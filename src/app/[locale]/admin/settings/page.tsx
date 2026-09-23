import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { BrandForm } from "./brand-form";
import { ContactForm } from "./contact-form";
import { SocialForm } from "./social-form";
import { TaxRatesForm } from "./tax-rates-form";
import { PaymentMethodsForm } from "./payment-methods-form";
import type { BrandSettingValue, ThemeSettingValue, ContactSettingValue, SocialSettingValue } from "./actions";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "settings.write")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.settings");

  const [settings, taxRates, paymentMethods] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: ["brand", "theme", "contact", "social"] } } }),
    prisma.taxRate.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ orderBy: { key: "asc" }, include: { translations: true } }),
  ]);
  const byKey = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("brand.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandForm
            initialBrand={byKey.brand as unknown as BrandSettingValue}
            initialTheme={byKey.theme as unknown as ThemeSettingValue}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("contact.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm initial={byKey.contact as unknown as ContactSettingValue} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("social.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialForm initial={byKey.social as unknown as SocialSettingValue} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("taxRates.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TaxRatesForm
            rates={taxRates.map((rate) => ({
              id: rate.id,
              name: rate.name,
              ratePercent: rate.ratePercent.toString(),
              legalMentionFr: rate.legalMentionFr,
              legalMentionEn: rate.legalMentionEn,
              legalMentionAr: rate.legalMentionAr,
              isDefault: rate.isDefault,
              isActive: rate.isActive,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentMethods.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodsForm
            methods={paymentMethods.map((method) => ({
              id: method.id,
              key: method.key,
              isActive: method.isActive,
              translations: {
                fr: method.translations.find((tr) => tr.locale === "fr")?.name ?? "",
                en: method.translations.find((tr) => tr.locale === "en")?.name ?? "",
                ar: method.translations.find((tr) => tr.locale === "ar")?.name ?? "",
              },
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
