import { describe, expect, it } from "vitest";
import { filterCourses, levelOf, levelsIn, matchSubjects, subjectOf, type Subject } from "./course-search";

const course = (code: string, title: string) => ({ id: `${code}_S2`, code, title });
const COURSES = [
  course("COMP1110", "Structured Programming"),
  course("COMP2100", "Software Construction"),
  course("COMP6250", "Professional Practice 1"),
  course("ASTR4004", "Astronomical Computing"),
  course("MATH1014", "Mathematics and Applications 2"),
];
const SUBJECTS: Subject[] = [
  { code: "ASTR", name: "Astronomy and Astrophysics", school: "Research School of Astronomy", count: 1 },
  { code: "COMP", name: "Computer Science", school: "School of Computing", count: 3 },
  { code: "MATH", name: "Mathematics", school: "Mathematical Sciences Institute", count: 1 },
];
const codes = (list: { code: string }[]) => list.map((c) => c.code);

describe("subjectOf and levelOf", () => {
  it("splits a course code into subject and thousand-level", () => {
    expect(subjectOf("COMP2100")).toBe("COMP");
    expect(levelOf("COMP2100")).toBe(2000);
    expect(levelOf("LAWS8001")).toBe(8000);
  });
});

describe("matchSubjects", () => {
  it("finds a subject by its code", () => {
    expect(codes(matchSubjects(SUBJECTS, "comp"))).toEqual(["COMP"]);
  });

  it("finds a subject by the words people use for it, including the school", () => {
    expect(codes(matchSubjects(SUBJECTS, "computing"))).toEqual(["COMP"]);
    expect(codes(matchSubjects(SUBJECTS, "Maths"))).toEqual([]);
    expect(codes(matchSubjects(SUBJECTS, "mathematics"))).toEqual(["MATH"]);
  });

  it("ignores a one-letter query", () => {
    expect(matchSubjects(SUBJECTS, "c")).toEqual([]);
  });
});

describe("filterCourses", () => {
  it("lists every course of a subject", () => {
    expect(codes(filterCourses(COURSES, SUBJECTS, { subject: "COMP" }))).toEqual(["COMP1110", "COMP2100", "COMP6250"]);
  });

  it("narrows a subject to one level", () => {
    expect(codes(filterCourses(COURSES, SUBJECTS, { subject: "COMP", level: 2000 }))).toEqual(["COMP2100"]);
  });

  it("treats a subject name as that subject, plus titles that mention it", () => {
    expect(codes(filterCourses(COURSES, SUBJECTS, { q: "computing" }))).toEqual([
      "ASTR4004",
      "COMP1110",
      "COMP2100",
      "COMP6250",
    ]);
  });

  it("matches a code or code prefix", () => {
    expect(codes(filterCourses(COURSES, SUBJECTS, { q: "comp21" }))).toEqual(["COMP2100"]);
  });

  it("combines a query with a level", () => {
    expect(codes(filterCourses(COURSES, SUBJECTS, { q: "computing", level: 1000 }))).toEqual(["COMP1110"]);
  });

  it("returns nothing without a query or subject", () => {
    expect(filterCourses(COURSES, SUBJECTS, {})).toEqual([]);
  });
});

describe("levelsIn", () => {
  it("lists the levels present, in order", () => {
    expect(levelsIn(COURSES)).toEqual([1000, 2000, 4000, 6000]);
  });
});
