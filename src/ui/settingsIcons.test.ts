import { readFileSync } from "node:fs";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import { SETTING_ICONS, STEPS_GLYPHS } from "./settingsIcons.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/ui/${path}`, import.meta.url), "utf8"));

describe("install steps glyphs", () => {
  it("start from Share on Apple devices, the browser's menu elsewhere, none in desktop Firefox", () => {
    expect(STEPS_GLYPHS).toEqual({
      chromiumAndroid: "icon-browser-menu",
      chromiumDesktop: "icon-browser-menu",
      firefoxAndroid: "icon-browser-menu",
      firefoxDesktop: undefined,
      ios: "icon-ios-share",
      other: "icon-browser-menu",
      safariMac: "icon-ios-share",
      samsungInternet: "icon-browser-menu",
    });
  });
});

describe("Settings icons", () => {
  it.each([
    ...Object.values(SETTING_ICONS),
    ...Object.values(STEPS_GLYPHS).filter((key) => key !== undefined),
  ])("draws %s from a single rest frame the UI manifest lists", (key) => {
    const manifest = json("manifest.json") as {
      sprites: { json: string; key: string; png: string }[];
    };
    const entry = manifest.sprites.find((sprite) => sprite.key === key);
    expect(entry?.png).toBe(`sprites/${key}.png`);
    const tags = sheetTags(json(entry!.json) as AsepriteSheet);
    expect([...tags.keys()]).toEqual(["rest"]);
    expect(tags.get("rest")).toHaveLength(1);
  });
});
