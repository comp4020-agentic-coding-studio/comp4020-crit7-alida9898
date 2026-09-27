# ANU Schedule Builder — design (crit 7, MVP)

## Intent

**What the user said:** ANU's timetable is the system they want replaced, in
the style of UMN's Schedule Builder (schedulebuilder.umn.edu). The two pains
that matter most: (A) hand-trying tutorial combinations to avoid clashes, and
(B) not seeing the whole week laid out while choosing.

**Success:** a student adds their Semester 2 2026 courses, the app generates
every clash-free combination of classes, shows each one as a weekly grid they
can page through, and lets them save the ones they like — still there after a
reload (crit 7 spec item 3). Deployed at a `*.fly.dev` URL by Wed 30 Sep 12:00.

**Assumptions (correct me):** no login — a plan is identified by an
unguessable id in its URL; one term only (2026 S2); English UI.

## Scope

In the MVP:

1. Search courses by code or title and add/remove them from a plan.
2. Generate all clash-free schedules for the plan's courses.
3. Show one generated schedule at a time as a Mon–Fri week grid, with
   previous/next paging and "n of N".
4. Save a generated schedule; list saved schedules on the plan and open one.

Not in the MVP (candidate v2, in rough priority): blocked times, sort
preferences (fewest days / latest start / fewest gaps), pinning or excluding
a specific class, other terms, ICS export. Registration hand-off is out of
scope entirely — ANU exposes no API for it.

## Data

**Source:** `public/timetable_data/2026/S2.json` from
[anucssa/anutimetable](https://github.com/anucssa/anutimetable), scraped
daily from the official ANU timetable. 895 courses. Committed to this repo as
`data/2026-S2.json` (≈2 MB) so builds are reproducible and the deploy needs
no network. The app credits the source and labels the data unofficial
(it comes from the old timetabling system and may differ from MyTimetable).

**Shape and rules the domain follows:**

- A course (`COMP1110_S2`) has classes; each class row is one meeting:
  `activity` (`LecA`, `TutA`, `ComA`…), `occurrence` (`01`, `02`…), `day`
  (0 = Mon), `start`/`finish` (`HH:MM`), `weeks` (e.g. `31‑36,39‑44`, with
  non-ASCII hyphens), `location`.
- An **option** is one `(activity, occurrence)` pair; it may have several
  meetings (e.g. a lecture Mon and Wed). Choosing it means attending all of
  them.
- A schedule picks exactly one option for every activity of every course in
  the plan. Activities with a single option are fixed.
- **Excluded from generation:** activities whose code starts with `Dro`
  (drop-in, optional).
- **Clash:** two meetings clash when they share a day, their time ranges
  overlap (`a.start < b.finish && b.start < a.finish`), *and* their week sets
  intersect. Week-awareness matters: assessment slots (`Asm*`) run in a
  single week and would otherwise clash with everything.

**Loading:** at boot, after migrations, `db.ts` seeds the catalogue tables
from the committed JSON if they are empty or the stored data version differs
(one transaction). User tables are never touched by the seed.

## Schema (Drizzle, SQLite)

Catalogue (seeded, read-only at runtime):

- `courses` — `id` text PK (`COMP1110_S2`), `code` (`COMP1110`), `title`,
  `link`.
- `meetings` — `id` int PK, `course_id` → courses, `activity`, `occurrence`,
  `day` int, `start_min` int, `finish_min` int, `weeks` text (as given),
  `location`.

User state:

- `plans` — `id` text PK (random, URL-safe, ≥ 16 chars), `created_at`.
- `plan_courses` — `plan_id` → plans, `course_id` → courses, composite PK.
- `saved_schedules` — `id` int PK, `plan_id` → plans, `selection` text (JSON
  array of `{courseId, activity, occurrence}`), `created_at`.

The starter's `messages` table, guestbook pages, SSE endpoint and
`guestbook.test.ts` are removed via a migration (the spec README says the
starter's plumbing test retires with the starter).

## Units

- `src/lib/weeks.ts` — parse a `weeks` string into a set of week numbers.
  Pure.
- `src/lib/generate.ts` — given a plan's courses with their meetings, return
  clash-free schedules. Pure, no DB. Backtracking over activities ordered by
  fewest options first, pruning on the first clash, **capped at 500 results**
  (the page says "showing the first 500" when the cap hits). Returns
  `{ schedules, capped, unschedulable }` where `unschedulable` names an
  activity that has no option compatible with the fixed ones, so the UI can
  say *why* there are zero results.
- `src/lib/catalogue.ts` — search courses, load meetings for course ids.
- `src/lib/plans.ts` — create plan, add/remove course, save/list schedules.
- `src/lib/seed.ts` — JSON → catalogue tables.

## Pages and flow

Server-rendered Astro with plain HTML forms + POST/303-redirect (the
starter's pattern), so the core flow works without client JS.

- `/` — explains the tool; "Start a plan" form POSTs to `/api/plans`, which
  creates a plan and redirects to it. If a `plan` cookie exists, also shows
  "Continue your plan".
- `/plan/[id]?q=…&n=…` — left column: course search (GET `q`), results each
  with an Add button, and the plan's courses each with Remove. Main column:
  schedule `n` of N as a week grid (08:00–21:00 rows, Mon–Fri columns;
  blocks labelled with course code, activity, occurrence, location; one
  colour per course), Prev/Next links, and "Save this schedule". Meetings
  that run in ≤ 2 weeks (one-off assessments) are listed under the grid
  rather than drawn in it. Below: saved schedules, each a link to
  `/plan/[id]/saved/[sid]`.
- `/plan/[id]/saved/[sid]` — the saved schedule's grid.
- `/example/` — see Testing; same grid component, no forms.
- `/readme/` — unchanged (renders `README.md`).
- Unknown plan/saved id → 404 page.

POST endpoints: `/api/plans`, `/api/plans/[id]/courses` (add/remove),
`/api/plans/[id]/saved`. Invalid input (unknown course id, malformed
selection) → 400; nothing is written.

## Testing

- Unit tests (vitest, pure modules): weeks parsing (ranges, single weeks,
  non-ASCII hyphens); generator — fixed activities, a known clash pruned, a
  clash in disjoint weeks allowed, multi-meeting options, cap, unschedulable
  reason. Add `src/**/*.test.ts` to the vitest include.
- Spec tests against the running app (`spec/schedule.test.ts`): create a
  plan → add two real courses → page shows "1 of N" with N > 0 → save →
  **re-fetch the plan page and the saved schedule is listed** (spec item 3);
  unknown plan id → 404.
- Invariants: `spec/routes.ts` lists `/`, `/readme/` and `/example/`.
  `/example/` is a read-only plan view over a fixed set of real courses
  (COMP1110, COMP2100), built from the catalogue with no user rows — it
  exists on a fresh test DB, so the invariants cover the grid page, and it
  doubles as a "see an example" link for visitors.

## Deliverables alongside the code

`README.md` (what it is, what good means, data caveat — served at
`/readme/`), `CLAUDE.md` harness rules, `PROCESS.md`, `reflections/crit-7.md`,
incremental commits, Fly deploy.
