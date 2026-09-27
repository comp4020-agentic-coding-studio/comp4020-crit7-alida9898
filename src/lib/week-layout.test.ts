import { describe, expect, it } from "vitest";
import type { Meeting, Schedule } from "./generate";
import { layoutWeek } from "./week-layout";

function option(day: number, startMin: number, finishMin: number, weeks = "31–36", occurrence = "01"): Schedule[number] {
  const meeting: Meeting = {
    courseId: "A_S2",
    activity: `Act${occurrence}`,
    occurrence,
    day,
    startMin,
    finishMin,
    weeks,
    location: "",
  };
  return { courseId: "A_S2", activity: meeting.activity, occurrence, meetings: [meeting] };
}

describe("layoutWeek", () => {
  it("shows Mon–Fri and at least 09:00–17:00 by default", () => {
    const layout = layoutWeek([option(1, 600, 660)]);
    expect(layout.days).toEqual([0, 1, 2, 3, 4]);
    expect([layout.startMin, layout.endMin]).toEqual([540, 1020]);
  });

  it("grows to include weekends and early or late classes", () => {
    const layout = layoutWeek([option(6, 420, 480), option(2, 1200, 1290)]);
    expect(layout.days).toEqual([0, 1, 2, 3, 4, 6]);
    expect(layout.startMin).toBe(420);
    expect(layout.endMin).toBe(1320);
  });

  it("lists one-off sessions instead of drawing them", () => {
    const layout = layoutWeek([option(0, 600, 660), option(1, 600, 660, "35", "02")]);
    expect(layout.blocks).toHaveLength(1);
    expect(layout.oneOffs.map((m) => m.weekList)).toEqual([[35]]);
  });

  it("puts same-time meetings in disjoint weeks side by side", () => {
    const layout = layoutWeek([
      option(0, 600, 660, "31–34", "01"),
      option(0, 600, 660, "39–44", "02"),
    ]);
    expect(layout.blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("draws a meeting with unknown weeks as recurring", () => {
    expect(layoutWeek([option(0, 600, 660, "")]).blocks).toHaveLength(1);
  });
});
