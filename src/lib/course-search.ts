// Browsing the catalogue the way UMN's Schedule Builder does: by subject
// (the letters of a course code, "COMP"), narrowed by level (the thousands
// digit, "2000-level"), or by a query that may name a subject in words
// ("computing" → COMP, via its school) as well as match codes and titles.
// Pure: the page hands in the courses and subjects.

export type Subject = { code: string; name: string; school: string; count: number };
export type SearchCourse = { id: string; code: string; title: string };
export type CourseFilter = { q?: string; subject?: string; level?: number };

const MIN_QUERY = 2;

export function subjectOf(code: string): string {
  return code.replace(/\d.*$/, "");
}

export function levelOf(code: string): number {
  const digit = code.match(/\d/)?.[0];
  return digit ? Number(digit) * 1000 : 0;
}

// A subject typed or picked from the list ("COMP — Computer Science",
// "comp", "Computer Science") as its code, if it names one exactly.
export function parseSubject(raw: string, subjects: Subject[]): string | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const token = text.match(/^[A-Za-z]+/)?.[0].toUpperCase();
  const byCode = subjects.find((s) => s.code === token);
  if (byCode && (token === text.toUpperCase() || /^[A-Za-z]+\s+—/.test(text))) return byCode.code;
  return subjects.find((s) => s.name.toLowerCase() === text.toLowerCase())?.code;
}

export function matchSubjects(subjects: Subject[], raw: string): Subject[] {
  const q = raw.trim().toLowerCase();
  if (q.length < MIN_QUERY) return [];
  const picked = /—/.test(q) ? parseSubject(raw, subjects) : undefined;
  if (picked) return subjects.filter((s) => s.code === picked);
  return subjects.filter(
    (s) =>
      s.code.toLowerCase().startsWith(q) ||
      s.name.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q),
  );
}

export function filterCourses<T extends SearchCourse>(courses: T[], subjects: Subject[], filter: CourseFilter): T[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const hasQuery = q.length >= MIN_QUERY;
  if (!hasQuery && !filter.subject) return [];

  const named = new Set(matchSubjects(subjects, q).map((s) => s.code));
  const compact = q.replace(/\s+/g, "");
  // code matches first, then the named subjects' courses, then title matches
  const rank = (c: T) => {
    if (!hasQuery || c.code.toLowerCase().startsWith(compact)) return 0;
    if (named.has(subjectOf(c.code))) return 1;
    if (c.title.toLowerCase().includes(q)) return 2;
    return -1;
  };
  return courses
    .filter((c) => !filter.subject || subjectOf(c.code) === filter.subject)
    .filter((c) => !filter.level || levelOf(c.code) === filter.level)
    .map((c) => ({ c, r: rank(c) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r || a.c.code.localeCompare(b.c.code))
    .map(({ c }) => c);
}

export function levelsIn(courses: { code: string }[]): number[] {
  return [...new Set(courses.map((c) => levelOf(c.code)))].sort((a, b) => a - b);
}
