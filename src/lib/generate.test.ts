import { describe, expect, it } from "vitest";
import { generate, groupOptions, type Meeting, toSelection } from "./generate";

const TERM = "31‑36,39‑44";

function mt(
  courseId: string,
  activity: string,
  occurrence: string,
  day: number,
  start: string,
  finish: string,
  weeks = TERM,
): Meeting {
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return {
    courseId,
    activity,
    occurrence,
    day,
    startMin: min(start),
    finishMin: min(finish),
    weeks,
    location: "",
  };
}

describe("groupOptions", () => {
  it("groups meetings into options per activity and drops drop-ins", () => {
    const groups = groupOptions([
      mt("A_S2", "LecA", "01", 0, "09:00", "10:00"),
      mt("A_S2", "LecA", "01", 2, "09:00", "10:00"),
      mt("A_S2", "TutA", "02", 1, "11:00", "12:00"),
      mt("A_S2", "TutA", "01", 1, "10:00", "11:00"),
      mt("A_S2", "DroA", "01", 3, "10:00", "11:00"),
    ]);
    expect(groups.map((g) => g.map((o) => `${o.activity}/${o.occurrence}`))).toEqual([
      ["LecA/01"],
      ["TutA/01", "TutA/02"],
    ]);
    expect(groups[0][0].meetings).toHaveLength(2);
  });
});

describe("generate", () => {
  it("returns nothing, uncapped, for no meetings", () => {
    expect(generate([])).toEqual({ schedules: [], capped: false, unschedulable: null });
  });

  it("returns the one schedule when every activity is fixed", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "09:00", "10:00"),
      mt("B_S2", "LecA", "01", 1, "09:00", "10:00"),
    ]);
    expect(result.schedules).toHaveLength(1);
  });

  it("prunes a tutorial that clashes with a fixed lecture", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "09:00", "11:00"),
      mt("B_S2", "TutA", "01", 0, "10:00", "11:00"),
      mt("B_S2", "TutA", "02", 0, "11:00", "12:00"),
    ]);
    expect(result.schedules.map((s) => toSelection(s).map((o) => o.occurrence))).toEqual([
      ["01", "02"],
    ]);
  });

  it("allows the same slot when the weeks don't overlap", () => {
    const result = generate([
      mt("A_S2", "AsmA", "01", 0, "10:00", "11:00", "35"),
      mt("B_S2", "TutA", "01", 0, "10:00", "11:00", "31‑34"),
    ]);
    expect(result.schedules).toHaveLength(1);
  });

  it("treats an unknown week set as every week", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "10:00", "11:00", ""),
      mt("B_S2", "LecA", "01", 0, "10:00", "11:00", "35"),
    ]);
    expect(result.schedules).toHaveLength(0);
  });

  it("rejects an option when any one of its meetings clashes", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 2, "09:00", "10:00"),
      mt("B_S2", "ComA", "01", 0, "09:00", "10:00"),
      mt("B_S2", "ComA", "01", 2, "09:00", "10:00"),
      mt("B_S2", "ComA", "02", 3, "09:00", "10:00"),
    ]);
    expect(result.schedules.map((s) => toSelection(s).find((o) => o.courseId === "B_S2")?.occurrence)).toEqual(["02"]);
  });

  it("orders results deterministically, first options first", () => {
    const result = generate([
      mt("A_S2", "TutA", "02", 1, "10:00", "11:00"),
      mt("A_S2", "TutA", "01", 2, "10:00", "11:00"),
    ]);
    expect(toSelection(result.schedules[0])[0].occurrence).toBe("01");
  });

  it("stops at the schedule cap and says so", () => {
    const meetings: Meeting[] = [];
    for (const [day, courseId] of ["A_S2", "B_S2", "C_S2"].entries()) {
      for (let hour = 8; hour < 18; hour++) {
        const hh = String(hour).padStart(2, "0");
        meetings.push(mt(courseId, "TutA", hh, day, `${hh}:00`, `${hh}:50`));
      }
    }
    const result = generate(meetings);
    expect(result.schedules).toHaveLength(500);
    expect(result.capped).toBe(true);
  });

  it("gives up after its step budget instead of hanging", () => {
    const meetings = ["01", "02", "03"].flatMap((occ) => [
      mt("A_S2", "TutA", occ, 0, "09:00", "10:00"),
      mt("B_S2", "TutA", occ, 1, "09:00", "10:00"),
    ]);
    const result = generate(meetings, { maxSteps: 2 });
    expect(result.capped).toBe(true);
  });

  it("names the activity that can't fit around the fixed classes", () => {
    const result = generate([
      mt("COMP1000_S2", "LecA", "01", 0, "10:00", "11:00"),
      mt("COMP2000_S2", "TutA", "01", 0, "10:00", "11:00"),
      mt("COMP2000_S2", "TutA", "02", 0, "10:30", "11:30"),
    ]);
    expect(result.schedules).toHaveLength(0);
    expect(result.unschedulable).toBe("COMP2000 TutA");
  });
});
