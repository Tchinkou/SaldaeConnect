import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-brand-600">Saldae</span>
          <span className="text-foreground">Connect</span>
        </span>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
