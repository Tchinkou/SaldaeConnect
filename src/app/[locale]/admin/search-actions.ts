"use server";
import "server-only";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";

export type SearchResult = { category: string; id: string; label: string; sublabel?: string; href: string };

/**
 * Recherche globale (Cmd/Ctrl+K, §49). Pas de `defineAction` ici : lecture
 * seule, pas d'audit à écrire, et les permissions varient par catégorie de
 * résultat (chacune filtrée séparément) plutôt qu'une permission unique.
 */
export async function globalSearchAction(rawQuery: string): Promise<SearchResult[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.user.userType !== "STAFF" || currentUser.user.status !== "ACTIVE") return [];

  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const contains = { contains: query, mode: "insensitive" as const };
  const results: SearchResult[] = [];

  const tasks: Promise<void>[] = [];

  if (hasPermission(currentUser, "lead.read")) {
    tasks.push(
      prisma.lead
        .findMany({
          where: { deletedAt: null, OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { companyName: contains }] },
          take: 5,
        })
        .then((leads) => {
          for (const lead of leads) {
            results.push({ category: "leads", id: lead.id, label: `${lead.firstName} ${lead.lastName}`, sublabel: lead.email ?? undefined, href: `/admin/leads/${lead.id}` });
          }
        }),
    );
  }

  if (hasPermission(currentUser, "client.read")) {
    tasks.push(
      prisma.client
        .findMany({
          where: { deletedAt: null, OR: [{ displayName: contains }, { legalName: contains }, { email: contains }, { code: contains }] },
          take: 5,
        })
        .then((clients) => {
          for (const client of clients) {
            results.push({ category: "clients", id: client.id, label: client.displayName, sublabel: client.code, href: `/admin/clients/${client.id}` });
          }
        }),
    );
  }

  if (hasPermission(currentUser, "opportunity.read")) {
    tasks.push(
      prisma.opportunity
        .findMany({ where: { deletedAt: null, OR: [{ title: contains }, { number: contains }] }, take: 5 })
        .then((opportunities) => {
          for (const opportunity of opportunities) {
            results.push({ category: "opportunities", id: opportunity.id, label: opportunity.title, sublabel: opportunity.number, href: `/admin/crm/opportunities/${opportunity.id}` });
          }
        }),
    );
  }

  if (hasPermission(currentUser, "quote.read")) {
    tasks.push(
      prisma.quote.findMany({ where: { number: contains }, take: 5 }).then((quotes) => {
        for (const quote of quotes) {
          if (!quote.number) continue;
          results.push({ category: "quotes", id: quote.id, label: quote.number, href: `/admin/quotes/${quote.id}` });
        }
      }),
    );
  }

  if (hasPermission(currentUser, "invoice.read")) {
    tasks.push(
      prisma.invoice.findMany({ where: { number: contains }, take: 5 }).then((invoices) => {
        for (const invoice of invoices) {
          if (!invoice.number) continue;
          results.push({ category: "invoices", id: invoice.id, label: invoice.number, href: `/admin/invoices/${invoice.id}` });
        }
      }),
    );
  }

  if (hasPermission(currentUser, "project.read")) {
    tasks.push(
      prisma.project.findMany({ where: { deletedAt: null, name: contains }, take: 5 }).then((projects) => {
        for (const project of projects) {
          results.push({ category: "projects", id: project.id, label: project.name, href: `/admin/projects/${project.id}` });
        }
      }),
    );
  }

  await Promise.all(tasks);
  return results;
}
