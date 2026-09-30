# Process overview

## What I built

`README.md` has the full account: an ANU timetable planner, UMN Schedule
Builder-style, that searches for clash-free combinations of lectures,
tutorials and labs and lets you save the ones you like.

## How I got here

The design came first: a spec
([`b9b54ca`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/b9b54ca))
and an implementation plan
([`6ad1f16`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/6ad1f16))
before any app code, settling the clash rule up front — same day,
overlapping times, *and* intersecting week sets — so it wouldn't get
simplified away under time pressure later.

From there the scheduling core was built pure and test-first, no DB or
Astro in sight: week parsing and clash-free generation
([`5caa7b7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/5caa7b7)),
then the week-grid layout and saved-selection parsing
([`f89f3ca`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/f89f3ca)).
Only once that logic had its own tests did it get wired to a database — the
catalogue schema seeded from the CSSA scrape
([`a341837`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/a341837))
and validated POST endpoints for plans, courses and saved schedules
([`aab4297`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/aab4297)),
then the actual pages
([`8c68104`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/8c68104)).

The UMN-inspired browsing model — subjects A–Z, narrow by level, or a query
that also matches a subject in words — came together over a few passes: the
app shell
([`212a93d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/212a93d)),
the search page itself
([`963b19d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/963b19d)),
course cards with per-class Only/Exclude choices
([`29ab520`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/29ab520)),
type scale
([`10b41e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/10b41e8)),
and a plan sidebar surfacing search, your courses, schedules and saved ones
on every page
([`99a2ec7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/99a2ec7)).

Two things got caught by review rather than planned in advance. First, a
combobox script I'd left as Astro's default-processed `<script type="module">`
even though it had no imports or hydration to justify it:

> 没有必须用astro的必要你知道的吧

— fair, so it moved to `is:inline` and stayed plain JS.

Second, a screenshot of the sidebar's quick-search box sitting right above
the *same* search form on the search page itself:

> 两个搜索框有点多余

Both fixes, plus restyling the Subject field's unstyleable native `<datalist>`
popup into a WAI-ARIA combobox, landed together
([`0237a7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/0237a7a))
— test written first per `CLAUDE.md`, seen failing, then made to pass. Writing
that test surfaced a real debugging detour: it kept throwing
`SecurityError: localStorage is not available for opaque origins` instead of
a clean assertion. Root-causing it (rather than papering over it) took
bisecting with a standalone JSDOM repro down to "a raw jsdom `<input>` element
handed straight to `expect()` triggers pretty-format's DOM inspection, which
touches `window.localStorage` on the opaque-origin JSDOM these specs build" —
a tooling quirk, not an app bug. The fix was boolean-casting the element
before asserting; the finding is documented so the next test in this file
doesn't hit the same wall.

Docs came last, deliberately: `CLAUDE.md` and `README.md` were written once
the rules and the app's account of itself were things I could actually stand
behind, not templates filled in on day one
([`bc62c58`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-alida9898/commit/bc62c58)).

Throughout, `pnpm check` (typecheck + unit tests + spec tests against the
built server) is what told me the result was right, not a manual click-through
— 142 tests passing is the actual bar every commit above cleared before it
landed.
