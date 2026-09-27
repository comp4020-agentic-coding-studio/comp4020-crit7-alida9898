import { describe, expect, it } from "vitest";
import type { Meeting } from "./generate";
import { activityLabel, applyPrefs, type ClassPref } from "./prefs";

const mt = (courseId: string, activity: string, occurrence: string, day = 0): Meeting => ({
  courseId,
  activity,
  occurrence,
  day,
  startMin: 600,
  finishMin: 660,
  weeks: "31–36",
  location: "",
});
const MEETINGS = [
  mt("COMP2100_S2", "LecA", "01"),
  mt("COMP2100_S2", "TutA", "01", 1),
  mt("COMP2100_S2", "TutA", "02", 2),
  mt("COMP2100_S2", "TutA", "03", 3),
  mt("MATH1014_S2", "TutA", "01", 4),
];
const pref = (occurrence: string, mode: ClassPref["mode"], courseId = "COMP2100_S2", activity = "TutA"): ClassPref => ({
  courseId,
  activity,
  occurrence,
  mode,
});
const tuts = (meetings: Meeting[]) =>
  meetings.filter((m) => m.courseId === "COMP2100_S2" && m.activity === "TutA").map((m) => m.occurrence);

describe("applyPrefs", () => {
  it("keeps every class when there are no preferences", () => {
    expect(applyPrefs(MEETINGS, [])).toEqual({ meetings: MEETINGS, emptied: [] });
  });

  it("drops an excluded class", () => {
    expect(tuts(applyPrefs(MEETINGS, [pref("02", "exclude")]).meetings)).toEqual(["01", "03"]);
  });

  it("keeps only the chosen classes of that activity", () => {
    const { meetings } = applyPrefs(MEETINGS, [pref("01", "only"), pref("03", "only")]);
    expect(tuts(meetings)).toEqual(["01", "03"]);
    // other activities and courses are untouched
    expect(meetings).toContainEqual(MEETINGS[0]);
    expect(meetings).toContainEqual(MEETINGS[4]);
  });

  it("lets 'only' win over 'exclude' in the same activity", () => {
    expect(tuts(applyPrefs(MEETINGS, [pref("01", "exclude"), pref("02", "only")]).meetings)).toEqual(["02"]);
  });

  it("names an activity whose every class was excluded", () => {
    const all = ["01", "02", "03"].map((o) => pref(o, "exclude"));
    expect(applyPrefs(MEETINGS, all).emptied).toEqual(["COMP2100 TutA"]);
  });

  it("ignores preferences for courses not in the plan", () => {
    expect(applyPrefs(MEETINGS, [pref("01", "only", "PHYS1101_S2")]).meetings).toEqual(MEETINGS);
  });
});

describe("activityLabel", () => {
  it("spells out the common activity codes", () => {
    expect(activityLabel("LecA")).toBe("Lecture A");
    expect(activityLabel("TutB")).toBe("Tutorial B");
    expect(activityLabel("ComA")).toBe("Computer lab A");
    expect(activityLabel("XyzA")).toBe("XyzA");
  });
});
