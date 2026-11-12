import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { UseAction } from "../model/types.ts";
import {
  isTouchChromePose,
  layerBounds,
  TOUCH_CHROME_ALPHA,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_SHEETS,
  touchChromeLayers,
  touchChromePixel,
  USE_DISC_POSES,
  USE_PRESS_MS,
  USE_SYMBOLS,
  useDiscLayers,
} from "./touch-chrome.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/ui/${path}`, import.meta.url), "utf8"));
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

describe("joystick chrome", () => {
  it("uses the UI palette's cream, ink and white", () => {
    const palette = json("palette.json") as { colours: Record<string, string> };
    for (const [name, colour] of Object.entries(TOUCH_CHROME_COLOURS)) {
      expect(hex(colour)).toBe(palette.colours[name]);
    }
  });

  it("reads every joystick sheet from the UI manifest with only known poses", () => {
    const manifest = json("manifest.json") as {
      sprites: { json: string; key: string }[];
    };
    for (const key of new Set(Object.values(TOUCH_CHROME_SHEETS))) {
      const entry = manifest.sprites.find((sprite) => sprite.key === key);
      expect(entry, key).toBeDefined();
      const tags = sheetTags(json(entry!.json) as AsepriteSheet);
      expect(tags.has("rest")).toBe(true);
      expect([...tags.keys()].every(isTouchChromePose)).toBe(true);
    }
  });

  it("draws a hollow ring with an ink edge and a cream band", () => {
    const layers = touchChromeLayers(TOUCH_CHROME_COLOURS, "aim", "rest");
    expect(touchChromePixel(4, layers, { x: 37.5, y: 37.5 })).toEqual([0, 0, 0, 0]);
    expect(touchChromePixel(4, layers, { x: 37.5, y: 37.5 - 34 })).toEqual([234, 212, 170, 255]);
    expect(touchChromePixel(4, layers, { x: 37.5, y: 37.5 - 36 })).toEqual([24, 20, 37, 255]);
    expect(touchChromePixel(4, layers, { x: 37.5, y: 0.2 })[3]).toBe(0);
  });

  it("lights only the move ring's chevron for the way it is pushed", () => {
    const left = { x: 13.5, y: 37.5 };
    const right = { x: 75 - 13.5, y: 37.5 };
    const pushed = touchChromeLayers(TOUCH_CHROME_COLOURS, "move", "held-left");
    expect(touchChromePixel(4, pushed, left)).toEqual([255, 255, 255, 255]);
    expect(touchChromePixel(4, pushed, right)).toEqual([234, 212, 170, 255]);
    const aim = touchChromeLayers(TOUCH_CHROME_COLOURS, "aim", "rest");
    expect(touchChromePixel(4, aim, left)).toEqual([0, 0, 0, 0]);
  });

  it("antialiases each edge over one texel at the raster scale it paints at", () => {
    const knob = touchChromeLayers(TOUCH_CHROME_COLOURS, "knob", "rest");
    // The knob's outer ink disc has radius 5.5 about its centre: 0.25 px beyond it is half a
    // texel's coverage band at 1 texel per px, and past the band at 2 or more.
    const beyond = { x: 5.5, y: 5.5 - 5.75 };
    expect(touchChromePixel(1, knob, beyond)[3]).toBeCloseTo(255 * 0.25, 0);
    expect(touchChromePixel(2, knob, beyond)[3]).toBe(0);
    expect(touchChromePixel(2.1667, knob, beyond)[3]).toBe(0);
  });

  it("lights the knob while held", () => {
    const centre = { x: 5.5, y: 5.5 };
    expect(
      touchChromePixel(4, touchChromeLayers(TOUCH_CHROME_COLOURS, "knob", "rest"), centre),
    ).toEqual([234, 212, 170, 255]);
    expect(
      touchChromePixel(4, touchChromeLayers(TOUCH_CHROME_COLOURS, "knob", "held"), centre),
    ).toEqual([255, 255, 255, 255]);
  });
});

