import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

/** Confirmation envoyée au client après acceptation d'un devis (§F.3) — le projet vient d'être créé. */
const COPY = {
  fr: {
    subject: (number: string) => `Devis ${number} accepté — merci !`,
    heading: "Merci, votre devis est accepté",
    body: (number: string, projectNumber: string) =>
      `Nous avons bien reçu votre acceptation du devis ${number}. Votre projet ${projectNumber} vient d'être créé et notre équipe va vous contacter pour la suite.`,
    cta: "Accéder à mon espace",
  },
  en: {
    subject: (number: string) => `Quote ${number} accepted — thank you!`,
    heading: "Thank you, your quote is accepted",
    body: (number: string, projectNumber: string) =>
      `We've received your acceptance of quote ${number}. Your project ${projectNumber} has just been created and our team will be in touch shortly.`,
    cta: "Go to my portal",
  },
  ar: {
    subject: (number: string) => `تم قبول عرض السعر ${number} — شكرًا لك!`,
    heading: "شكرًا لك، تم قبول عرض سعرك",
    body: (number: string, projectNumber: string) =>
      `لقد استلمنا موافقتك على عرض السعر ${number}. تم للتو إنشاء مشروعك ${projectNumber} وسيتواصل معك فريقنا قريبًا.`,
    cta: "الذهاب إلى مساحتي",
  },
} as const;

export async function sendQuoteAcceptedConfirmationEmail({
  to,
  quoteNumber,
  projectNumber,
  portalUrl,
  locale,
}: {
  to: string;
  quoteNumber: string;
  projectNumber: string;
  portalUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(quoteNumber, projectNumber);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${portalUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(quoteNumber),
    html,
    text: `${copy.heading}\n\n${body}\n\n${portalUrl}`,
    tag: "quote.accepted_confirmation",
  });
}
