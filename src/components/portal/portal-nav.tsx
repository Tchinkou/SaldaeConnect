"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function PortalNav() {
  const t = useTranslations("portal.nav");
  const pathname = usePathname();

  const items = [
    { href: "/portal", label: t("dashboard") },
    { href: "/portal/projects", label: t("projects") },
    { href: "/portal/quotes", label: t("quotes") },
    { href: "/portal/invoices", label: t("invoices") },
    { href: "/portal/reservations", label: t("reservations") },
    { href: "/portal/documents", label: t("documents") },
    { href: "/portal/messages", label: t("messages") },
    { href: "/portal/profile", label: t("profile") },
    { href: "/portal/settings", label: t("settings") },
  ] as const;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-100 text-brand-700"
                : "text-foreground/70 hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
