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
