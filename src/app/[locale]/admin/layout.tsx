import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/admin/global-search";
import { Link } from "@/i18n/navigation";

/**
 * Coquille admin : garde de route réelle (session + type d'utilisateur),
 * la redirection de `proxy.ts` n'étant qu'un confort (docs/security.md).
 * Le menu affiche uniquement les sections que l'utilisateur a le droit
 * d'ouvrir — la vérification de permission est de toute façon refaite dans
 * chaque page et chaque action serveur.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Le segment [locale] parent a déjà validé la langue (hasLocale + notFound
  // dans app/[locale]/layout.tsx) ; Next.js type ce paramètre en `string`
  // brut pour cette route (voir .next/types), d'où le recours à `Locale`
  // (use-intl) attendu par `redirect()` seulement au moment de l'appel.
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return redirect({ href: "/login", locale: locale as "fr" | "en" | "ar" });
  }
  // Un client authentifié qui atterrit ici (lien magique, favori...) va dans
  // son espace, pas un aller-retour vers /login qui le laisserait perplexe.
  if (currentUser.user.userType !== "STAFF" || currentUser.user.status !== "ACTIVE") {
    return redirect({ href: "/portal", locale: locale as "fr" | "en" | "ar" });
  }

  const t = await getTranslations("admin.nav");

  const permissions = {
    team: hasPermission(currentUser, "team.write"),
    settings: hasPermission(currentUser, "settings.write"),
    catalog: hasPermission(currentUser, "cms.write"),
    content: hasPermission(currentUser, "cms.write"),
    audit: hasPermission(currentUser, "audit.read"),
    crm: hasPermission(currentUser, "opportunity.read"),
    leads: hasPermission(currentUser, "lead.read"),
    clients: hasPermission(currentUser, "client.read"),
    quotes: hasPermission(currentUser, "quote.read"),
    projects: hasPermission(currentUser, "project.read"),
    invoices: hasPermission(currentUser, "invoice.read"),
    bookings: hasPermission(currentUser, "reservation.read"),
    transactions: hasPermission(currentUser, "transaction.read"),
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col justify-between border-e border-border bg-surface p-4">
        <div className="flex flex-col gap-6">
          <span className="px-3 text-lg font-semibold tracking-tight">
            <span className="text-brand-600">Saldae</span>
            <span className="text-foreground">Connect</span>
          </span>
          <AdminNav permissions={permissions} />
        </div>
        <div className="flex flex-col gap-3 px-3">
          <Link href="/" className="text-sm text-foreground/70 hover:text-foreground">
            {t("viewSite")}
          </Link>
          <div className="flex items-center justify-between">
            <SignOutButton />
            <LocaleSwitcher />
          </div>
        </div>
      </aside>
      <div className="flex-1 bg-surface-muted">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-center justify-end gap-3 text-sm text-foreground/70">
            <GlobalSearch />
            <NotificationBell />
            <span>
              {currentUser.user.name} · {currentUser.roles.join(", ")}
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
