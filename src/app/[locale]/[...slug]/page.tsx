import type { Route } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/server/core/db/client";

/**
 * Route de repli pour toute URL qui ne correspond à aucune page (§49
 * "redirections") — n'est atteinte qu'après que Next.js a écarté toutes les
 * routes littérales/dynamiques, donc sans impact sur elles. `proxy.ts`
 * (Edge, sans Prisma — voir son commentaire) ne peut pas faire cette
 * résolution ; elle se fait ici, côté Node. 301 → `permanentRedirect`
 * (308, l'équivalent moderne) ; tout le reste → `redirect` (307).
 */
export default async function CatchAllPage({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { slug } = await params;
  const fromPath = `/${slug.join("/")}`;

  const entry = await prisma.redirect.findUnique({ where: { fromPath } });
  if (!entry) notFound();

  await prisma.redirect.update({ where: { id: entry.id }, data: { hits: { increment: 1 } } });

  const toPath = entry.toPath as Route;
  if (entry.statusCode === 301) permanentRedirect(toPath);
  redirect(toPath);
}
