import { modalWidth } from "@andornaut/game-kit/modalLayout";
import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { CARD_CLOSE, CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";
import {
  actionsWidth,
  CARD_FLOOR_VIEW_WIDTH,
  CARD_WIDTH_CAPS,
  cardActionsSize,
  cardWidth,
  groupX,
  rowWidth,
  SCROLL,
} from "./contentCard.ts";
import { CONTROL_ROW, TEXT_BUTTON } from "./controls.ts";
import { logicalView, SAFE_MARGIN, safeRect } from "./playView.ts";
import { BUTTON_GAP, SPACING } from "./tokens.ts";

// The page safe rect's width at a logical view width, without insets.
const available = (width: number) =>
  safeRect({ bottom: 0, left: 0, right: 0, top: 0 }, SAFE_MARGIN.page, { height: 360, width })
    .width;

describe("content-fitted card width", () => {
  it("uses the approved wider small and medium caps without changing large", () => {
    expect(CARD_WIDTH_CAPS).toEqual({ large: 760, medium: 640, small: 480 });
  });
  it.each(["small", "medium", "large"] as const)(
    "fits content under the %s cap and clamps to the available width",
    (size) => {
      for (const availableWidth of [280, 688, 747]) {
        for (const content of [100, 328, 500, 800]) {
          expect(cardWidth({ availableWidth, size }, [content], undefined)).toBe(
            modalWidth(
              {
                availableWidth: Math.min(availableWidth, CARD_WIDTH_CAPS[size]),
                viewportWidth: 720,
              },
              content,
            ),
          );
        }
      }
      expect(cardWidth({ availableWidth: 900, size }, [100], undefined)).toBe(360);
      expect(cardWidth({ availableWidth: 900, size }, [800], undefined)).toBe(
        CARD_WIDTH_CAPS[size],
      );
      expect(CARD_FLOOR_VIEW_WIDTH).toBe(720);
    },
  );

  it("preserves the logical view scale and page inset", () => {
    expect(available(720)).toBe(688);
    expect(logicalView({ height: 390, width: 844 }).width).toBeCloseTo(779.08, 2);
  });

  it("counts the title with its derived 50 clearance on each side as content", () => {
    expect(CARD_CLOSE.hit).toEqual(hitAround(HIT_RULE, CARD_CLOSE.art));
    expect(CARD_CLOSE.hit).toEqual({ height: 48, width: 48, x: -6, y: -6 });
    expect(cardTitleReserve(true)).toBe(CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + SPACING.gap);
    expect(cardTitleReserve(true)).toBe(50);
    expect(cardTitleReserve(false)).toBe(CARD_CONTENT.padding);
    // 400 + 2 * (50 - 16) = 468 content, plus 32 padding.
    expect(
      cardWidth({ availableWidth: 688, size: "large" }, [100], { close: true, width: 400 }),
    ).toBe(500);
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

  it("share one action width of the widest label plus the insets, BUTTON_GAP apart", () => {
    expect(actionsWidth("row", [60, 90])).toBe(2 * (90 + 2 * TEXT_BUTTON.inset) + BUTTON_GAP);
    expect(actionsWidth("row", [60, 90])).toBe(260);
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
