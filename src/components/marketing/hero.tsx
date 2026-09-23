import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export async function Hero() {
  const t = await getTranslations("public.home.hero");

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-balance text-ink-500">{t("subtitle")}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/quote" className={buttonVariants({ size: "lg" })}>
          {t("ctaPrimary")}
        </Link>
        <Link href="/services" className={buttonVariants({ size: "lg", variant: "secondary" })}>
          {t("ctaSecondary")}
        </Link>
      </div>
    </section>
  );
}
