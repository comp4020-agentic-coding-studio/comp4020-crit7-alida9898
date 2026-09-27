import { courseCode, type Meeting } from "./generate";

// A student's say over one class: "only" keeps just the classes marked so in
// that activity (several may be); "exclude" drops that class. Everything
// unmarked stays in the pool the generator combines.
export type ClassPref = { courseId: string; activity: string; occurrence: string; mode: "only" | "exclude" };

const activityKey = (x: { courseId: string; activity: string }) => `${x.courseId} ${x.activity}`;
const classKey = (x: { courseId: string; activity: string; occurrence: string }) =>
  `${activityKey(x)} ${x.occurrence}`;

export function applyPrefs(meetings: Meeting[], prefs: ClassPref[]): { meetings: Meeting[]; emptied: string[] } {
  if (prefs.length === 0) return { meetings, emptied: [] };
  const only = new Set(prefs.filter((p) => p.mode === "only").map(classKey));
  const onlyActivities = new Set(prefs.filter((p) => p.mode === "only").map(activityKey));
  const excluded = new Set(prefs.filter((p) => p.mode === "exclude").map(classKey));

  const kept = meetings.filter((m) =>
    onlyActivities.has(activityKey(m)) ? only.has(classKey(m)) : !excluded.has(classKey(m)),
  );
  const before = new Set(meetings.map(activityKey));
  const after = new Set(kept.map(activityKey));
  const emptied = [...before]
    .filter((key) => !after.has(key))
    .map((key) => {
      const [courseId, activity] = key.split(" ");
      return `${courseCode(courseId)} ${activity}`;
    });
  return { meetings: kept, emptied };
}

const ACTIVITY_NAMES: Record<string, string> = {
  Lec: "Lecture",
  Tut: "Tutorial",
  Com: "Computer lab",
  Wor: "Workshop",
  Lab: "Lab",
  Sem: "Seminar",
  Pra: "Practical",
  Stu: "Studio",
  Asm: "Assessment",
  Dro: "Drop-in",
  Fie: "Field trip",
  Rev: "Revision",
  Pre: "Presentation",
  Ind: "Individual",
  Rep: "Repeat",
  Sup: "Supervision",
};

// "TutB" → "Tutorial B"; unknown codes are shown as they are
export function activityLabel(activity: string): string {
  const name = ACTIVITY_NAMES[activity.slice(0, 3)];
  return name ? `${name} ${activity.slice(3)}`.trim() : activity;
}
