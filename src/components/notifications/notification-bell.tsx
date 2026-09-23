"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { notificationDisplay } from "@/lib/notifications";
import { listMyNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction } from "@/server/core/notifications";

type NotificationItem = {
  id: string;
  type: string;
  params: unknown;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30_000;

/** Cloche de notifications (§I.7), partagée entre l'espace admin et le portail client — chaque utilisateur ne voit que les siennes. */
export function NotificationBell() {
  const t = useTranslations("common.notification");
  const tStatus = useTranslations("common.notification.projectStatus");
  const format = useFormatter();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function refresh() {
    const result = await listMyNotificationsAction();
    if (result.ok) {
      setItems(result.data.items);
      setUnreadCount(result.data.unreadCount);
    }
  }

  useEffect(() => {
    let cancelled = false;
    function poll() {
      listMyNotificationsAction().then((result) => {
        if (cancelled || !result.ok) return;
        setItems(result.data.items);
        setUnreadCount(result.data.unreadCount);
      });
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function textFor(item: NotificationItem): string {
    const display = notificationDisplay(item.type, item.params);
    const values = { ...display.values };
    if (typeof values.status === "string") {
      values.status = tStatus(values.status as Parameters<typeof tStatus>[0]);
    }
    return t(`type.${display.key}` as Parameters<typeof t>[0], values);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground/70 hover:bg-background"
      >
        🔔
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 z-50 mt-2 w-80 rounded-md border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="text-sm font-semibold text-foreground">{t("title")}</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await markAllNotificationsReadAction();
                  await refresh();
                }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {t("markAllRead")}
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="p-3 text-sm text-foreground/50">{t("empty")}</li>
            ) : (
              items.map((item) => (
                <li key={item.id} className={`border-b border-border last:border-0 ${item.readAt ? "" : "bg-brand-50"}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 p-3 text-start"
                    onClick={async () => {
                      if (!item.readAt) await markNotificationReadAction({ id: item.id });
                      setOpen(false);
                      if (item.link) router.push(item.link);
                      await refresh();
                    }}
                  >
                    <span className="text-sm text-foreground">{textFor(item)}</span>
                    <span className="text-xs text-foreground/50">
                      {format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
