import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import {
  achievementPage,
  achievementPages,
  ACHIEVEMENTS_CARD,
  ACHIEVEMENTS_PER_PAGE,
  fillCount,
  fillPage,
} from "./achievements-card.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";

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

  it("spaces its entries as Chibi's card does, and fits the base view inside the page inset", () => {
    // Chibi's ACHIEVEMENTS_CARD and CARD_CONTENT: 312 columns a card padding apart, a 16 icon a
    // card gap from its text, entries a card gap apart, three body lines each.
    expect(ACHIEVEMENTS_CARD).toEqual({
      badge: 16,
      badgeGap: 8,
      columnGap: 16,
      columnWidth: 312,
      columns: 2,
      conditionLines: 2,
      rowGap: 8,
      rows: 3,
    });
    expect([SPACING.gap, SPACING.panelPadding, TYPE.body.lineHeight]).toEqual([8, 16, 20]);
    const { columnGap, columnWidth, columns } = ACHIEVEMENTS_CARD;
    const card = columns * columnWidth + (columns - 1) * columnGap + 2 * SPACING.panelPadding;
    expect(card).toBe(672);
    expect(card + 2 * SPACING.pageInset).toBeLessThanOrEqual(SCREEN.width);
  });
});
