"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Conduit vers la page équivalente dans l'autre langue, conformément à
 * §G.1 : même route pour les pages sans slug de contenu ; pour une page à
 * slug traduit (service, réalisation…), le composant appelant fournit
 * `alternates` (le chemin exact dans chaque langue où la traduction existe)
 * et `fallback` (la page parente à utiliser si elle n'existe pas encore
 * dans la langue choisie).
 */
export function LocaleSwitcher({
  alternates,
  fallback,
}: {
  alternates?: Partial<Record<AppLocale, string>>;
  fallback?: string;
}) {
  const t = useTranslations("common.localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-1">
      {routing.locales.map((loc) => {
        const target = alternates ? (alternates[loc] ?? fallback ?? "/") : pathname;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => router.replace(target, { locale: loc })}
            aria-current={loc === locale ? "true" : undefined}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium uppercase transition-colors",
              loc === locale
                ? "bg-brand-100 text-brand-700"
                : "text-ink-500 hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}
