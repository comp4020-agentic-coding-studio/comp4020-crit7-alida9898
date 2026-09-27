import { describe, expect, it } from "vitest";
import { parseWeeks } from "./weeks";

describe("parseWeeks", () => {
  it("reads ranges joined by the scrape's non-breaking hyphen", () => {
    expect([...parseWeeks("31‑36,39‑44")]).toEqual([
      31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44,
    ]);
  });

  it("reads a single week", () => {
    expect([...parseWeeks("35")]).toEqual([35]);
  });

  it("accepts an ASCII hyphen", () => {
    expect([...parseWeeks("31-33")]).toEqual([31, 32, 33]);
  });

  it("returns an empty set for an empty string", () => {
    expect(parseWeeks("").size).toBe(0);
  });

  it("ignores a trailing comma rather than inventing week 0", () => {
    expect([...parseWeeks("31‑33,")]).toEqual([31, 32, 33]);
  });
});
