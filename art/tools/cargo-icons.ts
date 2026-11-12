// The status pill's and Ship card's cargo icons (art/controls.md "Status pill"): ore, a job item
// and a towed craft, 20 by 20 pixel art from character grids, each inside its own ink edge so it
// reads on every field. Writes the UI subset sheets and their ui/manifest.json entries.
// Usage: node art/tools/cargo-icons.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { ORE_PALETTE } from "./ore.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sprites = `${art}ui/sprites/`;
const uiManifest = `${art}ui/manifest.json`;
const INK = "181425";

// "H" is the ink edge in every icon.
const ICONS: Readonly<
  Record<string, { palette: Record<string, string>; rows: readonly string[] }>
> = {
  // A nugget and a pebble in ore's palette: rust rim on the lit side, ember body, shade and deep.
  "icon-ore-20": {
    palette: ORE_PALETTE,
    rows: [
      "....................",
      "....................",
      "......HHHH..........",
      ".....HRRMMHH........",
      "....HRRMMMMSHH......",
      "...HRRMMSMMMMSH.....",
      "...HRMMMMMMMSSH.....",
      "..HRMMMSMMMMMSSH....",
      "..HRMMMMMMMSMSDH....",
      "..HRMSMMMMMMSSDrH...",
      "...HRMMMMSMMSSDrH...",
      "...HrMMMMMMSSSrH....",
      "....HrSMMSSSDrH.....",
      ".....HHrrrrrHH......",
      ".......HHHHH....HHH.",
      "...............HRMrH",
      "..............HRMSrH",
      "..............HrrrH.",
      "...............HHH..",
      "....................",
    ],
  },
  // Any job item: a strapped crate in the Map's job orange, as on its held-job chip.
  "icon-cargo-20": {
    palette: { O: "feae34", o: "c9781c", S: "ead4aa" },
    rows: [
      "....................",
      "....................",
      "....................",
      "..HHHHHHHHHHHHHHHH..",
      "..HOOOOOOSSOOOOOOH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HHHHHHHHHHHHHHHH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HSSSSSSSSSSSSSSH..",
      "..HSSSSSSSSSSSSSSH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HOOOOOOSSOOOOOoH..",
      "..HooooooSSooooooH..",
      "..HHHHHHHHHHHHHHHH..",
      "....................",
      "....................",
      "....................",
    ],
  },
  // A towed craft: the tow hook on its line, in the tow line's steel core and edge.
  "icon-tow-20": {
    palette: { C: "b8bfc9", E: "4f5462" },
    rows: [
      "........HHH.........",
      "........HCH.........",
      "........HCH.........",
      "........HCH.........",
      "........HCH.........",
      ".......HHCHH........",
      "......HCCCCCH.......",
      "......HCEEECH.......",
      "......HHCCCHH.......",
      "........HCH.........",
      "........HCH.........",
      "...HH...HCH.........",
      "..HCCH..HCH.........",
      "..HCEH..HCH.........",
      "..HCCHHHCCH.........",
      "...HCCCCCCH.........",
      "....HCCCCH..........",
      ".....HHHH...........",
      "....................",
      "....................",
    ],
  },
};

async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

for (const [key, { palette, rows }] of Object.entries(ICONS)) {
  if (rows.length !== 20 || rows.some((row) => row.length !== 20)) {
    throw new Error(`${key} is not 20 by 20`);
  }
  const frame: Frame = rows.map((row) =>
    [...row].map((cell) => (cell === "H" ? INK : (palette[cell] ?? null))),
  );
  await writeSpriteSheet(
    { data: `${sprites}${key}.json`, sheet: `${sprites}${key}.png` },
    { key },
    [["rest", [frame], 100]],
  );
  await prettify(`${sprites}${key}.json`);
}

// UI subset entries stay sorted by key.
type Sprite = { key: string; png: string; json: string; once: string[] };
const manifest = JSON.parse(readFileSync(uiManifest, "utf8")) as { sprites: Sprite[] };
const keys = Object.keys(ICONS);
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !keys.includes(key)),
  ...keys.map((key) => ({ key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: [] })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(uiManifest, `${JSON.stringify(manifest, null, 2)}\n`);
await prettify(uiManifest);
