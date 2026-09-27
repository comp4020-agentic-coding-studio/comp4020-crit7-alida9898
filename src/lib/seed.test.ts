import { describe, expect, it } from "vitest";
import { catalogueRows } from "./seed";

describe("catalogueRows", () => {
  it("turns the scrape into course and meeting rows", () => {
    const { courseRows, meetingRows } = catalogueRows({
      COMP1110_S2: {
        id: "COMP1110_S2",
        title: "COMP1110_S2 Structured Programming",
        link: "https://programsandcourses.anu.edu.au/2026/course/COMP1110",
        dates: "ignored",
        classes: [
          {
            name: "COMP1110_S2-ComA/01",
            day: 0,
            start: "09:00",
            finish: "10:30",
            weeks: "31–36",
            activity: "ComA",
            occurrence: "01",
            location: " ",
            locationID: "",
          },
        ],
      },
    });
    expect(courseRows).toEqual([
      {
        id: "COMP1110_S2",
        code: "COMP1110",
        title: "Structured Programming",
        link: "https://programsandcourses.anu.edu.au/2026/course/COMP1110",
      },
    ]);
    expect(meetingRows).toEqual([
      {
        courseId: "COMP1110_S2",
        activity: "ComA",
        occurrence: "01",
        day: 0,
        startMin: 540,
        finishMin: 630,
        weeks: "31–36",
        location: "",
      },
    ]);
  });
});
