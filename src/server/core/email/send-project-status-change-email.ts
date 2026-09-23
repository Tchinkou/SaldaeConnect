import "server-only";
import { getEmailProvider } from "@/server/core/email/provider";

/** Email envoyé au client à chaque changement de statut d'un projet (§F.4 — « changement projet »). */
const COPY = {
  fr: {
    subject: (name: string) => `Mise à jour de votre projet « ${name} »`,
    heading: "Votre projet a été mis à jour",
    body: (name: string, statusLabel: string) => `Le statut de votre projet « ${name} » est maintenant : ${statusLabel}.`,
    note: (note: string) => `Précision : ${note}`,
    cta: "Voir mon projet",
  },
  en: {
    subject: (name: string) => `Update on your project "${name}"`,
    heading: "Your project has been updated",
    body: (name: string, statusLabel: string) => `Your project "${name}" is now: ${statusLabel}.`,
    note: (note: string) => `Note: ${note}`,
    cta: "View my project",
  },
  ar: {
    subject: (name: string) => `تحديث بخصوص مشروعك "${name}"`,
    heading: "تم تحديث مشروعك",
    body: (name: string, statusLabel: string) => `حالة مشروعك "${name}" الآن: ${statusLabel}.`,
    note: (note: string) => `ملاحظة: ${note}`,
    cta: "عرض مشروعي",
  },
} as const;

export async function sendProjectStatusChangeEmail({
  to,
  projectName,
  statusLabel,
  note,
  ctaUrl,
  locale,
}: {
  to: string;
  projectName: string;
  statusLabel: string;
  note?: string | null;
  ctaUrl: string;
  locale?: string;
}) {
  const copy = COPY[locale as keyof typeof COPY] ?? COPY.fr;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const body = copy.body(projectName, statusLabel);
  const noteLine = note ? copy.note(note) : null;

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f5f7; padding:32px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#0B1220;">${copy.heading}</h1>
      <p style="color:#374151;line-height:1.6;">${body}</p>
      ${noteLine ? `<p style="color:#374151;line-height:1.6;">${noteLine}</p>` : ""}
      <p style="text-align:center;margin:32px 0;">
        <a href="${ctaUrl}" style="background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">${copy.cta}</a>
      </p>
    </div>
  </body>
</html>`;

  await getEmailProvider().send({
    to,
    subject: copy.subject(projectName),
    html,
    text: `${copy.heading}\n\n${body}${noteLine ? `\n\n${noteLine}` : ""}\n\n${ctaUrl}`,
    tag: "project.status_change",
  });
}
