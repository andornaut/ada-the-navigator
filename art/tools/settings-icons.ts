import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";

// Cream icon ink for the dark lavender card, drawn as 2-pixel strokes on a clear 16 by 16 frame.
const INK = "ead4aa";
const output = fileURLToPath(new URL("../../public/art/ui/sprites/", import.meta.url));

// "#" is ink, "." is clear.
const ICONS: Readonly<Record<string, readonly string[]>> = {
  // Reticle: a ring crossed by four ticks around a centre dot.
  "icon-aim-controls": [
    ".......##.......",
    ".......##.......",
    "......####......",
    "....########....",
    "...###.##.###...",
    "...##......##...",
    "..##........##..",
    "#####..##..#####",
    "#####..##..#####",
    "..##........##..",
    "...##......##...",
    "...###.##.###...",
    "....########....",
    "......####......",
    ".......##.......",
    ".......##.......",
  ],
  // A wave that settles, through a down chevron, into a flat line.
  "icon-reduced-motion": [
    "..##.......##...",
    ".####.....####..",
    "##..##...##..##.",
    "#....##.##....##",
    "......###......#",
    ".......#........",
    "................",
    ".....##..##.....",
    "......####......",
    ".......##.......",
    "................",
    "................",
    "################",
    "################",
    "................",
    "................",
  ],
  // Speaker with two sound waves.
  "icon-sound": [
    "................",
    "......##........",
    ".....###...##...",
    "....####....##..",
    "...#####.....##.",
    "########.##..##.",
    "########..##..##",
    "########..##..##",
    "########..##..##",
    "########..##..##",
    "########.##..##.",
    "...#####.....##.",
    "....####....##..",
    ".....###...##...",
    "......##........",
    "................",
  ],
};

function frame(rows: readonly string[]): Frame {
  return rows.map((row) => [...row].map((cell) => (cell === "#" ? INK : null)));
}

for (const [key, rows] of Object.entries(ICONS)) {
  await writeSpriteSheet({ data: `${output}${key}.json`, sheet: `${output}${key}.png` }, { key }, [
    ["rest", [frame(rows)], 100],
  ]);
}
