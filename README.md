# ANU Schedule Builder

A timetable planner for ANU Semester 2 2026, modelled on the University of
Minnesota's [Schedule Builder](https://schedulebuilder.umn.edu). Add your
courses, and it generates every combination of lectures, tutorials and labs
that doesn't clash, shows each one as a week grid you can page through, and
lets you save the ones you like.

## The problem it fixes

With ANU's timetable you pick classes one at a time and find the clashes
yourself. Two things hurt most:

- **Trying tutorial combinations by hand.** With four courses and several
  tutorial times each, finding a set that fits is trial and error.
- **No week view while choosing.** You can't see the whole week laid out until
  you've already committed to classes.

Finding courses works like UMN's: browse all 89 subjects A–Z, open one (say
COMP — Computer Science) to list every course in it, and narrow by level
(1000-, 2000-level…). Or type a code, a title or the subject in words —
"computing" finds COMP through the School of Computing; a subject whose code
you typed is shown first, before courses that only mention the word.

Each result shows what the course is, its convener and unit value, a link to
its official Programs and Courses page, and its classes grouped by activity
(lectures, tutorials, labs…) with days, times, weeks and rooms. Every class is
in the mix by default; mark one **Only** to keep just the classes you choose
in that activity, or **Exclude** to leave one out. The generator respects
those marks, and says so if they leave no room.

Then the app does the search: every schedule it shows is clash-free, and each
one is drawn as a Monday–Friday grid (it grows to show weekend or early/late
classes when a course has them).

## How plans work

There is no login. **Start a plan** and you get a page at its own unguessable
link — that link *is* your plan. Bookmark it to come back from another device;
this browser also remembers your last plan on the home page. Anyone with the
link can see and change the plan, so share it only with people you'd let edit
it.

## What good looks like here

- **Every schedule shown is clash-free**, by a week-aware rule: two classes
  clash only if they're on the same day, their times overlap, *and* they run in
  at least one common teaching week. Without the week check, one-week
  assessment slots would clash with everything.
- **An empty result always says why** — no courses yet, a named activity that
  can't fit around the classes you can't move, or too many combinations to
  search — never a blank panel.
- **One-off sessions** (meetings that run in two weeks or fewer) are listed
  under the grid instead of cluttering a typical week.
- **Saved schedules survive a reload** and a redeploy (SQLite on the Fly
  volume).
- **The core flow works without JavaScript**: every action is a plain form
  POST followed by a redirect.
- **Only the grid scrolls sideways on a phone**, not the page.

### What's enforced and what's judgement

Enforced by `spec/` and the unit tests (`pnpm check`):

- the clash rule, drop-in exclusion, the 500-schedule cap and the "why is it
  empty" reason (`src/lib/generate.test.ts`, `plan-view.test.ts`);
- week parsing, one-off detection and side-by-side layout of same-time
  classes in different weeks (`weeks.test.ts`, `week-layout.test.ts`);
- subject/level/query search and its ranking (`course-search.test.ts`, and
  the "course search" block of `spec/schedule.test.ts`);
- Only/Exclude class marks — what they keep, that "only" wins, and the
  message when every class of an activity is gone (`prefs.test.ts`, and the
  "course details and class choices" block of `spec/schedule.test.ts`);
- the flow against the running app — start a plan, add courses, page through,
  save, reload and the saved schedule is still listed; forged or unknown input
  is rejected with 400/404 and nothing is written (`spec/schedule.test.ts`);
- the accessibility and structure invariants on `/`, `/readme/` and
  `/example/` (`spec/invariants.test.ts`).

Judgement calls, checked by eye: whether the grid is readable, the colours
distinguishable, and the copy clear; the phone layout (jsdom can't measure
it).

## What it deliberately doesn't do

Not in this version, roughly in the order they'd come next: blocking out
times you're busy, sorting schedules (fewest days, latest start, fewest gaps),
other terms, and calendar export. The timetable doesn't say who teaches each
class, so only a course's conveners are shown.
Enrolment hand-off is out of scope entirely — ANU exposes no API for it.

## Data

Class times come from the [ANU CSSA timetable](https://github.com/anucssa/anutimetable)
project's daily scrape of the official ANU timetable (Semester 2 2026, 895
courses), committed to this repo as `data/2026-S2.json` and loaded into the
database at boot. Subject names and schools come from ANU Programs and
Courses (`data/subjects-2026.json`, rebuilt by
`node scripts/fetch-subjects.ts`), as do course descriptions, conveners and
unit values (`data/courses-2026.json`, `node scripts/fetch-course-info.ts`). **It's unofficial**: the scrape reads the
old timetabling system and may differ from MyTimetable — check there before
you enrol. Every page says so.

Try it without starting a plan: [the example](/example/) shows COMP1110 +
COMP2100.
