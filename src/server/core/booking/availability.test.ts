import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "@/server/core/booking/availability";

// Lundi fixe de référence pour des tests déterministes (2026-09-21 est un lundi).
const MONDAY = new Date("2026-09-21T00:00:00");
const NOW = new Date("2026-09-20T08:00:00");

const baseParams = {
  rules: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }],
  exceptions: [],
  existingReservations: [],
  slotMinutes: 60,
  capacityPerSlot: 1,
  minNoticeHours: 1,
  maxAdvanceDays: 30,
  from: MONDAY,
  to: new Date("2026-09-28T00:00:00"),
  now: NOW,
};

describe("computeAvailableSlots", () => {
  it("slices a recurring weekly window into fixed-size slots", () => {
    const slots = computeAvailableSlots(baseParams);
    const monday = slots.filter((slot) => slot.start.toDateString() === MONDAY.toDateString());
    expect(monday.map((slot) => slot.start.getHours())).toEqual([9, 10, 11]);
  });

  it("excludes a slot already at full capacity", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      existingReservations: [{ startsAt: new Date("2026-09-21T09:00:00"), endsAt: new Date("2026-09-21T10:00:00") }],
    });
    const nineOClock = slots.find((slot) => slot.start.getTime() === new Date("2026-09-21T09:00:00").getTime());
    expect(nineOClock).toBeUndefined();
  });

  it("keeps a partially-booked slot with remaining capacity when capacityPerSlot > 1", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      capacityPerSlot: 3,
      existingReservations: [{ startsAt: new Date("2026-09-21T09:00:00"), endsAt: new Date("2026-09-21T10:00:00") }],
    });
    const nineOClock = slots.find((slot) => slot.start.getTime() === new Date("2026-09-21T09:00:00").getTime());
    expect(nineOClock?.remaining).toBe(2);
  });

  it("removes a whole day via a full-day CLOSED exception", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      exceptions: [{ date: MONDAY, type: "CLOSED" }],
    });
    expect(slots.some((slot) => slot.start.toDateString() === MONDAY.toDateString())).toBe(false);
  });

  it("carves a partial CLOSED exception out of the open window", () => {
    const slots = computeAvailableSlots({
      ...baseParams,
      exceptions: [{ date: MONDAY, type: "CLOSED", startTime: "10:00", endTime: "11:00" }],
    });
    const monday = slots.filter((slot) => slot.start.toDateString() === MONDAY.toDateString());
    expect(monday.map((slot) => slot.start.getHours())).toEqual([9, 11]);
  });

  it("adds an EXTRA exception window on a day the recurring rules don't cover", () => {
    const tuesday = new Date("2026-09-22T00:00:00");
    const slots = computeAvailableSlots({
      ...baseParams,
      exceptions: [{ date: tuesday, type: "EXTRA", startTime: "14:00", endTime: "15:00" }],
    });
    const extra = slots.filter((slot) => slot.start.toDateString() === tuesday.toDateString());
    expect(extra.map((slot) => slot.start.getHours())).toEqual([14]);
  });

  it("respects minNoticeHours by excluding slots too soon", () => {
    // À 08:30 le lundi avec 3h de préavis, le créneau 09:00-12:00 tombe entièrement avant l'heure la plus tôt réservable (11:30).
    const slots = computeAvailableSlots({ ...baseParams, now: new Date("2026-09-21T08:30:00"), minNoticeHours: 3 });
    const monday = slots.filter((slot) => slot.start.toDateString() === MONDAY.toDateString());
    expect(monday).toHaveLength(0);
  });

  it("respects maxAdvanceDays by excluding slots too far out", () => {
    const slots = computeAvailableSlots({ ...baseParams, maxAdvanceDays: 0 });
    expect(slots).toHaveLength(0);
  });
});
