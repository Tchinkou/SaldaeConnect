import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Espaces de noms de traduction chargés pour chaque requête. Une page ne
 * charge que ce dont elle a besoin serait plus fin par route, mais pour
 * l'instant (phase 1) chaque surface a son propre fichier ; on les fusionne
 * ici. Voir docs/i18n.md.
 */
const NAMESPACES = ["common", "public", "auth", "admin", "portal"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const modules = await Promise.all(
    NAMESPACES.map((namespace) => import(`../../messages/${locale}/${namespace}.json`)),
  );

  const messages = Object.fromEntries(
    NAMESPACES.map((namespace, index) => [namespace, modules[index].default]),
  );

  return { locale, messages };
});
