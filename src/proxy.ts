import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Dans Next.js 16, `middleware.ts` est renommé `proxy.ts` (voir la note
 * AGENTS.md générée par Next et docs/architecture.md §A.3). Ce fichier gère
 * pour l'instant uniquement la résolution de la langue ; les phases
 * suivantes y ajouteront la protection de /admin et /portal (redirection de
 * confort — l'autorisation réelle est toujours vérifiée côté serveur, voir
 * docs/security.md).
 */
const intlProxy = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return intlProxy(request);
}

export const config = {
  // Toutes les routes sauf les assets Next.js, les fichiers statiques et les
  // routes API (qui gèrent leur propre authentification).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
