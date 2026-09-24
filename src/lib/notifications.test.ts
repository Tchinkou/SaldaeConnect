import { describe, expect, it } from "vitest";
import { notificationDisplay } from "@/lib/notifications";

describe("notificationDisplay", () => {
  it("maps a known type to its key and interpolation values", () => {
    expect(notificationDisplay("quote.accepted", { quoteNumber: "DEV-2026-0001", clientName: "Acme" })).toEqual({
      key: "quote_accepted",
      values: { quoteNumber: "DEV-2026-0001", clientName: "Acme" },
    });
  });

  it("falls back to string defaults when params is missing an expected field", () => {
    expect(notificationDisplay("quote.expired", {})).toEqual({ key: "quote_expired", values: { quoteNumber: "" } });
  });

  it("falls back to the generic key for an unrecognized type", () => {
    expect(notificationDisplay("something.unknown", { a: 1 })).toEqual({ key: "fallback", values: {} });
  });

  it("tolerates a null/non-object params", () => {
    expect(notificationDisplay("project.message", null)).toEqual({ key: "project_message", values: {} });
  });

  it("maps invoice notification types (Phase 7)", () => {
    expect(notificationDisplay("invoice.issued", { number: "FAC-2026-0001" })).toEqual({
      key: "invoice_issued",
      values: { number: "FAC-2026-0001" },
    });
    expect(notificationDisplay("invoice.payment_recorded", { number: "FAC-2026-0001" })).toEqual({
      key: "invoice_payment_recorded",
      values: { number: "FAC-2026-0001" },
    });
    expect(notificationDisplay("invoice.overdue", { number: "FAC-2026-0001" })).toEqual({
      key: "invoice_overdue",
      values: { number: "FAC-2026-0001" },
    });
  });

  it("maps reservation and transaction notification types (Phase 9)", () => {
    expect(notificationDisplay("reservation.created", { number: "RDV-2026-0001" })).toEqual({
      key: "reservation_created",
      values: { number: "RDV-2026-0001" },
    });
    expect(notificationDisplay("reservation.status_changed", { number: "RDV-2026-0001", status: "CONFIRMED" })).toEqual({
      key: "reservation_status_changed",
      values: { number: "RDV-2026-0001", status: "CONFIRMED" },
    });
    expect(notificationDisplay("transaction.status_changed", { number: "TRX-2026-0001", status: "PAID" })).toEqual({
      key: "transaction_status_changed",
      values: { number: "TRX-2026-0001", status: "PAID" },
    });
  });
});
