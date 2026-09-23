"use server";
import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { definePortalAction } from "@/server/core/portal-action";
import { prisma } from "@/server/core/db/client";
import { env } from "@/server/core/env";
import { ValidationError } from "@/server/core/errors";
import { nextNumber } from "@/server/core/numbering";
import { recordActivity } from "@/server/core/crm/timeline";
import { advanceOpportunityStage } from "@/server/core/crm/stage";
import { resolveQuoteRecipients } from "@/server/core/quotes/notify";
import { createNotifications } from "@/server/core/notify-admins";
import { sendQuoteAcceptedConfirmationEmail } from "@/server/core/email/send-quote-accepted-confirmation-email";
import { sendQuoteDecisionNotificationEmail } from "@/server/core/email/send-quote-decision-notification-email";

/**
 * Charge un devis pour décision côté portail : doit appartenir au client de
 * la session (`ctx.clientId`, déjà résolu par `definePortalAction`) et être
 * encore dans un état où une décision a du sens (§F.3) — un devis en
 * brouillon n'a jamais été envoyé, un devis déjà décidé/expiré/annulé ne
 * peut pas recevoir une seconde décision.
 */
async function loadDecidableQuoteForClient(tx: Prisma.TransactionClient, clientId: string, quoteId: string) {
  const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { client: true, opportunity: true } });
  if (!quote || quote.clientId !== clientId) throw new ValidationError("Devis introuvable.");
  if (quote.status !== "SENT" && quote.status !== "VIEWED") {
    throw new ValidationError("Ce devis ne peut plus faire l'objet d'une décision.");
  }
  if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
    throw new ValidationError("Ce devis a expiré.");
  }

  const version = await tx.quoteVersion.findFirst({ where: { quoteId: quote.id }, orderBy: { version: "desc" } });
  if (!version) throw new ValidationError("Aucune version envoyée pour ce devis.");

  return { quote, version };
}

const acceptQuoteSchema = z.object({
  quoteId: z.string().min(1),
  signerName: z.string().trim().min(1).max(200),
});

/**
 * Acceptation d'un devis par le client (§F.3) — transaction tout-ou-rien :
 * devis → ACCEPTED, client PROSPECT → ACTIVE, projet créé (budget = total du
 * devis), jalons créés depuis les échéances du devis, opportunité avancée à
 * l'étape "accepted", décision enregistrée avec preuve (nom saisi, IP,
 * user-agent, méthode CLICK — §D.9). N'inclut délibérément PAS la création
 * d'un Subscription : aucune interface n'existe encore pour configurer la
 * cadence de facturation récurrente d'une ligne de devis (voir rapport de
 * phase 5).
 */
