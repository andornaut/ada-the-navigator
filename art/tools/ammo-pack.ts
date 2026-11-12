// The ammo pack pickup (art/weapons.md, Ammo pack): a cartridge clip of three rounds on an ink
// band, in ammo green, with a glint that lights one round at a time. Writes the sheet
// public/art/pickups/ammo-pack.png, its Aseprite data ammo-pack.json with each frame's collision,
// and the core manifest entry `ammo-pack`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";

import { replaceEntries } from "./manifest.ts";
import { withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const dir = fileURLToPath(new URL("../../public/art/pickups/", import.meta.url));
const ID = "ammo-pack";
const SIZE = 16;

// "L" light, "M" body (ammo green, the carrying colour), "D" shade, "C" cartridge tip, "S" tip
// shade, "K" ink, "G" glint, "." clear.
const PALETTE: Readonly<Record<string, string>> = {
  L: "d2f3a6",
  M: "8fd14f",
  D: "5e8f2a",
  C: "f2edd5",
  S: "b9b095",
  K: "181425",
  G: "ffffff",
};

// Three rounds 4 px wide at columns 1, 6 and 11, each a 3-row tip over a casing lit on its left,
// held by a 2-row ink clip across the whole width.
const REST = [
  "................",
  "..CC...CC...CC..",
  ".CCCS.CCCS.CCCS.",
  ".CCCS.CCCS.CCCS.",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  "KKKKKKKKKKKKKKKK",
  "KKKKKKKKKKKKKKKK",
  ".LMMD.LMMD.LMMD.",
  ".LMMD.LMMD.LMMD.",
  ".DDDD.DDDD.DDDD.",
  "................",
] as const;
const ROUNDS = [1, 6, 11] as const;

// Glint k whitens round k's tip and lit edge, left to right.
function glint(round: number): string[] {
  const x0 = ROUNDS[round]!;
  return REST.map((row) =>
    [...row]
      .map((cell, x) => (x >= x0 && x < x0 + 4 && (cell === "C" || cell === "L") ? "G" : cell))
      .join(""),
  );
}

const LOOP = [
  ["rest", 1100],
  ["glint1", 70],
  ["glint2", 70],
  ["glint3", 70],
] as const;
const GRIDS = [REST, glint(0), glint(1), glint(2)];

for (const rows of GRIDS) {
  if (rows.length !== SIZE || rows.some((row) => row.length !== SIZE)) {
    throw new Error(`ammo pack frames must be ${SIZE} by ${SIZE}`);
  }
}

// Collision: one convex part, the 16 by 14 hull of the drawn rounds and clip, in frame px. Every
// frame draws the same silhouette, so every frame carries it.
const HULL = [
  [0, 1],
  [SIZE, 1],
  [SIZE, 15],
  [0, 15],
] as const;
for (const rows of GRIDS) {
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== "." && (x < 0 || x >= SIZE || y < 1 || y >= 15)) {
        throw new Error(`ammo pack pixel ${x}, ${y} is outside the collision hull`);
      }
    }),
  );
}

function frame(rows: readonly string[]): Frame {
  return rows.map((row) => [...row].map((cell) => PALETTE[cell] ?? null));
}

mkdirSync(dir, { recursive: true });
const data = `${dir}${ID}.json`;
await writeSprites({ data, sheet: `${dir}${ID}.png` }, { key: ID }, [
  ["glint", GRIDS.map(frame), LOOP.map(([, ms]) => ms)],
]);
writeFileSync(
  data,
  withCollision(
    readFileSync(data, "utf8"),
    GRIDS.map(() => [HULL.map(([x, y]) => [x, y] as [number, number])]),
  ),
);
await prettify(data);

replaceEntries("core", (id) => id === ID, [
  {
    id: ID,
    path: `/art/pickups/${ID}.png`,
    width: SIZE * LOOP.length,
    height: SIZE,
    displayWidth: SIZE,
    displayHeight: SIZE,
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: SIZE,
    frameHeight: SIZE,
    frames: { rest: 0, glint1: 1, glint2: 2, glint3: 3 },
    loop: LOOP.map(([name, ms], index) => ({ frame: index, name, ms })),
  },
]);
