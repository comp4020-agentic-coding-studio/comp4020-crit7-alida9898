import { describe, expect, it } from "vitest";
import { parseSelection } from "./selection";

describe("parseSelection", () => {
  it("accepts an array of course/activity/occurrence triples", () => {
    const raw = JSON.stringify([{ courseId: "COMP1110_S2", activity: "ComA", occurrence: "01" }]);
    expect(parseSelection(raw)).toEqual([{ courseId: "COMP1110_S2", activity: "ComA", occurrence: "01" }]);
  });

  it("drops duplicate triples", () => {
    const one = { courseId: "A_S2", activity: "TutA", occurrence: "01" };
    expect(parseSelection(JSON.stringify([one, one]))).toEqual([one]);
  });

  it("rejects two different occurrences of the same course activity", () => {
    const raw = JSON.stringify([
      { courseId: "A_S2", activity: "TutA", occurrence: "01" },
      { courseId: "A_S2", activity: "TutA", occurrence: "02" },
    ]);
    expect(parseSelection(raw)).toBeNull();
  });

  it.each([
    ["not json"],
    ["{}"],
    ["[]"],
    ['[{"courseId":"A_S2","activity":"TutA"}]'],
    ['[{"courseId":1,"activity":"TutA","occurrence":"01"}]'],
    [JSON.stringify([{ courseId: "x".repeat(41), activity: "TutA", occurrence: "01" }])],
  ])("rejects %s", (raw) => {
    expect(parseSelection(raw)).toBeNull();
  });
});
