import axe from "axe-core";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// The schedule builder's promises, checked against the running app. Tests in
// this file run in order and share one plan.
const baseUrl = inject("baseUrl");

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const post = (path: string, fields: Record<string, string>) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

const page = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  return { status: res.status, doc: new JSDOM(await res.text()).window.document };
};

const api = (planPath: string, tail: string) => `${planPath.replace(/^\/plan\//, "/api/plans/")}/${tail}`;

describe("schedule builder API", () => {
  let planPath = "";

  it("starts a plan at its own unguessable URL and remembers it", async () => {
    const res = await post("/api/plans", {});
    expect(res.status).toBe(303);
    planPath = res.headers.get("location") ?? "";
    expect(planPath).toMatch(/^\/plan\/[A-Za-z0-9_-]{16}$/);
    expect(res.headers.get("set-cookie")).toContain("plan=");
  });

  it("adds a course and redirects back to the plan", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "add" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(planPath);
  });

  it("rejects a course that isn't in the timetable", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "NOPE9999_S2", action: "add" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown action", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "explode" });
    expect(res.status).toBe(400);
  });

  it("rejects malformed and unknown selections", async () => {
    for (const selection of [
      "not json",
      JSON.stringify([{ courseId: "COMP1110_S2", activity: "TutZ", occurrence: "99" }]),
    ]) {
      const res = await post(api(planPath, "saved"), { selection });
      expect(res.status).toBe(400);
    }
  });

  it("404s writes to a plan that doesn't exist", async () => {
    const res = await post("/api/plans/does-not-exist-000/courses", { courseId: "COMP1110_S2", action: "add" });
    expect(res.status).toBe(404);
  });

  it("removes a course", async () => {
    const res = await post(api(planPath, "courses"), { courseId: "COMP1110_S2", action: "remove" });
    expect(res.status).toBe(303);
  });
});

describe("schedule builder pages", () => {
  let planPath = "";

  it("tells an empty plan to add a course", async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    const { status, doc } = await page(planPath);
    expect(status).toBe(200);
    expect(doc.body.textContent).toContain("Add a course to see schedules.");
  });

  it("finds a course by code on the search page", async () => {
    const { doc } = await page(`${planPath}/search?q=COMP1110`);
    expect(doc.querySelector('button[aria-label="Add COMP1110"]')).toBeTruthy();
  });

  it("links the planner to the course search", async () => {
    const { doc } = await page(planPath);
    expect(doc.querySelector(`a[href="${planPath}/search"]`)).toBeTruthy();
  });

  it("generates clash-free schedules once courses are added", async () => {
    for (const courseId of ["COMP1110_S2", "COMP2100_S2"]) {
      await post(api(planPath, "courses"), { courseId, action: "add" });
    }
    const { doc } = await page(planPath);
    expect(doc.querySelector("#schedule-heading")?.textContent).toMatch(/Schedule 1 of \d+/);
    expect(doc.querySelectorAll(".block").length).toBeGreaterThan(0);
    expect(doc.querySelector('button[aria-label="Remove COMP2100"]')).toBeTruthy();
  });

  it("clamps a nonsense page number", async () => {
    const { status, doc } = await page(`${planPath}?n=abc`);
    expect(status).toBe(200);
    expect(doc.querySelector("#schedule-heading")?.textContent).toMatch(/Schedule 1 of/);
  });

  it("keeps a saved schedule across a reload", async () => {
    const before = await page(`${planPath}?n=2`);
    const selection = before.doc.querySelector<HTMLInputElement>('input[name="selection"]')?.value ?? "";
    const res = await post(api(planPath, "saved"), { selection, n: "2" });
    expect(res.status).toBe(303);

    const reloaded = await page(planPath);
    const link = reloaded.doc.querySelector(`a[href^="${planPath}/saved/"]`);
    expect(link).toBeTruthy();

    const saved = await page(link?.getAttribute("href") ?? "");
    expect(saved.status).toBe(200);
    expect(saved.doc.querySelectorAll(".block").length).toBeGreaterThan(0);
  });

  it("has one h1 and the site nav on the planner", async () => {
    const { doc } = await page(planPath);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector('nav[aria-label="site"]')).toBeTruthy();
  });

  it("404s an unknown plan and an unknown saved schedule", async () => {
    expect((await page("/plan/does-not-exist-000")).status).toBe(404);
    expect((await page(`${planPath}/saved/999999`)).status).toBe(404);
  });
});

describe("copy", () => {
  it("keeps the spaces around inline links", async () => {
    const { doc } = await page("/");
    expect(doc.querySelector("footer")?.textContent?.replace(/\s+/g, " ")).toContain("ANU CSSA timetable scrape");
  });
});

