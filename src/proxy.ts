import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

/**
 * Dans Next.js 16, `middleware.ts` est renommé `proxy.ts` (voir la note
 * AGENTS.md générée par Next et docs/architecture.md §A.3). Résolution de la
 * langue, puis redirection de confort vers /login pour /admin sans cookie de
 * session — une simple présence de cookie, pas une vérification de session
 * (impossible ici, l'Edge n'a pas accès à Prisma). L'autorisation réelle
 * (session valide, type d'utilisateur, permissions) est toujours vérifiée
 * côté serveur dans `src/app/[locale]/admin/layout.tsx` (docs/security.md).
 *
 * Le nom exact du cookie de session (préfixe `__Host-`, §H.2) doit rester
 * synchronisé avec `advanced.cookies.session_token.name` dans
 * `src/server/core/auth/auth.ts` — l'utilitaire `getSessionCookie` de
 * Better Auth ne connaît pas ce préfixe (il ne gère que `__Secure-`), d'où
 * la vérification directe ci-dessous plutôt que cet utilitaire.
 */
const SESSION_COOKIE_NAME = "__Host-saldaeconnect.session_token";

const intlProxy = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = routing.locales.find(
    (candidate) => pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`),
  );

  if (locale && pathname.startsWith(`/${locale}/admin`)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlProxy(request);
}

export const config = {
  // Toutes les routes sauf les assets Next.js, les fichiers statiques et les
  // routes API (qui gèrent leur propre authentification).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