describe("Use disc chrome", () => {
  const CREAM = [234, 212, 170, 255];
  const INK = [24, 20, 37, 255];
  const WHITE = [255, 255, 255, 255];
  const symbol = (action: UseAction) =>
    useDiscLayers(TOUCH_CHROME_COLOURS, action, "rest").slice(2);

  it("draws Chibi's open ring, ink 36.5 to 31.5 round a cream 35.5 to 32.5, with no face", () => {
    const rest = useDiscLayers(TOUCH_CHROME_COLOURS, "use", "rest");
    expect(rest.slice(0, 2)).toEqual([
      { centre: { x: 37.5, y: 37.5 }, colour: 0x181425, inner: 31.5, kind: "ring", outer: 36.5 },
      { centre: { x: 37.5, y: 37.5 }, colour: 0xead4aa, inner: 32.5, kind: "ring", outer: 35.5 },
    ]);
    expect(touchChromePixel(4, rest, { x: 37.5, y: 37.5 - 34 })).toEqual(CREAM);
    expect(touchChromePixel(4, rest, { x: 37.5, y: 37.5 - 36 })).toEqual(INK);
    expect(touchChromePixel(4, rest, { x: 37.5, y: 37.5 - 20 })).toEqual([0, 0, 0, 0]);
    expect(TOUCH_CHROME_ALPHA).toBe(0.85);
  });

  it("whitens band and symbol while pressed, the press frame's ring 1 larger for 60 ms", () => {
    expect(USE_DISC_POSES).toEqual(["rest", "press", "held"]);
    expect(USE_PRESS_MS).toBe(60);
    const press = useDiscLayers(TOUCH_CHROME_COLOURS, "talk", "press");
    const held = useDiscLayers(TOUCH_CHROME_COLOURS, "talk", "held");
    expect(press.slice(0, 2).map((layer) => "outer" in layer && layer.outer)).toEqual([37.5, 36.5]);
    expect(held.slice(0, 2).map((layer) => "outer" in layer && layer.outer)).toEqual([36.5, 35.5]);
    for (const layers of [press, held]) {
      expect(touchChromePixel(4, layers, { x: 37.5, y: 37.5 })).toEqual(WHITE);
    }
    expect(
      touchChromePixel(4, useDiscLayers(TOUCH_CHROME_COLOURS, "talk", "rest"), {
        x: 37.5,
        y: 37.5,
      }),
    ).toEqual(CREAM);
  });

  it.each([
    ["talk", { bottom: 42.5, left: 23.5, right: 51.5, top: 32.5 }],
    ["deliver", { bottom: 47.5, left: 19.5, right: 55, top: 27.5 }],
    ["deposit", { bottom: 55.5, left: 22.5, right: 52.5, top: 20.5 }],
    ["tow", { bottom: 56.5, left: 28, right: 47.5, top: 19 }],
    ["salvage", { bottom: 51.5, left: 25, right: 50, top: 24 }],
    ["use", { bottom: 48.5, left: 26.5, right: 48.5, top: 26.5 }],
  ] as const)(
    "centres %s's drawn bounds, ink included, within 0.5 of the ring's",
    (action, bounds) => {
      const drawn = layerBounds(symbol(action));
      expect(drawn.left).toBeCloseTo(bounds.left, 9);
      expect(drawn.top).toBeCloseTo(bounds.top, 9);
      expect(drawn.right).toBeCloseTo(bounds.right, 9);
      expect(drawn.bottom).toBeCloseTo(bounds.bottom, 9);
      expect(Math.abs((drawn.left + drawn.right) / 2 - 37.5)).toBeLessThanOrEqual(0.5);
      expect(Math.abs((drawn.top + drawn.bottom) / 2 - 37.5)).toBeLessThanOrEqual(0.5);
      // Every mark stays inside the ring's 31.5 inner edge.
      const corner = Math.max(
        ...[drawn.left, drawn.right].flatMap((x) =>
          [drawn.top, drawn.bottom].map((y) => Math.hypot(x - 37.5, y - 37.5)),
        ),
      );
      expect(corner).toBeLessThan(31.5);
    },
  );

  it("paints every symbol's ink before its cores, and Salvage's pole gaps in ink last", () => {
    for (const action of Object.keys(USE_SYMBOLS) as UseAction[]) {
      const colours = symbol(action).map((layer) => layer.colour);
      const firstCore = colours.indexOf(0xead4aa);
      expect(colours.slice(0, firstCore).every((colour) => colour === 0x181425)).toBe(true);
      const cores = colours.slice(firstCore).filter((colour) => colour !== 0x181425);
      expect(cores.length).toBe(USE_SYMBOLS[action].length);
    }
    const salvage = symbol("salvage");
    expect(salvage.slice(-2)).toEqual([
      { colour: 0x181425, kind: "rect", rect: { height: 1.5, width: 8, x: 25, y: 31.5 } },
      { colour: 0x181425, kind: "rect", rect: { height: 1.5, width: 8, x: 42, y: 31.5 } },
    ]);
    // The gap cuts the magnet's left arm in ink; the arm shows cream above and below it.
    const layers = useDiscLayers(TOUCH_CHROME_COLOURS, "salvage", "rest");
    expect(touchChromePixel(4, layers, { x: 29, y: 32.25 })).toEqual(INK);
    expect(touchChromePixel(4, layers, { x: 29, y: 29 })).toEqual(CREAM);
    expect(touchChromePixel(4, layers, { x: 29, y: 36 })).toEqual(CREAM);
  });

  it("draws Talk as Chibi's three dots and Use as a ring round a dot", () => {
    const talk = useDiscLayers(TOUCH_CHROME_COLOURS, "talk", "rest");
    for (const x of [28.5, 37.5, 46.5]) {
      expect(touchChromePixel(4, talk, { x, y: 37.5 })).toEqual(CREAM);
    }
    expect(touchChromePixel(4, talk, { x: 33, y: 37.5 })).toEqual(INK);
    const use = useDiscLayers(TOUCH_CHROME_COLOURS, "use", "rest");
    expect(touchChromePixel(4, use, { x: 37.5, y: 37.5 })).toEqual(CREAM);
    expect(touchChromePixel(4, use, { x: 37.5, y: 37.5 - 5.5 })).toEqual(INK);
    expect(touchChromePixel(4, use, { x: 37.5, y: 37.5 - 8 })).toEqual(CREAM);
  });

  it("names each action with Gameplay's string, the disc's accessible name", () => {
    expect(
      (Object.keys(USE_SYMBOLS) as UseAction[]).map((action) => PROTOTYPE.labels[action]),
    ).toEqual(["Deliver", "Deposit", "Salvage", "Talk", "Tow", "Use"]);
  });
});
