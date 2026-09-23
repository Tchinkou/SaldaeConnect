import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

/** Email envoyé au client à l'émission d'une facture (§F.5) — le client a toujours déjà un accès portail à ce stade (créé au plus tard à l'envoi du devis). */
const COPY = {
  fr: {
    subject: (number: string) => `Votre facture ${number}`,
    heading: "Nouvelle facture",
    body: (number: string) => `Votre facture ${number} est disponible dans votre espace client.`,
    cta: "Voir ma facture",
  },
  en: {
    subject: (number: string) => `Your invoice ${number}`,
    heading: "New invoice",
    body: (number: string) => `Your invoice ${number} is available in your client portal.`,
    cta: "View my invoice",
  },
  ar: {
    subject: (number: string) => `فاتورتك ${number}`,
    heading: "فاتورة جديدة",
    body: (number: string) => `فاتورتك ${number} متاحة في مساحة العميل الخاصة بك.`,
    cta: "عرض فاتورتي",
  },
} as const;

export async function sendInvoiceAvailableEmail({
  to,
  invoiceNumber,
  ctaUrl,
  locale,
}: {
  to: string;
  invoiceNumber: string;
  ctaUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(invoiceNumber);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="text-align:center;margin:32px 0;">
        <a href="${ctaUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(invoiceNumber),
    html,
    text: `${copy.heading}\n\n${body}\n\n${ctaUrl}`,
    tag: "invoice.available",
  });
}
