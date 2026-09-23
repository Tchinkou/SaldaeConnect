import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

/** Email envoyé au client à l'envoi d'un devis (§F.2) — le lien mène soit à la création de son accès portail, soit directement à la connexion s'il en a déjà un. */
const COPY = {
  fr: {
    subject: (number: string) => `Votre devis ${number} est disponible`,
    heading: "Votre devis est prêt",
    body: (number: string) =>
      `Votre devis ${number} est disponible dans votre espace client. Vous pourrez le consulter, l'accepter, le refuser ou demander une modification.`,
    cta: "Voir mon devis",
  },
  en: {
    subject: (number: string) => `Your quote ${number} is ready`,
    heading: "Your quote is ready",
    body: (number: string) =>
      `Your quote ${number} is available in your client portal. You can review it, accept it, decline it, or request a change.`,
    cta: "View my quote",
  },
  ar: {
    subject: (number: string) => `عرض سعرك ${number} جاهز`,
    heading: "عرض سعرك جاهز",
    body: (number: string) =>
      `عرض سعرك ${number} متاح في مساحة العميل الخاصة بك. يمكنك الاطلاع عليه وقبوله أو رفضه أو طلب تعديل.`,
    cta: "عرض عرض سعري",
  },
} as const;

export async function sendQuoteAvailableEmail({
  to,
  quoteNumber,
  ctaUrl,
  locale,
}: {
  to: string;
  quoteNumber: string;
  ctaUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(quoteNumber);

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
    subject: copy.subject(quoteNumber),
    html,
    text: `${copy.heading}\n\n${body}\n\n${ctaUrl}`,
    tag: "quote.available",
  });
}
