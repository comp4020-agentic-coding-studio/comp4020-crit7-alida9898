# ANU Schedule Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the starter guestbook with an ANU Semester 2 2026 schedule builder: add courses, page through every clash-free combination as a week grid, save the ones you like.

**Architecture:** Astro SSR pages with plain HTML forms (POST → 303), as in the starter. The timetable catalogue (from the ANU CSSA scrape) is seeded into SQLite at boot; user state (plans, their courses, saved schedules) lives in SQLite beside it. Schedule generation and week layout are pure TypeScript modules with unit tests; pages only wire them to the DB.

**Tech Stack:** Astro 7 (node adapter, `output: "server"`), Drizzle ORM 0.45 + drizzle-kit, better-sqlite3, Vitest 4, jsdom, axe-core.

**Spec:** `docs/superpowers/specs/2026-09-27-anu-schedule-builder-design.md`

## Global Constraints

- One term only: 2026 S2. Catalogue source: `public/timetable_data/2026/S2.json` from github.com/anucssa/anutimetable, committed as `data/2026-S2.json`.
- No new runtime dependencies. Do not edit `fly.toml` or `Dockerfile`.
- Schema changes only via `src/lib/schema.ts` + `pnpm db:generate`; commit the generated migration; never hand-edit `drizzle/`.
- Plan ids: `randomBytes(12).toString("base64url")` (16 URL-safe chars). The plan cookie is named `plan`.
- `MAX_SCHEDULES = 500`. Activities whose code starts with `Dro` are excluded from generation.
- Clash rule: same `day`, `a.start < b.finish && b.start < a.finish`, and week sets intersect (an empty/unparseable week set counts as "every week").
- Meetings that run in ≤ 2 weeks are "one-off": listed under the grid, not drawn in it.
- Every page renders through `src/components/Layout.astro` (lang `en-AU`, viewport, `<nav aria-label="site">`, exactly one `<h1>`).
- Every static route is listed in `spec/routes.ts`.
- Forms work without client JS: POST, then 303 redirect.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Classes on weekends or outside 9–5** (data has days 0–6 and times 07:00–22:00) → the grid grows to show them, never drops them. Pinned in Task 3.
2. **Two recurring meetings at the same time in disjoint weeks** (legal, not a clash) → both visible side by side, not stacked on top of each other. Pinned in Task 3.
3. **A plan with no courses, or courses with no clash-free combination** → a clear sentence saying why, not a blank panel. Pinned in Tasks 2, 3, 6.
4. **Garbage or out-of-range `?n=`** (`0`, `abc`, `99999`) → clamps to a valid page. Pinned in Task 3.
5. **Forged or stale POSTs** (unknown course id, malformed/unknown selection JSON, unknown plan) → 400/404, nothing written. Pinned in Task 5.

---

## File map

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Two projects: `unit` (pure, no server) and `spec` (boots built server) |
| `src/lib/weeks.ts` | Parse `"31‑36,39‑44"` into a week set |
| `src/lib/generate.ts` | Domain types; group meetings into options; clash-free generation |
| `src/lib/selection.ts` | Parse/validate the saved-selection JSON shape |
| `src/lib/week-layout.ts` | Turn a schedule into grid geometry (days, hour range, lanes, one-offs) |
| `src/lib/plan-view.ts` | Page clamping and the empty-state sentence |
| `src/lib/schema.ts` | Drizzle tables |
| `src/lib/seed.ts` | Raw JSON → catalogue rows; idempotent seed |
| `src/lib/db.ts` | Open DB, migrate, seed |
| `src/lib/catalogue.ts` | Course search and meeting lookups |
| `src/lib/plans.ts` | Plan CRUD, saved schedules, cookie options |
| `src/components/Layout.astro` | Shared page shell |
| `src/components/WeekGrid.astro` | Renders a schedule's week grid |
| `src/pages/index.astro` | Home |
| `src/pages/example.astro` | Read-only example (COMP1110 + COMP2100) |
| `src/pages/plan/[id]/index.astro` | Planner |
| `src/pages/plan/[id]/saved/[sid].astro` | One saved schedule |
| `src/pages/404.astro` | Not found |
| `src/pages/api/plans/index.ts` | POST create plan |
| `src/pages/api/plans/[id]/courses.ts` | POST add/remove course |
| `src/pages/api/plans/[id]/saved.ts` | POST save schedule |
| `spec/schedule.test.ts` | Contracts against the running app |

---

### Task 1: Retire the guestbook and split the test runner

**Files:**
- Modify: `vitest.config.ts`, `src/lib/schema.ts`, `src/lib/db.ts`, `src/pages/index.astro`, `src/pages/readme.astro`
- Create: `src/components/Layout.astro`, a new migration under `drizzle/` (generated)
- Delete: `src/lib/events.ts`, `src/pages/api/messages.ts`, `src/pages/api/events.ts`, `spec/guestbook.test.ts`

**Interfaces:**
- Produces: `Layout.astro` with prop `title: string` and a default slot; `db` export from `src/lib/db.ts` (unchanged name).

- [ ] **Step 1: Split vitest into unit and spec projects**

Replace `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

// Two projects: `unit` runs pure modules with no server (fast, run it while
// building); `spec` boots the built server once and checks what ships.
// `pnpm test` builds first and runs both.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "spec",
          include: ["spec/**/*.test.ts"],
          globalSetup: ["./spec/global-setup.ts"],
        },
      },
    ],
  },
});
```

- [ ] **Step 2: Delete the guestbook plumbing**

```bash
git rm src/lib/events.ts src/pages/api/messages.ts src/pages/api/events.ts spec/guestbook.test.ts
```

- [ ] **Step 3: Empty the schema and generate the drop migration**

