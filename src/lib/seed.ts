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
