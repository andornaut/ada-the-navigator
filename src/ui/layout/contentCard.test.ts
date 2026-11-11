import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { describe, expect, it } from "vitest";

import { CARD_CLOSE, CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";
import {
  actionsWidth,
  CARD_FLOOR_VIEW_WIDTH,
  cardActionsSize,
  cardWidth,
  groupX,
  rowWidth,
  SCROLL,
} from "./contentCard.ts";
import { CONTROL_ROW, TEXT_BUTTON } from "./controls.ts";
import { hitAround } from "./hitAreas.ts";
import { logicalView, SAFE_MARGIN, safeRect } from "./playView.ts";
import { SPACING } from "./tokens.ts";

// The page safe rect's width at a logical view width, without insets.
const available = (width: number) =>
  safeRect({ bottom: 0, left: 0, right: 0, top: 0 }, SAFE_MARGIN.page, { height: 360, width })
    .width;

describe("content-fitted card width", () => {
  it.each([720, 779])(
    "equals game-kit modalWidth below, at and above the floor at %s wide",
    (view) => {
      for (const content of [100, 328, 500]) {
        expect(cardWidth(available(view), [content], undefined)).toBe(
          modalWidth({ availableWidth: available(view), viewportWidth: 720 }, content),
        );
      }
      // The floor stays half the fixed 720 base at both widths.
      expect(cardWidth(available(view), [100], undefined)).toBe(360);
      expect(cardWidth(available(view), [500], undefined)).toBe(532);
      expect(CARD_FLOOR_VIEW_WIDTH).toBe(720);
    },
  );

  it("is capped by the available width", () => {
    expect(cardWidth(available(720), [800], undefined)).toBe(688);
    expect(logicalView({ height: 390, width: 844 }).width).toBeCloseTo(779.08, 2);
  });

  it("counts the title with its derived 50 clearance on each side as content", () => {
    expect(CARD_CLOSE.hit).toEqual(hitAround(CARD_CLOSE.art));
    expect(CARD_CLOSE.hit).toEqual({ height: 48, width: 48, x: -6, y: -6 });
    expect(cardTitleReserve(true)).toBe(CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + SPACING.gap);
    expect(cardTitleReserve(true)).toBe(50);
    expect(cardTitleReserve(false)).toBe(CARD_CONTENT.padding);
    // 400 + 2 * (50 - 16) = 468 content, plus 32 padding.
    expect(cardWidth(688, [100], { close: true, width: 400 })).toBe(500);
  });
});

describe("card groups", () => {
  it("centre in the card's inner width", () => {
    expect(groupX(390, 290)).toBe(50);
    expect(groupX(390, 390)).toBe(0);
  });

  it("compose control rows from icon, gaps, label and the right-end action", () => {
    expect(rowWidth(150, CONTROL_ROW.switch.width)).toBe(16 + 8 + 150 + 8 + 32);
    expect(CONTROL_ROW.height).toBe(48);
    expect(CARD_CONTENT.rowGap).toBe(4);
  });

  it("share one action width of the widest label plus the insets, a gap apart", () => {
    expect(actionsWidth("row", [60, 90])).toBe(2 * (90 + 2 * TEXT_BUTTON.inset) + SPACING.gap);
    expect(actionsWidth("stack", [60, 90])).toBe(90 + 32);
    expect(actionsWidth("row", [])).toBe(0);
  });

  it("make the compact Install 72 wide, or its label plus 8 insets when wider", () => {
    expect(cardActionsSize(40)).toBe(72);
    expect(cardActionsSize(70)).toBe(86);
  });

  it("reserve a 6 gap and an 8 track for a scrolling body, with a 16 end pad", () => {
    expect(SCROLL).toEqual({ dragThreshold: 8, endPad: 16, gap: 6, thumbInset: 1, track: 8 });
  });
});

describe("card header", () => {
  it("starts the first group at 58 below a 28 title line box", () => {
    expect(cardHeaderLayout(true, 0, 28)).toEqual({ bodyTop: 58, titleTop: 16 });
  });

  it("balances the gaps above and below the title", () => {
    const { bodyTop, titleTop } = cardHeaderLayout(false, 0, 28);
    const above = titleTop - CARD_CONTENT.frameBorder;
    const below = bodyTop - (titleTop + 28);
    expect(above).toBeCloseTo(below, 9);
  });

  it("keeps the balance when the first group's content starts lower", () => {
    const { bodyTop, titleTop } = cardHeaderLayout(true, 14, 28);
    expect(bodyTop).toBe(50);
    expect(titleTop - CARD_CONTENT.frameBorder).toBeCloseTo(bodyTop + 14 - (titleTop + 28), 9);
  });
});
