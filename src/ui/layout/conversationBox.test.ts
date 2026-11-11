import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CONVERSATIONS } from "../../data/conversations.ts";
import {
  CONVERSATION_BOX,
  conversationBoxRect,
  conversationShipClearance,
  conversationSpeakerLayout,
  conversationTabTop,
  conversationTextTop,
  shipHullTop,
} from "./conversationBox.ts";
import {
  HUD_BUTTON,
  hudButtonTarget,
  hudRect,
  logicalView,
  NO_INSETS,
  PAUSE_BUTTON,
  playView,
  SAFE_MARGIN,
  STATUS_PILL,
} from "./playView.ts";
import { SPACING, TYPE } from "./tokens.ts";

// Phone landscape and desktop CSS boxes, at the logical view each gives.
const BASE = { height: 360, width: 720 };
const PHONE = logicalView({ height: 390, width: 844 });
const DESKTOP = logicalView({ height: 720, width: 1280 });
const PHONE_INSETS = { bottom: 21, left: 47, right: 47, top: 0 };

const VIEWS = [
  ["720x360", BASE, NO_INSETS],
  ["a phone", PHONE, PHONE_INSETS],
  ["a desktop", DESKTOP, NO_INSETS],
] as const;

describe("conversation box", () => {
  it("is a 60 high ink panel at 0.65 alpha around a 52 portrait frame with 4 padding", () => {
    expect(CONVERSATION_BOX.panel).toEqual({ alpha: 0.65, ink: "#181425" });
    expect(CONVERSATION_BOX.portrait).toMatchObject({ art: 44, edge: 2, frame: 52, slot: 48 });
    expect(CONVERSATION_BOX.padding).toBe(4);
    expect(CONVERSATION_BOX.height).toBe(60);
    expect(CONVERSATION_BOX.maxWidth).toBe(480);
    expect(CONVERSATION_BOX.text).toBe(TYPE.body);
    expect(CONVERSATION_BOX.lines).toBe(2);
  });

  it("has a 20 high name tab with a 1 ink edge and radius 2, 8 from the panel end", () => {
    expect(CONVERSATION_BOX.tab).toEqual({
      clearance: 10,
      edge: 1,
      height: 20,
      inset: 8,
      labelInset: SPACING.markGap,
      overhang: 10,
      radius: 2,
    });
    expect(CONVERSATION_BOX.name).toBe(TYPE.label);
  });

  it.each(VIEWS)(
    "sits centred below the HUD row and at most 480 wide on %s",
    (_name, view, insets) => {
      const box = conversationBoxRect(insets, view);
      const hud = hudRect(insets, view);
      expect(box.y).toBe(hud.y + HUD_BUTTON.target + 10 + 10);
      expect(box.width).toBeLessThanOrEqual(480);
      expect(box.x + box.width / 2).toBeCloseTo(view.width / 2);
      expect(box.x).toBeGreaterThanOrEqual(Math.max(SAFE_MARGIN.page, insets.left));
    },
  );

  it("spans 120, 80 to 600, 140 on the base view, its tab from 70", () => {
    expect(conversationBoxRect(NO_INSETS, BASE)).toEqual({ height: 60, width: 480, x: 120, y: 80 });
    expect(conversationTabTop(NO_INSETS, BASE)).toBe(70);
  });

  it("clears the weapon press areas by 17.5, pause by 15.25 and the +N label by 3.5", () => {
    const hud = hudRect(NO_INSETS, BASE);
    const tabTop = conversationTabTop(NO_INSETS, BASE);
    const weaponsBottom = hud.y + hudButtonTarget(0).y + HUD_BUTTON.target;
    const pauseBottom = hud.y + PAUSE_BUTTON.hit.y + PAUSE_BUTTON.hit.height;
    const tickBottom = hud.y + STATUS_PILL.y + STATUS_PILL.tick.top + TYPE.body.lineHeight;
    expect(weaponsBottom).toBe(52.5);
    expect(tabTop - weaponsBottom).toBe(17.5);
    expect(pauseBottom).toBe(54.75);
    expect(tabTop - pauseBottom).toBe(15.25);
    expect(tickBottom).toBe(66.5);
    expect(tabTop - tickBottom).toBe(3.5);
  });

  it("takes the page width when that is narrower than 480", () => {
    const narrow = conversationBoxRect({ bottom: 0, left: 130, right: 130, top: 0 }, BASE);
    expect(narrow.width).toBe(460);
  });

  it("measures the ship's hull top from the play view's centre", () => {
    expect(shipHullTop(BASE)).toBeCloseTo(168.17, 9);
    const play = playView(DESKTOP);
    expect(shipHullTop(DESKTOP)).toBeCloseTo(play.y + play.height / 2 - 11.83, 9);
  });

  it("rises to the highest drawn hull point of Art's 32 idle headings, at heading 4", () => {
    // Frames are 96 px with the pivot at (48, 48), drawn 42 px across.
    const rises = Array.from({ length: 32 }, (_, heading) => {
      const svg = readFileSync(new URL(`../../../public/art/ship-${heading}.svg`, import.meta.url));
      const ys = [...String(svg).matchAll(/[\d.]+,([\d.]+)/g)].map((match) => Number(match[1]));
      return ((48 - Math.min(...ys)) * 42) / 96;
    });
    const highest = Math.max(...rises);
    expect(rises.indexOf(highest)).toBe(4);
    // The pyramid hull's measured 11.82125; the rise is never below it, rounded up to 0.01.
    expect(highest).toBeCloseTo(11.82125, 9);
    expect(highest).toBeLessThanOrEqual(CONVERSATION_BOX.ship.hullRise);
    expect(CONVERSATION_BOX.ship.hullRise).toBe(Math.ceil(highest * 100) / 100);
  });

  it("keeps 28.17 clear above Ada's ship at the 360 high view and 50.67 at 405", () => {
    expect(conversationShipClearance(NO_INSETS, BASE)).toBeCloseTo(28.17, 9);
    // At 405 high the pivot sits at 202.5 and the hull top at 190.67.
    const box = conversationBoxRect(NO_INSETS, BASE);
    expect(405 / 2 - CONVERSATION_BOX.ship.hullRise - (box.y + box.height)).toBeCloseTo(50.67, 9);
  });

  it.each(VIEWS)("keeps at least 24 clear above Ada's ship on %s", (_name, view, insets) => {
    expect(conversationShipClearance(insets, view)).toBeGreaterThanOrEqual(
      CONVERSATION_BOX.shipClearance,
    );
  });

  it("puts Ada's portrait frame 4 inside the left and everyone else's 4 inside the right", () => {
    const left = conversationSpeakerLayout("left", 480);
    const right = conversationSpeakerLayout("right", 480);
    expect(left.frame).toEqual({ height: 52, width: 52, x: 4, y: 4 });
    expect(left.slot).toEqual({ height: 48, width: 48, x: 6, y: 6 });
    expect(right.frame).toEqual({ height: 52, width: 52, x: 424, y: 4 });
    expect(right.slot).toEqual({ height: 48, width: 48, x: 426, y: 6 });
  });

  it.each([
    ["left", 64],
    ["right", 8],
  ] as const)("gives the %s speaker a 408 left-aligned column at %i", (side, x) => {
    const { text } = conversationSpeakerLayout(side, 480);
    expect(text).toEqual({ align: "left", height: 52, width: 408, x, y: 4 });
  });

  it("anchors the name tab 10 above the panel, 8 in from the end opposite the portrait", () => {
    expect(conversationSpeakerLayout("left", 480).nameTab).toEqual({
      end: "right",
      inset: 8,
      y: -10,
    });
    expect(conversationSpeakerLayout("right", 480).nameTab).toEqual({
      end: "left",
      inset: 8,
      y: -10,
    });
  });

  it("centres one line's box at 20 and two lines' at 10, below the tab's 10 inside the panel", () => {
    expect(conversationTextTop(1)).toBe(20);
    expect(conversationTextTop(2)).toBe(10);
    expect(conversationTextTop(3)).toBe(10);
    expect(conversationTextTop(2)).toBeGreaterThanOrEqual(
      CONVERSATION_BOX.tab.height - CONVERSATION_BOX.tab.overhang,
    );
  });

  it("holds every line in at most two lines of the 408 column", () => {
    // A generous body advance per character bounds each line's width.
    const advance = TYPE.body.size * 0.6;
    const column = conversationSpeakerLayout("left", 480).text.width;
    for (const conversation of CONVERSATIONS) {
      for (const line of conversation.lines) {
        for (const text of [line.text, line.desktop ?? ""]) {
          expect(text.length * advance, text).toBeLessThanOrEqual(CONVERSATION_BOX.lines * column);
        }
      }
    }
  });

  it("keeps the hull's rise within the ship's display frame", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../../public/art/manifest.json", import.meta.url), "utf8"),
    ) as { assets: { displayHeight?: number; id: string }[] };
    const display = manifest.assets.find(({ id }) => id === "ship")?.displayHeight ?? 0;
    expect(CONVERSATION_BOX.ship.hullRise).toBeLessThanOrEqual(display / 2);
  });
});
