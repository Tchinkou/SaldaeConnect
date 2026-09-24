"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type Step = "password" | "verify";

/** Extrait le secret lisible (param `secret`) d'une URI `otpauth://` pour la saisie manuelle dans l'appli d'authentification. */
function extractSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? totpURI;
  } catch {
    return totpURI;
  }
}

export function TwoFactorSetupForm() {
  const t = useTranslations("auth.twoFactorSetup");
  const router = useRouter();

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
      issuer: "SaldaeConnect",
    });
    setIsSubmitting(false);

    if (enableError || !data || data.method !== "totp") {
      setError(t("errorEnable"));
      return;
    }

    setSecret(extractSecret(data.totpURI));
    setBackupCodes(data.backupCodes);
    setStep("verify");
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });
    setIsSubmitting(false);

    if (verifyError) {
      setError(t("errorInvalidCode"));
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  if (step === "password") {
    return (
      <form onSubmit={handleEnable} className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70">{t("passwordIntro")}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tfa-password" className="text-sm font-medium text-foreground">
            {t("currentPassword")}
          </label>
          <input
            id="tfa-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          {t("continue")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">{t("scanTitle")}</p>
        <p className="text-sm text-foreground/70">{t("scanHint")}</p>
        <code dir="ltr" className="break-all rounded-md border border-border bg-surface-muted px-3 py-2 text-sm tracking-wider">
          {secret}
        </code>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">{t("backupTitle")}</p>
        <p className="text-sm text-foreground/70">{t("backupHint")}</p>
        <ul dir="ltr" className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-muted p-3 font-mono text-sm">
          {backupCodes.map((backupCode) => (
            <li key={backupCode}>{backupCode}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tfa-code" className="text-sm font-medium text-foreground">
          {t("code")}
        </label>
        <input
          id="tfa-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-center text-lg tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
    </form>
  );
}
