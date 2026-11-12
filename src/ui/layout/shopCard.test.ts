import { describe, expect, it } from "vitest";

import { SCROLL } from "./contentCard.ts";
import { FOCUS_RING, PILL, TEXT_BUTTON } from "./controls.ts";
import {
  BALANCE,
  CONFIRM_ITEM,
  glyphOffset,
  SHOP_ROW,
  shopColumns,
  shopListWidth,
  shopRowWidth,
} from "./shopCard.ts";
import { BUTTON_GAP, SPACING, TYPE } from "./tokens.ts";

// art/layout.md "Shop item row", value for value.
describe("shop item row", () => {
  it("is a ui-button-tile at the action height with gap insets and a 36 well", () => {
    expect(SHOP_ROW.height).toBe(TEXT_BUTTON.height);
    expect(SHOP_ROW.inset).toBe(SPACING.gap);
    expect(SHOP_ROW.nameGap).toBe(SPACING.gap);
    expect(SHOP_ROW.well).toBe(36);
    expect(SHOP_ROW.nameLine).toBe(TYPE.body.lineHeight);
  });

  it("centres 20 icons at 8, the 24 upgrade composite at 6 and the 32 swatch at 2", () => {
    expect(glyphOffset(SHOP_ROW.glyph.icon)).toBe(8);
    expect(glyphOffset(SHOP_ROW.glyph.upgrade)).toBe(6);
    expect(glyphOffset(SHOP_ROW.glyph.swatch)).toBe(2);
  });

  it("prices in a PILL with the 16 Stardust icon and marks Owned with the 12x8 check", () => {
    expect(SHOP_ROW.pill).toEqual({ icon: 16, pill: PILL });
    expect(SHOP_ROW.markGap).toBe(SPACING.markGap);
    expect(SHOP_ROW.check).toEqual({ height: 8, width: 12 });
  });

  it("rings the paint in use with the selection ring", () => {
    expect(SHOP_ROW.selection).toEqual({
      band: FOCUS_RING.selectionBand,
      outset: FOCUS_RING.selectionOutset,
    });
  });

  it("measures a row as inset, well, gap, name, gap, slot and inset", () => {
    expect(shopRowWidth(120, 70)).toBe(8 + 36 + 8 + 120 + 8 + 70 + 8);
  });

  it("heads the paint rows with a 20 icon on a 20 line a gap above them", () => {
    expect(SHOP_ROW.paintHeading).toEqual({ gap: SPACING.gap, icon: 20, line: 20 });
  });
});

describe("shop item list", () => {
  it("counts the scroll reserve toward the list's width", () => {
    expect(shopListWidth(1, 250)).toBe(250 + SCROLL.gap + SCROLL.track);
    // The item grid's columns are buttons side by side, BUTTON_GAP apart.
    expect(shopListWidth(2, 250)).toBe(2 * 250 + BUTTON_GAP + SCROLL.gap + SCROLL.track);
  });

  it("uses two columns only when they and the panel padding fit the available width", () => {
    const fits = shopListWidth(2, 250) + 2 * SPACING.panelPadding;
    expect(shopColumns(fits, 250)).toBe(2);
    expect(shopColumns(fits - 1, 250)).toBe(1);
  });
});

describe("balance and buy confirm", () => {
  it("shows the balance as the 20 icon, a mark gap and a label on a 20 line", () => {
    expect(BALANCE).toEqual({ icon: 20, line: TYPE.label.lineHeight, markGap: SPACING.markGap });
  });

  it("draws the confirm well at 56 with 2x glyphs, a 48 swatch and a heading price", () => {
    expect(CONFIRM_ITEM.well).toBe(56);
    expect(CONFIRM_ITEM.glyphScale * SHOP_ROW.glyph.icon).toBe(40);
    expect(CONFIRM_ITEM.glyphScale * SHOP_ROW.glyph.upgrade).toBe(48);
    expect(CONFIRM_ITEM.swatch).toBe(48);
    expect(CONFIRM_ITEM.price).toEqual({ icon: 20, markGap: SPACING.markGap, text: TYPE.heading });
  });
});
