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
