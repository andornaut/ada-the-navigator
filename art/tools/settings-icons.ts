import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

// Cream icon ink for the dark lavender card, drawn as 2-pixel strokes on a clear frame: 16 by 16
// for Settings rows, 24 by 24 for the top-right HUD settings button. The 20 by 20 nav glyphs
// keep Chibi's nav icon outlines.
const INK = "ead4aa";
const ui = fileURLToPath(new URL("../../public/art/ui/", import.meta.url));
const output = `${ui}sprites/`;

// "#" is ink, "." is clear.
const ICONS: Readonly<Record<string, readonly string[]>> = {
  // Chibi's icon-achievements trophy, its alpha in one colour: a rim with a 1-pixel handle loop
  // on each side, a tapering cup, a 4-wide stem and a stepped foot.
  "icon-achievements": [
    "....................",
    "....................",
    "....############....",
    "..################..",
    "..#..##########..#..",
    "..#..##########..#..",
    "...#.##########.#...",
    "....############....",
    "......########......",
    ".......######.......",
    "........####........",
    "........####........",
    "........####........",
    ".......######.......",
    "......########......",
    ".....##########.....",
    ".....##########.....",
    "....................",
    "....................",
    "....................",
  ],
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
  // Gear for the top-right settings button: a ring with four orthogonal and four diagonal teeth.
  "icon-settings-nav-24": [
    "..........####..........",
    "..........####..........",
    "..........####..........",
    "...####...####...####...",
    "...####.########.####...",
    "...##################...",
    "...##################...",
    ".....##############.....",
    "....######....######....",
    "....#####......#####....",
    "########........########",
    "########........########",
    "########........########",
    "########........########",
    "....#####......#####....",
    "....######....######....",
    ".....##############.....",
    "...##################...",
    "...##################...",
    "...####.########.####...",
    "...####...####...####...",
    "..........####..........",
    "..........####..........",
    "..........####..........",
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

// The start screen's 20 by 20 vector nav glyphs (public/art/ui/icons/<name>.svg), each shape a
// list of attributes. The runtime draws each file as a CSS mask in the HUD button's glyph colour
// with smooth sampling, so the fill is each file's default colour only.
const NAV_GLYPHS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  // A trophy on icon-achievements' outline: a rim, a cup tapering into a 4-wide stem, a collar
  // and a base, and a handle loop 1.25 wide on each side.
  achievements: [
    [
      `fill="#${INK}"`,
      'd="M4 2H16V4H15V7C15 9 13.5 10.25 12 10.5V13H13.5V15H15V17H5V15H6.5V13H8V10.5C6.5 10.25 5 9 5 7V4H4Z"',
    ],
    [
      'fill="none"',
      `stroke="#${INK}"`,
      'stroke-width="1.25"',
      'd="M5 3.625H3.625Q2.625 3.625 2.625 4.625V5.25Q2.625 7.375 5 7.375M15 3.625H16.375Q17.375 3.625 17.375 4.625V5.25Q17.375 7.375 15 7.375"',
    ],
  ],
  // The gear on icon-settings-nav's outline: a body of radius 7.5 around a hole of radius 4, four
  // orthogonal teeth 4 wide to the frame edges and four 3 by 3 diagonal teeth.
  settings: [
    [
      `fill="#${INK}"`,
      'd="M2.5 10A7.5 7.5 0 1 1 17.5 10A7.5 7.5 0 1 1 2.5 10ZM6 10A4 4 0 1 0 14 10A4 4 0 1 0 6 10ZM8 0H12V4H8ZM8 16H12V20H8ZM0 8H4V12H0ZM16 8H20V12H16ZM2 2H5V5H2ZM15 2H18V5H15ZM2 15H5V18H2ZM15 15H18V18H15Z"',
    ],
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

for (const [name, shapes] of Object.entries(NAV_GLYPHS)) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">',
    ...shapes.flatMap((attributes) => ["  <path", ...attributes.map((a) => `    ${a}`), "  />"]),
    "</svg>",
    "",
  ];
  writeFileSync(`${ui}icons/${name}.svg`, svg.join("\n"));
}

// The UI manifest's entries for these sheets, in the existing sprite schema, sorted by key.
type Sprite = { json: string; key: string; once: string[]; png: string };
const manifestPath = `${ui}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { sprites: Sprite[] };
const keys = Object.keys(ICONS);
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !keys.includes(key)),
  ...keys.map((key) => ({ key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: [] })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
const options = await resolveConfig(manifestPath);
writeFileSync(
  manifestPath,
  await format(JSON.stringify(manifest, null, 2), { ...options, filepath: manifestPath }),
);
