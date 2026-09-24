import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/server/core/db/client";

interface ContactSetting {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  country?: string | null;
}

const LEGAL_PAGE_KEYS = ["legal-notice", "privacy", "terms", "cookies"] as const;

export async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const tNav = await getTranslations("common.nav");
  const year = new Date().getFullYear();

  const [contactSetting, legalTranslations] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "contact" } }),
    prisma.pageTranslation.findMany({
      where: { locale, isPublished: true, parent: { key: { in: [...LEGAL_PAGE_KEYS] } } },
      select: { title: true, slug: true, parent: { select: { key: true } } },
    }),
  ]);
  const contact = (contactSetting?.value ?? {}) as ContactSetting;

  return (
    <footer className="border-t border-border">
      {/* 4 colonnes serrées à `md` (768px) débordaient horizontalement
          (contact email/téléphone en dir="ltr" non coupable) — bascule à
          `lg`, avec un palier à 2 colonnes en tablette. */}
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-brand-600">Saldae</span>
            <span className="text-foreground">Connect</span>
          </span>
        </div>

        <nav aria-label={t("footer.navTitle")}>
          <h2 className="text-sm font-semibold text-foreground">{t("footer.navTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            <li><Link href="/services" className="hover:text-foreground">{tNav("services")}</Link></li>
            <li><Link href="/portfolio" className="hover:text-foreground">{tNav("portfolio")}</Link></li>
            <li><Link href="/about" className="hover:text-foreground">{tNav("about")}</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">{tNav("contact")}</Link></li>
          </ul>
        </nav>

        <nav aria-label={t("footer.legalTitle")}>
          <h2 className="text-sm font-semibold text-foreground">{t("footer.legalTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            {legalTranslations.length === 0 ? (
              <li className="text-ink-300">—</li>
            ) : (
              legalTranslations.map((page) => (
                <li key={page.parent.key}>
                  <Link href={`/legal/${page.slug}`} className="hover:text-foreground">
                    {page.title}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("footer.contactTitle")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            {contact.email ? (
              <li>
                <a href={`mailto:${contact.email}`} dir="ltr" className="hover:text-foreground">
                  {contact.email}
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a href={`tel:${contact.phone}`} dir="ltr" className="hover:text-foreground">
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.city ? <li>{contact.city}</li> : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-500 sm:px-6">
          © {year} SaldaeConnect — {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
