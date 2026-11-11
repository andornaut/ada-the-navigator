import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  achievementPage,
  achievementPages,
  ACHIEVEMENTS_PER_PAGE,
  fillCount,
  fillPage,
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

  it("formats a count with {have}/{need} and the page count with {page}/{pages}", () => {
    expect(fillCount(PROTOTYPE.labels.achievementProgress ?? "", 3, 10)).toBe("3/10");
    const pages = achievementPages(ACHIEVEMENTS.length);
    expect(fillPage(PROTOTYPE.labels.achievementsPage ?? "", 1, pages)).toBe("1/3");
  });
});
