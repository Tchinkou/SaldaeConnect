"use client";

import { useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { notificationDisplay } from "@/lib/notifications";
import { listMyNotificationsAction, markNotificationReadAction } from "@/server/core/notifications";

type NotificationItem = {
  id: string;
  type: string;
  params: unknown;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Version compacte (5 dernières, pas de sondage) de la liste affichée par la cloche — pour le tableau de bord (§16). */
export function RecentNotifications() {
  const t = useTranslations("common.notification");
  const tStatus = useTranslations("common.notification.projectStatus");
  const format = useFormatter();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    listMyNotificationsAction().then((result) => {
      if (result.ok) setItems(result.data.items.slice(0, 5));
    });
  }, []);

  function textFor(item: NotificationItem): string {
    const display = notificationDisplay(item.type, item.params);
    const values = { ...display.values };
    if (typeof values.status === "string") {
      values.status = tStatus(values.status as Parameters<typeof tStatus>[0]);
    }
    return t(`type.${display.key}` as Parameters<typeof t>[0], values);
  }

  if (items === null) return null;

  if (items.length === 0) {
    return <p className="text-sm text-foreground/70">{t("empty")}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className={item.readAt ? "" : "bg-brand-50"}>
          <button
            type="button"
            className="flex w-full flex-col items-start gap-0.5 py-2 text-start"
            onClick={async () => {
              if (!item.readAt) await markNotificationReadAction({ id: item.id });
              if (item.link) router.push(item.link);
            }}
          >
            <span className="text-sm text-foreground">{textFor(item)}</span>
            <span className="text-xs text-foreground/70">
              {format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
