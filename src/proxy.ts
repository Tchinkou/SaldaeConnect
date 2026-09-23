import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "@/i18n/routing";

/**
 * Dans Next.js 16, `middleware.ts` est renommé `proxy.ts` (voir la note
 * AGENTS.md générée par Next et docs/architecture.md §A.3). Résolution de la
 * langue, puis redirection de confort vers /login pour /admin sans cookie de
 * session — une simple présence de cookie, pas une vérification de session
 * (impossible ici, l'Edge n'a pas accès à Prisma). L'autorisation réelle
 * (session valide, type d'utilisateur, permissions) est toujours vérifiée
 * côté serveur dans `src/app/[locale]/admin/layout.tsx` (docs/security.md).
 */
const intlProxy = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = routing.locales.find(
    (candidate) => pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`),
  );

  if (locale && pathname.startsWith(`/${locale}/admin`)) {
    const sessionCookie = getSessionCookie(request, { cookiePrefix: "saldaeconnect" });
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
