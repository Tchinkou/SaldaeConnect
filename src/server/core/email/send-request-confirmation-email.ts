import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const COPY = {
  fr: {
    subject: (number: string) => `Votre demande ${number} a bien été reçue`,
    heading: "Merci pour votre demande",
    body: (number: string) =>
      `Nous avons bien reçu votre demande, enregistrée sous le numéro ${number}. Notre équipe vous répondra dans les meilleurs délais.`,
  },
  en: {
    subject: (number: string) => `Your request ${number} has been received`,
    heading: "Thank you for your request",
    body: (number: string) =>
      `We've received your request, registered under number ${number}. Our team will get back to you shortly.`,
  },
  ar: {
    subject: (number: string) => `تم استلام طلبك ${number}`,
    heading: "شكرًا لطلبك",
    body: (number: string) => `لقد استلمنا طلبك، المسجل تحت الرقم ${number}. سيتواصل معك فريقنا في أقرب وقت ممكن.`,
  },
} as const;

export async function sendRequestConfirmationEmail({
  to,
  requestNumber,
  locale,
}: {
  to: string;
  requestNumber: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(requestNumber);

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="color:#9CA3AF;font-size:13px;"><bdi dir="ltr">${requestNumber}</bdi></p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(requestNumber),
    html,
    text: `${copy.heading}\n\n${body}`,
    tag: "opportunity.request_confirmation",
  });
}
