"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    await authClient.requestPasswordReset({
      email,
      redirectTo: `/${locale}/reset-password`,
    });

    // Toujours le même message, que le compte existe ou non (§H.2 : ne pas
    // révéler si une adresse email est enregistrée).
    setIsSubmitting(false);
    setIsSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {isSent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground">{t("success")}</p>
            <Link href="/login" className="text-center text-sm text-brand-600 hover:underline">
              {t("backToLogin")}
            </Link>
          </div>
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
            <Button type="submit" isLoading={isSubmitting} className="w-full">
              {t("submit")}
            </Button>
            <Link href="/login" className="text-center text-sm text-brand-600 hover:underline">
              {t("backToLogin")}
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