Replace `src/lib/schema.ts` with the header comment only (keep the starter's explanation, it still applies):

```ts
// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export {};
```

Run: `pnpm db:generate`
Expected: a new `drizzle/0001_*.sql` containing `DROP TABLE \`messages\`;`. (Dropping in its own migration keeps drizzle-kit from asking whether new tables are renames of `messages` in Task 4.)

- [ ] **Step 4: Trim db.ts to open + migrate**

Replace `src/lib/db.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });
```

- [ ] **Step 5: Add the shared layout**

Create `src/components/Layout.astro`:

```astro
---
// Every page's shell: the invariants in spec/ want a language, a viewport,
// a real title, a nav landmark and exactly one h1 (the page supplies the h1).
import "../styles.css";

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <nav aria-label="site">
      <a href="/">Schedule builder</a>
      <a href="/readme/">About</a>
    </nav>
    <main>
      <slot />
    </main>
    <footer>
      <p>
        Class data: the <a href="https://github.com/anucssa/anutimetable">ANU CSSA timetable</a>
        scrape of the official ANU timetable, Semester 2 2026. Unofficial — check MyTimetable
        before you enrol.
      </p>
    </footer>
  </body>
</html>
```

- [ ] **Step 6: Placeholder home and readme on the layout**

Replace `src/pages/index.astro` (Task 6 gives it its real content):

```astro
---
import Layout from "../components/Layout.astro";
---

<Layout title="ANU Schedule Builder">
  <h1>ANU Schedule Builder</h1>
  <p>Coming together — add your Semester 2 2026 courses and see every clash-free timetable.</p>
</Layout>
```

Replace `src/pages/readme.astro`:

```astro
---
// README.md, rendered: what this app is and what good looks like here,
// published with the app. spec/readme.test.ts checks the whole of it is here.
import * as readme from "../../README.md";
import Layout from "../components/Layout.astro";

const title = readme.getHeadings().find((h) => h.depth === 1)?.text ?? "README";

// README images are committed to public/ and linked relatively (public/x.png)
// so they render on GitHub; here they're served from the site root.
const html = (await readme.compiledContent()).replace(/(src|href)="public\//g, '$1="/');
---

<Layout title={title}>
  <Fragment set:html={html} />
</Layout>
```

- [ ] **Step 7: Run the full check**

Run: `pnpm check`
Expected: typecheck passes; `unit` runs `scripts/check-evidence.test.ts` green; `spec` runs invariants + readme green; no guestbook tests.

- [ ] **Step 8: Commit**

```bash
git add -A vitest.config.ts src spec drizzle
git commit -m "chore: retire the guestbook starter, split unit and spec tests

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Week parsing and clash-free generation

**Files:**
- Create: `src/lib/weeks.ts`, `src/lib/generate.ts`
- Test: `src/lib/weeks.test.ts`, `src/lib/generate.test.ts`

**Interfaces:**
- Produces:
  - `parseWeeks(weeks: string): Set<number>`
  - `type Meeting = { courseId: string; activity: string; occurrence: string; day: number; startMin: number; finishMin: number; weeks: string; location: string }`
  - `type Option = { courseId: string; activity: string; occurrence: string; meetings: Meeting[] }`
  - `type Schedule = Option[]`
  - `type Selection = { courseId: string; activity: string; occurrence: string }[]`
  - `type GenerateResult = { schedules: Schedule[]; capped: boolean; unschedulable: string | null }`
  - `MAX_SCHEDULES = 500`
  - `groupOptions(meetings: Meeting[]): Option[][]` — one inner array per `(course, activity)`, `Dro*` excluded, sorted by key then occurrence
  - `generate(meetings: Meeting[], limits?: { maxSchedules?: number; maxSteps?: number }): GenerateResult`
  - `toSelection(schedule: Schedule): Selection`
  - `courseCode(courseId: string): string` — `"COMP1110_S2"` → `"COMP1110"`

- [ ] **Step 1: Write the failing weeks tests**

Create `src/lib/weeks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseWeeks } from "./weeks";

