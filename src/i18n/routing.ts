import { defineRouting } from "next-intl/routing";

/**
 * Langues de SaldaeConnect. Le préfixe de langue est toujours présent dans
 * l'URL (`/fr/…`, `/en/…`, `/ar/…`), y compris pour le français par défaut,
 * pour que chaque page ait une URL stable et indexable (§25).
 */
export const routing = defineRouting({
  locales: ["fr", "en", "ar"],
  defaultLocale: "fr",
  localePrefix: "always",
  localeCookie: {
    name: "saldaeconnect_locale",
  },
});

export type AppLocale = (typeof routing.locales)[number];

/** Sens d'écriture de chaque langue — utilisé pour `<html dir>` (§24, §G.6). */
export const localeDirection: Record<AppLocale, "ltr" | "rtl"> = {
  fr: "ltr",
  en: "ltr",
  ar: "rtl",
};
