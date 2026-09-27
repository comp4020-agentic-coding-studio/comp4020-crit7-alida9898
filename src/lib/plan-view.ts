import type { GenerateResult } from "./generate";

// `?n=` is 1-based and user-editable; anything odd lands on a real page.
export function clampPage(raw: string | null, total: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1 || total === 0) return 1;
  return Math.min(n, total);
}

// What the schedule panel says when there's nothing to draw — always a reason.
// `narrowed` holds the "COURSE Activity"s the student has marked classes in.
export function emptyMessage(courseCount: number, result: GenerateResult, narrowed = new Set<string>()): string {
  if (courseCount === 0) return "Add a course to see schedules.";
  if (result.capped) return "Too many combinations to search. Try removing a course.";
  if (result.unschedulable && narrowed.has(result.unschedulable)) {
    return `No clash-free schedule: the ${result.unschedulable} classes you kept all clash with a class you can't move. Widen your choice on its page under “Your courses”.`;
  }
  if (result.unschedulable) {
    return `No clash-free schedule: every ${result.unschedulable} class clashes with a class you can't move.`;
  }
  return "No clash-free combination of these courses exists.";
}
