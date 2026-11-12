import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Frame } from "@andornaut/art-kit/grid";

import { BAYER, IN_BETWEEN, INK } from "./palette.ts";
import { Random, roundHalfEven } from "./random.ts";
import { prettify, writeSprites } from "./sprite-sheet.ts";

const sprites = fileURLToPath(new URL("../../public/art/ui/sprites/", import.meta.url));
const uiManifest = fileURLToPath(new URL("../../public/art/ui/manifest.json", import.meta.url));

// Endesga greys of the reused Archie sprites, light to dark, and the dirt specks.
const GREY = ["c0cbdc", "8b9bb4", "5a6988", "3a4466"] as const;
const DIRT = ["733e39", "3e2731"] as const;
const WHITE = "ffffff";
const PULSE_MS = 700;
const AURA_PAD = 3;

type State = "raw" | "polished" | "glow";
type Cell = readonly [number, number];
const key = (x: number, y: number) => y * 4096 + x;

// A lumpy ellipse: three seeded sine bumps on the radius.
function mask(n: number, seed: number) {
  const random = new Random(seed);
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2 + n * 0.04;
  const rx = n * 0.46;
  const ry = n * 0.38;
  const bumps = [2, 3, 5].map((k) => {
    const amp = random.uniform(0.02, n <= 32 ? 0.07 : 0.09);
    return { amp, k, phase: random.uniform(0, 6.28) };
  });
  const cells: Cell[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const a = Math.atan2(dy, dx);
      const r =
        1 + bumps.reduce((sum, { amp, k, phase }) => sum + amp * Math.sin(k * a + phase), 0);
      if (dx * dx + dy * dy <= r * r) {
        cells.push([x, y]);
      }
    }
  }
  return { cells, cx, cy, inside: new Set(cells.map(([x, y]) => key(x, y))), rx, ry };
}

// One-arm spiral, flattened to 82% vertically; longer on bigger rocks.
function spiral(n: number, cx: number, cy: number, scale: number): Set<number> {
  const turns = n <= 16 ? 1.0 : n <= 32 ? 1.4 : 1.75;
  const span = turns * 2 * Math.PI;
  const points = new Set<number>();
  for (let t = 0; t < span; t += 0.05) {
    const r = scale * (0.12 + (0.88 * t) / span);
    points.add(
      key(roundHalfEven(cx + r * Math.cos(t)), roundHalfEven(cy + r * Math.sin(t) * 0.82)),
    );
  }
  points.add(key(roundHalfEven(cx), roundHalfEven(cy)));
  return points;
}

// Dug up: dithered greys with dirt. Polished: smooth bands, a glint and the engraved spiral.
// Glow: the spiral lit in the in-between ramp; `bright` picks the brighter pulse step.
function rock(n: number, state: State, bright = true, seed = 3): Frame {
  const { cells, cx, cy, inside, rx, ry } = mask(n, seed);
  const random = new Random(seed + 11);
  const px: Frame = Array.from({ length: n }, () => Array<string | null>(n).fill(null));
  const at = (k: number) => px[Math.floor(k / 4096)]![k % 4096];
  for (const [x, y] of cells) {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    let v = 0.5 + 0.45 * -(nx * 0.7 + ny * 0.9);
    if (state === "raw") {
      v = Math.min(v + random.uniform(-0.22, 0.22), 0.62);
    }
    const t = state === "raw" ? (BAYER[y % 4]![x % 4]! + 0.5) / 16 : 0.5;
    let index = Math.trunc((1 - Math.max(0, Math.min(0.999, v))) * 4 + (t - 0.5) * 0.9);
    index = Math.max(0, Math.min(3, index));
    if (state !== "raw" && index === 0) {
      index = v < 0.8 ? 1 : 0;
    }
    px[y]![x] = GREY[index]!;
  }
  for (const [x, y] of cells) {
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const;
    if (neighbours.some(([qx, qy]) => !inside.has(key(qx, qy)))) {
      px[y]![x] = INK;
    }
  }
  if (state === "raw") {
    const sorted = [...cells].sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
    for (let i = 0; i < Math.max(2, Math.floor(n / 4)); i++) {
      const [x, y] = random.choice(sorted);
      if (px[y]![x] !== INK) {
        px[y]![x] = random.choice(DIRT);
      }
    }
    return px;
  }
  const gx = roundHalfEven(cx - rx * 0.45);
  const gy = roundHalfEven(cy - ry * 0.5);
  const glint: readonly Cell[] =
    n >= 20
      ? [
          [0, 0],
          [1, 0],
          [0, 1],
        ]
      : [[0, 0]];
  for (const [dx, dy] of glint) {
    if (inside.has(key(gx + dx, gy + dy))) {
      px[gy + dy]![gx + dx] = WHITE;
    }
  }
  const pattern = new Set(
    [...spiral(n, cx + rx * 0.08, cy + ry * 0.1, Math.min(rx, ry) * 0.62)].filter(
      (k) => inside.has(k) && at(k) !== INK,
    ),
  );
  if (state === "polished") {
    for (const k of pattern) {
      px[Math.floor(k / 4096)]![k % 4096] = GREY[3];
    }
    return px;
  }
  const core = bright ? IN_BETWEEN[4] : IN_BETWEEN[3];
  const halo = bright ? IN_BETWEEN[3] : IN_BETWEEN[2];
  if (n >= 24) {
    for (const k of pattern) {
      const x = k % 4096;
      const y = Math.floor(k / 4096);
      for (const [qx, qy] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        const q = key(qx, qy);
        if (inside.has(q) && !pattern.has(q) && at(q) !== INK && BAYER[qy % 4]![qx % 4]! < 9) {
          px[qy]![qx] = halo;
        }
      }
    }
  }
  for (const k of pattern) {
    px[Math.floor(k / 4096)]![k % 4096] = core;
  }
  if (bright) {
    px[roundHalfEven(cy + ry * 0.1)]![roundHalfEven(cx + rx * 0.08)] = WHITE;
  }
  return px;
}

