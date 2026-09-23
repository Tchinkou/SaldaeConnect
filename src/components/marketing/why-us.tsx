import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";

const POINTS = ["local", "multilingual", "transparent", "durable"] as const;

export async function WhyUs() {
  const t = await getTranslations("public.home.whyUs");

  return (
    <section className="border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point) => (
            <Card key={point}>
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-foreground">{t(`points.${point}.title`)}</h3>
                <p className="mt-2 text-sm text-ink-500">{t(`points.${point}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
