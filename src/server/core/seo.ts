import "server-only";
import { env } from "@/server/core/env";
import { routing, type AppLocale } from "@/i18n/routing";

/** URL absolue à partir d'un chemin préfixé par la langue (`/fr/services`, `/en`, …). */
export function absoluteUrl(pathWithLocale: string): string {
  return new URL(pathWithLocale, env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * Construit les alternates `languages` pour `generateMetadata` (§G.4) : une
 * entrée par langue où la page existe réellement (traduction publiée),
 * plus `x-default` vers le français. Les langues absentes de `pathByLocale`
 * ne sont pas incluses — pas de lien `hreflang` vers une page qui 404.
 */
export function buildLanguageAlternates(
  pathByLocale: Partial<Record<AppLocale, string>>,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    const path = pathByLocale[locale];
    if (path) {
      languages[locale] = absoluteUrl(`/${locale}${path}`);
    }
  }
  if (pathByLocale[routing.defaultLocale]) {
    languages["x-default"] = absoluteUrl(`/${routing.defaultLocale}${pathByLocale[routing.defaultLocale]}`);
  }
  return languages;
}
