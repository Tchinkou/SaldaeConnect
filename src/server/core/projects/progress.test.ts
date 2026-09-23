import { describe, expect, it } from "vitest";
import { computeProjectProgress } from "@/server/core/projects/progress";

describe("computeProjectProgress", () => {
  it("MANUAL: returns the manual value, clamped to 0-100", () => {
    expect(computeProjectProgress("MANUAL", { progressManual: 42, tasks: [], milestones: [] })).toBe(42);
    expect(computeProjectProgress("MANUAL", { progressManual: null, tasks: [], milestones: [] })).toBe(0);
    expect(computeProjectProgress("MANUAL", { progressManual: 150, tasks: [], milestones: [] })).toBe(100);
    expect(computeProjectProgress("MANUAL", { progressManual: -10, tasks: [], milestones: [] })).toBe(0);
  });

  it("TASKS: percentage of DONE tasks, CANCELLED excluded from denominator", () => {
    expect(computeProjectProgress("TASKS", { progressManual: null, tasks: [], milestones: [] })).toBe(0);
    expect(
      computeProjectProgress("TASKS", {
        progressManual: null,
        milestones: [],
        tasks: [{ status: "DONE" }, { status: "DONE" }, { status: "TODO" }, { status: "CANCELLED" }],
      }),
    ).toBe(67); // 2/3 rounded
  });

  it("MILESTONES: weighted percentage of DONE milestones, CANCELLED excluded", () => {
    expect(computeProjectProgress("MILESTONES", { progressManual: null, tasks: [], milestones: [] })).toBe(0);
    expect(
      computeProjectProgress("MILESTONES", {
        progressManual: null,
        tasks: [],
        milestones: [
          { status: "DONE", weight: 1 },
          { status: "DONE", weight: 3 },
          { status: "TODO", weight: 1 },
          { status: "CANCELLED", weight: 5 },
        ],
      }),
    ).toBe(80); // (1+3) / (1+3+1) = 4/5
  });
});
