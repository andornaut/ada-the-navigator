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
  HUD_AMMO_COUNT,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  HUD_ROW,
  hudButtonTarget,
  hudRect,
  type Insets,
  logicalView,
  NO_INSETS,
  PAUSE_BUTTON,
  playView,
  SAFE_MARGIN,
  safeInsets,
  type Size,
  STATUS_PILL,
  statusPillWidth,
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
    "sits centred 5 below the count pills and at most 480 wide on %s",
    (_name, view, insets) => {
      const box = conversationBoxRect(insets, view);
      const hud = hudRect(insets, view);
      const pillBottom = hud.y + hudButtonTarget(0).y + HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height;
      expect(HUD_AMMO_COUNT.clearance).toBe(5);
      expect(box.y).toBe(pillBottom + HUD_AMMO_COUNT.clearance);
      expect(box.y).toBe(hud.y + 51.5);
      expect(box.width).toBeLessThanOrEqual(480);
      expect(box.x + box.width / 2).toBeCloseTo(view.width / 2);
      expect(box.x).toBeGreaterThanOrEqual(Math.max(SAFE_MARGIN.page, insets.left));
    },
  );

  it("spans 120, 63.5 to 600, 123.5 on the base view, its tab from 53.5", () => {
    expect(conversationBoxRect(NO_INSETS, BASE)).toEqual({
      height: 60,
      width: 480,
      x: 120,
      y: 63.5,
    });
    expect(conversationTabTop(NO_INSETS, BASE)).toBe(53.5);
  });

  it("puts the tab top below the pill by 11, the +N line by 15, the discs by 8.5, targets by 1", () => {
    const hud = hudRect(NO_INSETS, BASE);
    const tabTop = conversationTabTop(NO_INSETS, BASE) - hud.y;
    expect(tabTop).toBe(41.5);
    expect(tabTop - (STATUS_PILL.y + STATUS_PILL.pill.height)).toBe(11);
    expect(tabTop - (STATUS_PILL.y + STATUS_PILL.tick.top + TYPE.label.lineHeight)).toBe(15);
    const target = hudButtonTarget(0);
    expect(tabTop - (target.y + HUD_BUTTON_INSET.disc + HUD_BUTTON.disc)).toBe(8.5);
    expect(tabTop - (target.y + HUD_BUTTON.target)).toBe(1);
    // It shares rows only with the count pills and the pause press area, so it clears them across.
    expect(target.y + HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height).toBeGreaterThan(tabTop);
    expect(PAUSE_BUTTON.hit.y + PAUSE_BUTTON.hit.height).toBeGreaterThan(tabTop);
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

  it("keeps 44.67 clear above Ada's ship at the 360 high view and 67.17 at 405", () => {
    expect(conversationShipClearance(NO_INSETS, BASE)).toBeCloseTo(44.67, 9);
    // At 405 high the pivot sits at 202.5 and the hull top at 190.67.
    const box = conversationBoxRect(NO_INSETS, BASE);
    expect(405 / 2 - CONVERSATION_BOX.ship.hullRise - (box.y + box.height)).toBeCloseTo(67.17, 9);
  });

  it.each(VIEWS)("keeps at least 24 clear above Ada's ship on %s", (_name, view, insets) => {
    expect(conversationShipClearance(insets, view)).toBeGreaterThanOrEqual(
      CONVERSATION_BOX.shipClearance,
    );
  });

  it("puts Ada's portrait frame 4 inside the left and everyone else's 4 inside the right", () => {
    const left = conversationSpeakerLayout(true, "left", 480);
    const right = conversationSpeakerLayout(true, "right", 480);
    expect(left.frame).toEqual({ height: 52, width: 52, x: 4, y: 4 });
    expect(left.slot).toEqual({ height: 48, width: 48, x: 6, y: 6 });
    expect(right.frame).toEqual({ height: 52, width: 52, x: 424, y: 4 });
    expect(right.slot).toEqual({ height: 48, width: 48, x: 426, y: 6 });
  });

  it.each([
    ["left", 64],
    ["right", 8],
  ] as const)("gives the %s speaker a 408 left-aligned column at %i", (side, x) => {
    const { text } = conversationSpeakerLayout(true, side, 480);
    expect(text).toEqual({ align: "left", height: 52, width: 408, x, y: 4 });
  });

  it.each(["left", "right"] as const)(
    "gives a %s speaker without a portrait no frame and the slot's 464 column, 8 from each end",
    (side) => {
      const layout = conversationSpeakerLayout(false, side, 480);
      expect(layout.frame).toBeNull();
      expect(layout.slot).toBeNull();
      expect(layout.text).toEqual({ align: "left", height: 52, width: 464, x: 8, y: 4 });
      expect(layout.text.x + layout.text.width).toBe(480 - CONVERSATION_BOX.textGap);
      // The tab sits at the left end, 8 in.
      expect(layout.nameTab).toEqual({ end: "left", inset: 8, y: -10 });
    },
  );

  it("anchors every name tab 10 above the panel's left end: 8 in, or 64 past Ada's frame", () => {
    // Ada's tab starts SPACING.gap past her left portrait frame, over the text column's left.
    expect(conversationSpeakerLayout(true, "left", 480).nameTab).toEqual({
      end: "left",
      inset: 64,
      y: -10,
    });
    expect(conversationSpeakerLayout(true, "left", 480).text.x).toBe(64);
    expect(conversationSpeakerLayout(true, "right", 480).nameTab).toEqual({
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
    const column = conversationSpeakerLayout(true, "left", 480).text.width;
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

describe("tab clearance on every view", () => {
  // CSS sizes with odd and even logical widths, bands on either axis and the exact 2:1 base.
  const sizes: Size[] = [{ height: 360, width: 720 }];
  for (let width = 600; width <= 2600; width += 37) {
    for (const height of [300, 346, 390, 405, 720, 768, 1080]) {
      sizes.push({ height, width });
    }
  }
  const insetCases: readonly Insets[] = [
    NO_INSETS,
    { bottom: 21, left: 47, right: 47, top: 0 },
    { bottom: 21, left: 47, right: 0, top: 0 },
    { bottom: 0, left: 0, right: 59, top: 0 },
    { bottom: 0, left: 43.4, right: 12.6, top: 0 },
    { bottom: 34, left: 0, right: 0, top: 47 },
  ];
  // Art's widest tabs (art/layout.md "Tab clearance"): Ada's "Ada" and "General Gadget", each its
  // label plus a mark gap each side.
  const ADA_TAB = 42.23;
  const WIDEST_TAB = 131.15;
  // The widest +N label, "+9,999" with its outline, and the rise above its line box.
  const TICK_WIDTH = 51.38;
  type Span = {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  };
  const overlap = (a: Span, b: Span) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  it("keeps every tab off the count pills, +N and pause, and the box below the HUD row", () => {
    for (const css of sizes) {
      const view = logicalView(css);
      for (const cssInsets of insetCases) {
        const insets = safeInsets(cssInsets, 1);
        const label = `${css.width}x${css.height} ${JSON.stringify(cssInsets)}`;
        const hud = hudRect(insets, view);
        const box = conversationBoxRect(insets, view);
        const tabTop = conversationTabTop(insets, view);
        const tab = (inset: number, width: number): Span => ({
          bottom: tabTop + CONVERSATION_BOX.tab.height,
          left: box.x + inset,
          right: box.x + inset + width,
          top: tabTop,
        });
        const ada = conversationSpeakerLayout(true, "left", box.width).nameTab.inset;
        const other = conversationSpeakerLayout(true, "right", box.width).nameTab.inset;
        const tabs = [tab(ada, ADA_TAB), tab(other, WIDEST_TAB), tab(ada, WIDEST_TAB)];
        // Every weapon column up to six weapons; a count pill is never wider than its target.
        const columns: Span[] = [0, 1, 2, 3, 4, 5].map((index) => {
          const target = hudButtonTarget(index);
          return {
            bottom: hud.y + target.y + HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height,
            left: hud.x + hud.width + target.x,
            right: hud.x + hud.width + target.x + target.width,
            top: hud.y + target.y,
          };
        });
        const pause: Span = {
          bottom: hud.y + PAUSE_BUTTON.hit.y + PAUSE_BUTTON.hit.height,
          left: hud.x + PAUSE_BUTTON.hit.x,
          right: hud.x + PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width,
          top: hud.y + PAUSE_BUTTON.hit.y,
        };
        // The +N label at its highest, beside the widest pill Art allows (a 109.37 count).
        const pillRight = hud.x + STATUS_PILL.x + statusPillWidth(109.37);
        const tick: Span = {
          bottom: hud.y + STATUS_PILL.y + STATUS_PILL.tick.top + TYPE.label.lineHeight,
          left: pillRight + STATUS_PILL.tick.gap,
          right: pillRight + STATUS_PILL.tick.gap + TICK_WIDTH,
          top: hud.y + STATUS_PILL.y + STATUS_PILL.tick.top - STATUS_PILL.tick.rise,
        };
        for (const nameTab of tabs) {
          for (const column of columns) {
            expect(overlap(nameTab, column), `${label} tab against a weapon column`).toBe(false);
          }
          expect(overlap(nameTab, tick), `${label} tab against +N`).toBe(false);
          expect(overlap(nameTab, pause), `${label} tab against pause`).toBe(false);
        }
        // The box starts below the whole HUD row and the count pills.
        expect(box.y, label).toBeGreaterThanOrEqual(hud.y + HUD_ROW.bottom);
        for (const column of columns) {
          expect(box.y - column.bottom, label).toBeCloseTo(HUD_AMMO_COUNT.clearance, 9);
        }
        expect(box.y, label).toBeGreaterThan(tick.bottom);
      }
    }
  });
});
