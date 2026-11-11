import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { json } from "./projection.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const SIZE = 21;
const BLINK_MS = 500;

// Sealed pod with a beacon: "L" light, "M" body, "D" shade, "S" seam, "a" mast, "B" beacon,
// "W" beacon core, "." clear.
const POD = [
  "......B......",
  ".....BWB.....",
  "......B......",
  "......a......",
  "....LLLLL....",
  "..LLLLLLLLL..",
  ".MLLLLLLLLLM.",
  "MMMMMMMMMMMMM",
  "SSSSSSSSSSSSS",
  "MMMMMMMMMMMMM",
  "DMMMMMMMMMMMD",
  ".DDMMMMMMMDD.",
  "...DDDDDDD...",
] as const;
const POD_ORIGIN = [4, 5] as const;
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
};
// Lit: point-of-interest lavender with a warm seam and beacon.
const LIT_A: Palette = {
  L: "e6dbeb",
  M: "c4afcc",
  D: "8f7c9c",
  S: "ffe9b8",
  a: "8f7c9c",
  B: "ffe9b8",
  W: "ffffff",
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

// Sprite data goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

await writeSpriteSheet(
  { data: `${art}discovery-cache.json`, sheet: `${art}discovery-cache.png` },
  { key: "discovery-cache" },
  [
    ["hidden", [frame(HIDDEN, false)], BLINK_MS],
    ["lit", [frame(LIT_A, false), frame(LIT_B, true)], BLINK_MS],
  ],
);
await prettify(`${art}discovery-cache.json`);

// The sheet loads as a root manifest sprite sheet after the outposts and before the enemies.
const entry = {
  id: "discovery-cache",
  path: "/art/discovery-cache.png",
  width: SIZE * 3,
  height: SIZE,
  displayWidth: SIZE,
  displayHeight: SIZE,
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
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { assets: { id: string }[] };
const kept = manifest.assets.filter(({ id }) => id !== "discovery-cache");
const later = kept.findIndex(({ id }) => id.startsWith("enemy-"));
const insert = later === -1 ? kept.length : later;
manifest.assets = [...kept.slice(0, insert), entry, ...kept.slice(insert)];
writeFileSync(manifestPath, json(manifest));