describe("course search", () => {
  let planPath = "";
  const search = (params: string) => page(`${planPath}/search${params}`);
  const addButtons = (doc: Document) =>
    [...doc.querySelectorAll("button[aria-label^='Add ']")].map((b) => b.getAttribute("aria-label"));

  it("opens on a directory of subjects by code and name", async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    const { status, doc } = await search("");
    expect(status).toBe(200);
    const comp = doc.querySelector('a[href$="/search?subject=COMP"]');
    expect(comp?.textContent).toContain("Computer Science");
  });

  it("lists every course in a subject", async () => {
    const { doc } = await search("?subject=COMP");
    const adds = addButtons(doc);
    expect(adds).toContain("Add COMP1110");
    expect(adds).toContain("Add COMP2100");
    expect(adds.every((a) => a?.startsWith("Add COMP"))).toBe(true);
  });

  it("narrows a subject to one level", async () => {
    const { doc } = await search("?subject=COMP&level=2000");
    const adds = addButtons(doc);
    expect(adds).toContain("Add COMP2100");
    expect(adds).not.toContain("Add COMP1110");
    expect(doc.querySelector('a[aria-current="true"]')?.textContent).toContain("2000");
  });

  it("understands a subject named in words", async () => {
    const { doc } = await search("?q=computing");
    expect(addButtons(doc)).toContain("Add COMP1110");
  });

  it("says so when nothing matches", async () => {
    const { doc } = await search("?q=zzzzqqq");
    expect(doc.body.textContent).toContain("No Semester 2 courses match");
  });

  it("adds a course and comes back to the same search", async () => {
    const back = `${planPath}/search?subject=COMP&level=2000`;
    const res = await post(api(planPath, "courses"), { courseId: "COMP2100_S2", action: "add", back });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(back);
    const { doc } = await page(back);
    expect(addButtons(doc)).not.toContain("Add COMP2100");
  });

  it("won't redirect anywhere but this plan", async () => {
    const res = await post(api(planPath, "courses"), {
      courseId: "COMP1110_S2",
      action: "add",
      back: "https://example.com/phish",
    });
    expect(res.headers.get("location")).toBe(planPath);
  });

  it("404s the search page of an unknown plan", async () => {
    expect((await page("/plan/does-not-exist-000/search")).status).toBe(404);
  });
});

