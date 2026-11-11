// Elder Loom's portraits: an adaptation of Archie's elder owner portrait (art/sources/
// face-owner-kilo.png, CC BY-NC-SA 4.0) with silver hair, a lavender Weaver tunic, a rose thread
// badge and pilot goggles, as 32 px storybook and 22 px compact sheets. Contract: art/needle.md
// (Elder Loom's portrait) and art/portraits.md.
// Usage: node art/tools/needle-portraits.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Colour, Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";
import type { Tag } from "@andornaut/art-kit/raster";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { replaceEntries } from "./manifest.ts";

const source = fileURLToPath(new URL("../sources/face-owner-kilo.png", import.meta.url));
const output = fileURLToPath(new URL("../../public/art/needle/portraits/", import.meta.url));

const FULL = 32;
const COMPACT = 22;
const MS = 1000;
// Source frames kept: happy 0 and neutral 1.
const FRAMES = [
  ["happy", 0],
  ["neutral", 1],
] as const;
// The compact crop's top-left in the 32 frame: the braid's edge to the chin.
const CROP = [4, 5] as const;

const INK = "181425";
const PEARL = "f1ece6";
const SILVER = "cfc5bd";
const SILVER_SHADE = "9d948b";
const LAV = "c4afcc";
const LAV_SIDE = "8f7c9c";
const LAV_DEEP = "5e4f6c";
const ROSE = "e3b7c0";
const GLASS = "8fd6e0";
const STRAP = "4a4360";

// Rows from BODY down are the clothes; rows above are the hair and face.
const BODY = 26;
const HAIR: Readonly<Record<string, string>> = {
  a99c86: SILVER,
  ead4aa: PEARL,
  c0cbdc: PEARL,
  "8b9bb4": SILVER_SHADE,
};
const CLOTHES: Readonly<Record<string, string>> = {
  "733e39": LAV_SIDE,
  ead4aa: PEARL,
  e4a672: LAV,
  "3e2731": LAV_DEEP,
  feae34: ROSE,
  fee761: "ffffff",
  b86f50: LAV_SIDE,
};
// Goggles pushed up on the hair: the strap row, its span and the two lenses' columns.
const GOGGLES = {
  row: 8,
  span: [7, 24],
  lenses: [
    [10, 12],
    [19, 21],
  ],
} as const;

const image = decodePng(readFileSync(source));

function frame(index: number): Frame {
  const rows: Frame = Array.from({ length: FULL }, (_, y) =>
    Array.from({ length: FULL }, (_, x): Colour => {
      const at = (y * image.width + index * FULL + x) * 4;
      const [r = 0, g = 0, b = 0, a = 0] = image.data.subarray(at, at + 4);
      if (a !== 0 && a !== 255) {
        throw new RangeError(`source has partial alpha at ${index * FULL + x},${y}`);
      }
      if (a === 0) return null;
      const colour = [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return (y >= BODY ? CLOTHES : HAIR)[colour] ?? colour;
    }),
  );
  const { lenses, row, span } = GOGGLES;
  for (let x = span[0]; x <= span[1]; x++) {
    if (rows[row]![x] !== null && rows[row]![x] !== INK) rows[row]![x] = STRAP;
  }
  for (const [a, b] of lenses) {
    for (let x = a; x <= b; x++) {
      rows[row - 1]![x] = GLASS;
      rows[row]![x] = GLASS;
      rows[row - 2]![x] = INK;
    }
    for (const y of [row - 1, row]) {
      rows[y]![a - 1] = INK;
      rows[y]![b + 1] = INK;
    }
    rows[row - 1]![a] = "ffffff";
  }
  return rows;
}

const crop = (full: Frame): Frame =>
  full.slice(CROP[1], CROP[1] + COMPACT).map((row) => row.slice(CROP[0], CROP[0] + COMPACT));

const sheets = [
  { key: "loom", size: FULL, make: frame },
  { key: "loom-compact", size: COMPACT, make: (i: number) => crop(frame(i)) },
] as const;

mkdirSync(output, { recursive: true });
const entries = [];
for (const { key, make, size } of sheets) {
  const tags: Tag[] = FRAMES.map(([name, index]) => [name, [make(index)], [MS]]);
  await writeSpriteSheet(
    { data: `${output}${key}.json`, sheet: `${output}${key}.png` },
    { key },
    tags,
  );
  const path = `${output}${key}.json`;
  writeFileSync(
    path,
    await format(readFileSync(path, "utf8"), { ...(await resolveConfig(path)), filepath: path }),
  );
  entries.push({
    id: size === FULL ? "loom-portrait" : "loom-portrait-compact",
    path: `/art/needle/portraits/${key}.png`,
    width: size * FRAMES.length,
    height: size,
    ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: size,
    frameHeight: size,
    frames: Object.fromEntries(FRAMES.map(([name], i) => [name, i])),
  });
}

replaceEntries("needle", (id) => id.startsWith("loom-portrait"), entries);
console.log(`wrote ${entries.map(({ id }) => id).join(", ")}`);
