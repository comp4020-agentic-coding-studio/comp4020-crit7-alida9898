# Harness rules

What this app is and what good looks like: `README.md`. The design it was
built from: `docs/superpowers/specs/2026-09-27-anu-schedule-builder-design.md`.
Read the spec before changing behaviour; if a change contradicts it, say so
instead of drifting.

## Before every commit

- `pnpm check` is green (typecheck + unit + spec against the built server).
  Run `pnpm vitest run --project unit` while iterating on `src/lib`.
- New behaviour comes with a test written first and seen failing.

## Where things live

- Scheduling logic (`weeks`, `generate`, `week-layout`, `plan-view`,
  `selection`) stays pure — no DB, no Astro — and unit-tested beside it.
  Pages only wire it to the DB.
- The clash rule is: same day, overlapping times, *and* intersecting week
  sets (an empty week set means every week). Don't simplify it away.
- Every page renders through `src/components/Layout.astro`, with exactly one
  `<h1>`. Every static route goes in `spec/routes.ts`.
- Forms work without client JS: POST, validate, 303 redirect. Invalid input
  → 400/404 with nothing written.

## Don't

- Change the schema except by editing `src/lib/schema.ts` and running
  `pnpm db:generate`; commit the migration; never hand-edit `drizzle/`.
- Edit `fly.toml` or the `Dockerfile`, or add runtime dependencies, without
  asking.
- Commit `mise.local.toml`, `.env*`, tokens or the `.data/` database.
- Remove the unofficial-data notice from the footer.
- Deploy, push, or flip the repo public without asking.

## Data

`data/2026-S2.json` is the CSSA scrape. Refreshing it means replacing the
file and bumping `DATA_VERSION` in `src/lib/seed.ts`, which reseeds the
catalogue at the next boot (user tables are untouched).
