import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import type { Selection } from "./generate";
import { planCourses, plans, savedSchedules } from "./schema";

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

export function removeCourse(planId: string, courseId: string): void {
  db.delete(planCourses)
    .where(and(eq(planCourses.planId, planId), eq(planCourses.courseId, courseId)))
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
