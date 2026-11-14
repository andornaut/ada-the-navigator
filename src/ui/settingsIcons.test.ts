import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { type AsepriteSheet, sheetTags } from "@andornaut/game-kit/art/aseprite";
import { describe, expect, it } from "vitest";

import { SETTING_ICON_INK_TOP, SETTING_ICONS, STEPS_GLYPHS } from "./settingsIcons.ts";

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

// Aseprite's RGBA8888 sprite frames use the standard PNG row filters.
function firstInkRow(png: Buffer): number {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const size = png.readUInt32BE(at);
    if (png.toString("ascii", at + 4, at + 8) === "IDAT") {
      chunks.push(png.subarray(at + 8, at + 8 + size));
    }
    at += size + 12;
  }
  const source = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const decoded = Buffer.alloc(stride * height);
  let at = 0;
  for (let y = 0; y < height; y++) {
    const filter = source[at++]!;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? decoded[y * stride + x - 4]! : 0;
      const above = y ? decoded[(y - 1) * stride + x]! : 0;
      const corner = y && x >= 4 ? decoded[(y - 1) * stride + x - 4]! : 0;
      const prediction = left + above - corner;
      const distances = [
        Math.abs(prediction - left),
        Math.abs(prediction - above),
        Math.abs(prediction - corner),
      ];
      const paeth =
        distances[0]! <= distances[1]! && distances[0]! <= distances[2]!
          ? left
          : distances[1]! <= distances[2]!
            ? above
            : corner;
      const adjustment = [0, left, above, Math.floor((left + above) / 2), paeth][filter]!;
      decoded[y * stride + x] = (source[at++]! + adjustment) & 255;
    }
    if (Array.from({ length: width }, (_, x) => decoded[y * stride + x * 4 + 3]).some(Boolean)) {
      return y;
    }
  }
  return height;
}

it.each(Object.values(SETTING_ICONS))("matches %s top inset to its authored sprite ink", (key) => {
  const png = readFileSync(new URL(`../../public/art/ui/sprites/${key}.png`, import.meta.url));
  expect(SETTING_ICON_INK_TOP.get(key) ?? 0).toBe(firstInkRow(png));
});
