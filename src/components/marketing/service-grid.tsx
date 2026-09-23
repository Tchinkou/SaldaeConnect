import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ArrowIcon } from "@/components/icons/arrow-icon";

export interface ServiceGridItem {
  slug: string;
  name: string;
  shortDescription: string | null;
}

export async function ServiceGrid({ services }: { services: ServiceGridItem[] }) {
  const t = await getTranslations("public.home.services");

  if (services.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
        {t("title")}
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Link key={service.slug} href={`/services/${service.slug}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <CardTitle>{service.name}</CardTitle>
                {service.shortDescription ? (
                  <p className="mt-2 text-sm text-ink-500">{service.shortDescription}</p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/services"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {t("viewAll")} <ArrowIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
