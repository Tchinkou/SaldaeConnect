import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const COPY = {
  fr: {
    subject: "Votre lien de connexion SaldaeConnect",
    heading: "Connexion à votre espace",
    body: "Cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable 15 minutes et ne peut servir qu'une fois.",
    cta: "Se connecter",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.",
  },
  en: {
    subject: "Your SaldaeConnect sign-in link",
    heading: "Sign in to your account",
    body: "Click the button below to sign in. This link is valid for 15 minutes and can only be used once.",
    cta: "Sign in",
    ignore: "If you didn't request this, you can safely ignore this email.",
  },
  ar: {
    subject: "رابط تسجيل الدخول إلى SaldaeConnect",
    heading: "تسجيل الدخول إلى حسابك",
    body: "انقر على الزر أدناه لتسجيل الدخول. هذا الرابط صالح لمدة 15 دقيقة ويمكن استخدامه مرة واحدة فقط.",
    cta: "تسجيل الدخول",
    ignore: "إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة.",
  },
} as const;

export async function sendMagicLinkEmail({
  to,
  magicLinkUrl,
  locale,
}: {
  to: string;
  magicLinkUrl: string;
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
        <a href="${magicLinkUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
      <p style="color:#9CA3AF;font-size:13px;">${copy.ignore}</p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject,
    html,
    text: `${copy.heading}\n\n${copy.body}\n\n${magicLinkUrl}\n\n${copy.ignore}`,
    tag: "auth.magic-link",
  });
}
