"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magicLink">("password");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      rememberMe: true,
    });

    setIsSubmitting(false);

    if (signInError) {
      if (signInError.status === 429) {
        setError(t("errorTooManyRequests"));
      } else if (signInError.status === 401 || signInError.status === 400) {
        setError(t("errorInvalidCredentials"));
      } else {
        setError(t("errorGeneric"));
      }
      return;
    }

    const landing = data?.user?.userType === "CLIENT" ? "/portal" : "/admin";
    router.push((next && next.startsWith(`/${locale}${landing}`) ? next.slice(locale.length + 1) : landing) as "/admin");
    router.refresh();
  }

  async function handleMagicLinkSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // La destination réelle (/admin ou /portal) est déterminée après
    // vérification du lien, selon le type de compte (voir admin/layout.tsx) :
    // on ne peut pas le savoir avant, sans révéler si l'email existe.
    const { error: magicLinkError } = await authClient.signIn.magicLink({
      email,
      callbackURL: `/${locale}/admin`,
    });

    setIsSubmitting(false);

    if (magicLinkError) {
      setError(magicLinkError.status === 429 ? t("errorTooManyRequests") : t("errorGeneric"));
      return;
    }

    setMagicLinkSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {mode === "magicLink" ? (
          magicLinkSent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-foreground/80">{t("magicLinkSent")}</p>
              <button
                type="button"
                onClick={() => {
                  setMagicLinkSent(false);
                  setMode("password");
                }}
                className="text-center text-sm text-brand-600 hover:underline"
              >
                {t("passwordToggle")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="magic-link-email" className="text-sm font-medium text-foreground">
                  {t("email")}
                </label>
                <input
                  id="magic-link-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </div>

              {error ? (
                <p role="alert" className="text-sm text-danger-600">
                  {error}
                </p>
              ) : null}

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                {t("magicLinkSubmit")}
              </Button>

              <button type="button" onClick={() => setMode("password")} className="text-center text-sm text-brand-600 hover:underline">
                {t("passwordToggle")}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                {t("password")}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger-600">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              {t("submit")}
            </Button>

            <Link href="/forgot-password" className="text-center text-sm text-brand-600 hover:underline">
              {t("forgotPassword")}
            </Link>
            <button type="button" onClick={() => setMode("magicLink")} className="text-center text-sm text-brand-600 hover:underline">
              {t("magicLinkToggle")}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
