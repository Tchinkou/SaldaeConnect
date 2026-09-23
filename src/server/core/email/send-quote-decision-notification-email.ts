import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

/**
 * Email envoyé au staff (propriétaire du client) lors d'une décision client
 * sur un devis (§F.3) — accepté, refusé, ou modification demandée. La
 * notification in-app (`createNotifications`) est immédiate ; cet email
 * s'assure que le staff est prévenu même hors ligne, en particulier pour une
 * demande de modification qui appelle une action de sa part.
 */
const COPY = {
  fr: {
    subject: (number: string, decision: string) => `Devis ${number} : ${decision}`,
    heading: "Décision du client sur un devis",
    body: (number: string, clientName: string, decisionLabel: string) =>
      `${clientName} a répondu au devis ${number} : ${decisionLabel}.`,
    cta: "Voir le devis",
    decisions: { ACCEPTED: "accepté", REJECTED: "refusé", CHANGES_REQUESTED: "modification demandée" },
  },
  en: {
    subject: (number: string, decision: string) => `Quote ${number}: ${decision}`,
    heading: "Client decision on a quote",
    body: (number: string, clientName: string, decisionLabel: string) =>
      `${clientName} responded to quote ${number}: ${decisionLabel}.`,
    cta: "View the quote",
    decisions: { ACCEPTED: "accepted", REJECTED: "declined", CHANGES_REQUESTED: "changes requested" },
  },
  ar: {
    subject: (number: string, decision: string) => `عرض السعر ${number}: ${decision}`,
    heading: "قرار العميل بشأن عرض سعر",
    body: (number: string, clientName: string, decisionLabel: string) =>
      `رد ${clientName} على عرض السعر ${number}: ${decisionLabel}.`,
    cta: "عرض عرض السعر",
    decisions: { ACCEPTED: "مقبول", REJECTED: "مرفوض", CHANGES_REQUESTED: "طلب تعديل" },
  },
} as const;

export async function sendQuoteDecisionNotificationEmail({
  to,
  quoteNumber,
  clientName,
  decision,
  crmUrl,
  locale,
}: {
  to: string;
  quoteNumber: string;
  clientName: string;
  decision: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";
  crmUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const decisionLabel = copy.decisions[decision];
  const body = copy.body(quoteNumber, clientName, decisionLabel);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${crmUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(quoteNumber, decisionLabel),
    html,
    text: `${copy.heading}\n\n${body}\n\n${crmUrl}`,
    tag: `quote.decision_notification.${decision.toLowerCase()}`,
  });
}
