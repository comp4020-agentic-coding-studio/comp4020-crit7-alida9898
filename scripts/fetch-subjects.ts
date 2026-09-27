// Builds data/subjects-2026.json: for every subject code in the timetable
// scrape, its official name ("Course subject") and the school that offers it,
// read from one of its courses on Programs and Courses. The timetable scrape
// has course titles only, and people search by subject name ("computing").
//
//   node scripts/fetch-subjects.ts
import { readFileSync, writeFileSync } from "node:fs";

const timetable = JSON.parse(readFileSync("data/2026-S2.json", "utf8")) as Record<string, { id: string }>;
const firstCourse = new Map<string, string>();
for (const id of Object.keys(timetable).sort()) {
  const code = id.split("_")[0];
  const subject = code.replace(/\d.*$/, "");
  if (!firstCourse.has(subject)) firstCourse.set(subject, code);
}

// the text right after a label on the course page, e.g. "Course subject"
function field(html: string, label: string): string {
  const text = html.replace(/<[^>]*>/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean);
  const i = text.indexOf(label);
  const value = i >= 0 ? text[i + 1] : "";
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const subjects: Record<string, { name: string; school: string }> = {};
for (const [subject, code] of firstCourse) {
  const res = await fetch(`https://programsandcourses.anu.edu.au/2026/course/${code}`);
  const html = await res.text();
  subjects[subject] = { name: field(html, "Course subject") || subject, school: field(html, "Offered by") };
  console.log(subject, "→", subjects[subject].name, "/", subjects[subject].school);
  await new Promise((resolve) => setTimeout(resolve, 300));
}
writeFileSync("data/subjects-2026.json", `${JSON.stringify(subjects, null, 2)}\n`);
