// Phantom's speakers as Blurbs (goo): Dollop, the third settlement's Blurb, and the settlements'
// greeter, each one neutral frame in the conversation format. General Gadget, Phantom's keeper
// once the chapter is complete, uses his named portrait (art/conversation.md).
// Contract: art/conversation.md (Cast portraits) and art/phantom.md (Portraits).
// Usage: node art/tools/phantom-portraits.ts [--packed-candidate]
import { mkdirSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import type { Frame } from "@andornaut/art-kit/build/grid";
import { decodePng } from "@andornaut/art-kit/build/png";
import { spriteSheet } from "@andornaut/art-kit/build/spriteSheet";

import {
  blank,
  dots,
  ellipse,
  faceNeutral,
  fill,
  has,
  type Mask,
  paint,
  rect,
  set,
  stamp,
  tilted,
  union,
  WHITE,
} from "./bust.ts";
import { type Portrait, portraitSheets, writePortraits } from "./bust-sheets.ts";
import { packCastStrips } from "./cast-portrait-pages.ts";
import { readManifest } from "./manifest.ts";

type Goo = { base: string; shade: string; light: string };
const ORCHID: Goo = { base: "e48fd4", light: "ffd6f4", shade: "b05aa6" };
const VIOLET: Goo = { base: "a896ec", light: "dcd4ff", shade: "7462c4" };
const AMBER = { base: "f0bd68", shade: "b98a40" };

// A jelly blob whose top is row `top`, over three drips that run off the frame's bottom edge.
function slime(top: number): Mask {
  return union(
    ellipse(15.5, 18.4, 12.8, 18.4 - top),
    ...(
      [
        [7.5, 31.5],
        [15.5, 30.5],
        [23.5, 31.5],
      ] as const
    ).map(([cx, bottom]) => ellipse(cx, 27, 2.6, bottom - 27)),
  );
}

// The blob painted with a glossy highlight and three bubbles inside.
function goo(colours: Goo, body: Mask): Frame {
  const frame = blank();
  paint(frame, body, { ...colours, shadeDepth: 3 });
  const gloss = tilted(10, 12, 1.4, 2.6, 30);
  fill(
    frame,
    gloss.map((row, y) => row.map((on, x) => on && has(body, x, y))),
    colours.light,
  );
  dots(
    frame,
    [
      [9, 11],
      [9, 12],
      [10, 10],
    ],
    WHITE,
  );
  for (const [x, y] of [
    [22, 23],
    [12, 26],
    [24, 15],
  ] as const) {
    dots(
      frame,
      [
        [x, y],
        [x + 1, y],
        [x, y + 1],
      ],
      colours.light,
    );
  }
  return frame;
}

// Dollop: an orchid blob curling up to a cream-dollop peak, with blush.
function dollop(): Frame {
  const curl = union(tilted(17, 5.2, 2.6, 3.8, 32), ellipse(14.6, 2.8, 2.2, 1.8));
  const frame = goo(ORCHID, union(slime(7.5), curl));
  dots(
    frame,
    [
      [16, 4],
      [17, 5],
      [17, 6],
    ],
    ORCHID.shade,
  );
  faceNeutral(frame, { ex: 10, ey: 15, gap: 9, my: 21, tall: 4 });
  dots(
    frame,
    [
      [8, 19],
      [9, 19],
      [22, 19],
      [23, 19],
    ],
    "f6757a",
  );
  return frame;
}

// The settlements' greeter: a rounder violet-blue blob with no peak, a floating bubble and an
// amber scarf with a red patch.
function settler(): Frame {
  const frame = goo(VIOLET, slime(6));
  stamp(frame, 23, 0, [".ll.", "l..l", "l..l", ".ll."], { l: VIOLET.light });
  set(frame, 24, 1, WHITE);
  paint(frame, ellipse(15.5, 24.4, 11.4, 2.2), AMBER);
  paint(frame, rect(19, 25, 21, 30), AMBER);
  stamp(frame, 9, 24, ["pp"], { p: "e43b44" });
  faceNeutral(frame, { ex: 10, ey: 13, gap: 9, my: 19, tall: 4 });
  return frame;
}

const portraits: readonly Portrait[] = [
  { compact: [5, 2], frames: [["neutral", dollop()]], key: "dollop" },
  { compact: [5, 3], frames: [["neutral", settler()]], key: "blurb-settler" },
];

const folder = "phantom/portraits";
const sizes = ["full", "compact"] as const;
const legacyPaths = new Map(
  portraits.flatMap(({ key }) => [
    [`${key}-portrait`, `/art/${folder}/${key}.png`],
    [`${key}-portrait-compact`, `/art/${folder}/${key}-compact.png`],
  ]),
);

type PortraitRow = {
  id: string;
  path: string;
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: unknown;
  portraitCrop?: unknown;
};

function packedPages() {
  const authored = portraits
    .toSorted((left, right) => left.key.localeCompare(right.key))
    .map((portrait) => ({ key: portrait.key, sheets: portraitSheets(portrait) }));
  return sizes.map((name, index) => {
    const strips = authored.map(({ key, sheets }) => {
      const { sheet, tags } = sheets[index]!;
      const { sheet: png } = spriteSheet({ image: `${sheet}.png`, key: sheet }, tags);
      const id = name === "compact" ? `${key}-portrait-compact` : `${key}-portrait`;
      return { image: decodePng(png), strip: { id } };
    });
    const { bytes, height, origins, width } = packCastStrips(strips);
    const members = strips.map(({ image, strip }) => ({
      id: strip.id,
      crop: { ...origins.get(strip.id)!, width: image.width, height: image.height },
    }));
    return { bytes, file: `phantom-${name}.png`, height, members, width };
  });
}

type PackedPage = ReturnType<typeof packedPages>[number];

function writePacked(output: URL, pages: readonly PackedPage[]): void {
  mkdirSync(output, { recursive: true });
  for (const { bytes, file } of pages) writeFileSync(new URL(file, output), bytes);
}

function validatePackedRows(rows: readonly PortraitRow[], pages: readonly PackedPage[]): void {
  if (rows.length !== legacyPaths.size) throw new Error("Incomplete Phantom portrait selection");
  for (const { file, height, members, width } of pages) {
    for (const { crop, id } of members) {
      const row = rows.find((entry) => entry.id === id);
      if (
        !row ||
        row.path !== `/art/${folder}/${file}` ||
        row.width !== width ||
        row.height !== height ||
        row.frameWidth !== undefined ||
        row.frameHeight !== undefined ||
        !isDeepStrictEqual(row.frames, { neutral: 0 }) ||
        !isDeepStrictEqual(row.portraitCrop, crop)
      ) {
        throw new Error(`Invalid packed Phantom portrait selection: ${id}`);
      }
    }
  }
}

if (process.argv.length === 3 && process.argv[2] === "--packed-candidate") {
  const output = new URL("../../.check-results/ada-0281-phantom-authored-pages/", import.meta.url);
  writePacked(output, packedPages());
} else {
  if (process.argv.length !== 2)
    throw new Error("Usage: node art/tools/phantom-portraits.ts [--packed-candidate]");
  const rows = (readManifest("phantom").assets as PortraitRow[]).filter(({ id }) =>
    legacyPaths.has(id),
  );
  if (
    rows.some(
      ({ id, path, portraitCrop }) => portraitCrop !== undefined || path !== legacyPaths.get(id),
    )
  ) {
    const pages = packedPages();
    validatePackedRows(rows, pages);
    writePacked(new URL(`../../public/art/${folder}/`, import.meta.url), pages);
    console.log("wrote the selected Phantom portrait pages");
  } else {
    const ids = await writePortraits("phantom", folder, portraits, (id) => legacyPaths.has(id));
    console.log(`wrote ${ids.join(", ")}`);
  }
}
