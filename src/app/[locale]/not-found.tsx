import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("common.app");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-medium text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        {t("name")}
      </h1>
      <p className="mt-2 text-ink-500">Page introuvable.</p>
    </div>
  );
}
