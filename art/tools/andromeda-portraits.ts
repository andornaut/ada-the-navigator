// Pip's and the settler's portraits: Archie portrait sheets in art/sources/, recoloured into
// Andromeda's courier and settler colours, as 32 px sheets and 22 px compact crops in the
// conversation format. Contract: art/andromeda.md (Portraits) and art/portraits.md (provenance).
// Usage: node art/tools/andromeda-portraits.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Colour, Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";
import type { Tag } from "@andornaut/art-kit/raster";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { replaceEntries } from "./manifest.ts";

const sources = fileURLToPath(new URL("../sources/", import.meta.url));
const output = fileURLToPath(new URL("../../public/art/andromeda/portraits/", import.meta.url));
const FULL = 32;
const COMPACT = 22;

type Point = readonly [number, number];

type Portrait = {
  id: string;
  key: string;
  source: string;
  // Source frames kept, in order, by tag name: the source sheet's frame index for each, from its
  // Aseprite data (art/portraits.md). Every source frame is 32 px wide in one row and lasts 1000 ms.
  tags: readonly (readonly [string, number])[];
  // Source colour to Andromeda colour, six lowercase hex digits.
  swap: Readonly<Record<string, string>>;
  // Pixels drawn over the recoloured frame where the source is opaque.
  paint?: readonly { colour: string; points: readonly Point[] }[];
  // The 22 px compact window's origin in source frame px.
  crop: Point;
};

const portraits: Portrait[] = [
  {
    // Pip: buddy's face under a periwinkle courier cap with a white badge, a periwinkle jacket
    // and a tan satchel strap with an amber buckle.
    id: "pip-portrait",
    key: "pip",
    source: "face-owner-buddy",
    tags: [
      ["happy", 0],
      ["neutral", 1],
      ["worried", 4],
    ],
    swap: {
      be4a2f: "5b6093",
      f77622: "8f9cf0",
      d77643: "8f9cf0",
      feae34: "ffffff",
      "6b8a35": "5b6093",
      "9cb04a": "8f9cf0",
      "445a26": "3a4466",
    },
    paint: [
      {
        colour: "e4a672",
        points: [
          [9, 27],
          [10, 28],
          [12, 30],
          [13, 31],
        ],
      },
      { colour: "feae34", points: [[11, 29]] },
    ],
    crop: [4, 5],
  },
  {
    // The settler: the brimmed-hat face with the tie in the galaxy's periwinkle.
    id: "settler-portrait",
    key: "settler",
    source: "face-owner-penny",
    tags: [
      ["happy", 0],
      ["neutral", 1],
      ["worried", 4],
    ],
    swap: { a22633: "5b6093" },
    crop: [5, 4],
  },
];

function sourceFrames({ paint = [], source, swap, tags }: Portrait): Frame[] {
  const image = decodePng(readFileSync(`${sources}${source}.png`));
  return tags.map(([, index]) => {
    const [x, y] = [index * FULL, 0];
    if (x + FULL > image.width || image.height !== FULL) {
      throw new RangeError(`${source} has no frame ${index}`);
    }
    const frame: Frame = Array.from({ length: FULL }, (_, row) =>
      Array.from({ length: FULL }, (_, column): Colour => {
        const at = ((y + row) * image.width + x + column) * 4;
        const [r = 0, g = 0, b = 0, alpha = 0] = image.data.subarray(at, at + 4);
        if (alpha !== 0 && alpha !== 255) {
          throw new RangeError(`${source} has partial alpha at ${x + column},${y + row}`);
        }
        if (alpha === 0) return null;
        const colour = [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        return swap[colour] ?? colour;
      }),
    );
    for (const { colour, points } of paint) {
      for (const [px, py] of points) {
        if (frame[py]![px] !== null) frame[py]![px] = colour;
      }
    }
    return frame;
  });
}

const FRAME_MS = 1000;

const crop = (frame: Frame, [ox, oy]: Point): Frame =>
  frame.slice(oy, oy + COMPACT).map((row) => row.slice(ox, ox + COMPACT));

// Sprite data goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

function entry(id: string, key: string, size: number, names: readonly string[]) {
  return {
    id,
    path: `/art/andromeda/portraits/${key}.png`,
    width: size * names.length,
    height: size,
    ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: size,
    frameHeight: size,
    frames: Object.fromEntries(names.map((name, i) => [name, i])),
  };
}

mkdirSync(output, { recursive: true });
const entries: ReturnType<typeof entry>[] = [];
for (const portrait of portraits) {
  const frames = sourceFrames(portrait);
  for (const [key, size, list] of [
    [portrait.key, FULL, frames],
    [`${portrait.key}-compact`, COMPACT, frames.map((frame) => crop(frame, portrait.crop))],
  ] as const) {
    const tags: Tag[] = portrait.tags.map(([name], i) => [name, [list[i]!], FRAME_MS]);
    await writeSpriteSheet(
      { data: `${output}${key}.json`, sheet: `${output}${key}.png` },
      { key },
      tags,
    );
    await prettify(`${output}${key}.json`);
    entries.push(
      entry(
        size === FULL ? portrait.id : `${portrait.id}-compact`,
        key,
        size,
        portrait.tags.map(([name]) => name),
      ),
    );
  }
}

// Full sheets then compact sheets, last in Andromeda's manifest.
const ordered = entries.toSorted(
  (p, q) =>
    Number(p.id.endsWith("-compact")) - Number(q.id.endsWith("-compact")) ||
    p.id.localeCompare(q.id),
);
replaceEntries("andromeda", (id) => /^(pip|settler)-portrait(-compact)?$/.test(id), ordered);
