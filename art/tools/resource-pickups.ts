// The Stardust and ore pickups (art/stardust.md): one 9 px pixel-art sheet per resource, the
// design the UI's vector icons share (currency-svg.ts). `node art/tools/resource-pickups.ts` writes
// `public/art/stardust.png` (rest and its glint frames) and `public/art/ore-nugget.png` (rest),
// their Aseprite data with each frame's collision parts and Stardust's pull streak, and replaces
// their core manifest rows in place.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { mergeEntries } from "./manifest.ts";
import { ORE_PICKUP, PICKUP_SIZE, STARDUST_PALETTE, STARDUST_REST } from "./resource-glyphs.ts";
import { traceGrid, withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));

// Brighten the resting star without changing its silhouette.
const { W, L, M, D } = STARDUST_PALETTE;
const GLINT = {
  glint1: new Map([
    [W, W],
    [L, L],
    [M, L],
    [D, M],
  ]),
  glint2: new Map([
    [W, W],
    [L, W],
    [M, L],
    [D, L],
  ]),
};
const LOOP = [
  ["rest", 420],
  ["glint1", 60],
  ["glint2", 80],
  ["glint1", 60],
] as const;
const glint = LOOP.map(([name]): Frame =>
  name === "rest"
    ? STARDUST_REST
    : STARDUST_REST.map((row) =>
        row.map((cell) => (cell ? (GLINT[name].get(cell) ?? cell) : null)),
      ),
);

// Stardust's pull streak: two opaque wedges drawn in order behind a pickup inside Ada's tractor
// radius. Each point is `[u, v]` in display px, `u` along the pull direction from the pickup's
// centre and `v` across it. The first wedge takes the ink keyline on a light field.
const PULL_STREAK = {
  wedges: [
    {
      color: "#c9a86a",
      points: [
        [-2.5, -1.2],
        [-9, 0],
        [-2.5, 1.2],
      ],
      keyline: true,
    },
    {
      color: "#f6e4b8",
      points: [
        [-2.5, -0.6],
        [-6, 0],
        [-2.5, 0.6],
      ],
    },
  ],
  reducedMotion: false,
};

// Writes a sheet and its data, each frame carrying its drawn silhouette in frame px.
async function sheet(
  key: string,
  frames: readonly Frame[],
  tags: Parameters<typeof writeSprites>[2],
  extra: Record<string, unknown> = {},
) {
  const paths = { data: `${art}${key}.json`, sheet: `${art}${key}.png` };
  await writeSprites(paths, { key }, tags);
  const traced = withCollision(
    readFileSync(paths.data, "utf8"),
    frames.map((rows, i) => traceGrid(`${key} ${i}`, rows).collision),
  );
  writeFileSync(paths.data, JSON.stringify({ ...JSON.parse(traced), ...extra }));
  await prettify(paths.data);
}

await sheet("stardust", glint, [["glint", glint, LOOP.map(([, ms]) => ms)]], {
  pullStreak: PULL_STREAK,
});
await sheet("ore-nugget", [ORE_PICKUP], [["rest", [ORE_PICKUP], 100]]);

// One row per resource, drawn at whole multiples of 9 px.
const row = (id: string, count: number) => ({
  id,
  path: `/art/${id}.png`,
  width: PICKUP_SIZE * count,
  height: PICKUP_SIZE,
  displayWidth: PICKUP_SIZE,
  displayHeight: PICKUP_SIZE,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: PICKUP_SIZE,
  frameHeight: PICKUP_SIZE,
});
const rows = [
  {
    ...row("stardust", LOOP.length),
    frames: { rest: 0, glint1: 1, glint2: 2 },
    loop: LOOP.map(([name, ms], index) => ({ frame: index, name, ms })),
  },
  { ...row("ore-nugget", 1), frames: { rest: 0 } },
];
// Each row keeps its place in the core manifest.
mergeEntries(
  "core",
  (id) => id === "stardust" || id === "ore-nugget",
  rows,
  (id) => id.startsWith("station-") || id.startsWith("enemy-"),
);
