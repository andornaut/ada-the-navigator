import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { JOB_GLYPHS } from "./job-glyphs.ts";

// Map glyphs on the 20 px grid: "#" is an opaque pixel, "." is clear. One grid per map symbol
// and map tool writes its mask SVG (public/art/ui/icons/map-<id>.svg). Symbols draw in ink on
// their chip's face and tools in their HUD_BUTTON state colour (art/map.md); the fill below is
// each file's default colour only, since the runtime draws every glyph as a mask.
const INK = "181425";
const CREAM = "ead4aa";
const icons = fileURLToPath(new URL("../../public/art/ui/icons/", import.meta.url));
const E = "....................";

// Every opaque pixel lies inside this radius of the grid's centre, so a symbol glyph stays on its
// 28 chip's face, clear of the 1 ink edge (face radius 13).
const FACE_RADIUS = 13;

const SYMBOLS: Readonly<Record<string, readonly string[]>> = {
  // A mast and dome over an elliptical ring, as the in-world station.
  station: [
    E,
    E,
    ".........##.........",
    ".........##.........",
    ".........##.........",
    "........####........",
    ".......######.......",
    ".......######.......",
    "......########......",
    "...##############...",
    "..####.######.####..",
    ".###...######...###.",
    ".##....######....##.",
    ".###............###.",
    "..####........####..",
    "...##############...",
    "......########......",
    E,
    E,
    E,
  ],
  // A sunflower head: an 8 px disc in eight teardrop petals.
  growers: [
    E,
    "........####........",
    ".......######.......",
    "...##...####...##...",
    "..####...##...####..",
    "..#####......#####..",
    "...###..####..###...",
    ".......######.......",
    ".##...########...##.",
    "####..########..####",
    "####..########..####",
    ".##...########...##.",
    ".......######.......",
    "...###..####..###...",
    "..#####......#####..",
    "..####...##...####..",
    "...##...####...##...",
    ".......######.......",
    "........####........",
    E,
  ],
  // A wrench on the diagonal, its open jaw toward the top right.
  workshop: [
    E,
    E,
    "............###.....",
    "..........#####.....",
    "..........####......",
    ".........####...##..",
    ".........#####.###..",
    ".........#########..",
    "..........#######...",
    ".........########...",
    "........###.###.....",
    ".......###..........",
    "......###...........",
    ".....###............",
    "....###.............",
    "...###..............",
    "...##...............",
    E,
    E,
    E,
  ],
  // An electromagnet: a horseshoe with gapped pole tips.
  salvagers: [
    E,
    E,
    E,
    "...####......####...",
    "...####......####...",
    "...####......####...",
    E,
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "...####......####...",
    "....####....####....",
    "....############....",
    ".....##########.....",
    ".......######.......",
    E,
    E,
    E,
  ],
  // A story destination without its own glyph: a swallowtail flag on a footed pole.
  destination: [
    E,
    E,
    ".....##.............",
    ".....############...",
    ".....###########....",
    ".....##########.....",
    ".....#########......",
    ".....##########.....",
    ".....###########....",
    ".....############...",
    ".....##.............",
    ".....##.............",
    ".....##.............",
    ".....##.............",
    ".....##.............",
    ".....##.............",
    "....######..........",
    "....######..........",
    E,
    E,
  ],
  // The holodisk: a pearl disc's band around a spindle hole.
  holodisk: [
    E,
    E,
    E,
    "......########......",
    ".....##########.....",
    "....###......###....",
    "...###...##...###...",
    "...##..######..##...",
    "...##..######..##...",
    "...##.###..###.##...",
    "...##.###..###.##...",
    "...##..######..##...",
    "...##..######..##...",
    "...###...##...###...",
    "....###......###....",
    ".....##########.....",
    "......########......",
    E,
    E,
    E,
  ],
  // Landmark: a nebula, a cloud with two stars.
  nebula: [
    E,
    E,
    E,
    "...............##...",
    "...##..........##...",
    "...##...............",
    "..........##........",
    "........######......",
    ".......########.....",
    ".......########.....",
    ".....##########.....",
    "....############....",
    "....#############...",
    "....#############...",
    "....#############...",
    ".....############...",
    E,
    E,
    E,
    E,
  ],
  // Landmark: a wreck, a hull split in two with debris.
  wreck: [
    E,
    E,
    E,
    E,
    "..##................",
    "..#####....###......",
    "..#######..#######..",
    "..######...#######..",
    "..######....#####...",
    "..######.....###....",
    "..#######....##.....",
    "..########...#......",
    "..#######.......##..",
    "..#######.......##..",
    "..#######...........",
    "..#####......##.....",
    "..###........##.....",
    E,
    E,
    E,
  ],
  // Landmark: a beacon, a mast with a lamp and two pairs of signal arcs.
  beacon: [
    E,
    E,
    "...#............#...",
    "..##..#......#..##..",
    ".##..##..##..##..##.",
    ".##..#..####..#..##.",
    ".##..#..####..#..##.",
    ".##..##..##..##..##.",
    "..##..#..##..#..##..",
    "...#.....##.....#...",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    "......########......",
    "......########......",
    E,
    E,
  ],
};

