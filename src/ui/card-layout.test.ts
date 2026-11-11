import { describe, expect, it } from "vitest";

import {
  actionsWidth,
  CARD,
  cardHeaderLayout,
  cardTitleReserve,
  cardWidth,
  groupX,
  ROW,
  rowWidth,
} from "./card-layout.ts";

describe("content-fitted card width", () => {
  const view = { availableWidth: 812, viewportWidth: 844 };

  it("is half the viewport for narrow content", () => {
    expect(cardWidth(view, [200, 120], undefined)).toBe(422);
  });

  it("fits wide content plus 32px padding", () => {
    expect(cardWidth(view, [500, 120], undefined)).toBe(532);
  });

  it("is capped by the available width", () => {
    expect(cardWidth({ availableWidth: 400, viewportWidth: 844 }, [500], undefined)).toBe(400);
  });

  it("counts the title with its 50px reservation on each side as content", () => {
    expect(cardTitleReserve(true)).toBe(50);
    expect(cardTitleReserve(false)).toBe(CARD.padding);
    // 400 + 2 * (50 - 16) = 468 content, plus 32 padding.
    expect(cardWidth(view, [100], { close: true, width: 400 })).toBe(500);
  });
});

describe("card groups", () => {
  it("centre in the card's inner width", () => {
    expect(groupX(390, 290)).toBe(50);
    expect(groupX(390, 390)).toBe(0);
  });

  it("compose control rows from icon, gaps, label and the right-end control", () => {
    expect(rowWidth(150, ROW.action.switch)).toBe(16 + 8 + 150 + 8 + 32);
    expect(rowWidth(150, ROW.action.button)).toBe(16 + 8 + 150 + 8 + 72);
    expect(ROW.height).toBe(48);
    expect(CARD.rowGap).toBe(4);
  });

  it("share one button width of the widest label plus 16px insets", () => {
    expect(actionsWidth("row", [60, 90])).toBe(2 * (90 + 32) + 8);
    expect(actionsWidth("stack", [60, 90])).toBe(90 + 32);
    expect(actionsWidth("row", [])).toBe(0);
    expect(CARD.gap).toBe(8);
  });
});

describe("card header", () => {
  it("balances the gaps above and below the title's ink", () => {
    const titleHeight = 28;
    const inkTop = 0;
    const { bodyTop, titleTop } = cardHeaderLayout(false, inkTop, titleHeight);
    const above = titleTop - CARD.frameBorder;
    const below = bodyTop + inkTop - (titleTop + titleHeight);
    expect(above).toBeCloseTo(below, 9);
  });

  it("keeps the balance when the close target pushes the first group lower", () => {
    const { bodyTop, titleTop } = cardHeaderLayout(true, 14, 28);
    expect(bodyTop).toBe(50);
    expect(titleTop - CARD.frameBorder).toBeCloseTo(bodyTop + 14 - (titleTop + 28), 9);
  });
});
