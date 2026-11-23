import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { json } from "./projection.ts";
import { hasUiIcon, readUiIcon, writeUiIcon } from "./ui-icon-sources.ts";
import { svgText } from "./svg-text.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

// Weapon and ammunition glyphs on the 20 px grid: "#" is an opaque pixel, "." is clear. One grid per
// weapon writes both the HUD mask SVG (public/art/ui/icons/weapon-<id>.svg) and the shop sheet
// (public/art/ui/sprites/icon-shop-weapon-<id>), frame 0 cream and frame 1 disabled; one grid per
// ammunition kind writes ammo-<kind>.svg and icon-shop-ammo-<kind> the same way. A weapon in
// HAND_AUTHORED keeps its existing SVG and verifies its rectangles against the grid.
const CREAM = "ead4aa";
const DISABLED = "9a96ad";
const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));
const E = "....................";

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  // A bolt with a short trail: a 4 px capsule head on a 2 px trail, one piece.
  laser: [
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
  // Seven separate 2 px dots in a wide fan.
  scattershot: [
    E,
    E,
    "...............##...",
    "...............##...",
    E,
    ".........##.........",
    ".........##.........",
    E,
    E,
    "...##....##....##...",
    "...##....##....##...",
    E,
    E,
    ".........##.........",
    ".........##.........",
    E,
    "...............##...",
    "...............##...",
    E,
    E,
  ],
  // Two slim darts, staggered, each with a thin trail dash.
  rapidMissile: [
    E,
    E,
    E,
    ".........##.........",
    ".........########...",
    "...####..#########..",
    "...####..########...",
    ".........##.........",
    E,
    E,
    E,
    E,
    ".......##...........",
    ".......########.....",
    ".####..#########....",
    ".####..########.....",
    ".......##...........",
    E,
    E,
    E,
  ],
};

// Ammunition kinds stand upright as stock; every weapon glyph is fire travelling right.
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

const HAND_AUTHORED: ReadonlySet<string> = new Set(["scattershot"]);

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

// The pixel grid of a hand-authored SVG drawn only as "Mx yHx2Vy2Hx" rectangles.
function rectangles(text: string): string[] {
  const d = /\sd="([^"]*)"/.exec(text)?.[1] ?? "";
  const cells = Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => "."));
  const pattern = /M(\d+) (\d+)H(\d+)V(\d+)H(\d+)Z/g;
  if (d.replace(pattern, "") !== "") {
    throw new Error(`unexpected path data: ${d}`);
  }
  for (const [, x0, y0, x1, y1, x2] of d.matchAll(pattern)) {
    if (x2 !== x0) {
      throw new Error(`open rectangle in path data: ${d}`);
    }
    for (let y = Number(y0); y < Number(y1); y += 1) {
      for (let x = Number(x0); x < Number(x1); x += 1) {
        cells[y]![x] = "#";
      }
    }
  }
  return cells.map((row) => row.join(""));
}

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

for (const [id, rows] of Object.entries(GLYPHS)) {
  check(id, rows);
  const icon = `weapon-${id}`;
  const maskWasPresent = hasUiIcon(icon);
  if (!HAND_AUTHORED.has(id)) {
    writeUiIcon(icon, svgText(svg(rows)));
  } else if (maskWasPresent && rectangles(readUiIcon(icon)).join("\n") !== rows.join("\n")) {
    throw new Error(`${id}: the grid does not match weapon-${id}.svg`);
  }
  await writeSheet(`icon-shop-weapon-${id}`, rows, maskWasPresent);
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
