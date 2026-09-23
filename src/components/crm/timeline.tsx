import { useTranslations, useFormatter } from "next-intl";
import { Badge } from "@/components/ui/badge";

export type TimelineActivity = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  occurredAt: string;
  actorName: string | null;
};

const TONE_BY_TYPE: Record<string, "neutral" | "brand" | "success" | "warning" | "info"> = {
  NOTE: "neutral",
  CALL: "info",
  EMAIL: "brand",
  MEETING: "success",
  WHATSAPP: "success",
  STAGE_CHANGE: "warning",
  SYSTEM: "neutral",
};

export function Timeline({ activities }: { activities: TimelineActivity[] }) {
  const t = useTranslations("admin.crm.activity");
  const format = useFormatter();

  if (activities.length === 0) {
    return <p className="text-sm text-foreground/50">{t("empty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-md border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE_BY_TYPE[activity.type] ?? "neutral"}>{t(`type.${activity.type}`)}</Badge>
            {activity.subject ? <span className="text-sm font-medium text-foreground">{activity.subject}</span> : null}
            <span className="ms-auto text-xs text-foreground/50">
              {format.dateTime(new Date(activity.occurredAt), { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
          {activity.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{activity.body}</p> : null}
          {activity.actorName ? <p className="mt-1 text-xs text-foreground/50">{t("by", { name: activity.actorName })}</p> : null}
        </li>
      ))}
    </ol>
  );
}
