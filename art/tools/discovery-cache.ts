import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/build/grid";

import { editManifest } from "./manifest.ts";
import { traceGrid, withCollision } from "./silhouette.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const SIZE = 21;
const DISPLAY_SIZE = 31;
const BLINK_MS = 500;

// A sealed data satellite with swept solar wings, a central bus and a blinking receiver.
const POD = [
  ".........B.........",
  "........BWB........",
  ".........B.........",
  ".........a.........",
  ".......LCCCL.......",
  ".RPP...LMMML...PPR.",
  ".RGPPR.MMSMM.RPPGR.",
  "..RPGPPMMMMMPPGPR..",
  "...RPGPMSMSMPGPR...",
  "....RRRMDMDMRRR....",
  ".......DDDDD.......",
  "........a.a........",
] as const;
const POD_ORIGIN = [1, 4] as const;
// Lit B adds eight warm halo pixels on a ring around the pod.
const HALO = [
  [10, 2],
  [16, 5],
  [19, 11],
  [16, 17],
  [10, 20],
  [4, 17],
  [1, 11],
  [4, 5],
] as const;

type Palette = Readonly<Record<string, string>>;

// Hidden: unlit and desaturated, close to the environment tones.
const HIDDEN: Palette = {
  L: "6e6478",
  M: "5a5164",
  D: "453e4f",
  S: "3a3344",
  a: "453e4f",
  B: "5a5164",
  W: "6e6478",
  C: "5a5164",
  R: "484956",
  P: "505769",
  G: "666b79",
};
// Lit: point-of-interest lavender with a warm seam and beacon.
const LIT_A: Palette = {
  L: "e3d9ae",
  M: "a09370",
  D: "5d5b60",
  S: "ffe9b8",
  a: "8f7c9c",
  B: "ffe9b8",
  W: "ffffff",
  C: "fff2cf",
  R: "384267",
  P: "556ca6",
  G: "8fafd3",
};
const LIT_B: Palette = { ...LIT_A, B: "c4afcc", W: "ffe9b8" };
const HALO_COLOUR = "ffe9b8";

function frame(palette: Palette, halo: boolean): Frame {
  const px: Frame = Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null));
  const [ox, oy] = POD_ORIGIN;
  for (const [y, row] of POD.entries()) {
    for (const [x, cell] of [...row].entries()) {
      if (cell !== ".") {
        px[oy + y]![ox + x] = palette[cell]!;
      }
    }
  }
  if (halo) {
    for (const [x, y] of HALO) {
      px[y]![x] = HALO_COLOUR;
    }
  }
  return px;
}

// The sheet loads as a core manifest sprite sheet after the station and before the enemies.
const entry = {
  id: "discovery-cache",
  path: "/art/discovery-cache.png",
  width: SIZE * 3,
  height: SIZE,
  displayWidth: DISPLAY_SIZE,
  displayHeight: DISPLAY_SIZE,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: SIZE,
  frameHeight: SIZE,
  frames: { hidden: 0, litA: 1, litB: 2 },
  loop: [
    { frame: 1, name: "litA", ms: BLINK_MS },
    { frame: 2, name: "litB", ms: BLINK_MS },
  ],
};

await writeSprites(
  { data: `${art}discovery-cache.json`, sheet: `${art}discovery-cache.png` },
  { key: "discovery-cache" },
  [
    ["hidden", [frame(HIDDEN, false)], BLINK_MS],
    ["lit", [frame(LIT_A, false), frame(LIT_B, true)], BLINK_MS],
  ],
);
// Each frame's drawn silhouette, in frame px. The halo is light, not matter, so lit B traces
// its pod alone.
const data = JSON.parse(
  withCollision(
    readFileSync(`${art}discovery-cache.json`, "utf8"),
    [frame(HIDDEN, false), frame(LIT_A, false), frame(LIT_B, false)].map(
      (rows, i) => traceGrid(`discovery-cache ${i}`, rows).collision,
    ),
  ),
) as { meta: Record<string, unknown> };
data.meta.displayGeometry = {
  width: entry.displayWidth,
  height: entry.displayHeight,
  pivot: entry.pivot,
};
writeFileSync(`${art}discovery-cache.json`, JSON.stringify(data));
await prettify(`${art}discovery-cache.json`);

editManifest("core", (manifest) => {
  const kept = manifest.assets.filter(({ id }) => id !== "discovery-cache");
  const later = kept.findIndex(({ id }) => id.startsWith("enemy-"));
  const insert = later === -1 ? kept.length : later;
  manifest.assets = [...kept.slice(0, insert), entry, ...kept.slice(insert)];
});
