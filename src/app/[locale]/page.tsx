import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { CheckIcon } from "@/components/icons/check-icon";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("public.home");
  const checklistItems = ["i18n", "rtl", "designSystem", "fonts"] as const;

  return (
    <div className="flex flex-1 flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <Badge tone="brand" className="mb-6">
            {t("badge")}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-ink-500">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg">{t("ctaPrimary")}</Button>
            <Button size="lg" variant="secondary">
              {t("ctaSecondary")}
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-sm font-semibold text-ink-500">
                {t("checklistTitle")}
              </h2>
              <ul className="mt-4 space-y-3">
                {checklistItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
                    <span className="text-sm text-foreground">
                      {t(`checklist.${item}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-ink-500">{t("comingSoon")}</p>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
