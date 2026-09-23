import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const COPY = {
  fr: {
    subject: "Nouveau message via le formulaire de contact",
    heading: "Nouveau message de contact",
    body: (name: string) => `${name} a envoyé un message depuis la page contact du site.`,
    cta: "Voir dans le CRM",
  },
  en: {
    subject: "New message via the contact form",
    heading: "New contact message",
    body: (name: string) => `${name} sent a message from the site's contact page.`,
    cta: "View in the CRM",
  },
  ar: {
    subject: "رسالة جديدة عبر نموذج الاتصال",
    heading: "رسالة اتصال جديدة",
    body: (name: string) => `أرسل ${name} رسالة من صفحة الاتصال بالموقع.`,
    cta: "عرض في إدارة العملاء",
  },
} as const;

export async function sendNewContactMessageNotificationEmail({
  to,
  contactName,
  crmUrl,
  locale,
}: {
  to: string;
  contactName: string;
  crmUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(contactName);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${crmUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject,
    html,
    text: `${copy.heading}\n\n${body}\n\n${crmUrl}`,
    tag: "lead.contact_message_notification",
  });
}