describe("parseWeeks", () => {
  it("reads ranges joined by the scrape's non-breaking hyphen", () => {
    expect([...parseWeeks("31‑36,39‑44")]).toEqual([
      31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44,
    ]);
  });

  it("reads a single week", () => {
    expect([...parseWeeks("35")]).toEqual([35]);
  });

  it("accepts an ASCII hyphen", () => {
    expect([...parseWeeks("31-33")]).toEqual([31, 32, 33]);
  });

  it("returns an empty set for an empty string", () => {
    expect(parseWeeks("").size).toBe(0);
  });

  it("ignores a trailing comma rather than inventing week 0", () => {
    expect([...parseWeeks("31‑33,")]).toEqual([31, 32, 33]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run --project unit src/lib/weeks.test.ts`
Expected: FAIL — cannot resolve `./weeks`.

- [ ] **Step 3: Implement weeks.ts**

Create `src/lib/weeks.ts`:

```ts
// The scrape writes teaching weeks as calendar-week ranges, e.g.
// "31‑36,39‑44" — joined with U+2011 (non-breaking hyphen), not "-".
const DASH = /[-‐-―]/;

export function parseWeeks(weeks: string): Set<number> {
  const out = new Set<number>();
  for (const part of weeks.split(",")) {
    const [a = "", b = a] = part.split(DASH).map((s) => s.trim());
    if (a === "" || b === "") continue;
    const from = Number(a);
    const to = Number(b);
    if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
    for (let week = from; week <= to; week++) out.add(week);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run --project unit src/lib/weeks.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Write the failing generator tests**

Create `src/lib/generate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generate, groupOptions, type Meeting, toSelection } from "./generate";

const TERM = "31‑36,39‑44";

function mt(
  courseId: string,
  activity: string,
  occurrence: string,
  day: number,
  start: string,
  finish: string,
  weeks = TERM,
): Meeting {
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return {
    courseId,
    activity,
    occurrence,
    day,
    startMin: min(start),
    finishMin: min(finish),
    weeks,
    location: "",
  };
}

describe("groupOptions", () => {
  it("groups meetings into options per activity and drops drop-ins", () => {
    const groups = groupOptions([
      mt("A_S2", "LecA", "01", 0, "09:00", "10:00"),
      mt("A_S2", "LecA", "01", 2, "09:00", "10:00"),
      mt("A_S2", "TutA", "02", 1, "11:00", "12:00"),
      mt("A_S2", "TutA", "01", 1, "10:00", "11:00"),
      mt("A_S2", "DroA", "01", 3, "10:00", "11:00"),
    ]);
    expect(groups.map((g) => g.map((o) => `${o.activity}/${o.occurrence}`))).toEqual([
      ["LecA/01"],
      ["TutA/01", "TutA/02"],
    ]);
    expect(groups[0][0].meetings).toHaveLength(2);
  });
});

describe("generate", () => {
  it("returns nothing, uncapped, for no meetings", () => {
    expect(generate([])).toEqual({ schedules: [], capped: false, unschedulable: null });
  });

  it("returns the one schedule when every activity is fixed", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "09:00", "10:00"),
      mt("B_S2", "LecA", "01", 1, "09:00", "10:00"),
    ]);
    expect(result.schedules).toHaveLength(1);
  });

  it("prunes a tutorial that clashes with a fixed lecture", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "09:00", "11:00"),
      mt("B_S2", "TutA", "01", 0, "10:00", "11:00"),
      mt("B_S2", "TutA", "02", 0, "11:00", "12:00"),
    ]);
    expect(result.schedules.map((s) => toSelection(s).map((o) => o.occurrence))).toEqual([
      ["01", "02"],
    ]);
  });

  it("allows the same slot when the weeks don't overlap", () => {
    const result = generate([
      mt("A_S2", "AsmA", "01", 0, "10:00", "11:00", "35"),
      mt("B_S2", "TutA", "01", 0, "10:00", "11:00", "31‑34"),
    ]);
    expect(result.schedules).toHaveLength(1);
  });

  it("treats an unknown week set as every week", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 0, "10:00", "11:00", ""),
      mt("B_S2", "LecA", "01", 0, "10:00", "11:00", "35"),
    ]);
    expect(result.schedules).toHaveLength(0);
  });

  it("rejects an option when any one of its meetings clashes", () => {
    const result = generate([
      mt("A_S2", "LecA", "01", 2, "09:00", "10:00"),
      mt("B_S2", "ComA", "01", 0, "09:00", "10:00"),
      mt("B_S2", "ComA", "01", 2, "09:00", "10:00"),
      mt("B_S2", "ComA", "02", 3, "09:00", "10:00"),
    ]);
    expect(result.schedules.map((s) => toSelection(s).find((o) => o.courseId === "B_S2")?.occurrence)).toEqual(["02"]);
  });

  it("orders results deterministically, first options first", () => {
    const result = generate([
      mt("A_S2", "TutA", "02", 1, "10:00", "11:00"),
      mt("A_S2", "TutA", "01", 2, "10:00", "11:00"),
    ]);
    expect(toSelection(result.schedules[0])[0].occurrence).toBe("01");
  });

  it("stops at the schedule cap and says so", () => {
    const meetings: Meeting[] = [];
    for (const [day, courseId] of ["A_S2", "B_S2", "C_S2"].entries()) {
      for (let hour = 8; hour < 18; hour++) {
        const hh = String(hour).padStart(2, "0");
        meetings.push(mt(courseId, "TutA", hh, day, `${hh}:00`, `${hh}:50`));
      }
    }
    const result = generate(meetings);
    expect(result.schedules).toHaveLength(500);
    expect(result.capped).toBe(true);
  });

  it("gives up after its step budget instead of hanging", () => {
    const meetings = ["01", "02", "03"].flatMap((occ) => [
      mt("A_S2", "TutA", occ, 0, "09:00", "10:00"),
      mt("B_S2", "TutA", occ, 1, "09:00", "10:00"),
    ]);
    const result = generate(meetings, { maxSteps: 2 });
    expect(result.capped).toBe(true);
  });

  it("names the activity that can't fit around the fixed classes", () => {
    const result = generate([
      mt("COMP1000_S2", "LecA", "01", 0, "10:00", "11:00"),
      mt("COMP2000_S2", "TutA", "01", 0, "10:00", "11:00"),
      mt("COMP2000_S2", "TutA", "02", 0, "10:30", "11:30"),
    ]);
    expect(result.schedules).toHaveLength(0);
    expect(result.unschedulable).toBe("COMP2000 TutA");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run --project unit src/lib/generate.test.ts`
Expected: FAIL — cannot resolve `./generate`.

- [ ] **Step 7: Implement generate.ts**

Create `src/lib/generate.ts`:

```ts
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
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm vitest run --project unit src/lib`
Expected: all weeks + generate tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/weeks.ts src/lib/weeks.test.ts src/lib/generate.ts src/lib/generate.test.ts
git commit -m "feat: week parsing and clash-free schedule generation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Week layout, paging and empty-state copy

**Files:**
- Create: `src/lib/week-layout.ts`, `src/lib/plan-view.ts`, `src/lib/selection.ts`
- Test: `src/lib/week-layout.test.ts`, `src/lib/plan-view.test.ts`, `src/lib/selection.test.ts`

**Interfaces:**
- Consumes: `Meeting`, `Schedule`, `Selection`, `GenerateResult` from `./generate`; `parseWeeks` from `./weeks`.
- Produces:
  - `type Block = Meeting & { lane: number; lanes: number }`
  - `type OneOff = Meeting & { weekList: number[] }`
  - `type WeekLayout = { days: number[]; startMin: number; endMin: number; blocks: Block[]; oneOffs: OneOff[] }`
  - `layoutWeek(schedule: Schedule): WeekLayout`
  - `clampPage(raw: string | null, total: number): number` (1-based)
  - `emptyMessage(courseCount: number, result: GenerateResult): string`
  - `parseSelection(raw: string): Selection | null`

- [ ] **Step 1: Write the failing layout tests**

Create `src/lib/week-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Meeting, Schedule } from "./generate";
import { layoutWeek } from "./week-layout";

function option(day: number, startMin: number, finishMin: number, weeks = "31–36", occurrence = "01"): Schedule[number] {
  const meeting: Meeting = {
    courseId: "A_S2",
    activity: `Act${occurrence}`,
    occurrence,
    day,
    startMin,
    finishMin,
    weeks,
    location: "",
  };
  return { courseId: "A_S2", activity: meeting.activity, occurrence, meetings: [meeting] };
}

describe("layoutWeek", () => {
  it("shows Mon–Fri and at least 09:00–17:00 by default", () => {
    const layout = layoutWeek([option(1, 600, 660)]);
    expect(layout.days).toEqual([0, 1, 2, 3, 4]);
    expect([layout.startMin, layout.endMin]).toEqual([540, 1020]);
  });

  it("grows to include weekends and early or late classes", () => {
    const layout = layoutWeek([option(6, 420, 480), option(2, 1200, 1290)]);
    expect(layout.days).toEqual([0, 1, 2, 3, 4, 6]);
    expect(layout.startMin).toBe(420);
    expect(layout.endMin).toBe(1320);
  });

  it("lists one-off sessions instead of drawing them", () => {
    const layout = layoutWeek([option(0, 600, 660), option(1, 600, 660, "35", "02")]);
    expect(layout.blocks).toHaveLength(1);
    expect(layout.oneOffs.map((m) => m.weekList)).toEqual([[35]]);
  });

  it("puts same-time meetings in disjoint weeks side by side", () => {
    const layout = layoutWeek([
      option(0, 600, 660, "31–34", "01"),
      option(0, 600, 660, "39–44", "02"),
    ]);
    expect(layout.blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("draws a meeting with unknown weeks as recurring", () => {
    expect(layoutWeek([option(0, 600, 660, "")]).blocks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Write the failing plan-view and selection tests**

Create `src/lib/plan-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampPage, emptyMessage } from "./plan-view";

describe("clampPage", () => {
  it.each([
    [null, 10, 1],
    ["3", 10, 3],
    ["0", 10, 1],
    ["-4", 10, 1],
    ["abc", 10, 1],
    ["99999", 10, 10],
    ["2", 0, 1],
  ])("clamps %s of %i to %i", (raw, total, expected) => {
    expect(clampPage(raw, total)).toBe(expected);
  });
});

describe("emptyMessage", () => {
  const none = { schedules: [], capped: false, unschedulable: null };

  it("asks for a course when the plan is empty", () => {
    expect(emptyMessage(0, none)).toBe("Add a course to see schedules.");
  });

  it("names the activity that can't fit", () => {
    expect(emptyMessage(2, { ...none, unschedulable: "COMP2000 TutA" })).toBe(
      "No clash-free schedule: every COMP2000 TutA class clashes with a class you can't move.",
    );
  });

  it("explains a search that ran out of budget", () => {
    expect(emptyMessage(6, { ...none, capped: true })).toBe(
      "Too many combinations to search. Try removing a course.",
    );
  });

  it("falls back to the combination failing", () => {
    expect(emptyMessage(3, none)).toBe("No clash-free combination of these courses exists.");
  });
});
```

Create `src/lib/selection.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm vitest run --project unit src/lib/week-layout.test.ts src/lib/plan-view.test.ts src/lib/selection.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement week-layout.ts**

Create `src/lib/week-layout.ts`:

```ts
import type { Meeting, Schedule } from "./generate";
import { parseWeeks } from "./weeks";

// A drawn meeting: `lane` of `lanes` columns within its day, so meetings at
// the same time in different weeks sit side by side instead of overlapping.
export type Block = Meeting & { lane: number; lanes: number };
export type OneOff = Meeting & { weekList: number[] };

export type WeekLayout = {
  days: number[];
  startMin: number;
  endMin: number;
  blocks: Block[];
  oneOffs: OneOff[];
};

// Meetings that run this few weeks (assessments, one-off labs) would clutter
// a typical week, so they're listed under the grid instead.
export const ONE_OFF_MAX_WEEKS = 2;
const WEEKDAYS = [0, 1, 2, 3, 4];
const HOUR = 60;

export function layoutWeek(schedule: Schedule): WeekLayout {
  const recurring: Meeting[] = [];
  const oneOffs: OneOff[] = [];
  for (const meeting of schedule.flatMap((option) => option.meetings)) {
    const weeks = parseWeeks(meeting.weeks);
    if (weeks.size > 0 && weeks.size <= ONE_OFF_MAX_WEEKS) {
      oneOffs.push({ ...meeting, weekList: [...weeks].sort((a, b) => a - b) });
    } else {
      recurring.push(meeting);
    }
  }

  const days = [...new Set([...WEEKDAYS, ...recurring.map((m) => m.day)])].sort((a, b) => a - b);
  const startMin = Math.min(9 * HOUR, ...recurring.map((m) => Math.floor(m.startMin / HOUR) * HOUR));
  const endMin = Math.max(17 * HOUR, ...recurring.map((m) => Math.ceil(m.finishMin / HOUR) * HOUR));

  const blocks: Block[] = [];
  for (const day of days) {
    const today = recurring
      .filter((m) => m.day === day)
      .sort((a, b) => a.startMin - b.startMin || a.finishMin - b.finishMin);
    const laneEnds: number[] = [];
    const placed: Block[] = [];
    for (const meeting of today) {
      let lane = laneEnds.findIndex((end) => end <= meeting.startMin);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = meeting.finishMin;
      placed.push({ ...meeting, lane, lanes: 0 });
    }
    for (const block of placed) block.lanes = laneEnds.length;
    blocks.push(...placed);
  }

  oneOffs.sort((a, b) => a.weekList[0] - b.weekList[0] || a.day - b.day || a.startMin - b.startMin);
  return { days, startMin, endMin, blocks, oneOffs };
}
```

- [ ] **Step 5: Implement plan-view.ts and selection.ts**

Create `src/lib/plan-view.ts`:

```ts
import type { GenerateResult } from "./generate";

// `?n=` is 1-based and user-editable; anything odd lands on a real page.
export function clampPage(raw: string | null, total: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1 || total === 0) return 1;
  return Math.min(n, total);
}

// What the schedule panel says when there's nothing to draw — always a reason.
export function emptyMessage(courseCount: number, result: GenerateResult): string {
  if (courseCount === 0) return "Add a course to see schedules.";
  if (result.capped) return "Too many combinations to search. Try removing a course.";
  if (result.unschedulable) {
    return `No clash-free schedule: every ${result.unschedulable} class clashes with a class you can't move.`;
  }
  return "No clash-free combination of these courses exists.";
}
```

Create `src/lib/selection.ts`:

```ts
import type { Selection } from "./generate";

// The saved-schedule form posts its selection as JSON; this checks the shape
// only (the API checks each triple exists in the catalogue).
const MAX_ITEMS = 100;
const MAX_FIELD = 40;

export function parseSelection(raw: string): Selection | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) return null;
  const seen = new Set<string>();
  const selection: Selection = [];
  for (const item of value) {
    const { courseId, activity, occurrence } = (item ?? {}) as Record<string, unknown>;
    const fields = [courseId, activity, occurrence];
    if (!fields.every((f) => typeof f === "string" && f.length > 0 && f.length <= MAX_FIELD)) {
      return null;
    }
    const key = fields.join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    selection.push({ courseId: courseId as string, activity: activity as string, occurrence: occurrence as string });
  }
  return selection;
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm vitest run --project unit src/lib`
Expected: all unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/week-layout.ts src/lib/week-layout.test.ts src/lib/plan-view.ts src/lib/plan-view.test.ts src/lib/selection.ts src/lib/selection.test.ts
git commit -m "feat: week grid layout, paging and saved-selection parsing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Schema, catalogue data and boot-time seed

**Files:**
- Create: `data/2026-S2.json`, `src/lib/seed.ts`, migration `drizzle/0002_*.sql` (generated)
- Modify: `src/lib/schema.ts`, `src/lib/db.ts`
- Test: `src/lib/seed.test.ts`

**Interfaces:**
- Produces:
  - Tables `meta`, `courses`, `meetings`, `plans`, `planCourses`, `savedSchedules` (Drizzle exports with these names)
  - `type RawTimetable = Record<string, RawCourse>`
  - `catalogueRows(raw: RawTimetable): { courseRows: typeof courses.$inferInsert[]; meetingRows: typeof meetings.$inferInsert[] }`
  - `seedCatalogue(db: BetterSQLite3Database, load: () => RawTimetable, version: string): void`
  - `DATA_VERSION` exported from `src/lib/seed.ts`

- [ ] **Step 1: Commit the catalogue data**

```bash
mkdir -p data
curl -fsSL https://raw.githubusercontent.com/anucssa/anutimetable/master/public/timetable_data/2026/S2.json -o data/2026-S2.json
python3 -c "import json; d=json.load(open('data/2026-S2.json')); print(len(d))"
```

Expected: prints `895` (or close — the scrape updates daily). Record the fetch date in `DATA_VERSION` below.

- [ ] **Step 2: Write the schema**

Replace `src/lib/schema.ts`:

```ts
import { sql } from "drizzle-orm";
import { index, int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

// --- catalogue: seeded from data/ at boot (src/lib/seed.ts), read-only ---

export const meta = sqliteTable("meta", {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const courses = sqliteTable("courses", {
  id: text().primaryKey(), // "COMP1110_S2"
  code: text().notNull(), // "COMP1110"
  title: text().notNull(),
  link: text().notNull(),
});

export const meetings = sqliteTable(
  "meetings",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    activity: text().notNull(), // "TutA"
    occurrence: text().notNull(), // "01"
    day: int().notNull(), // 0 = Monday
    startMin: int("start_min").notNull(),
    finishMin: int("finish_min").notNull(),
    weeks: text().notNull(), // as scraped, e.g. "31‑36,39‑44"
    location: text().notNull(),
  },
  (t) => [index("meetings_course_idx").on(t.courseId)],
);

// --- user state: never touched by the seed ---

export const plans = sqliteTable("plans", {
  id: text().primaryKey(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// course_id deliberately has no foreign key: a catalogue reseed replaces
// `courses`, and a plan must survive a course disappearing from the scrape.
export const planCourses = sqliteTable(
  "plan_courses",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.planId, t.courseId] })],
);

export const savedSchedules = sqliteTable("saved_schedules", {
  id: int().primaryKey({ autoIncrement: true }),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  selection: text().notNull(), // JSON Selection (src/lib/generate.ts)
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: `drizzle/0002_*.sql` with six `CREATE TABLE` statements and the index; no interactive prompt.

- [ ] **Step 4: Write the failing seed test**

Create `src/lib/seed.test.ts`:

```ts
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
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm vitest run --project unit src/lib/seed.test.ts`
Expected: FAIL — cannot resolve `./seed`.

- [ ] **Step 6: Implement seed.ts**

Create `src/lib/seed.ts`:

```ts
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { courses, meetings, meta } from "./schema";

// The shape of anucssa/anutimetable's public/timetable_data/<year>/<term>.json
// (only the fields we read are typed).
export type RawClass = {
  day: number;
  start: string;
  finish: string;
  weeks: string;
  activity: string;
  occurrence: string;
  location: string;
  [extra: string]: unknown;
};
export type RawCourse = {
  id: string;
  title: string;
  link: string;
  classes: RawClass[];
  [extra: string]: unknown;
};
export type RawTimetable = Record<string, RawCourse>;

// Bump when data/2026-S2.json is refreshed: a new version reseeds the
// catalogue at the next boot.
export const DATA_VERSION = "2026-S2@2026-09-27";
const VERSION_KEY = "catalogue_version";
const CHUNK = 500;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function catalogueRows(raw: RawTimetable) {
  const list = Object.values(raw);
  const courseRows = list.map((c) => ({
    id: c.id,
    code: c.id.split("_")[0],
    // titles arrive as "COMP1110_S2 Structured Programming"
    title: c.title.replace(c.id, "").trim() || c.id,
    link: c.link,
  }));
  const meetingRows = list.flatMap((c) =>
    c.classes.map((x) => ({
      courseId: c.id,
      activity: x.activity,
      occurrence: x.occurrence,
      day: x.day,
      startMin: toMinutes(x.start),
      finishMin: toMinutes(x.finish),
      weeks: x.weeks,
      location: x.location.trim(),
    })),
  );
  return { courseRows, meetingRows };
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

// Replace the catalogue when the committed data's version changes; a no-op
// on every other boot. User tables are never touched.
export function seedCatalogue(db: BetterSQLite3Database, load: () => RawTimetable, version: string): void {
  const current = db.select().from(meta).where(eq(meta.key, VERSION_KEY)).get();
  if (current?.value === version) return;
  const { courseRows, meetingRows } = catalogueRows(load());
  db.transaction((tx) => {
    tx.delete(meetings).run();
    tx.delete(courses).run();
    for (const rows of chunks(courseRows)) tx.insert(courses).values(rows).run();
    for (const rows of chunks(meetingRows)) tx.insert(meetings).values(rows).run();
    tx.insert(meta)
      .values({ key: VERSION_KEY, value: version })
      .onConflictDoUpdate({ target: meta.key, set: { value: version } })
      .run();
  });
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm vitest run --project unit src/lib/seed.test.ts`
Expected: PASS.

- [ ] **Step 8: Seed at boot**

Append to `src/lib/db.ts` (and add the two imports at the top with the others):

```ts
import timetable from "../../data/2026-S2.json?raw";
import { DATA_VERSION, seedCatalogue } from "./seed";
```

```ts
// The catalogue ships inside the build (the ?raw import) so a deploy needs no
// network; it's parsed only when its version differs from what's stored.
seedCatalogue(db, () => JSON.parse(timetable), DATA_VERSION);
```

- [ ] **Step 9: Verify the seed runs on a real boot**

Run:
```bash
rm -rf .data && pnpm build && (DATABASE_PATH=.data/app.db node dist/server/entry.mjs & echo $! > /tmp/sb.pid; sleep 3; kill $(cat /tmp/sb.pid))
sqlite3 .data/app.db "select count(*) from courses; select count(*) from meetings; select value from meta;"
```
Expected: `895` (± the scrape), several thousand meetings, `2026-S2@2026-09-27`. If `sqlite3` isn't installed, use `node -e "const D=require('better-sqlite3');const d=new D('.data/app.db');console.log(d.prepare('select count(*) c from courses').get())"`.

- [ ] **Step 10: Run the full check and commit**

Run: `pnpm check`
Expected: green.

```bash
git add data/2026-S2.json src/lib/schema.ts src/lib/seed.ts src/lib/seed.test.ts src/lib/db.ts drizzle
git commit -m "feat: catalogue schema and boot-time seed from the CSSA 2026 S2 scrape

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Data access and the POST endpoints

**Files:**
- Create: `src/lib/catalogue.ts`, `src/lib/plans.ts`, `src/pages/api/plans/index.ts`, `src/pages/api/plans/[id]/courses.ts`, `src/pages/api/plans/[id]/saved.ts`
- Test: `spec/schedule.test.ts` (API half)

**Interfaces:**
- Consumes: `db` (`src/lib/db.ts`); tables from `src/lib/schema.ts`; `Meeting`, `Selection` from `src/lib/generate.ts`; `parseSelection` from `src/lib/selection.ts`.
- Produces:
  - `catalogue.ts`: `type Course`; `searchCourses(q: string): Course[]`; `getCourses(ids: string[]): Course[]` (preserves `ids` order, skips unknown); `courseExists(id: string): boolean`; `meetingsFor(courseIds: string[]): Meeting[]`; `meetingsForSelection(selection: Selection): Meeting[]`; `selectionExists(selection: Selection): boolean`
  - `plans.ts`: `type Plan`; `type SavedSchedule = { id: number; selection: Selection; createdAt: string }`; `PLAN_COOKIE = "plan"`; `planCookieOptions`; `createPlan(): Plan`; `getPlan(id: string): Plan | undefined`; `planCourseIds(planId: string): string[]`; `addCourse(planId, courseId): void`; `removeCourse(planId, courseId): void`; `saveSchedule(planId: string, selection: Selection): number`; `listSaved(planId: string): SavedSchedule[]`; `getSaved(planId: string, id: number): SavedSchedule | undefined`

- [ ] **Step 1: Write the failing API contract tests**

Create `spec/schedule.test.ts`:

```ts
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The schedule builder's promises, checked against the running app. Tests in
// this file run in order and share one plan.
const baseUrl = inject("baseUrl");

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const post = (path: string, fields: Record<string, string>) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

const page = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  return { status: res.status, doc: new JSDOM(await res.text()).window.document };
};

const api = (planPath: string, tail: string) => `${planPath.replace(/^\/plan\//, "/api/plans/")}/${tail}`;

describe("schedule builder API", () => {
  let planPath = "";

  it("starts a plan at its own unguessable URL and remembers it", async () => {
    const res = await post("/api/plans", {});
    expect(res.status).toBe(303);
    planPath = res.headers.get("location") ?? "";
    expect(planPath).toMatch(/^\/plan\/[A-Za-z0-9_-]{16}$/);
    expect(res.headers.get("set-cookie")).toContain("plan=");
  });

  it("adds a course and redirects back to the plan", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "add" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(planPath);
  });

  it("rejects a course that isn't in the timetable", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "NOPE9999_S2", action: "add" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown action", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "explode" });
    expect(res.status).toBe(400);
  });

  it("rejects malformed and unknown selections", async () => {
    for (const selection of [
      "not json",
      JSON.stringify([{ courseId: "COMP1110_S2", activity: "TutZ", occurrence: "99" }]),
    ]) {
      const res = await post(api(planPath, "saved"), { selection });
      expect(res.status).toBe(400);
    }
  });

  it("404s writes to a plan that doesn't exist", async () => {
    const res = await post("/api/plans/does-not-exist-000/courses", { courseId: "COMP1110_S2", action: "add" });
    expect(res.status).toBe(404);
  });

  it("removes a course", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "remove" });
    expect(res.status).toBe(303);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: the new tests FAIL (404 for `/api/plans`); invariants still pass.

- [ ] **Step 3: Implement catalogue.ts**

Create `src/lib/catalogue.ts`:

```ts
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
```

- [ ] **Step 4: Implement plans.ts**

Create `src/lib/plans.ts`:

```ts
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
```

- [ ] **Step 5: Implement the three endpoints**

Create `src/pages/api/plans/index.ts`:

```ts
import type { APIRoute } from "astro";
import { createPlan, PLAN_COOKIE, planCookieOptions } from "../../../lib/plans";

// Start a plan: new row, remember it in this browser, go to its page.
export const POST: APIRoute = ({ cookies, redirect }) => {
  const plan = createPlan();
  cookies.set(PLAN_COOKIE, plan.id, planCookieOptions);
  return redirect(`/plan/${plan.id}`, 303);
};
```

Create `src/pages/api/plans/[id]/courses.ts`:

```ts
import type { APIRoute } from "astro";
import { courseExists } from "../../../../lib/catalogue";
import { addCourse, getPlan, removeCourse } from "../../../../lib/plans";

// Add or remove one course, then back to the plan (keeping the search).
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const courseId = String(form.get("courseId") ?? "");
  const action = String(form.get("action") ?? "");
  const q = String(form.get("q") ?? "").trim();

  if (action === "add") {
    if (!courseExists(courseId)) return new Response("Unknown course", { status: 400 });
    addCourse(plan.id, courseId);
  } else if (action === "remove") {
    removeCourse(plan.id, courseId);
  } else {
    return new Response("Unknown action", { status: 400 });
  }
  return redirect(q ? `/plan/${plan.id}?q=${encodeURIComponent(q)}` : `/plan/${plan.id}`, 303);
};
```

Create `src/pages/api/plans/[id]/saved.ts`:

```ts
import type { APIRoute } from "astro";
import { selectionExists } from "../../../../lib/catalogue";
import { getPlan, saveSchedule } from "../../../../lib/plans";
import { parseSelection } from "../../../../lib/selection";

// Save the schedule on screen, then back to the same page of results.
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const plan = getPlan(params.id ?? "");
  if (!plan) return new Response("No such plan", { status: 404 });

  const form = await request.formData();
  const selection = parseSelection(String(form.get("selection") ?? ""));
  if (!selection || !selectionExists(selection)) {
    return new Response("Not a schedule from this timetable", { status: 400 });
  }
  saveSchedule(plan.id, selection);
  const n = Number.parseInt(String(form.get("n") ?? ""), 10);
  return redirect(`/plan/${plan.id}${Number.isInteger(n) && n > 0 ? `?n=${n}` : ""}#saved`, 303);
};
```

- [ ] **Step 6: Run to verify the API tests pass**

Run: `pnpm check`
Expected: typecheck green; all `schedule builder API` tests pass (the redirect targets 404 until Task 6, but the tests only read the redirect, not its target).

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalogue.ts src/lib/plans.ts src/pages/api spec/schedule.test.ts
git commit -m "feat: plans, courses and saved schedules behind validated POST endpoints

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The pages — planner, week grid, saved view, home, example, 404

**Files:**
- Create: `src/components/WeekGrid.astro`, `src/pages/plan/[id]/index.astro`, `src/pages/plan/[id]/saved/[sid].astro`, `src/pages/example.astro`, `src/pages/404.astro`
- Modify: `src/pages/index.astro`, `src/styles.css`, `spec/routes.ts`, `spec/schedule.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 2–5 (names exactly as listed there).
- Produces: pages. The spec tests rely on: `#schedule-heading` text `Schedule {n} of {N}`; grid blocks with class `block`; the save form's hidden `input[name="selection"]`; remove/add buttons with `aria-label="Add CODE"` / `"Remove CODE"`; saved links `a[href^="/plan/<id>/saved/"]`.

- [ ] **Step 1: Write the failing page contract tests**

Append to the end of `spec/schedule.test.ts` (it reuses `post`, `page` and `api` defined at the top):

```ts
describe("schedule builder pages", () => {
  let planPath = "";

  it("tells an empty plan to add a course", async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    const { status, doc } = await page(planPath);
    expect(status).toBe(200);
    expect(doc.body.textContent).toContain("Add a course to see schedules.");
  });

  it("finds a course by code", async () => {
    const { doc } = await page(`${planPath}?q=COMP1110`);
    expect(doc.querySelector('button[aria-label="Add COMP1110"]')).toBeTruthy();
  });

  it("generates clash-free schedules once courses are added", async () => {
    for (const courseId of ["COMP1110_S2", "COMP2100_S2"]) {
      await post(api(planPath, "courses"), { courseId, action: "add" });
    }
    const { doc } = await page(planPath);
    expect(doc.querySelector("#schedule-heading")?.textContent).toMatch(/Schedule 1 of \d+/);
    expect(doc.querySelectorAll(".block").length).toBeGreaterThan(0);
    expect(doc.querySelector('button[aria-label="Remove COMP2100"]')).toBeTruthy();
  });

  it("clamps a nonsense page number", async () => {
    const { status, doc } = await page(`${planPath}?n=abc`);
    expect(status).toBe(200);
    expect(doc.querySelector("#schedule-heading")?.textContent).toMatch(/Schedule 1 of/);
  });

  it("keeps a saved schedule across a reload", async () => {
    const before = await page(`${planPath}?n=2`);
    const selection = before.doc.querySelector<HTMLInputElement>('input[name="selection"]')?.value ?? "";
    const res = await post(api(planPath, "saved"), { selection, n: "2" });
    expect(res.status).toBe(303);

    const reloaded = await page(planPath);
    const link = reloaded.doc.querySelector(`a[href^="${planPath}/saved/"]`);
    expect(link).toBeTruthy();

    const saved = await page(link?.getAttribute("href") ?? "");
    expect(saved.status).toBe(200);
    expect(saved.doc.querySelectorAll(".block").length).toBeGreaterThan(0);
  });

  it("has one h1 and the site nav on the planner", async () => {
    const { doc } = await page(planPath);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector('nav[aria-label="site"]')).toBeTruthy();
  });

  it("404s an unknown plan and an unknown saved schedule", async () => {
    expect((await page("/plan/does-not-exist-000")).status).toBe(404);
    expect((await page(`${planPath}/saved/999999`)).status).toBe(404);
  });
});
```

Replace `spec/routes.ts`:

```ts
// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it. Plan pages need a plan, so
// spec/schedule.test.ts covers those; /example/ exercises the same grid.
export const ROUTES = ["/", "/readme/", "/example/"];
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test`
Expected: page tests FAIL (plan pages 404; `/example/` invariants fail).

- [ ] **Step 3: The week grid component**

Create `src/components/WeekGrid.astro`:

```astro
---
// One schedule as a week: a column per day, blocks positioned by time.
// Blocks are list items so the grid reads as "Monday: …" to a screen reader.
import { courseCode, type Schedule } from "../lib/generate";
import { layoutWeek } from "../lib/week-layout";

interface Props {
  schedule: Schedule;
  // courseId → colour slot 0..7
  colours: Map<string, number>;
}

const { schedule, colours } = Astro.props;
const layout = layoutWeek(schedule);
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const span = layout.endMin - layout.startMin;
const pct = (min: number) => `${((min - layout.startMin) / span) * 100}%`;
const clock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const hours: number[] = [];
for (let m = layout.startMin; m < layout.endMin; m += 60) hours.push(m);
---

<div class="week-scroll" role="region" aria-label="Week view" tabindex="0">
  <div class="week" style={`--days:${layout.days.length};--hours:${span / 60}`}>
    <div class="hours" aria-hidden="true">
      {hours.map((m) => <span style={`top:${pct(m)}`}>{clock(m)}</span>)}
    </div>
    {
      layout.days.map((day) => (
        <section class="day" aria-labelledby={`day-${day}`}>
          <h3 id={`day-${day}`}>{DAY_NAMES[day]}</h3>
          <ol class="slots">
            {layout.blocks
              .filter((b) => b.day === day)
              .map((b) => (
                <li
                  class={`block c${colours.get(b.courseId) ?? 0}`}
                  style={`top:${pct(b.startMin)};height:${(b.finishMin - b.startMin) / span * 100}%;left:${(b.lane / b.lanes) * 100}%;width:${100 / b.lanes}%`}
                >
                  <strong>{courseCode(b.courseId)}</strong> {b.activity}/{b.occurrence}
                  <span>
                    {clock(b.startMin)}–{clock(b.finishMin)}
                  </span>
                  {b.location && <span>{b.location}</span>}
                </li>
              ))}
          </ol>
        </section>
      ))
    }
  </div>
</div>
{
  layout.oneOffs.length > 0 && (
    <>
      <h3>One-off sessions</h3>
      <ul class="one-offs">
        {layout.oneOffs.map((m) => (
          <li>
            <strong>{courseCode(m.courseId)}</strong> {m.activity}/{m.occurrence} — {DAY_NAMES[m.day]}{" "}
            {clock(m.startMin)}–{clock(m.finishMin)}, calendar week {m.weekList.join(" & ")}
            {m.location && `, ${m.location}`}
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 4: The planner page**

Create `src/pages/plan/[id]/index.astro`:

```astro
---
import Layout from "../../../components/Layout.astro";
import WeekGrid from "../../../components/WeekGrid.astro";
import { getCourses, meetingsFor, searchCourses } from "../../../lib/catalogue";
import { courseCode, generate, toSelection } from "../../../lib/generate";
import { clampPage, emptyMessage } from "../../../lib/plan-view";
import { getPlan, listSaved, PLAN_COOKIE, planCookieOptions, planCourseIds } from "../../../lib/plans";

const plan = getPlan(Astro.params.id ?? "");
if (!plan) return Astro.rewrite("/404");
// opening a plan's link makes it the one "Continue your plan" returns to
Astro.cookies.set(PLAN_COOKIE, plan.id, planCookieOptions);

const ids = planCourseIds(plan.id);
const added = getCourses(ids);
const colours = new Map(ids.map((id, i) => [id, i % 8]));
const q = Astro.url.searchParams.get("q")?.trim() ?? "";
const results = searchCourses(q);
const result = generate(meetingsFor(ids));
const total = result.schedules.length;
const n = clampPage(Astro.url.searchParams.get("n"), total);
const schedule = result.schedules[n - 1];
const saved = listSaved(plan.id);
const coursesAction = `/api/plans/${plan.id}/courses`;

const pageLink = (k: number) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("n", String(k));
  return `?${params}`;
};
const savedCodes = (selection: { courseId: string }[]) =>
  [...new Set(selection.map((s) => courseCode(s.courseId)))].join(", ");
---

<Layout title="Your plan — ANU Schedule Builder">
  <h1>Your plan</h1>
  <p class="hint">This page's link is your plan — bookmark it to come back from anywhere.</p>
  <div class="planner">
    <aside aria-labelledby="courses-heading">
      <h2 id="courses-heading">Courses</h2>
      {
        added.length === 0 ? (
          <p>No courses yet — search below.</p>
        ) : (
          <ul class="course-list">
            {added.map((c) => (
              <li class={`c${colours.get(c.id)}`}>
                <span>
                  <strong>{c.code}</strong> {c.title}
                </span>
                <form method="post" action={coursesAction}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="q" value={q} />
                  <button aria-label={`Remove ${c.code}`}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )
      }
      <form method="get" role="search" class="search">
        <label for="q">Find a Semester 2 course</label>
        <input id="q" name="q" value={q} placeholder="COMP1110 or programming" />
        <button>Search</button>
      </form>
      {
        q &&
          (results.length === 0 ? (
            <p>No Semester 2 courses match “{q}”.</p>
          ) : (
            <ul class="results">
              {results.map((c) => (
                <li>
                  <span>
                    <strong>{c.code}</strong> {c.title}
                  </span>
                  {ids.includes(c.id) ? (
                    <span class="added">Added</span>
                  ) : (
                    <form method="post" action={coursesAction}>
                      <input type="hidden" name="courseId" value={c.id} />
                      <input type="hidden" name="action" value="add" />
                      <input type="hidden" name="q" value={q} />
                      <button aria-label={`Add ${c.code}`}>Add</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ))
      }
    </aside>

    <section aria-labelledby="schedule-heading" class="schedule">
      {
        schedule ? (
          <>
            <h2 id="schedule-heading">
              Schedule {n} of {total}
              {result.capped && "+"}
            </h2>
            {result.capped && <p class="hint">Showing the first {total} combinations.</p>}
            <nav aria-label="schedules" class="pager">
              {n > 1 ? <a href={pageLink(n - 1)}>← Previous</a> : <span>← Previous</span>}
              {n < total ? <a href={pageLink(n + 1)}>Next →</a> : <span>Next →</span>}
            </nav>
            <WeekGrid schedule={schedule} colours={colours} />
            <form method="post" action={`/api/plans/${plan.id}/saved`}>
              <input type="hidden" name="selection" value={JSON.stringify(toSelection(schedule))} />
              <input type="hidden" name="n" value={String(n)} />
              <button>Save this schedule</button>
            </form>
          </>
        ) : (
          <>
            <h2 id="schedule-heading">Schedules</h2>
            <p>{emptyMessage(ids.length, result)}</p>
          </>
        )
      }

      <h2 id="saved">Saved schedules</h2>
      {
        saved.length === 0 ? (
          <p>None yet.</p>
        ) : (
          <ol>
            {saved.map((s, i) => (
              <li>
                <a href={`/plan/${plan.id}/saved/${s.id}`}>Saved schedule {i + 1}</a> —{" "}
                {savedCodes(s.selection)}, saved {s.createdAt} UTC
              </li>
            ))}
          </ol>
        )
      }
    </section>
  </div>
</Layout>
```

- [ ] **Step 5: Saved view, example, 404, home**

Create `src/pages/plan/[id]/saved/[sid].astro`:

```astro
---
import Layout from "../../../../components/Layout.astro";
import WeekGrid from "../../../../components/WeekGrid.astro";
import { meetingsForSelection } from "../../../../lib/catalogue";
import { courseCode, groupOptions } from "../../../../lib/generate";
import { getPlan, getSaved } from "../../../../lib/plans";

const plan = getPlan(Astro.params.id ?? "");
const saved = plan && getSaved(plan.id, Number(Astro.params.sid));
if (!plan || !saved) return Astro.rewrite("/404");

// each selected (course, activity, occurrence) regroups into one option
const schedule = groupOptions(meetingsForSelection(saved.selection)).flat();
const courseIds = [...new Set(saved.selection.map((s) => s.courseId))];
const colours = new Map(courseIds.map((id, i) => [id, i % 8]));
---

<Layout title="Saved schedule — ANU Schedule Builder">
  <h1>Saved schedule</h1>
  <p>
    {courseIds.map(courseCode).join(", ")} · saved {saved.createdAt} UTC ·
    <a href={`/plan/${plan.id}`}>Back to your plan</a>
  </p>
  {
    schedule.length < saved.selection.length && (
      <p class="hint">Some classes in this schedule are no longer in the timetable.</p>
    )
  }
  <WeekGrid schedule={schedule} colours={colours} />
</Layout>
```

Create `src/pages/example.astro`:

```astro
---
import Layout from "../components/Layout.astro";
import WeekGrid from "../components/WeekGrid.astro";
import { meetingsFor } from "../lib/catalogue";
import { generate } from "../lib/generate";
import { clampPage, emptyMessage } from "../lib/plan-view";

// A read-only plan over real courses: something to look at before starting
// your own, and a page the invariants can check without creating a plan.
const ids = ["COMP1110_S2", "COMP2100_S2"];
const colours = new Map(ids.map((id, i) => [id, i]));
const result = generate(meetingsFor(ids));
const total = result.schedules.length;
const n = clampPage(Astro.url.searchParams.get("n"), total);
const schedule = result.schedules[n - 1];
---

<Layout title="Example — ANU Schedule Builder">
  <h1>Example: COMP1110 + COMP2100</h1>
  <form method="post" action="/api/plans">
    <button>Start your own plan</button>
  </form>
  {
    schedule ? (
      <>
        <h2>
          Schedule {n} of {total}
          {result.capped && "+"}
        </h2>
        <nav aria-label="schedules" class="pager">
          {n > 1 ? <a href={`?n=${n - 1}`}>← Previous</a> : <span>← Previous</span>}
          {n < total ? <a href={`?n=${n + 1}`}>Next →</a> : <span>Next →</span>}
        </nav>
        <WeekGrid schedule={schedule} colours={colours} />
      </>
    ) : (
      <p>{emptyMessage(ids.length, result)}</p>
    )
  }
</Layout>
```

Create `src/pages/404.astro`:

```astro
---
import Layout from "../components/Layout.astro";

Astro.response.status = 404;
---

<Layout title="Not found — ANU Schedule Builder">
  <h1>Not found</h1>
  <p>That plan or schedule doesn't exist. Plans live at their own link — check you copied all of it.</p>
  <p><a href="/">Start again</a></p>
</Layout>
```

Replace `src/pages/index.astro`:

```astro
---
import Layout from "../components/Layout.astro";
import { getPlan, PLAN_COOKIE } from "../lib/plans";

const remembered = Astro.cookies.get(PLAN_COOKIE)?.value;
const existing = remembered ? getPlan(remembered) : undefined;
---

<Layout title="ANU Schedule Builder">
  <h1>ANU Schedule Builder</h1>
  <p>
    Add your Semester 2 2026 courses and see every clash-free timetable, one week at a time —
    no more trying tutorials one by one. Save the ones you like.
  </p>
  {existing && <p><a href={`/plan/${existing.id}`} class="button">Continue your plan</a></p>}
  <form method="post" action="/api/plans">
    <button>{existing ? "Start a new plan" : "Start a plan"}</button>
  </form>
  <p><a href="/example/">See an example</a> with COMP1110 and COMP2100.</p>
  <p class="hint">
    There's no login: your plan lives at its own link, so bookmark it to come back from another
    device. Anyone with that link can see and change it.
  </p>
</Layout>
```

- [ ] **Step 6: Styles**

Replace `src/styles.css`:

```css
body {
  margin: 0;
  padding: 1rem;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1a1a1a;
  background: #fff;
}

body > nav,
main,
footer {
  max-width: 72rem;
  margin: 0 auto;
}

body > nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

footer {
  margin-top: 3rem;
  font-size: 0.85rem;
  color: #555;
}

a {
  color: #0b5fff;
}

button,
.button {
  padding: 0.35rem 0.9rem;
  font: inherit;
  cursor: pointer;
}

input {
  padding: 0.35rem 0.6rem;
  font: inherit;
  min-width: 0;
}

.hint {
  color: #555;
}

/* --- planner layout --- */

.planner {
  display: grid;
  gap: 2rem;
}

@media (min-width: 60rem) {
  .planner {
    grid-template-columns: 20rem 1fr;
  }
}

.course-list,
.results {
  list-style: none;
  padding: 0;
}

.course-list li,
.results li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #e5e5e5;
}

.course-list li {
  border-left: 0.4rem solid var(--course);
}

.search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.search label {
  width: 100%;
}

.search input {
  flex: 1;
}

.added {
  color: #555;
}

.pager {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.pager span {
  color: #999;
}

/* --- week grid --- */

.week-scroll {
  overflow-x: auto;
}

.week {
  --row: 3rem;
  display: grid;
  grid-template-columns: 3.5rem repeat(var(--days), minmax(6rem, 1fr));
  min-width: 36rem;
}

.hours {
  position: relative;
  margin-top: 2rem;
  height: calc(var(--hours) * var(--row));
  font-size: 0.75rem;
  color: #555;
}

.hours span {
  position: absolute;
  transform: translateY(-0.5em);
}

.day h3 {
  height: 2rem;
  margin: 0;
  font-size: 0.9rem;
  text-align: center;
}

.slots {
  position: relative;
  height: calc(var(--hours) * var(--row));
  margin: 0;
  padding: 0;
  list-style: none;
  border-left: 1px solid #e5e5e5;
  background: repeating-linear-gradient(to bottom, #e5e5e5 0 1px, transparent 1px var(--row));
}

.block {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0.2rem 0.3rem;
  border-left: 0.3rem solid var(--course);
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--course) 18%, white);
  font-size: 0.75rem;
  line-height: 1.25;
}

.block span {
  display: block;
}

.c0 { --course: #1f77b4; }
.c1 { --course: #d62728; }
.c2 { --course: #2ca02c; }
.c3 { --course: #9467bd; }
.c4 { --course: #ff7f0e; }
.c5 { --course: #8c564b; }
.c6 { --course: #e377c2; }
.c7 { --course: #17becf; }
```

- [ ] **Step 7: Run the full check**

Run: `pnpm check`
Expected: typecheck green; all unit, invariants (`/`, `/readme/`, `/example/`), readme and schedule tests pass. If `/404` via `Astro.rewrite` doesn't return status 404, the 404 test says so — `Astro.response.status = 404` in `404.astro` is what sets it.

- [ ] **Step 8: Look at it in a browser**

Run: `pnpm dev`, open `http://localhost:4321/`, start a plan, add COMP1110 and COMP2100, page through, save one, reload, open the saved link. Check at 375px width that only the grid scrolls sideways, not the page.

- [ ] **Step 9: Commit**

```bash
git add src spec
git commit -m "feat: planner, week grid, saved schedules, example and 404 pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: README and harness rules (user-approved)

**Files:**
- Modify: `README.md`, `CLAUDE.md`

The README is served at `/readme/` and read by the marker; `CLAUDE.md` is marked as rules *the student* decided. Draft both, **show the drafts to the user and apply their edits before committing** — do not commit either unreviewed.

- [ ] **Step 1: Draft README.md** covering: what it is (ANU S2 2026 schedule builder modelled on UMN Schedule Builder); the problem it fixes (hand-trying tutorial combinations; no week view); how plans work (no login, the link is the plan); what good looks like (every schedule shown is clash-free by the week-aware rule; the reason is always given when there are none; core flow works without JS; state survives reload); what it deliberately doesn't do (blocked times, sorting, pinning classes, other terms, registration); data source and caveat (CSSA scrape of the old timetabling system, may differ from MyTimetable); which parts are enforced by `spec/` and which are judgement calls. Remove the template comment.

- [ ] **Step 2: Draft CLAUDE.md** as a short rule list for the agent, e.g.: read the spec doc before changing behaviour; schema changes only through `pnpm db:generate`; generation/layout logic stays pure and unit-tested; every page through `Layout.astro` and every static route in `spec/routes.ts`; `pnpm check` green before every commit; never edit `fly.toml`/`Dockerfile`; never commit `mise.local.toml` or tokens; unofficial-data notice stays on every page.

- [ ] **Step 3: Show both drafts to the user; apply their changes.**

- [ ] **Step 4: Verify and commit**

Run: `pnpm check` (the readme test checks `/readme/` serves all of `README.md`).

```bash
git add README.md CLAUDE.md
git commit -m "docs: README and agent harness rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Deploy and verify live (user-confirmed)

Deploying is outward-facing: **ask the user before each deploy**.

- [ ] **Step 1: Tooling.** The brief requires the comp4020 plugin ≥ 0.14.21 (the installed cache is 0.12.1). Ask the user to run `claude plugin marketplace update comp4020 && claude plugin update comp4020@comp4020` and restart, then run `/comp4020:doctor`.

- [ ] **Step 2: Deploy** (after the user says yes): `flyctl deploy --remote-only --ha=false -a <app name from /comp4020:doctor>`.

- [ ] **Step 3: Verify the live app** at its `*.fly.dev` URL: home loads; start a plan; add COMP1110 + COMP2100; save a schedule; reload — still listed; open the saved link.

- [ ] **Step 4: Hand back to the user** the pieces only they can write: `PROCESS.md` (with commit citations) and `reflections/crit-7.md` (150–300 words, the two standing prompts). Then `pnpm check:evidence`.
