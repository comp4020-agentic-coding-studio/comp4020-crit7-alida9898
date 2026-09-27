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
