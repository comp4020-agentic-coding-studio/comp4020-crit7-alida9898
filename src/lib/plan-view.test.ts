import { describe, expect, it } from "vitest";
import { clampPage, emptyMessage } from "./plan-view";

describe("clampPage", () => {
  it.each([
    [null, 10, 1],
    ["3", 10, 3],
    ["0", 10, 1],
    ["-4", 10, 1],
    ["abc", 10, 1],
    ["99999", 10, 10],
    ["2", 0, 1],
  ])("clamps %s of %i to %i", (raw, total, expected) => {
    expect(clampPage(raw, total)).toBe(expected);
  });
});

describe("emptyMessage", () => {
  const none = { schedules: [], capped: false, unschedulable: null };

  it("asks for a course when the plan is empty", () => {
    expect(emptyMessage(0, none)).toBe("Add a course to see schedules.");
  });

  it("names the activity that can't fit", () => {
    expect(emptyMessage(2, { ...none, unschedulable: "COMP2000 TutA" })).toBe(
      "No clash-free schedule: every COMP2000 TutA class clashes with a class you can't move.",
    );
  });

  it("points at your class choices when they're what leaves no room", () => {
    const result = { ...none, unschedulable: "COMP2100 ComA" };
    expect(emptyMessage(2, result, new Set(["COMP2100 ComA"]))).toBe(
      "No clash-free schedule: the COMP2100 ComA classes you kept all clash with a class you can't move. Widen your choice under “Choose classes”.",
    );
  });

  it("explains a search that ran out of budget", () => {
    expect(emptyMessage(6, { ...none, capped: true })).toBe(
      "Too many combinations to search. Try removing a course.",
    );
  });

  it("falls back to the combination failing", () => {
    expect(emptyMessage(3, none)).toBe("No clash-free combination of these courses exists.");
  });
});
