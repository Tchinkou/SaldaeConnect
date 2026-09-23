import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PortalSignOutButton } from "@/components/portal/portal-sign-out-button";
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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-8">
        <Link href="/portal" className="text-lg font-semibold tracking-tight">
          <span className="text-brand-600">Saldae</span>
          <span className="text-foreground">Connect</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground/70">{contact.client.displayName}</span>
          <PortalSignOutButton label={t("signOut")} />
          <LocaleSwitcher />
        </div>
      </header>
      <div className="flex-1 bg-surface-muted">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
