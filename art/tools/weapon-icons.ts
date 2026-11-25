import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { json } from "./projection.ts";
import { hasUiIcon, writeUiIcon } from "./ui-icon-sources.ts";
import { svgText } from "./svg-text.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

// Weapon and ammunition glyphs in the 20 px box. Each weapon is a bold vector mask of filled
// shapes and round-capped strokes 2.4 to 2.8 px wide, written as the HUD and shop mask
// (weapon-<id>.svg). Each ammunition kind is a pixel grid, "#" an opaque pixel and "." clear,
// written as ammo-<kind>.svg and, where the UI manifest registers it, as the shop sheet
// icon-shop-ammo-<kind>, frame 0 cream and frame 1 disabled.
const CREAM = "ead4aa";
const DISABLED = "9a96ad";
const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));
const E = "....................";

const fill = (d: string) => `<path fill="#${CREAM}" d="${d}"/>`;
const dot = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#${CREAM}"/>`;
const stroke = (d: string, width: number) =>
  `<path fill="none" stroke="#${CREAM}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;

// Every weapon glyph is fire travelling right.
const WEAPONS: Readonly<Record<string, readonly string[]>> = {
  // One bolt: a round-nosed slug on a short trail.
  laser: [stroke("M3.2 10H9", 2.4), fill("M9 7.4h6.4a2.6 2.6 0 0 1 0 5.2H9Z")],
  // One heavy warhead with a swept tail fin block behind it.
  heavyMissile: [
    fill("M5.5 6.6h6.3l5.6 3.4-5.6 3.4H5.5Z"),
    fill("M2.4 3.8h2.6l2.8 2.8H5.2v6.8h2.6l-2.8 2.8H2.4Z"),
  ],
  // Three bolts fanning from one muzzle dot.
  multiLaser: [dot(4, 10, 2), stroke("M9.6 6.2L16.2 3.4M10.4 10H17.2M9.6 13.8L16.2 16.6", 2.6)],
  // A short beam and two widening arcs ahead of it.
  phaser: [
    fill("M2.6 8.6H10.4v2.8H2.6Z"),
    stroke("M12.2 7.2A4 4 0 0 1 12.2 12.8M14.6 4.4A7.6 7.6 0 0 1 14.6 15.6", 2.4),
  ],
  // Two staggered darts.
  rapidMissile: [fill("M6.4 3.2h6.4l4 2.8-4 2.8H6.4Z"), fill("M2.4 11.2h6.4l4 2.8-4 2.8H2.4Z")],
  // Six round pellets spreading in a cone: one, two, three.
  scattershot: [
    dot(4.4, 10, 1.7),
    dot(10, 7.4, 1.7),
    dot(10, 12.6, 1.7),
    dot(15.6, 4.6, 1.7),
    dot(15.6, 10, 1.7),
    dot(15.6, 15.4, 1.7),
  ],
};

// Ammunition kinds stand upright as stock.
const AMMO: Readonly<Record<string, readonly string[]>> = {
  // An upright energy cell: terminal cap, 2 px case, three charge bars.
  energy: [
    E,
    E,
    "........####........",
    "........####........",
    "....############....",
    "....############....",
    "....##........##....",
    "....##.######.##....",
    "....##.######.##....",
    "....##........##....",
    "....##.######.##....",
    "....##.######.##....",
    "....##........##....",
    "....##.######.##....",
    "....##.######.##....",
    "....##........##....",
    "....############....",
    "....############....",
    E,
    E,
  ],
  // Two upright missiles on a rack bar: pointed noses, a warhead seam, side fins.
  missile: [
    E,
    E,
    "....##........##....",
    "....##........##....",
    "...####......####...",
    E,
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "..######....######..",
    "..######....######..",
    "..##..##....##..##..",
    "..##..##....##..##..",
    E,
    "..################..",
    "..################..",
    E,
    E,
  ],
  // Two upright shotgun shells: crimped tops, a hull seam over the brass, wide rims.
  shell: [
    E,
    E,
    E,
    "....###......###....",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    "...#####....#####...",
    E,
    "...#####....#####...",
    "...#####....#####...",
    "..#######..#######..",
    "..#######..#######..",
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

const document = (shapes: readonly string[]) =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">',
    ...shapes.map((shape) => `  ${shape}`),
    "</svg>",
    "",
  ].join("\n");

const svg = (rows: readonly string[]) => document([`<path fill="#${CREAM}" d="${path(rows)}" />`]);

function frame(rows: readonly string[], colour: string): Frame {
  return rows.map((row) => [...row].map((cell) => (cell === "#" ? colour : null)));
}

function check(name: string, rows: readonly string[]): void {
  if (rows.length !== 20 || rows.some((row) => row.length !== 20 || /[^#.]/.test(row))) {
    throw new Error(`${name}: the glyph must be 20 rows of 20 "#" or "." cells`);
  }
}

const manifestPath = `${ui}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { sprites: Sprite[] };
const registered = new Set(manifest.sprites.map(({ key }) => key));
const emitted = new Set<string>();

async function writeSheet(
  key: string,
  rows: readonly string[],
  maskWasPresent: boolean,
): Promise<void> {
  // An absent row selects the mask only if it was present before this run emitted SVGs.
  if (!registered.has(key) && maskWasPresent) return;
  await writeSprites(
    { data: `${ui}sprites/${key}.json`, sheet: `${ui}sprites/${key}.png` },
    { key },
    [
      ["normal", [frame(rows, CREAM)], 100],
      ["disabled", [frame(rows, DISABLED)], 100],
    ],
  );
  await prettify(`${ui}sprites/${key}.json`);
  emitted.add(key);
}

for (const [id, shapes] of Object.entries(WEAPONS)) {
  writeUiIcon(`weapon-${id}`, svgText(document(shapes)));
}

for (const [kind, rows] of Object.entries(AMMO)) {
  check(`ammo ${kind}`, rows);
  const icon = `ammo-${kind}`;
  const maskWasPresent = hasUiIcon(icon);
  writeUiIcon(icon, svgText(svg(rows)));
  await writeSheet(`icon-shop-ammo-${kind}`, rows, maskWasPresent);
}

// Register the shop sheets in the UI subset manifest, sorted by key.
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !emitted.has(key)),
  ...[...emitted].map((key) => ({
    key,
    png: `sprites/${key}.png`,
    json: `sprites/${key}.json`,
    once: [],
  })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(manifestPath, json(manifest));
await prettify(manifestPath);
