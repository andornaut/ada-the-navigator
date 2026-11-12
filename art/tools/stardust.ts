import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { editManifest } from "./manifest.ts";
import { traceGrid, withCollision } from "./silhouette.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sprites = `${art}ui/sprites/`;

// Mint Stardust: "W" glint core, "L" light, "M" body, "D" shade, "." clear.
const PALETTE: Readonly<Record<string, string>> = {
  W: "ffffff",
  L: "d2fbdf",
  M: "8ee8a8",
  D: "52b47e",
};

// 9 by 9 pickup: a 7 px faceted gem whose glint grows four rays to the full 9 px.
const PICKUP: Readonly<Record<"rest" | "glint1" | "glint2", readonly string[]>> = {
  rest: [
    ".........",
    "....L....",
    "...LWM...",
    "..LWMMM..",
    ".LMMMMMD.",
    "..MMMMD..",
    "...MMD...",
    "....D....",
    ".........",
  ],
  glint1: [
    "....L....",
    "....W....",
    "...LWM...",
    "..LWWMM..",
    "LWWWWWMDD",
    "..MMWMD..",
    "...MMD...",
    "....M....",
    "....D....",
  ],
  glint2: [
    "....L....",
    "....W....",
    "...LWL...",
    "..LWWWL..",
    "LWWWWWWWL",
    "..LWWWM..",
    "...MWD...",
    "....W....",
    "....M....",
  ],
};
const LOOP = [
  ["rest", 420],
  ["glint1", 60],
  ["glint2", 80],
  ["glint1", 60],
] as const;

// HUD icons: one large sparkle, a small sparkle and a dust mote.
const ICONS: Readonly<Record<string, readonly string[]>> = {
  "icon-stardust": [
    "................",
    "............M...",
    "............L...",
    "......M...MLWLM.",
    "......M.....L...",
    "......M.....M...",
    ".....MMM........",
    ".....MLM........",
    "...MMMLMDD......",
    "MMMMLLWLLMMDD...",
    "...MMMLDDD......",
    ".....DLD........",
    ".....DMD....MM..",
    "......M.....MD..",
    "......D.........",
    "......D.........",
  ],
  "icon-stardust-20": [
    "....................",
    "...............M....",
    "...............M....",
    "..............MLM...",
    ".......M....MMLWLMD.",
    ".......M......MLD...",
    ".......M.......M....",
    "......MMM......D....",
    ".....MMMMM..........",
    "....MMMLMMD.........",
    "...MMMMLMMDD........",
    "MMMMMLLWLLMMMDD.....",
    "...MMMMLDDDD........",
    "....MMMLDDD.........",
    ".....DDMDD..........",
    "......DMD......MM...",
    ".......M.......MD...",
    ".......D............",
    ".......D............",
    "....................",
  ],
};

function frame(rows: readonly string[]): Frame {
  return rows.map((row) => [...row].map((cell) => PALETTE[cell] ?? null));
}

// Sprite data goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

const glint = LOOP.map(([name]) => frame(PICKUP[name]));
await writeSpriteSheet(
  { data: `${art}stardust.json`, sheet: `${art}stardust.png` },
  { key: "stardust" },
  [["glint", glint, LOOP.map(([, ms]) => ms)]],
);
// Each frame's drawn silhouette, in frame px.
writeFileSync(
  `${art}stardust.json`,
  withCollision(
    readFileSync(`${art}stardust.json`, "utf8"),
    glint.map((rows, i) => traceGrid(`stardust ${i}`, rows).collision),
  ),
);
await prettify(`${art}stardust.json`);
for (const [key, rows] of Object.entries(ICONS)) {
  await writeSpriteSheet(
    { data: `${sprites}${key}.json`, sheet: `${sprites}${key}.png` },
    { key },
    [["rest", [frame(rows)], 100]],
  );
  await prettify(`${sprites}${key}.json`);
}

// The pickup sheet loads as a root manifest sprite sheet, placed before the station and enemies.
const entry = {
  id: "stardust",
  path: "/art/stardust.png",
  width: 9 * LOOP.length,
  height: 9,
  displayWidth: 9,
  displayHeight: 9,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: 9,
  frameHeight: 9,
  frames: { rest: 0, glint1: 1, glint2: 2 },
  loop: LOOP.map(([name, ms], index) => ({ frame: index, name, ms })),
};
editManifest("core", (manifest) => {
  const kept = manifest.assets.filter(({ id }) => id !== "stardust");
  const later = kept.findIndex(({ id }) => id.startsWith("station-") || id.startsWith("enemy-"));
  const insert = later === -1 ? kept.length : later;
  manifest.assets = [...kept.slice(0, insert), entry, ...kept.slice(insert)];
});
