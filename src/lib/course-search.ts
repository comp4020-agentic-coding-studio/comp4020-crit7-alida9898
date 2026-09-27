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

export function matchSubjects(subjects: Subject[], raw: string): Subject[] {
  const q = raw.trim().toLowerCase();
  if (q.length < MIN_QUERY) return [];
  return subjects.filter(
    (s) =>
      s.code.toLowerCase().startsWith(q) ||
      s.name.toLowerCase().includes(q) ||
      s.school.toLowerCase().includes(q),
  );
}

export function filterCourses(courses: SearchCourse[], subjects: Subject[], filter: CourseFilter): SearchCourse[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const hasQuery = q.length >= MIN_QUERY;
  if (!hasQuery && !filter.subject) return [];

  const named = new Set(matchSubjects(subjects, q).map((s) => s.code));
  const compact = q.replace(/\s+/g, "");
  return courses
    .filter((c) => !filter.subject || subjectOf(c.code) === filter.subject)
    .filter((c) => !filter.level || levelOf(c.code) === filter.level)
    .filter(
      (c) =>
        !hasQuery ||
        named.has(subjectOf(c.code)) ||
        c.code.toLowerCase().startsWith(compact) ||
        c.title.toLowerCase().includes(q),
    )
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function levelsIn(courses: { code: string }[]): number[] {
  return [...new Set(courses.map((c) => levelOf(c.code)))].sort((a, b) => a - b);
}
