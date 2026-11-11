import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  achievementPage,
  achievementPages,
  ACHIEVEMENTS_PER_PAGE,
  fillCount,
} from "./achievements-card.ts";

describe("Achievements card", () => {
  it("pages the 14 entries six to a page, in Gameplay's order", () => {
    expect(ACHIEVEMENTS_PER_PAGE).toBe(6);
    expect(achievementPages(ACHIEVEMENTS.length)).toBe(3);
    const pages = [0, 1, 2].map((page) => achievementPage(ACHIEVEMENTS, page));
    expect(pages.map((entries) => entries.length)).toEqual([6, 6, 2]);
    expect(pages.flat()).toEqual(ACHIEVEMENTS);
    expect(achievementPages(0)).toBe(1);
  });

  it("formats a count and the page count with Gameplay's {have}/{need}", () => {
    const template = PROTOTYPE.labels.achievementProgress ?? "";
    expect(fillCount(template, 3, 10)).toBe("3/10");
    expect(fillCount(template, 1, achievementPages(ACHIEVEMENTS.length))).toBe("1/3");
  });
});
