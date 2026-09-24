"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  listAvailabilityRulesAction,
  upsertAvailabilityRuleAction,
  deleteAvailabilityRuleAction,
  createAvailabilityExceptionAction,
  deleteAvailabilityExceptionAction,
} from "@/server/core/booking/availability-actions";

type Rule = { id: string; weekday: number; startTime: string; endTime: string };
type Exception = { id: string; date: string; startTime: string | null; endTime: string | null; type: "CLOSED" | "EXTRA"; reason: string | null };

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function AvailabilityManager({
  services,
  initialExceptions,
}: {
  services: Array<{ id: string; name: string }>;
  initialExceptions: Exception[];
}) {
  const t = useTranslations("admin.availability");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newRule, setNewRule] = useState({ weekday: 1, startTime: "09:00", endTime: "17:00" });
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [exceptions, setExceptions] = useState(initialExceptions);
  const [newException, setNewException] = useState<{ date: string; startTime: string; endTime: string; type: "CLOSED" | "EXTRA"; reason: string }>({
    date: "",
    startTime: "",
    endTime: "",
    type: "CLOSED",
    reason: "",
  });
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setLoadingRules(true);
    });
    listAvailabilityRulesAction({ serviceId }).then((result) => {
      if (cancelled) return;
      setLoadingRules(false);
      if (result.ok) setRules(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  async function addRule() {
    setRuleError(null);
    const result = await upsertAvailabilityRuleAction({ serviceId, ...newRule });
    if (!result.ok) {
      setRuleError(result.error);
      return;
    }
    setRules((previous) => [...previous, result.data].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)));
  }

  async function removeRule(id: string) {
    const result = await deleteAvailabilityRuleAction({ id });
    if (result.ok) setRules((previous) => previous.filter((rule) => rule.id !== id));
  }

  async function addException() {
    setExceptionError(null);
    if (!newException.date) {
      setExceptionError(t("exceptionDateRequired"));
      return;
    }
    const result = await createAvailabilityExceptionAction({
      date: newException.date,
      startTime: newException.startTime || null,
      endTime: newException.endTime || null,
      type: newException.type,
      reason: newException.reason || null,
    });
    if (!result.ok) {
      setExceptionError(result.error);
      return;
    }
    setExceptions((previous) => [
      { id: result.data.id, date: newException.date, startTime: newException.startTime || null, endTime: newException.endTime || null, type: newException.type, reason: newException.reason || null },
      ...previous,
    ]);
    setNewException({ date: "", startTime: "", endTime: "", type: "CLOSED", reason: "" });
  }

  async function removeException(id: string) {
    const result = await deleteAvailabilityExceptionAction({ id });
    if (result.ok) setExceptions((previous) => previous.filter((exception) => exception.id !== id));
  }

  if (services.length === 0) {
    return <p className="text-sm text-foreground/50">{t("noBookingServices")}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t("rulesTitle")}</h3>
        <select
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="h-10 w-64 rounded-md border border-border bg-surface px-3 text-sm"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>

        {loadingRules ? (
          <p className="text-sm text-foreground/50">{t("loading")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  {t(`weekday.${rule.weekday}`)} · {rule.startTime}–{rule.endTime}
                </span>
                <button type="button" onClick={() => removeRule(rule.id)} className="text-xs font-medium text-danger-600 hover:underline">
                  {t("remove")}
                </button>
              </li>
            ))}
            {rules.length === 0 ? <p className="text-sm text-foreground/50">{t("noRules")}</p> : null}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("weekdayLabel")}</label>
            <select
              value={newRule.weekday}
              onChange={(event) => setNewRule((previous) => ({ ...previous, weekday: Number(event.target.value) }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {t(`weekday.${day}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("startTime")}</label>
            <input
              type="time"
              value={newRule.startTime}
              onChange={(event) => setNewRule((previous) => ({ ...previous, startTime: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("endTime")}</label>
            <input
              type="time"
              value={newRule.endTime}
              onChange={(event) => setNewRule((previous) => ({ ...previous, endTime: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              dir="ltr"
            />
          </div>
          <Button type="button" size="sm" onClick={addRule}>
            {t("addRule")}
          </Button>
        </div>
        {ruleError ? <p className="text-xs text-danger-600">{ruleError}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t("exceptionsTitle")}</h3>
        <ul className="flex flex-col gap-1.5">
          {exceptions.map((exception) => (
            <li key={exception.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                {exception.date} · {t(`exceptionType.${exception.type}`)}
                {exception.startTime && exception.endTime ? ` (${exception.startTime}–${exception.endTime})` : ` (${t("wholeDay")})`}
                {exception.reason ? ` — ${exception.reason}` : ""}
              </span>
              <button type="button" onClick={() => removeException(exception.id)} className="text-xs font-medium text-danger-600 hover:underline">
                {t("remove")}
              </button>
            </li>
          ))}
          {exceptions.length === 0 ? <p className="text-sm text-foreground/50">{t("noExceptions")}</p> : null}
        </ul>

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("date")}</label>
            <input
              type="date"
              value={newException.date}
              onChange={(event) => setNewException((previous) => ({ ...previous, date: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("type")}</label>
            <select
              value={newException.type}
              onChange={(event) => setNewException((previous) => ({ ...previous, type: event.target.value as "CLOSED" | "EXTRA" }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            >
              <option value="CLOSED">{t("exceptionType.CLOSED")}</option>
              <option value="EXTRA">{t("exceptionType.EXTRA")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("startTime")}</label>
            <input
              type="time"
              value={newException.startTime}
              onChange={(event) => setNewException((previous) => ({ ...previous, startTime: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("endTime")}</label>
            <input
              type="time"
              value={newException.endTime}
              onChange={(event) => setNewException((previous) => ({ ...previous, endTime: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("reason")}</label>
            <input
              type="text"
              value={newException.reason}
              onChange={(event) => setNewException((previous) => ({ ...previous, reason: event.target.value }))}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            />
          </div>
          <Button type="button" size="sm" onClick={addException}>
            {t("addException")}
          </Button>
        </div>
        {exceptionError ? <p className="text-xs text-danger-600">{exceptionError}</p> : null}
      </section>
    </div>
  );
}
