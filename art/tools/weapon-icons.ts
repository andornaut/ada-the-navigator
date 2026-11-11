import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { json } from "./projection.ts";

// Weapon glyphs on the 20 px grid: "#" is an opaque pixel, "." is clear. One grid per weapon writes
// both the HUD mask SVG (public/art/ui/icons/weapon-<id>.svg) and the shop sheet
// (public/art/ui/sprites/icon-shop-weapon-<id>), frame 0 cream and frame 1 disabled.
const CREAM = "ead4aa";
const DISABLED = "9a96ad";
const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));
const E = "....................";

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  // A bolt with a short trail: a 4 px capsule head on a 2 px trail, one piece.
  basic: [
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    "..........#######...",
    "..################..",
    "..################..",
    "..........#######...",
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ],
  // One deep missile body with a warhead seam, small rear fins and a heavy exhaust block.
  heavyMissile: [
    E,
    E,
    E,
    E,
    E,
    "....###.............",
    ".....###............",
    ".....#######.##.....",
    "..##.#######.####...",
    "..##.#######.#####..",
    "..##.#######.#####..",
    "..##.#######.####...",
    ".....#######.##.....",
    ".....###............",
    "....###.............",
    E,
    E,
    E,
    E,
    E,
  ],
  // Three 2 px bolts fanning from one origin.
  multiLaser: [
    E,
    E,
    "...............###..",
    "............######..",
    ".........######.....",
    "......######........",
    "...######...........",
    "...###..............",
    E,
    "...###############..",
    "...###############..",
    E,
    "...###..............",
    "...######...........",
    "......######........",
    ".........######.....",
    "............######..",
    "...............###..",
    E,
    E,
  ],
  // A thin beam ending in a starburst: a 2 px line with five rays fanned off its tip.
  phaser: [
    E,
    E,
    E,
    E,
    ".............##.....",
    ".............##.....",
    "................##..",
    "...............##...",
    E,
    "..#############.##..",
    "..#############.##..",
    E,
    "...............##...",
    "................##..",
    ".............##.....",
    ".............##.....",
    E,
    E,
    E,
    E,
  ],
  // Two slim darts, staggered, each with a thin trail dash.
  rapidMissile: [
    E,
    E,
    E,
    "........##..........",
    "........########....",
    "..####..#########...",
    "..####..########....",
    "........##..........",
    E,
    E,
    E,
    E,
    "......##............",
    "......########......",
    "####..#########.....",
    "####..########......",
    "......##............",
    E,
    E,
    E,
  ],
};

interface Sprite {
  readonly key: string;
  readonly png: string;
  readonly json: string;
  readonly once: readonly string[];
}

// Horizontal runs of "#" as one closed path, so the mask stays on whole pixels at any scale.
function path(rows: readonly string[]): string {
  return rows
    .flatMap((row, y) =>
      [...row.matchAll(/#+/g)].map(
        ({ 0: run, index: x }) => `M${x} ${y}h${run.length}v1h-${run.length}Z`,
      ),
    )
    .join("");
}

function svg(rows: readonly string[]): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">',
    `  <path fill="#${CREAM}" d="${path(rows)}" />`,
    "</svg>",
    "",
  ].join("\n");
}

function frame(rows: readonly string[], colour: string): Frame {
  return rows.map((row) => [...row].map((cell) => (cell === "#" ? colour : null)));
}

// Written JSON goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(file: string): Promise<void> {
  const options = await resolveConfig(file);
  writeFileSync(file, await format(readFileSync(file, "utf8"), { ...options, filepath: file }));
}

for (const [id, rows] of Object.entries(GLYPHS)) {
  if (rows.length !== 20 || rows.some((row) => row.length !== 20 || /[^#.]/.test(row))) {
    throw new Error(`${id}: the glyph must be 20 rows of 20 "#" or "." cells`);
  }
  writeFileSync(`${ui}icons/weapon-${id}.svg`, svg(rows));
  const key = `icon-shop-weapon-${id}`;
  await writeSpriteSheet(
    { data: `${ui}sprites/${key}.json`, sheet: `${ui}sprites/${key}.png` },
    { key },
    [
      ["normal", [frame(rows, CREAM)], 100],
      ["disabled", [frame(rows, DISABLED)], 100],
    ],
  );
  await prettify(`${ui}sprites/${key}.json`);
}

// Register the shop sheets in the UI subset manifest, sorted by key.
const manifestPath = `${ui}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { sprites: Sprite[] };
const keys = new Set(Object.keys(GLYPHS).map((id) => `icon-shop-weapon-${id}`));
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !keys.has(key)),
  ...[...keys].map((key) => ({
    key,
    png: `sprites/${key}.png`,
    json: `sprites/${key}.json`,
    once: [],
  })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(manifestPath, json(manifest));
await prettify(manifestPath);
