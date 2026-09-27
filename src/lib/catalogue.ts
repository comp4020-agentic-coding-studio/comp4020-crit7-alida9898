import { asc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "./db";
import type { Meeting, Selection } from "./generate";
import { courses, meetings } from "./schema";

export type Course = typeof courses.$inferSelect;

const SEARCH_LIMIT = 20;
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

// Code or title substring; SQLite's LIKE is case-insensitive for ASCII.
export function searchCourses(q: string): Course[] {
  const term = q.trim();
  if (term.length < 2) return [];
  const pattern = `%${term}%`;
  return db
    .select()
    .from(courses)
    .where(or(like(courses.code, pattern), like(courses.title, pattern)))
    .orderBy(asc(courses.code))
    .limit(SEARCH_LIMIT)
    .all();
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
