"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePortalNotificationPreferenceAction } from "@/app/[locale]/portal/settings/actions";

export type PreferenceRow = {
  type: string;
  channels: Array<{ channel: "IN_APP" | "EMAIL"; enabled: boolean }>;
};

/** Grille des préférences de notification (§16) : modèle opt-out, une ligne absente en base vaut activé. */
export function NotificationPreferences({ rows }: { rows: PreferenceRow[] }) {
  const t = useTranslations("portal.settings");
  const [state, setState] = useState(rows);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(type: string, channel: "IN_APP" | "EMAIL", next: boolean) {
    const key = `${type}:${channel}`;
    setPending(key);
    setError(null);
    setState((prev) =>
      prev.map((row) =>
        row.type === type
          ? { ...row, channels: row.channels.map((c) => (c.channel === channel ? { ...c, enabled: next } : c)) }
          : row,
      ),
    );

    const result = await updatePortalNotificationPreferenceAction({ type, channel, enabled: next });
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      setState((prev) =>
        prev.map((row) =>
          row.type === type
            ? { ...row, channels: row.channels.map((c) => (c.channel === channel ? { ...c, enabled: !next } : c)) }
            : row,
        ),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      <div className="flex flex-col divide-y divide-border">
        {state.map((row) => (
          <div key={row.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t(`type.${row.type}.label`)}</p>
              <p className="text-xs text-foreground/70">{t(`type.${row.type}.description`)}</p>
            </div>
            <div className="flex items-center gap-4">
              {row.channels.map(({ channel, enabled }) => {
                const key = `${row.type}:${channel}`;
                return (
                  <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={pending === key}
                      onChange={(event) => toggle(row.type, channel, event.target.checked)}
                    />
                    {t(channel === "IN_APP" ? "channel.inApp" : "channel.email")}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
