import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const COPY = {
  fr: {
    subject: "Réinitialisation de votre mot de passe SaldaeConnect",
    heading: "Réinitialiser votre mot de passe",
    body: "Une demande de réinitialisation de mot de passe a été effectuée pour ce compte. Ce lien est valable 1 heure.",
    cta: "Choisir un nouveau mot de passe",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, votre mot de passe reste inchangé : ignorez cet email.",
  },
  en: {
    subject: "Reset your SaldaeConnect password",
    heading: "Reset your password",
    body: "A password reset was requested for this account. This link is valid for 1 hour.",
    cta: "Choose a new password",
    ignore: "If you didn't request this, your password stays unchanged — ignore this email.",
  },
  ar: {
    subject: "إعادة تعيين كلمة المرور الخاصة بك في SaldaeConnect",
    heading: "إعادة تعيين كلمة المرور",
    body: "تم تقديم طلب لإعادة تعيين كلمة المرور لهذا الحساب. هذا الرابط صالح لمدة ساعة واحدة.",
    cta: "اختيار كلمة مرور جديدة",
    ignore: "إذا لم تطلب هذا، تبقى كلمة مرورك دون تغيير، يمكنك تجاهل هذه الرسالة.",
  },
} as const;

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  locale,
}: {
  to: string;
  resetUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${copy.body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
      <p style="color:#9CA3AF;font-size:13px;">${copy.ignore}</p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject,
    html,
    text: `${copy.heading}\n\n${copy.body}\n\n${resetUrl}\n\n${copy.ignore}`,
    tag: "auth.password-reset",
  });
}
