"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { resendInvitationAction } from "./actions";

export function ResendButton({ invitationId }: { invitationId: string }) {
  const t = useTranslations("admin.team");
  const locale = useLocale() as "fr" | "en" | "ar";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setIsSubmitting(true);
    await resendInvitationAction({ invitationId, locale });
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" isLoading={isSubmitting} onClick={handleClick}>
      {t("resend")}
    </Button>
  );
}
