import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CONVERSATION_BOX,
  conversationBoxRect,
  conversationShipClearance,
  conversationSpeakerLayout,
} from "./conversationBox.ts";
import { HUD_BUTTON, logicalView, NO_INSETS, SAFE_MARGIN } from "./playView.ts";

// Phone landscape and desktop CSS boxes, at the logical view each gives.
const PHONE = logicalView({ height: 390, width: 844 });
const DESKTOP = logicalView({ height: 720, width: 1280 });
const PHONE_INSETS = { bottom: 21, left: 47, right: 47, top: 0 };

describe("conversation box", () => {
  it("is a compact ink panel at 0.70 alpha, one 48 portrait high with a gap around it", () => {
    expect(CONVERSATION_BOX.panel).toEqual({ alpha: 0.7, ink: "#181425" });
    expect(CONVERSATION_BOX.portrait).toBe(48);
    expect(CONVERSATION_BOX.height).toBe(64);
    // The name tab and one line fit beside the portrait.
    expect(
      CONVERSATION_BOX.name.lineHeight + CONVERSATION_BOX.rowGap + CONVERSATION_BOX.text.lineHeight,
    ).toBeLessThanOrEqual(CONVERSATION_BOX.portrait);
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, NO_INSETS],
    ["a phone", PHONE, PHONE_INSETS],
    ["a desktop", DESKTOP, NO_INSETS],
  ])("sits centred below the HUD row and at most 640 wide on %s", (_name, view, insets) => {
    const box = conversationBoxRect(insets, view);
    const hudBottom = Math.max(SAFE_MARGIN.hud, insets.top) + HUD_BUTTON.target;
    expect(box.y).toBeGreaterThanOrEqual(hudBottom);
    expect(box.width).toBeLessThanOrEqual(640);
    expect(box.x + box.width / 2).toBeCloseTo(view.width / 2);
    const page = Math.max(SAFE_MARGIN.page, insets.left);
    expect(box.x).toBeGreaterThanOrEqual(page);
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, NO_INSETS],
    ["a phone", PHONE, PHONE_INSETS],
    ["a desktop", DESKTOP, NO_INSETS],
  ])("keeps at least 24 clear above Ada's ship on %s", (_name, view, insets) => {
    expect(conversationShipClearance(insets, view)).toBeGreaterThanOrEqual(
      CONVERSATION_BOX.shipClearance,
    );
  });

  it("takes the page width when that is narrower than 640", () => {
    const narrow = conversationBoxRect(
      { bottom: 0, left: 60, right: 60, top: 0 },
      {
        height: 360,
        width: 720,
      },
    );
    expect(narrow.width).toBe(600);
  });

  it("puts Ada's portrait on the left and everyone else's on the right", () => {
    const left = conversationSpeakerLayout("left", 640);
    const right = conversationSpeakerLayout("right", 640);
    expect(left.portrait.x).toBe(CONVERSATION_BOX.inset);
    expect(left.text.x).toBe(left.portrait.x + left.portrait.width + CONVERSATION_BOX.inset);
    expect(right.portrait.x + right.portrait.width).toBe(640 - CONVERSATION_BOX.inset);
    expect(right.text.x + right.text.width).toBe(right.portrait.x - CONVERSATION_BOX.inset);
  });

  it.each(["left", "right"] as const)(
    "starts the %s speaker's name tab and line at the text column's left edge, left-aligned",
    (side) => {
      const { line, nameTab, text } = conversationSpeakerLayout(side, 640);
      expect(nameTab).toEqual({ x: text.x, y: text.y });
      expect(line).toEqual({
        align: "left",
        x: text.x,
        y: text.y + CONVERSATION_BOX.name.lineHeight + CONVERSATION_BOX.rowGap,
      });
    },
  );

  it("keeps the right-side tab and line where the left side's text column would start", () => {
    const left = conversationSpeakerLayout("left", 640);
    const right = conversationSpeakerLayout("right", 640);
    expect(right.nameTab.x).toBe(CONVERSATION_BOX.inset);
    expect(right.line.x).toBe(CONVERSATION_BOX.inset);
    expect(left.nameTab.x).toBe(2 * CONVERSATION_BOX.inset + CONVERSATION_BOX.portrait);
    expect(right.text.width).toBe(left.text.width);
  });

  it("measures the ship at its display size", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../../public/art/manifest.json", import.meta.url), "utf8"),
    ) as { assets: { displayHeight?: number; id: string }[] };
    expect(manifest.assets.find(({ id }) => id === "ship")?.displayHeight).toBe(
      CONVERSATION_BOX.ship.display,
    );
  });
});
