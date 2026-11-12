import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../data/achievements.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import { lineCount, measure } from "../testing/text-measure.ts";
import {
  achievementColumnWidth,
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

  it("spaces its entries as Chibi's card does, inside the base view's page inset", () => {
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

  // The page safe rect's width: the view less max(16, inset) on each side.
  const available = (view: number, inset = 0) => view - 2 * Math.max(SPACING.pageInset, inset);
  const cardWidth = (column: number) =>
    ACHIEVEMENTS_CARD.columns * column +
    (ACHIEVEMENTS_CARD.columns - 1) * ACHIEVEMENTS_CARD.columnGap +
    2 * SPACING.panelPadding;

  it("narrows its columns to fit the view rather than scaling the card", () => {
    expect(achievementColumnWidth(available(SCREEN.width))).toBe(312);
    expect(achievementColumnWidth(available(779.08, 43))).toBe(312);
    // 720x360 with phone insets, the narrowest view: 634 across.
    expect(achievementColumnWidth(available(SCREEN.width, 43))).toBe(293);
    for (const room of [available(SCREEN.width, 43), available(SCREEN.width), 900]) {
      expect(cardWidth(achievementColumnWidth(room))).toBeLessThanOrEqual(room);
    }
  });

  it("fits each name and count on one line and each condition in two at the narrowest view", () => {
    const column = achievementColumnWidth(available(SCREEN.width, 43));
    const text = column - ACHIEVEMENTS_CARD.badge - ACHIEVEMENTS_CARD.badgeGap;
    // The widest count a locked entry can show.
    const widest = fillCount(PROTOTYPE.labels.achievementProgress ?? "", 99, 99);
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