const mod4 = (v: number) => ((v % 4) + 4) % 4;

// Sparse dithered aura pixels one and two steps outside the rock; `strength` thins the dither.
function aura(frame: Frame, strength: number): Frame {
  const n = frame.length;
  const size = n + 2 * AURA_PAD;
  const solid: Cell[] = [];
  frame.forEach((row, y) => row.forEach((c, x) => c && solid.push([x, y])));
  const out: Frame = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  for (let y = -AURA_PAD; y < n + AURA_PAD; y++) {
    for (let x = -AURA_PAD; x < n + AURA_PAD; x++) {
      if (frame[y]?.[x]) {
        out[y + AURA_PAD]![x + AURA_PAD] = frame[y]![x]!;
        continue;
      }
      let d = 9;
      for (const [sx, sy] of solid) {
        if (Math.abs(x - sx) <= 3 && Math.abs(y - sy) <= 3) {
          d = Math.min(d, Math.abs(x - sx) + Math.abs(y - sy));
        }
      }
      const b = BAYER[mod4(y)]![mod4(x)]!;
      if ((d === 1 && b < 8 * strength) || (d === 2 && b < 3 * strength)) {
        out[y + AURA_PAD]![x + AURA_PAD] = IN_BETWEEN[2];
      }
    }
  }
  return out;
}

// A clear frame grown by the aura padding, so every close-up frame shares one size.
const padded = (frame: Frame) => aura(frame, 0);

async function sheet(name: string, frames: readonly [Frame, Frame, Frame, Frame]) {
  const [raw, polished, dim, bright] = frames;
  await writeSprites(
    { data: `${sprites}${name}.json`, sheet: `${sprites}${name}.png` },
    { key: name },
    [
      ["raw", [raw], 100],
      ["polished", [polished], 100],
      ["glow", [dim, bright], PULSE_MS],
    ],
  );
  await prettify(`${sprites}${name}.json`);
}

const ITEMS = [
  ["icon-rock", 16],
  ["icon-rock-24", 24],
  ["icon-rock-32", 32],
] as const;
for (const [name, n] of ITEMS) {
  await sheet(name, [rock(n, "raw"), rock(n, "polished"), rock(n, "glow", false), rock(n, "glow")]);
}
// The 64 px close-up uses its own seed; glowing frames carry the outer aura.
const CLOSE = 64;
const CLOSE_SEED = 8;
await sheet("rock-closeup", [
  padded(rock(CLOSE, "raw", true, CLOSE_SEED)),
  padded(rock(CLOSE, "polished", true, CLOSE_SEED)),
  aura(rock(CLOSE, "glow", false, CLOSE_SEED), 0.5),
  aura(rock(CLOSE, "glow", true, CLOSE_SEED), 1),
]);

// UI subset entries stay sorted by key.
type Sprite = { key: string; png: string; json: string; once: string[] };
const manifest = JSON.parse(readFileSync(uiManifest, "utf8")) as { sprites: Sprite[] };
const names = [...ITEMS.map(([name]) => name), "rock-closeup"];
manifest.sprites = [
  ...manifest.sprites.filter(({ key }) => !names.includes(key)),
  ...names.map((name) => ({
    key: name,
    png: `sprites/${name}.png`,
    json: `sprites/${name}.json`,
    once: [],
  })),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
writeFileSync(uiManifest, `${JSON.stringify(manifest, null, 2)}\n`);
await prettify(uiManifest);