const TOOLS: Readonly<Record<string, readonly string[]>> = {
  close: [
    E,
    E,
    E,
    E,
    "....##........##....",
    "....###......###....",
    ".....###....###.....",
    "......###..###......",
    ".......######.......",
    "........####........",
    "........####........",
    ".......######.......",
    "......###..###......",
    ".....###....###.....",
    "....###......###....",
    "....##........##....",
    E,
    E,
    E,
    E,
  ],
  "zoom-in": [
    E,
    E,
    E,
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    "...##############...",
    "...##############...",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    E,
    E,
    E,
  ],
  "zoom-out": [
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    "...##############...",
    "...##############...",
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
    E,
  ],
  // A crosshair: a ring, a centre dot and four ticks.
  recentre: [
    E,
    ".........##.........",
    ".........##.........",
    ".........##.........",
    ".......######.......",
    ".....##########.....",
    ".....##......##.....",
    "....##........##....",
    "....##........##....",
    ".#####...##...#####.",
    ".#####...##...#####.",
    "....##........##....",
    "....##........##....",
    ".....##......##.....",
    ".....##########.....",
    ".......######.......",
    ".........##.........",
    ".........##.........",
    ".........##.........",
    E,
  ],
};

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

function svg(rows: readonly string[], colour: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">',
    `  <path fill="#${colour}" d="${path(rows)}" />`,
    "</svg>",
    "",
  ].join("\n");
}

// The farthest corner of an opaque pixel from the grid's centre.
function reach(rows: readonly string[]): number {
  let far = 0;
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") {
        const dx = Math.max(Math.abs(x - 10), Math.abs(x + 1 - 10));
        const dy = Math.max(Math.abs(y - 10), Math.abs(y + 1 - 10));
        far = Math.max(far, Math.hypot(dx, dy));
      }
    });
  });
  return far;
}

function check(id: string, rows: readonly string[]): void {
  if (rows.length !== 20 || rows.some((row) => row.length !== 20 || /[^#.]/.test(row))) {
    throw new Error(`${id}: the glyph must be 20 rows of 20 "#" or "." cells`);
  }
}

// A held job's own spot (a rescue's craft, a hunt's search area) carries its job type's glyph,
// the board row's grid (art/tools/job-glyphs.ts), as map-job-<type>.
const JOB_SYMBOLS = Object.fromEntries(
  Object.entries(JOB_GLYPHS).map(([type, rows]) => [`job-${type}`, rows]),
);

for (const [id, rows] of Object.entries({ ...SYMBOLS, ...JOB_SYMBOLS })) {
  check(id, rows);
  if (reach(rows) > FACE_RADIUS) {
    throw new Error(`${id}: a pixel reaches ${reach(rows).toFixed(2)} past the chip face`);
  }
  writeFileSync(`${icons}map-${id}.svg`, svg(rows, INK));
}

for (const [id, rows] of Object.entries(TOOLS)) {
  check(id, rows);
  writeFileSync(`${icons}map-${id}.svg`, svg(rows, CREAM));
}
