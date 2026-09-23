/**
 * Composition du texte affiché d'une notification à partir de son `type` et
 * de ses `params` (§I.7 : composé à l'affichage, dans la langue de
 * l'utilisateur — jamais stocké en clair). Renvoie une clé de traduction
 * (sous `common.notification.type`, `.` remplacé par `_` car next-intl
 * découpe les clés sur `.`) et les valeurs d'interpolation, plutôt que le
 * texte final, pour rester découplé de `useTranslations` et testable.
 */
export interface NotificationDisplay {
  key: string;
  values: Record<string, string>;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function notificationDisplay(type: string, params: unknown): NotificationDisplay {
  const p = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;

  switch (type) {
    case "opportunity.created":
      return { key: "opportunity_created", values: { requestNumber: str(p.requestNumber) } };
    case "lead.contact_message":
      return { key: "lead_contact_message", values: { contactName: str(p.contactName) } };
    case "quote.viewed":
      return { key: "quote_viewed", values: { quoteNumber: str(p.quoteNumber), clientName: str(p.clientName) } };
    case "quote.accepted":
      return { key: "quote_accepted", values: { quoteNumber: str(p.quoteNumber), clientName: str(p.clientName) } };
    case "quote.rejected":
      return { key: "quote_rejected", values: { quoteNumber: str(p.quoteNumber), clientName: str(p.clientName) } };
    case "quote.changes_requested":
      return { key: "quote_changes_requested", values: { quoteNumber: str(p.quoteNumber), clientName: str(p.clientName) } };
    case "quote.expired":
      return { key: "quote_expired", values: { quoteNumber: str(p.quoteNumber) } };
    case "project.status_changed":
      return { key: "project_status_changed", values: { projectName: str(p.projectName), status: str(p.status) } };
    case "project.message":
      return { key: "project_message", values: {} };
    default:
      return { key: "fallback", values: {} };
  }
}
