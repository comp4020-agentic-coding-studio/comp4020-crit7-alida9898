import { parseWeeks } from "./weeks";

// One row of the timetable: a single weekly meeting of one class.
export type Meeting = {
  courseId: string;
  activity: string;
  occurrence: string;
  day: number;
  startMin: number;
  finishMin: number;
  weeks: string;
  location: string;
};

// A class you can enrol in: one occurrence of one activity, which may meet
// more than once a week (choosing it means attending all its meetings).
export type Option = {
  courseId: string;
  activity: string;
  occurrence: string;
  meetings: Meeting[];
};

// One option for every activity of every course in the plan.
export type Schedule = Option[];

export type Selection = { courseId: string; activity: string; occurrence: string }[];

export type GenerateResult = {
  schedules: Schedule[];
  // true when the schedule cap or the step budget stopped the search early
  capped: boolean;
  // when there are no schedules, the "COURSE Activity" that can't fit around
  // the fixed classes, or null if it's the combination that fails
  unschedulable: string | null;
};

export const MAX_SCHEDULES = 500;
const MAX_STEPS = 200_000;

export function courseCode(courseId: string): string {
  return courseId.split("_")[0];
}

// Drop-ins are optional help sessions, not something you enrol in.
function isOptional(activity: string): boolean {
  return activity.startsWith("Dro");
}

export function groupOptions(meetings: Meeting[]): Option[][] {
  const byActivity = new Map<string, Map<string, Meeting[]>>();
  for (const meeting of meetings) {
    if (isOptional(meeting.activity)) continue;
    const key = `${meeting.courseId} ${meeting.activity}`;
    const occurrences = byActivity.get(key) ?? new Map<string, Meeting[]>();
    byActivity.set(key, occurrences);
    const list = occurrences.get(meeting.occurrence) ?? [];
    occurrences.set(meeting.occurrence, list);
    list.push(meeting);
  }
  return [...byActivity.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, occurrences]) =>
      [...occurrences.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([occurrence, list]) => ({
          courseId: list[0].courseId,
          activity: list[0].activity,
          occurrence,
          meetings: list,
        })),
    );
}

export function toSelection(schedule: Schedule): Selection {
  return schedule.map(({ courseId, activity, occurrence }) => ({ courseId, activity, occurrence }));
}

export function generate(
  meetings: Meeting[],
  limits: { maxSchedules?: number; maxSteps?: number } = {},
): GenerateResult {
  const maxSchedules = limits.maxSchedules ?? MAX_SCHEDULES;
  const maxSteps = limits.maxSteps ?? MAX_STEPS;
  // fewest options first: fixed classes constrain everything after them
  const activities = groupOptions(meetings).sort((a, b) => a.length - b.length);
  if (activities.length === 0) return { schedules: [], capped: false, unschedulable: null };

  const weekSets = new Map<Meeting, Set<number>>();
  const weeksOf = (m: Meeting) => {
    let set = weekSets.get(m);
    if (!set) weekSets.set(m, (set = parseWeeks(m.weeks)));
    return set;
  };
  const weeksOverlap = (a: Set<number>, b: Set<number>) =>
    a.size === 0 || b.size === 0 || [...a].some((w) => b.has(w));
  const meetingsClash = (a: Meeting, b: Meeting) =>
    a.day === b.day &&
    a.startMin < b.finishMin &&
    b.startMin < a.finishMin &&
    weeksOverlap(weeksOf(a), weeksOf(b));
  const clash = (x: Option, y: Option) =>
    x.meetings.some((m) => y.meetings.some((n) => meetingsClash(m, n)));

  const schedules: Schedule[] = [];
  const chosen: Option[] = [];
  let steps = 0;
  let capped = false;

  const walk = (i: number): void => {
    if (i === activities.length) {
      schedules.push([...chosen]);
      if (schedules.length >= maxSchedules) capped = true;
      return;
    }
    for (const option of activities[i]) {
      if (++steps > maxSteps) {
        capped = true;
        return;
      }
      if (chosen.some((c) => clash(c, option))) continue;
      chosen.push(option);
      walk(i + 1);
      chosen.pop();
      if (capped) return;
    }
  };
  walk(0);

  let unschedulable: string | null = null;
  if (schedules.length === 0 && !capped) {
    const fixed = activities.filter((a) => a.length === 1).map((a) => a[0]);
    const blocked = activities.find((options) =>
      options.every((option) => fixed.some((f) => f !== option && clash(f, option))),
    );
    if (blocked) unschedulable = `${courseCode(blocked[0].courseId)} ${blocked[0].activity}`;
  }
  return { schedules, capped, unschedulable };
}
