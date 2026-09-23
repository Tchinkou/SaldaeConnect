"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function AdminNav({
  permissions,
}: {
  permissions: {
    team: boolean;
    settings: boolean;
    catalog: boolean;
    content: boolean;
    audit: boolean;
    crm: boolean;
    leads: boolean;
    clients: boolean;
    quotes: boolean;
    projects: boolean;
    invoices: boolean;
  };
}) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  const items = [
    { href: "/admin", label: t("dashboard"), show: true },
    { href: "/admin/crm", label: t("crm"), show: permissions.crm },
    { href: "/admin/leads", label: t("leads"), show: permissions.leads },
    { href: "/admin/clients", label: t("clients"), show: permissions.clients },
    { href: "/admin/quotes", label: t("quotes"), show: permissions.quotes },
    { href: "/admin/projects", label: t("projects"), show: permissions.projects },
    { href: "/admin/invoices", label: t("invoices"), show: permissions.invoices },
    { href: "/admin/team", label: t("team"), show: permissions.team },
    { href: "/admin/catalogue", label: t("catalog"), show: permissions.catalog },
    { href: "/admin/content", label: t("content"), show: permissions.content },
    { href: "/admin/settings", label: t("settings"), show: permissions.settings },
    { href: "/admin/audit", label: t("audit"), show: permissions.audit },
  ] as const;

  return (
    <nav className="flex flex-col gap-1">
      {items
        .filter((item) => item.show)
        .map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
