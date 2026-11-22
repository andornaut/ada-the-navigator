import { HIT_RULE, hitAround } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { CARD_CLOSE, CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";
import {
  actionsWidth,
  CARD_WIDTH_CAPS,
  cardActionsSize,
  cardWidth,
  groupX,
  MODAL_SCREEN_MARGIN,
  rowWidth,
  SCROLL,
} from "./contentCard.ts";
import { CONTROL_ROW, TEXT_BUTTON } from "./controls.ts";
import { BUTTON_GAP, SPACING } from "./tokens.ts";

describe("fixed modal width", () => {
  it("uses the shared width families and screen margin", () => {
    expect(CARD_WIDTH_CAPS).toEqual({ large: 688, medium: 500, small: 400 });
    expect(MODAL_SCREEN_MARGIN).toBe(16);
  });

  // Content width is not an input: a card takes its family's width, capped at the modal rect.
  it.each(["small", "medium", "large"] as const)(
    "keeps %s at its family width at 720 and 779 logical wide",
    (size) => {
      for (const view of [720, 779.08]) {
        const availableWidth = view - 2 * MODAL_SCREEN_MARGIN;
        expect(cardWidth({ availableWidth, size })).toBe(
          Math.min(CARD_WIDTH_CAPS[size], availableWidth),
        );
      }
      expect(cardWidth({ availableWidth: 688, size })).toBe(CARD_WIDTH_CAPS[size]);
    },
  );

  it.each(["small", "medium", "large"] as const)("clamps %s to a narrow game-area rect", (size) => {
    expect(cardWidth({ availableWidth: 380, size })).toBe(380);
    expect(cardWidth({ availableWidth: 0, size })).toBe(0);
  });

  it("does not allocate space when safe-area constraints exhaust the rect", () => {
    expect(cardWidth({ availableWidth: -10, size: "large" })).toBe(0);
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

  it("sum intrinsic widths in rows and share the widest width in stacks", () => {
    expect(actionsWidth("row", [60, 90])).toBe(60 + 90 + 4 * TEXT_BUTTON.inset + BUTTON_GAP);
    expect(actionsWidth("row", [60, 90])).toBe(230);
    expect(actionsWidth("stack", [60, 90])).toBe(90 + 32);
    expect(actionsWidth("row", [])).toBe(0);
  });

  it("give Install the standard minimum and label insets", () => {
    expect(cardActionsSize(40)).toBe(72);
    expect(cardActionsSize(70)).toBe(102);
    expect(cardActionsSize(4)).toBe(TEXT_BUTTON.height);
  });

  it("reserve a 6 gap and an 8 track for a scrolling body, with a 16 end pad", () => {
    expect(SCROLL).toEqual({ dragThreshold: 8, endPad: 16, gap: 6, thumbInset: 1, track: 8 });
  });
});

describe("card header", () => {
  it("reserves the close hit target and mirrored title clearance", () => {
    expect(CARD_CLOSE.hit).toEqual(hitAround(HIT_RULE, CARD_CLOSE.art));
    expect(CARD_CLOSE.hit).toEqual({ height: 48, width: 48, x: -6, y: -6 });
    expect(cardTitleReserve(true)).toBe(CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + SPACING.gap);
    expect(cardTitleReserve(true)).toBe(50);
    expect(cardTitleReserve(false)).toBe(CARD_CONTENT.padding);
  });

  it("starts the first group at 58 below a 28 title line box", () => {
    expect(cardHeaderLayout(true, 0, 28)).toEqual({ bodyTop: 58, titleTop: 16 });
    // A measured line box a layout unit over 28 still starts the group at 58.
    expect(cardHeaderLayout(true, 0, 28.002).bodyTop).toBe(58);
    expect(cardHeaderLayout(true, 0, 28.5).bodyTop).toBe(59);
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
