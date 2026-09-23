import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { buttonVariants } from "@/components/ui/button";

const NAV_ITEMS = ["services", "portfolio", "about", "contact"] as const;

export function Header({
  localeAlternates,
  localeFallback,
}: {
  /** Chemin équivalent (sans préfixe de langue) dans chaque langue, pour les pages à slug traduit (§G.1). */
  localeAlternates?: Partial<Record<AppLocale, string>>;
  /** Page de repli si la traduction courante n'existe pas dans la langue choisie. */
  localeFallback?: string;
}) {
  const t = useTranslations("common.nav");
  const tApp = useTranslations("common.app");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          <span className="text-brand-600">Saldae</span>
          <span className="text-foreground">Connect</span>
          <span className="sr-only"> — {tApp("name")}</span>
        </Link>

        <nav aria-label={t("menu")} className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item}
              href={`/${item}`}
              className="text-sm font-medium text-ink-700 transition-colors hover:text-foreground"
            >
              {t(item)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-ink-500 hover:text-foreground">
            {t("login")}
          </Link>
          <LocaleSwitcher alternates={localeAlternates} fallback={localeFallback} />
          <Link href="/quote" className={buttonVariants({ size: "sm" })}>
            {t("cta")}
          </Link>
        </div>

        {/* Menu mobile sans JavaScript (`<details>`) : pas de coût de bundle pour un usage occasionnel. */}
        <details className="group relative md:hidden">
          <summary
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-border text-foreground [&::-webkit-details-marker]:hidden"
            aria-label={t("menu")}
          >
            <span className="sr-only">{t("menu")}</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <div className="absolute end-0 top-12 z-50 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item}
                  href={`/${item}`}
                  className="rounded-md px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface-muted hover:text-foreground"
                >
                  {t(item)}
                </Link>
              ))}
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-500 hover:bg-surface-muted hover:text-foreground"
              >
                {t("login")}
              </Link>
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <LocaleSwitcher alternates={localeAlternates} fallback={localeFallback} />
            </div>
            <Link href="/quote" className={buttonVariants({ size: "sm", className: "mt-3 w-full" })}>
              {t("cta")}
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
