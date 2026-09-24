import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

const STATUS_LABEL = {
  fr: { REQUESTED: "Demandée", CONFIRMED: "Confirmée", PENDING: "En attente", COMPLETED: "Terminée", CANCELLED: "Annulée" },
  en: { REQUESTED: "Requested", CONFIRMED: "Confirmed", PENDING: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled" },
  ar: { REQUESTED: "قيد الطلب", CONFIRMED: "مؤكد", PENDING: "قيد الانتظار", COMPLETED: "منتهٍ", CANCELLED: "ملغى" },
} as const;

const COPY = {
  fr: {
    subject: (number: string) => `Votre réservation ${number} a été mise à jour`,
    heading: "Mise à jour de votre réservation",
    body: (number: string, status: string) => `Votre réservation ${number} est maintenant : ${status}.`,
  },
  en: {
    subject: (number: string) => `Your reservation ${number} has been updated`,
    heading: "Your reservation has been updated",
    body: (number: string, status: string) => `Your reservation ${number} is now: ${status}.`,
  },
  ar: {
    subject: (number: string) => `تم تحديث حجزك ${number}`,
    heading: "تم تحديث حجزك",
    body: (number: string, status: string) => `حجزك ${number} الآن: ${status}.`,
  },
} as const;

export async function sendReservationStatusChangeEmail({
  to,
  reservationNumber,
  status,
  locale,
}: {
  to: string;
  reservationNumber: string;
  status: keyof (typeof STATUS_LABEL)["fr"];
  locale?: string;
}) {
  const localeKey = (locale as keyof typeof COPY) in COPY ? (locale as keyof typeof COPY) : "fr";
  const copy = COPY[localeKey];
  const dir = localeKey === "ar" ? "rtl" : "ltr";
  const statusLabel = STATUS_LABEL[localeKey][status];
  const body = copy.body(reservationNumber, statusLabel);

  const html = `<!doctype html>
<html lang="${localeKey}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      <p style="color:#9CA3AF;font-size:13px;"><bdi dir="ltr">${reservationNumber}</bdi></p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(reservationNumber),
    html,
    text: `${copy.heading}\n\n${body}`,
    tag: "reservation.status_changed",
  });
}
