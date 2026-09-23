import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const COPY = {
  fr: {
    subject: "Vous êtes invité·e à rejoindre SaldaeConnect",
    heading: "Rejoignez l'équipe SaldaeConnect",
    body: (roleName: string, invitedBy: string) =>
      `${invitedBy} vous invite à rejoindre l'espace d'administration SaldaeConnect avec le rôle « ${roleName} ». Ce lien est valable 7 jours.`,
    cta: "Créer mon compte",
    ignore: "Si vous ne vous attendiez pas à cette invitation, vous pouvez ignorer cet email.",
  },
  en: {
    subject: "You're invited to join SaldaeConnect",
    heading: "Join the SaldaeConnect team",
    body: (roleName: string, invitedBy: string) =>
      `${invitedBy} invites you to join the SaldaeConnect admin with the "${roleName}" role. This link is valid for 7 days.`,
    cta: "Create my account",
    ignore: "If you weren't expecting this invitation, you can safely ignore this email.",
  },
  ar: {
    subject: "أنت مدعو للانضمام إلى SaldaeConnect",
    heading: "انضم إلى فريق SaldaeConnect",
    body: (roleName: string, invitedBy: string) =>
      `${invitedBy} يدعوك للانضمام إلى لوحة إدارة SaldaeConnect بدور «${roleName}». هذا الرابط صالح لمدة 7 أيام.`,
    cta: "إنشاء حسابي",
    ignore: "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.",
  },
} as const;

export async function sendInvitationEmail({
  to,
  acceptUrl,
  roleName,
  invitedBy,
  locale,
}: {
  to: string;
  acceptUrl: string;
  roleName: string;
  invitedBy: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(roleName, invitedBy);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${acceptUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
      <p style="color:#9CA3AF;font-size:13px;">${copy.ignore}</p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject,
    html,
    text: `${copy.heading}\n\n${body}\n\n${acceptUrl}\n\n${copy.ignore}`,
    tag: "team.invitation",
  });
}
