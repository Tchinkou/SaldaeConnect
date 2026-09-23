import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export function Header() {
  const t = useTranslations("common.app");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-brand-600">Saldae</span>
          <span className="text-foreground">Connect</span>
          <span className="sr-only"> — {t("name")}</span>
        </span>
        <LocaleSwitcher />
      </div>
    </header>
  );
}
