import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";

import { placeEntries } from "./manifest.ts";
import { INK } from "./palette.ts";
import { roundHalfEven } from "./random.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const sprites = `${art}ui/sprites/`;
const uiManifest = `${art}ui/manifest.json`;
const WHITE = "ffffff";
// The pearl rim and hub, light to shade, and the magenta hologram band.
const PEARL = ["ffffff", "d9dff0", "a3aacb"] as const;
const HOLO = ["ffb3ec", "e868c8", "a83a96"] as const;

// A face-on pearl disc with a magenta hologram band, lit from the upper left. `squash` below 1
// narrows it as it turns; `glint` turns the band's highlights.
function holodisk(n: number, squash = 1, glint = 0): Frame {
  const px: Frame = Array.from({ length: n }, () => Array<string | null>(n).fill(null));
  const c = (n - 1) / 2;
  const R = n / 2 - 0.2;
  const rx = Math.max(0.6, R * squash);
  const small = n < 14;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - c) / rx;
      const dy = (y - c) / R;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        continue;
      }
      const ax = Math.abs(x - c);
      const ay = Math.abs(y - c);
      if (Math.hypot((ax + 0.9) / rx, ay / R) > 1 || Math.hypot(ax / rx, (ay + 0.9) / R) > 1) {
        px[y]![x] = INK;
      } else if (squash < 0.45) {
        // Edge-on: only the pearl rim shows.
        px[y]![x] = x <= c ? PEARL[1] : PEARL[2];
      } else if (d < (small ? 0.22 : 0.2)) {
        px[y]![x] = INK;
      } else if (d < (small ? 0.4 : 0.36)) {
        px[y]![x] = PEARL[2];
      } else if (d < (small ? 0.72 : 0.66)) {
        const band = (Math.sin(Math.atan2(dy, dx) * 2 + glint * 1.2) + 1) / 2;
        px[y]![x] = band > 0.78 ? HOLO[0] : band > 0.25 ? HOLO[1] : HOLO[2];
      } else {
        const lit = dx + dy;
        px[y]![x] = lit < -0.2 ? PEARL[0] : lit < 0.7 ? PEARL[1] : PEARL[2];
      }
    }
  }
  if (n >= 16 && squash > 0.9) {
    const g = roundHalfEven(c - R * 0.42);
    px[g]![g] = WHITE;
  }
  return px;
}

// 11 px pickup coin turn: rest, three-quarter, edge-on, three-quarter with the band mirrored.
const PICKUP = 11;
const TURN = [
  ["rest", 1, 600],
  ["turn1", 0.62, 70],
  ["edge", 0.3, 70],
  ["turn2", 0.62, 70],
] as const;

// Dotted 1 px ring of radius 8 round the pickup, two pulse steps.
const BEACON_RADIUS = 8;
const BEACON = 2 * BEACON_RADIUS + 3;
const PULSE = [
  ["base", HOLO[2], 600],
  ["bright", HOLO[1], 600],
] as const;

function beacon(colour: string): Frame {
  const px: Frame = Array.from({ length: BEACON }, () => Array<string | null>(BEACON).fill(null));
  const c = Math.floor(BEACON / 2);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    px[roundHalfEven(c + BEACON_RADIUS * Math.sin(a))]![
      roundHalfEven(c + BEACON_RADIUS * Math.cos(a))
    ] = colour;
  }
  return px;
}

const ICONS = [
  ["icon-holodisk", 16],
  ["icon-holodisk-20", 20],
  ["icon-holodisk-24", 24],
] as const;
for (const [key, n] of ICONS) {
  await writeSprites({ data: `${sprites}${key}.json`, sheet: `${sprites}${key}.png` }, { key }, [
    ["rest", [holodisk(n)], 100],
  ]);
  await prettify(`${sprites}${key}.json`);
}

await writeSprites(
  { data: `${art}holodisk.json`, sheet: `${art}holodisk.png` },
  { key: "holodisk" },
  [["turn", TURN.map(([, squash], i) => holodisk(PICKUP, squash, i)), TURN.map(([, , ms]) => ms)]],
);
await prettify(`${art}holodisk.json`);
await writeSprites(
  { data: `${art}holodisk-beacon.json`, sheet: `${art}holodisk-beacon.png` },
  { key: "holodisk-beacon" },
  [["pulse", PULSE.map(([, colour]) => beacon(colour)), PULSE.map(([, , ms]) => ms)]],
);
await prettify(`${art}holodisk-beacon.json`);

// The pickup and beacon load as root manifest sprite sheets.
const sheetEntry = (
  id: string,
  size: number,
  frames: readonly (readonly [string, unknown, number])[],
) => ({
  id,
  path: `/art/${id}.png`,
  width: size * frames.length,
  height: size,
  displayWidth: size,
  displayHeight: size,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: size,
  frameHeight: size,
  frames: Object.fromEntries(frames.map(([name], i) => [name, i])),
  loop: frames.map(([name, , ms], frame) => ({ frame, name, ms })),
});
placeEntries("core", "holodisk", [
  sheetEntry("holodisk", PICKUP, TURN),
  sheetEntry("holodisk-beacon", BEACON, PULSE),
]);

// UI subset entries stay sorted by key.
type Sprite = { key: string; png: string; json: string; once: string[] };
const manifest = JSON.parse(readFileSync(uiManifest, "utf8")) as { sprites: Sprite[] };
const keys: readonly (readonly [string, string[]])[] = [
  ...ICONS.map(([key]) => [key, []] as const),
];
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !keys.some(([k]) => k === key)),
  ...keys.map(([key, once]) => ({
    key,
    png: `sprites/${key}.png`,
    json: `sprites/${key}.json`,
    once,
  })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(uiManifest, `${JSON.stringify(manifest, null, 2)}\n`);
await prettify(uiManifest);
