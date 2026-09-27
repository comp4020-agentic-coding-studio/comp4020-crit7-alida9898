// Builds data/courses-2026.json: for every course in the timetable scrape,
// its description, conveners and unit value from Programs and Courses — what
// the search results show beside the class times.
//
//   node scripts/fetch-course-info.ts
import { readFileSync, writeFileSync } from "node:fs";

const timetable = JSON.parse(readFileSync("data/2026-S2.json", "utf8")) as Record<string, { id: string }>;
const codes = [...new Set(Object.keys(timetable).map((id) => id.split("_")[0]))].sort();

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const lines = (html: string) =>
  html
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map((s) => decode(s).trim())
    .filter(Boolean);

// the lines between a label and the next known label on the course page
function after(text: string[], label: string, stop: string[]): string[] {
  const i = text.indexOf(label);
  if (i < 0) return [];
  const out: string[] = [];
  for (const line of text.slice(i + 1)) {
    if (stop.includes(line)) break;
    out.push(line);
  }
  return out;
}

const info: Record<string, { description: string; conveners: string[]; units: string }> = {};
for (const [n, code] of codes.entries()) {
  try {
    const html = await (await fetch(`https://programsandcourses.anu.edu.au/2026/course/${code}`)).text();
    const intro = html.match(/id="introduction"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const text = lines(html);
    info[code] = {
      description: lines(intro).join(" ").replace(/\s+/g, " ").replace(/ ([.,;:)])/g, "$1"),
      conveners: after(text, "Course convener", ["Mode of delivery", "Co-taught Course", "Offered in"]),
      units: text[text.indexOf("Unit Value") + 1] ?? "",
    };
  } catch (error) {
    info[code] = { description: "", conveners: [], units: "" };
    console.error(code, error);
  }
  if (n % 50 === 0) console.log(`${n}/${codes.length}`, code);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
writeFileSync("data/courses-2026.json", `${JSON.stringify(info, null, 1)}\n`);
console.log("done", Object.keys(info).length);
