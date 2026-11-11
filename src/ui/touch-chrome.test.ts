import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import {
  isTouchChromePose,
  TOUCH_CHROME_COLOURS,
  TOUCH_CHROME_SHEETS,
  touchChromeLayers,
  touchChromePixel,
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
