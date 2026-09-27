import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

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

  it("finds a course by code", async () => {
    const { doc } = await page(`${planPath}?q=COMP1110`);
    expect(doc.querySelector('button[aria-label="Add COMP1110"]')).toBeTruthy();
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