describe("course details and class choices", () => {
  let planPath = "";
  const total = async () => {
    const { doc } = await page(planPath);
    return Number(doc.querySelector("#schedule-heading")?.textContent?.match(/of (\d+)/)?.[1] ?? 0);
  };
  const classes = (fields: Record<string, string>) =>
    post(api(planPath, "classes"), { courseId: "COMP2100_S2", activity: "ComA", back: planPath, ...fields });

  it("shows what a course is, who runs it and where to read more", async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    const { doc } = await page(`${planPath}/search?q=COMP1110`);
    const card = doc.querySelector("#course-COMP1110_S2");
    expect(card?.textContent).toMatch(/programming/i);
    expect(card?.textContent).toMatch(/convener/i);
    expect(card?.querySelector('a[href="https://programsandcourses.anu.edu.au/2026/course/COMP1110"]')).toBeTruthy();
  });

  it("lists a course's classes grouped by activity, with times", async () => {
    const { doc } = await page(`${planPath}/search?course=COMP2100_S2`);
    const card = doc.querySelector("#course-COMP2100_S2");
    expect(card?.textContent).toContain("Computer lab A");
    expect(card?.textContent).toMatch(/\d\d:\d\d–\d\d:\d\d/);
    expect(card?.querySelector('button[aria-label="Only COMP2100 ComA/03"]')).toBeTruthy();
    expect(card?.querySelector('button[aria-label="Exclude COMP2100 ComA/03"]')).toBeTruthy();
  });

  it("combines every class by default", async () => {
    await post(api(planPath, "courses"), { courseId: "COMP2100_S2", action: "add" });
    expect(await total()).toBe(7);
  });

  it("drops an excluded class from the combinations", async () => {
    const res = await classes({ occurrence: "01", mode: "exclude" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(planPath);
    expect(await total()).toBe(6);
  });

  it("keeps only the chosen class when told to", async () => {
    await classes({ occurrence: "03", mode: "only" });
    expect(await total()).toBe(1);
    const { doc } = await page(planPath);
    const selection = doc.querySelector<HTMLInputElement>('input[name="selection"]')?.value ?? "";
    expect(JSON.parse(selection)).toContainEqual({ courseId: "COMP2100_S2", activity: "ComA", occurrence: "03" });
  });

  it("shows the choices on the plan and can reset them", async () => {
    const { doc } = await page(planPath);
    expect(doc.querySelector(".course-list")?.textContent).toContain("ComA");
    await classes({ occurrence: "03", mode: "clear" });
    await classes({ occurrence: "01", mode: "clear" });
    expect(await total()).toBe(7);
  });

  it("says which activity has nothing left when every class is excluded", async () => {
    for (const occurrence of ["01", "02", "03", "04", "05", "06", "07"]) await classes({ occurrence, mode: "exclude" });
    const { doc } = await page(planPath);
    expect(doc.body.textContent).toContain("You've excluded every COMP2100 ComA class");
  });

  it("adds the course when a class is chosen from search", async () => {
    await post(api(planPath, "classes"), {
      courseId: "COMP1110_S2",
      activity: "LecA",
      occurrence: "01",
      mode: "only",
      back: planPath,
    });
    const { doc } = await page(planPath);
    expect(doc.querySelector('button[aria-label="Remove COMP1110"]')).toBeTruthy();
  });

  it("rejects a class that isn't in the timetable, or an unknown mode", async () => {
    expect((await classes({ occurrence: "99", mode: "only" })).status).toBe(400);
    expect((await classes({ occurrence: "01", mode: "maybe" })).status).toBe(400);
  });
});

describe("plan sidebar", () => {
  let planPath = "";
  let savedHref = "";
  const sidebar = (doc: Document) => doc.querySelector('aside[aria-label="Your plan"]');

  beforeAll(async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    await post(api(planPath, "courses"), { courseId: "COMP2100_S2", action: "add" });
    await post(api(planPath, "classes"), { courseId: "COMP2100_S2", activity: "ComA", occurrence: "02", mode: "exclude" });
    const selection = (await page(planPath)).doc.querySelector<HTMLInputElement>('input[name="selection"]')?.value ?? "";
    await post(api(planPath, "saved"), { selection });
    savedHref = (await page(planPath)).doc.querySelector(`a[href^="${planPath}/saved/"]`)?.getAttribute("href") ?? "";
  });

  it("follows you across the plan's pages with your courses, marks and saved schedules", async () => {
    const { doc: search } = await page(`${planPath}/search?subject=MATH`);
    const saved = sidebar(search)?.querySelector(`a[href^="${planPath}/saved/"]`)?.getAttribute("href") ?? "";
    expect(saved).toBeTruthy();
    for (const path of [planPath, `${planPath}/search?subject=MATH`, saved]) {
      const side = sidebar((await page(path)).doc);
      expect(side?.querySelector('button[aria-label="Remove COMP2100"]'), path).toBeTruthy();
      expect(side?.textContent, path).toContain("ComA: not 02");
      expect(side?.querySelector(`a[href="${planPath}/search?course=COMP2100_S2"]`), path).toBeTruthy();
    }
  });

  it("searches from anywhere in the plan", async () => {
    const form = sidebar((await page(savedHref)).doc)?.querySelector("form[role=search]");
    expect(form?.getAttribute("action")).toBe(`${planPath}/search`);
  });

  it("removing a course from the sidebar returns to the same page", async () => {
    const back = `${planPath}/search?subject=MATH`;
    const res = await post(api(planPath, "courses"), { courseId: "COMP2100_S2", action: "remove", back });
    expect(res.headers.get("location")).toBe(back);
  });
});

// The invariants' axe floor, for the pages that need a plan to exist (so
// can't be listed in routes.ts): same rules, same jsdom limits.
describe("accessibility of plan pages", () => {
  let planPath = "";
  const violations = async (path: string) => {
    const url = new URL(path, baseUrl).href;
    const dom = new JSDOM(await (await fetch(url)).text(), { url, runScripts: "outside-only", pretendToBeVisual: true });
    const window = dom.window as unknown as { eval: (source: string) => void; axe: typeof axe };
    window.eval(axe.source);
    const results = await window.axe.run(dom.window.document, {
      rules: { "color-contrast": { enabled: false }, "link-in-text-block": { enabled: false } },
    });
    return results.violations.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.map((n) => n.target.join(" ")).join("; ")})`);
  };

  let savedHref = "";
  beforeAll(async () => {
    const res = await post("/api/plans", {});
    planPath = res.headers.get("location") ?? "";
    await post(api(planPath, "courses"), { courseId: "COMP2100_S2", action: "add" });
    await post(api(planPath, "classes"), { courseId: "COMP2100_S2", activity: "ComA", occurrence: "02", mode: "exclude" });
    const selection = (await page(planPath)).doc.querySelector<HTMLInputElement>('input[name="selection"]')?.value ?? "";
    await post(api(planPath, "saved"), { selection });
    savedHref = (await page(planPath)).doc.querySelector(`a[href^="${planPath}/saved/"]`)?.getAttribute("href") ?? "";
  });

  for (const [name, path] of [
    ["the planner", () => planPath],
    ["the subject directory", () => `${planPath}/search`],
    ["search results", () => `${planPath}/search?q=comp`],
    ["a subject at one level", () => `${planPath}/search?subject=COMP&level=2000`],
    ["one course with its classes", () => `${planPath}/search?course=COMP2100_S2`],
    ["a saved schedule", () => savedHref],
  ] as const) {
    it(`has no axe violations on ${name}`, { timeout: 20_000 }, async () => {
      expect(await violations(path())).toEqual([]);
    });
  }
});
