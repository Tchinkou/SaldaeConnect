import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";
import { ContactForm } from "@/app/[locale]/(public)/contact/contact-form";

interface ContactSetting {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const t = await getTranslations({ locale, namespace: "public.contact" });
  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/contact"]));

  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: {
      canonical: absoluteUrl(`/${locale}/contact`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  setRequestLocale(locale);
  const t = await getTranslations("public.contact");

  const contactSetting = await prisma.setting.findUnique({ where: { key: "contact" } });
  const contact = (contactSetting?.value ?? {}) as ContactSetting;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-balance text-ink-500">{t("subtitle")}</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <ContactForm />
              </CardContent>
            </Card>

            <div>
              <h2 className="text-sm font-semibold text-foreground">{t("infoTitle")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {contact.email ? (
                  <div>
                    <dd>
                      <a href={`mailto:${contact.email}`} dir="ltr" className="text-brand-600 hover:text-brand-700">
                        {contact.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {contact.phone ? (
                  <div>
                    <dd>
                      <a href={`tel:${contact.phone}`} dir="ltr" className="text-brand-600 hover:text-brand-700">
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {contact.city || contact.country ? (
                  <div>
                    <dd className="text-ink-500">{[contact.city, contact.country].filter(Boolean).join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
