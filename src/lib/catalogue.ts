import { asc, eq, inArray } from "drizzle-orm";
import courseDetails from "../../data/courses-2026.json";
import subjectNames from "../../data/subjects-2026.json";
import { type Subject, subjectOf } from "./course-search";
import { db } from "./db";
import type { Meeting, Selection } from "./generate";
import { courses, meetings } from "./schema";

export type Course = typeof courses.$inferSelect;
// from Programs and Courses (scripts/fetch-course-info.ts), keyed by code
export type CourseInfo = { description: string; conveners: string[]; units: string };

export function courseInfo(code: string): CourseInfo | undefined {
  return (courseDetails as Record<string, CourseInfo>)[code];
}

const meetingColumns = {
  courseId: meetings.courseId,
  activity: meetings.activity,
  occurrence: meetings.occurrence,
  day: meetings.day,
  startMin: meetings.startMin,
  finishMin: meetings.finishMin,
  weeks: meetings.weeks,
  location: meetings.location,
};

export function allCourses(): Course[] {
  return db.select().from(courses).orderBy(asc(courses.code)).all();
}

// Every subject with courses this term; names come from Programs and Courses
// (scripts/fetch-subjects.ts), falling back to the code.
export function allSubjects(list: Course[] = allCourses()): Subject[] {
  const names = subjectNames as Record<string, { name: string; school: string }>;
  const counts = new Map<string, number>();
  for (const c of list) counts.set(subjectOf(c.code), (counts.get(subjectOf(c.code)) ?? 0) + 1);
  return [...counts]
    .map(([code, count]) => ({ code, count, name: names[code]?.name ?? code, school: names[code]?.school ?? "" }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function getCourses(ids: string[]): Course[] {
  if (ids.length === 0) return [];
  const found = new Map(
    db.select().from(courses).where(inArray(courses.id, ids)).all().map((c) => [c.id, c]),
  );
  return ids.flatMap((id) => found.get(id) ?? []);
}

export function courseExists(id: string): boolean {
  return db.select({ id: courses.id }).from(courses).where(eq(courses.id, id)).get() !== undefined;
}

export function meetingsFor(courseIds: string[]): Meeting[] {
  if (courseIds.length === 0) return [];
  return db.select(meetingColumns).from(meetings).where(inArray(meetings.courseId, courseIds)).all();
}

const key = (s: { courseId: string; activity: string; occurrence: string }) =>
  `${s.courseId} ${s.activity} ${s.occurrence}`;

export function meetingsForSelection(selection: Selection): Meeting[] {
  const wanted = new Set(selection.map(key));
  const courseIds = [...new Set(selection.map((s) => s.courseId))];
  return meetingsFor(courseIds).filter((m) => wanted.has(key(m)));
}

export function selectionExists(selection: Selection): boolean {
  const found = new Set(meetingsForSelection(selection).map(key));
  return selection.every((s) => found.has(key(s)));
}
