"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateSettingAction, type BrandSettingValue, type ThemeSettingValue } from "./actions";

export function BrandForm({
  initialBrand,
  initialTheme,
}: {
  initialBrand: BrandSettingValue;
  initialTheme: ThemeSettingValue;
}) {
  const t = useTranslations("admin.settings");

  const [brand, setBrand] = useState(initialBrand);
  const [colors, setColors] = useState(initialTheme.colors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const brandResult = await updateSettingAction({ key: "brand", value: brand });
    if (!brandResult.ok) {
      setIsSubmitting(false);
      setError(brandResult.error);
      return;
    }

    const themeResult = await updateSettingAction({
      key: "theme",
      value: { colors },
    });
    setIsSubmitting(false);

    if (!themeResult.ok) {
      setError(themeResult.error);
      return;
    }

    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand-name" className="text-sm font-medium text-foreground">
          {t("brand.name")}
        </label>
        <input
          id="brand-name"
          type="text"
          required
          value={brand.name}
          onChange={(event) => setBrand({ ...brand, name: event.target.value })}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>

      {(["fr", "en", "ar"] as const).map((locale) => (
        <div key={locale} className="flex flex-col gap-1.5">
          <label htmlFor={`brand-slogan-${locale}`} className="text-sm font-medium text-foreground">
            {t("brand.tagline")} ({locale.toUpperCase()})
          </label>
          <input
            id={`brand-slogan-${locale}`}
            type="text"
            dir={locale === "ar" ? "rtl" : "ltr"}
            value={brand.slogan[locale]}
            onChange={(event) => setBrand({ ...brand, slogan: { ...brand.slogan, [locale]: event.target.value } })}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="color-brand" className="text-sm font-medium text-foreground">
            {t("brand.primaryColor")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="color-brand"
              type="color"
              value={colors.brand}
              onChange={(event) => setColors({ ...colors, brand: event.target.value })}
              className="h-10 w-12 rounded-md border border-border bg-surface"
            />
            <span className="text-sm text-foreground/70">{colors.brand}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="color-accent" className="text-sm font-medium text-foreground">
            {t("brand.accentColor")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="color-accent"
              type="color"
              value={colors.accent}
              onChange={(event) => setColors({ ...colors, accent: event.target.value })}
              className="h-10 w-12 rounded-md border border-border bg-surface"
            />
            <span className="text-sm text-foreground/70">{colors.accent}</span>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-success-600">{t("saved")}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
