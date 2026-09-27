import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import type { Selection } from "./generate";
import type { ClassPref } from "./prefs";
import { classPrefs, planCourses, plans, savedSchedules } from "./schema";

export type Plan = typeof plans.$inferSelect;
export type SavedSchedule = { id: number; selection: Selection; createdAt: string };

// A plan has no owner: its unguessable id in the URL is the whole of access,
// and this cookie only remembers which plan this browser last opened.
export const PLAN_COOKIE = "plan";
export const planCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export function createPlan(): Plan {
  return db
    .insert(plans)
    .values({ id: randomBytes(12).toString("base64url") })
    .returning()
    .get();
}

export function getPlan(id: string): Plan | undefined {
  return db.select().from(plans).where(eq(plans.id, id)).get();
}

// in the order they were added (rowid order)
export function planCourseIds(planId: string): string[] {
  return db
    .select({ courseId: planCourses.courseId })
    .from(planCourses)
    .where(eq(planCourses.planId, planId))
    .orderBy(sql`rowid`)
    .all()
    .map((row) => row.courseId);
}

export function addCourse(planId: string, courseId: string): void {
  db.insert(planCourses).values({ planId, courseId }).onConflictDoNothing().run();
}

// removing a course also forgets its class marks
export function removeCourse(planId: string, courseId: string): void {
  db.delete(planCourses)
    .where(and(eq(planCourses.planId, planId), eq(planCourses.courseId, courseId)))
    .run();
  db.delete(classPrefs)
    .where(and(eq(classPrefs.planId, planId), eq(classPrefs.courseId, courseId)))
    .run();
}

export function saveSchedule(planId: string, selection: Selection): number {
  return db
    .insert(savedSchedules)
    .values({ planId, selection: JSON.stringify(selection) })
    .returning({ id: savedSchedules.id })
    .get().id;
}

const toSaved = (row: typeof savedSchedules.$inferSelect): SavedSchedule => ({
  id: row.id,
  selection: JSON.parse(row.selection) as Selection,
  createdAt: row.createdAt,
});

export function listSaved(planId: string): SavedSchedule[] {
  return db
    .select()
    .from(savedSchedules)
    .where(eq(savedSchedules.planId, planId))
    .orderBy(asc(savedSchedules.id))
    .all()
    .map(toSaved);
}

export function getSaved(planId: string, id: number): SavedSchedule | undefined {
  const row = db
    .select()
    .from(savedSchedules)
    .where(and(eq(savedSchedules.planId, planId), eq(savedSchedules.id, id)))
    .get();
  return row && toSaved(row);
}

export function listPrefs(planId: string): ClassPref[] {
  return db
    .select({
      courseId: classPrefs.courseId,
      activity: classPrefs.activity,
      occurrence: classPrefs.occurrence,
      mode: classPrefs.mode,
    })
    .from(classPrefs)
    .where(eq(classPrefs.planId, planId))
    .orderBy(asc(classPrefs.courseId), asc(classPrefs.activity), asc(classPrefs.occurrence))
    .all();
}

// Mark one class "only" or "exclude", or clear its mark.
export function setPref(planId: string, target: Omit<ClassPref, "mode">, mode: ClassPref["mode"] | "clear"): void {
  const where = and(
    eq(classPrefs.planId, planId),
    eq(classPrefs.courseId, target.courseId),
    eq(classPrefs.activity, target.activity),
    eq(classPrefs.occurrence, target.occurrence),
  );
  if (mode === "clear") {
    db.delete(classPrefs).where(where).run();
    return;
  }
  db.insert(classPrefs)
    .values({ planId, ...target, mode })
    .onConflictDoUpdate({
      target: [classPrefs.planId, classPrefs.courseId, classPrefs.activity, classPrefs.occurrence],
      set: { mode },
    })
    .run();
}

// Where a form may send the browser back to: only this plan's own pages,
// never somewhere a forged `back` field names.
export function backTo(planId: string, back: string): string | undefined {
  const home = `/plan/${planId}`;
  return back === home || back.startsWith(`${home}/search`) || back.startsWith(`${home}?`) ? back : undefined;
}
