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
