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
});
