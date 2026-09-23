"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Conduit vers la page équivalente dans l'autre langue (même route),
 * conformément à §G.1. `usePathname`/`useRouter` de next-intl gèrent déjà le
 * préfixe de langue.
 */
export function LocaleSwitcher() {
  const t = useTranslations("common.localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-1">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
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
      ))}
    </div>
  );
}
