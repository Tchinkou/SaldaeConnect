/**
 * Moteur de disponibilité des services en mode `AGENCY_SLOT` (§D.5, §B.3) :
 * calcule les créneaux libres à partir des règles récurrentes
 * (`AvailabilityRule`), des exceptions ponctuelles (`AvailabilityException`)
 * et des réservations déjà posées, en respectant le préavis minimum et
 * l'horizon maximum du service. Fonction pure (aucun accès Prisma) pour
 * rester testable unitairement — l'appelant (server action) charge les
 * lignes et transmet leur forme minimale.
 */

export interface AvailabilityRuleInput {
  weekday: number; // 0 = dimanche … 6 = samedi
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  validFrom?: Date | null;
  validTo?: Date | null;
}

export interface AvailabilityExceptionInput {
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  type: "CLOSED" | "EXTRA";
}

export interface ExistingReservationInput {
  startsAt: Date;
  endsAt: Date;
}

export interface Slot {
  start: Date;
  end: Date;
  /** Places encore libres sur ce créneau. */
  remaining: number;
}

export interface ComputeAvailableSlotsParams {
  rules: AvailabilityRuleInput[];
  exceptions: AvailabilityExceptionInput[];
  existingReservations: ExistingReservationInput[];
  slotMinutes: number;
  capacityPerSlot: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  from: Date;
  to: Date;
  now?: Date;
}

function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface OpenWindow {
  start: Date;
  end: Date;
}

/** Fenêtres ouvertes d'une journée : règles récurrentes applicables, modulées par les exceptions du jour. */
function openWindowsForDay(day: Date, rules: AvailabilityRuleInput[], exceptions: AvailabilityExceptionInput[]): OpenWindow[] {
  const dayExceptions = exceptions.filter((exception) => startOfDay(exception.date).getTime() === startOfDay(day).getTime());

  const fullDayClosed = dayExceptions.some((exception) => exception.type === "CLOSED" && !exception.startTime && !exception.endTime);
  if (fullDayClosed) return [];

  const weekday = day.getDay();
  let windows: OpenWindow[] = rules
    .filter((rule) => rule.weekday === weekday)
    .filter((rule) => (!rule.validFrom || rule.validFrom <= day) && (!rule.validTo || rule.validTo >= day))
    .map((rule) => ({ start: parseTimeOnDate(day, rule.startTime), end: parseTimeOnDate(day, rule.endTime) }));

  for (const exception of dayExceptions) {
    if (exception.type === "EXTRA" && exception.startTime && exception.endTime) {
      windows.push({ start: parseTimeOnDate(day, exception.startTime), end: parseTimeOnDate(day, exception.endTime) });
    }
  }

  for (const exception of dayExceptions) {
    if (exception.type === "CLOSED" && exception.startTime && exception.endTime) {
      const closedStart = parseTimeOnDate(day, exception.startTime);
      const closedEnd = parseTimeOnDate(day, exception.endTime);
      windows = windows.flatMap((window) => subtractRange(window, { start: closedStart, end: closedEnd }));
    }
  }

  return windows;
}

function subtractRange(window: OpenWindow, closed: OpenWindow): OpenWindow[] {
  if (closed.end <= window.start || closed.start >= window.end) return [window];
  const result: OpenWindow[] = [];
  if (closed.start > window.start) result.push({ start: window.start, end: closed.start });
  if (closed.end < window.end) result.push({ start: closed.end, end: window.end });
  return result;
}

export function computeAvailableSlots(params: ComputeAvailableSlotsParams): Slot[] {
  const now = params.now ?? new Date();
  const earliestStart = new Date(now.getTime() + params.minNoticeHours * 60 * 60 * 1000);
  const latestStart = new Date(now.getTime() + params.maxAdvanceDays * 24 * 60 * 60 * 1000);

  const rangeStart = params.from > earliestStart ? params.from : earliestStart;
  const rangeEnd = params.to < latestStart ? params.to : latestStart;
  if (rangeStart >= rangeEnd) return [];

  const slots: Slot[] = [];
  const slotMs = params.slotMinutes * 60 * 1000;

  let day = startOfDay(rangeStart);
  const lastDay = startOfDay(rangeEnd);
  while (day <= lastDay) {
    const windows = openWindowsForDay(day, params.rules, params.exceptions);
    for (const window of windows) {
      let slotStart = window.start;
      while (slotStart.getTime() + slotMs <= window.end.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + slotMs);
        if (slotStart >= rangeStart && slotStart >= earliestStart && slotStart <= rangeEnd) {
          const occupied = params.existingReservations.filter((reservation) => reservation.startsAt.getTime() === slotStart.getTime()).length;
          const remaining = params.capacityPerSlot - occupied;
          if (remaining > 0) {
            slots.push({ start: slotStart, end: slotEnd, remaining });
          }
        }
        slotStart = slotEnd;
      }
    }
    day = addDays(day, 1);
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
