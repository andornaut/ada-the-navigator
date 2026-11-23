import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { editManifest } from "./manifest.ts";
import { PICKUP_SIZE, resourceIcon, STARDUST_PALETTE, STARDUST_REST } from "./resource-glyphs.ts";
import { traceGrid, withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sprites = `${art}ui/sprites/`;

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
await writeSprites(
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
const key = "icon-stardust-20";
const uiManifest = JSON.parse(readFileSync(`${art}ui/manifest.json`, "utf8")) as {
  sprites: { key: string }[];
};
// Keep the UI raster until Tech selects its vector. The world glint emits every time.
if (
  uiManifest.sprites.some((entry) => entry.key === key) ||
  !existsSync(`${art}ui/icons/${key}.svg`)
) {
  await writeSprites({ data: `${sprites}${key}.json`, sheet: `${sprites}${key}.png` }, { key }, [
    ["rest", [resourceIcon(STARDUST_REST, 20)], 100],
  ]);
}

// The pickup sheet loads as a root manifest sprite sheet, placed before the station and enemies.
const entry = {
  id: "stardust",
  path: "/art/stardust.png",
  width: PICKUP_SIZE * LOOP.length,
  height: PICKUP_SIZE,
  displayWidth: PICKUP_SIZE,
  displayHeight: PICKUP_SIZE,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: PICKUP_SIZE,
  frameHeight: PICKUP_SIZE,
  frames: { rest: 0, glint1: 1, glint2: 2 },
  loop: LOOP.map(([name, ms], index) => ({ frame: index, name, ms })),
};
editManifest("core", (manifest) => {
  const kept = manifest.assets.filter(({ id }) => id !== "stardust");
  const later = kept.findIndex(({ id }) => id.startsWith("station-") || id.startsWith("enemy-"));
  const insert = later === -1 ? kept.length : later;
  manifest.assets = [...kept.slice(0, insert), entry, ...kept.slice(insert)];
});
