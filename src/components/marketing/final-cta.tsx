import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export async function FinalCta() {
  const t = await getTranslations("public.home.finalCta");

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
      <p className="mx-auto mt-3 max-w-xl text-balance text-ink-500">{t("subtitle")}</p>
      <div className="mt-8">
        <Link href="/quote" className={buttonVariants({ size: "lg" })}>
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
