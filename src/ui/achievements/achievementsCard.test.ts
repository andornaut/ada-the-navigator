import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../../data/achievements.ts";
import { CONTENT } from "../../data/content.ts";
import { SCREEN } from "../../data/screen.ts";
import { lineCount, measure } from "../../testing/textMetrics.ts";
import { listCardHeader } from "../layout/cardFrame.ts";
import { TEXT_BUTTON } from "../layout/controls.ts";
import { SPACING, TYPE } from "../layout/tokens.ts";
import {
  achievementColumnWidth,
  achievementPage,
  achievementPages,
  achievementRows,
  ACHIEVEMENTS_CARD,
  ACHIEVEMENTS_LIST_TOP,
  ACHIEVEMENTS_PER_PAGE,
  fillCount,
  fillPage,
} from "./achievementsCard.ts";

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
    expect(fillCount(CONTENT.labels.achievementProgress ?? "", 3, 10)).toBe("3/10");
    const pages = achievementPages(ACHIEVEMENTS.length);
    expect(fillPage(CONTENT.labels.achievementsPage ?? "", 1, pages)).toBe("1/3");
  });

  it("spaces its entries as Chibi's card does", () => {
    // Chibi's ACHIEVEMENTS_CARD and CARD_CONTENT: columns a card padding apart, a 16 icon a card
    // gap from its text, entries a card gap apart, three body lines each.
    expect(ACHIEVEMENTS_CARD).toEqual({
      badge: 16,
      badgeGap: 8,
      columnGap: 16,
      columns: 2,
      conditionLines: 2,
      rowGap: 8,
    });
    expect([SPACING.gap, SPACING.panelPadding, TYPE.body.lineHeight]).toEqual([8, 16, 20]);
  });

  // The modal rect's width: the view less max(16, inset) on each side.
  const available = (view: number, inset = 0) => view - 2 * Math.max(SPACING.pageInset, inset);
  const cardWidth = (column: number) =>
    ACHIEVEMENTS_CARD.columns * column +
    (ACHIEVEMENTS_CARD.columns - 1) * ACHIEVEMENTS_CARD.columnGap +
    2 * SPACING.panelPadding;

  it("fills the Large card, narrowing its columns rather than scaling the card", () => {
    expect(achievementColumnWidth(available(SCREEN.width))).toBe(320);
    expect(achievementColumnWidth(available(779.08, 43))).toBe(320);
    // 720x360 with phone insets, the narrowest view: 634 across.
    expect(achievementColumnWidth(available(SCREEN.width, 43))).toBe(293);
    // The columns fill the Large card capped at the room, so it never scales.
    expect(cardWidth(achievementColumnWidth(available(SCREEN.width)))).toBe(688);
    expect(cardWidth(achievementColumnWidth(available(SCREEN.width, 43)))).toBe(634);
    expect(cardWidth(achievementColumnWidth(900))).toBe(688);
  });

  it("starts the list 50 down and fits three rows in a 318 card at every view", () => {
    // The close X's press area bottom (42) and a gap; the title's 28 line box 14.2 down.
    expect(ACHIEVEMENTS_LIST_TOP).toBe(50);
    expect(listCardHeader(TYPE.label).titleTop).toBeCloseTo(14.2, 1);
    // Available heights: 720x360, with phone insets, and 1280x720 (a 720x405 view).
    for (const height of [328, 325, 373]) {
      const rows = achievementRows(height);
      expect(rows, String(height)).toBe(3);
      const card =
        ACHIEVEMENTS_LIST_TOP +
        rows * 60 +
        (rows - 1) * ACHIEVEMENTS_CARD.rowGap +
        SPACING.gap +
        TEXT_BUTTON.height +
        SPACING.panelPadding;
      expect(card).toBe(318);
      expect(card).toBeLessThanOrEqual(height);
    }
    expect(ACHIEVEMENTS_PER_PAGE).toBe(6);
    expect(achievementPages(ACHIEVEMENTS.length, 2 * achievementRows(325))).toBe(3);
  });

  it("fits each name and count on one line and each condition in two at the narrowest view", () => {
    const column = achievementColumnWidth(available(SCREEN.width, 43));
    const text = column - ACHIEVEMENTS_CARD.badge - ACHIEVEMENTS_CARD.badgeGap;
    // The widest count a locked entry can show.
    const widest = fillCount(CONTENT.labels.achievementProgress ?? "", 99, 99);
    const count = measure(widest, TYPE.body.size, "regular");
    for (const entry of ACHIEVEMENTS) {
      const name = measure(entry.name, TYPE.label.size, "bold");
      const line = name + (entry.counted ? ACHIEVEMENTS_CARD.badgeGap + count : 0);
      expect(line, entry.name).toBeLessThanOrEqual(text);
      expect(
        lineCount(entry.condition, TYPE.body.size, "regular", () => text),
        entry.condition,
      ).toBeLessThanOrEqual(ACHIEVEMENTS_CARD.conditionLines);
    }
  });
});
