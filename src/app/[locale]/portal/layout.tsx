import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PortalSignOutButton } from "@/components/portal/portal-sign-out-button";
import { PortalNav } from "@/components/portal/portal-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Link } from "@/i18n/navigation";

/**
 * Coquille du portail client (§D.9, `PortalShell`) : garde de route réelle
 * (session + type d'utilisateur), symétrique à `admin/layout.tsx`. Un membre
 * du staff qui atterrit ici (lien copié, favori...) est renvoyé vers
 * `/admin`, pas laissé bloqué sur une page qui ne le concerne pas.
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return redirect({ href: "/login", locale: locale as "fr" | "en" | "ar" });
  }
  if (currentUser.user.userType !== "CLIENT" || currentUser.user.status !== "ACTIVE") {
    return redirect({ href: "/admin", locale: locale as "fr" | "en" | "ar" });
  }

  const contact = await prisma.clientContact.findUnique({
    where: { userId: currentUser.user.id },
    include: { client: true },
  });

  if (!contact) {
    return redirect({ href: "/login", locale: locale as "fr" | "en" | "ar" });
  }

  const t = await getTranslations("portal.nav");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col justify-between border-e border-border bg-surface p-4">
        <div className="flex flex-col gap-6">
          <Link href="/portal" className="px-3 text-lg font-semibold tracking-tight">
            <span className="text-brand-600">Saldae</span>
            <span className="text-foreground">Connect</span>
          </Link>
          <PortalNav />
        </div>
        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-center justify-between">
            <PortalSignOutButton label={t("signOut")} />
            <LocaleSwitcher />
          </div>
        </div>
      </aside>
      {/* min-w-0 : même correctif que admin/layout.tsx — un enfant flex-1
          ne rétrécit pas sous la largeur intrinsèque de son contenu par
          défaut, ce qui élargissait toute la page au lieu de laisser un
          contenu large défiler dans son propre conteneur. */}
      <div className="min-w-0 flex-1 bg-surface-muted">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-center justify-end gap-3 text-sm text-foreground/70">
            <NotificationBell />
            <span className="min-w-0 truncate">{contact.client.displayName}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
