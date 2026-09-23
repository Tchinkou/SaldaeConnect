import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/server/core/env";
import { runQuotesExpireJob } from "@/server/core/cron/quotes-expire";
import { runInvoicesOverdueJob } from "@/server/core/cron/invoices-overdue";

/**
 * Point d'entrée cron unique (§A.2, `/api/cron/[job]/route.ts`), protégé par
 * `CRON_SECRET` — appelé toutes les minutes par Vercel Cron, Railway Cron ou
 * un timer système sur VPS. En `GET` : Vercel Cron n'émet que des requêtes
 * `GET`, ce qui contraint le choix de méthode pour rester compatible avec
 * les deux profils d'hébergement documentés dans `deployment.md`.
 */
const JOBS: Record<string, () => Promise<unknown>> = {
  "quotes-expire": runQuotesExpireJob,
  "invoices-overdue": runInvoicesOverdueJob,
};

function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(env.CRON_SECRET);
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!isAuthorized(request)) {
    return new NextResponse(null, { status: 401 });
  }

  const { job } = await params;
  const handler = JOBS[job];
  if (!handler) {
    return new NextResponse(null, { status: 404 });
  }

  const result = await handler();
  return NextResponse.json({ ok: true, job, result });
}