export const acceptQuoteAction = definePortalAction({
  schema: acceptQuoteSchema,
  audit: {
    category: "BUSINESS",
    action: "quote.accept",
    entityType: "Quote",
    entityId: (input) => input.quoteId,
  },
  handler: async (input, ctx) => {
    const outcome = await prisma.$transaction(async (tx) => {
      const { quote, version } = await loadDecidableQuoteForClient(tx, ctx.clientId, input.quoteId);

      await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED", decidedAt: new Date() } });

      const client = await tx.client.update({ where: { id: quote.clientId }, data: { status: "ACTIVE" } });

      const projectNumber = await nextNumber(tx, "PROJECT");
      const project = await tx.project.create({
        data: {
          number: projectNumber,
          clientId: quote.clientId,
          quoteId: quote.id,
          opportunityId: quote.opportunityId,
          name: quote.title,
          description: quote.introduction,
          budget: quote.total,
          currency: quote.currency,
          managerId: quote.opportunity?.ownerId ?? client.ownerId ?? null,
        },
      });

      const installments = await tx.quoteInstallment.findMany({
        where: { quoteId: quote.id },
        orderBy: { position: "asc" },
      });
      if (installments.length > 0) {
        await tx.milestone.createMany({
          data: installments.map((installment, index) => ({
            projectId: project.id,
            title: installment.label,
            dueDate: installment.dueDate,
            position: index,
          })),
        });
      }

      if (quote.opportunityId) {
        await advanceOpportunityStage(tx, quote.opportunityId, "accepted", null);
      }

      await tx.quoteDecision.create({
        data: {
          quoteId: quote.id,
          quoteVersionId: version.id,
          decision: "ACCEPTED",
          userId: ctx.user.user.id,
          signerName: input.signerName,
          signerEmail: ctx.user.user.email,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          method: "CLICK",
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Devis accepté par le client",
        body: `Signé par ${input.signerName}. Projet ${project.number} créé.`,
        clientId: quote.clientId,
        opportunityId: quote.opportunityId ?? undefined,
        projectId: project.id,
        quoteId: quote.id,
      });

      const recipients = await resolveQuoteRecipients(tx, client.ownerId);
      await createNotifications(
        recipients,
        "quote.accepted",
        { quoteId: quote.id, quoteNumber: quote.number, clientName: client.displayName },
        `/admin/quotes/${quote.id}`,
      );

      return { quote, client, project, recipients };
    });

    await Promise.all([
      ...outcome.recipients.map((recipient) =>
        sendQuoteDecisionNotificationEmail({
          to: recipient.email,
          quoteNumber: outcome.quote.number ?? outcome.quote.id,
          clientName: outcome.client.displayName,
          decision: "ACCEPTED",
          crmUrl: `${env.NEXT_PUBLIC_APP_URL}/${recipient.locale}/admin/quotes/${outcome.quote.id}`,
          locale: recipient.locale,
        }),
      ),
      ctx.user.user.email
        ? sendQuoteAcceptedConfirmationEmail({
            to: ctx.user.user.email,
            quoteNumber: outcome.quote.number ?? outcome.quote.id,
            projectNumber: outcome.project.number,
            portalUrl: `${env.NEXT_PUBLIC_APP_URL}/${outcome.quote.locale}/portal/quotes/${outcome.quote.id}`,
            locale: outcome.quote.locale,
          })
        : null,
    ]);

    return { quoteId: outcome.quote.id, projectId: outcome.project.id };
  },
});

const rejectQuoteSchema = z.object({
  quoteId: z.string().min(1),
  reason: z.string().trim().max(2000).nullable().optional(),
});

export const rejectQuoteAction = definePortalAction({
  schema: rejectQuoteSchema,
  audit: {
    category: "BUSINESS",
    action: "quote.reject",
    entityType: "Quote",
    entityId: (input) => input.quoteId,
  },
  handler: async (input, ctx) => {
    const outcome = await prisma.$transaction(async (tx) => {
      const { quote, version } = await loadDecidableQuoteForClient(tx, ctx.clientId, input.quoteId);

      await tx.quote.update({ where: { id: quote.id }, data: { status: "REJECTED", decidedAt: new Date() } });

      await tx.quoteDecision.create({
        data: {
          quoteId: quote.id,
          quoteVersionId: version.id,
          decision: "REJECTED",
          comment: input.reason || null,
          userId: ctx.user.user.id,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          method: "CLICK",
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Devis refusé par le client",
        body: input.reason || undefined,
        clientId: quote.clientId,
        opportunityId: quote.opportunityId ?? undefined,
        quoteId: quote.id,
      });

      const recipients = await resolveQuoteRecipients(tx, quote.client.ownerId);
      await createNotifications(
        recipients,
        "quote.rejected",
        { quoteId: quote.id, quoteNumber: quote.number, clientName: quote.client.displayName },
        `/admin/quotes/${quote.id}`,
      );

      return { quote, client: quote.client, recipients };
    });

    await Promise.all(
      outcome.recipients.map((recipient) =>
        sendQuoteDecisionNotificationEmail({
          to: recipient.email,
          quoteNumber: outcome.quote.number ?? outcome.quote.id,
          clientName: outcome.client.displayName,
          decision: "REJECTED",
          crmUrl: `${env.NEXT_PUBLIC_APP_URL}/${recipient.locale}/admin/quotes/${outcome.quote.id}`,
          locale: recipient.locale,
        }),
      ),
    );

    return { quoteId: outcome.quote.id };
  },
});

const requestQuoteChangesSchema = z.object({
  quoteId: z.string().min(1),
  comment: z.string().trim().min(1).max(2000),
});

export const requestQuoteChangesAction = definePortalAction({
  schema: requestQuoteChangesSchema,
  audit: {
    category: "BUSINESS",
    action: "quote.request_changes",
    entityType: "Quote",
    entityId: (input) => input.quoteId,
  },
  handler: async (input, ctx) => {
    const outcome = await prisma.$transaction(async (tx) => {
      const { quote, version } = await loadDecidableQuoteForClient(tx, ctx.clientId, input.quoteId);

      await tx.quote.update({ where: { id: quote.id }, data: { status: "CHANGES_REQUESTED", decidedAt: new Date() } });

      await tx.quoteDecision.create({
        data: {
          quoteId: quote.id,
          quoteVersionId: version.id,
          decision: "CHANGES_REQUESTED",
          comment: input.comment,
          userId: ctx.user.user.id,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          method: "CLICK",
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Modification demandée par le client",
        body: input.comment,
        clientId: quote.clientId,
        opportunityId: quote.opportunityId ?? undefined,
        quoteId: quote.id,
      });

      const recipients = await resolveQuoteRecipients(tx, quote.client.ownerId);
      await createNotifications(
        recipients,
        "quote.changes_requested",
        { quoteId: quote.id, quoteNumber: quote.number, clientName: quote.client.displayName },
        `/admin/quotes/${quote.id}`,
      );

      return { quote, client: quote.client, recipients };
    });

    await Promise.all(
      outcome.recipients.map((recipient) =>
        sendQuoteDecisionNotificationEmail({
          to: recipient.email,
          quoteNumber: outcome.quote.number ?? outcome.quote.id,
          clientName: outcome.client.displayName,
          decision: "CHANGES_REQUESTED",
          crmUrl: `${env.NEXT_PUBLIC_APP_URL}/${recipient.locale}/admin/quotes/${outcome.quote.id}`,
          locale: recipient.locale,
        }),
      ),
    );

    return { quoteId: outcome.quote.id };
  },
});
