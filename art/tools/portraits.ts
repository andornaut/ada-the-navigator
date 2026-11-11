import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Colour, Frame } from "@andornaut/art-kit/grid";
import { decodePng } from "@andornaut/art-kit/png";
import type { Tag } from "@andornaut/art-kit/raster";
import { writeSpriteSheet } from "@andornaut/art-kit/spriteSheet";
import { format, resolveConfig } from "prettier";

import { editManifest } from "./manifest.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}portraits/`;

// Portrait sheets: 32 px frames for the storybook panel and 22 px compact frames that the
// conversation box draws at 2x. Ada and Penny compact frames are crops of their reused sheets;
// Astra and General Gadget are drawn here at both sizes.
const FULL = 32;
const COMPACT = 22;
const IDLE_MS = 1000;
const SPEAK_MS = 120;

const INK = "181425";
const NAVY_LIGHT = "3a4466";
const LOCKED = "1d2032";
const STATIC = "5a6988";
const AMBER = "f0bd68";
const AMBER_SIDE = "b98a40";
const CORAL = "d68b72";
const CORAL_SIDE = "a8654f";
const CORAL_REAR = "7f4b3d";
const CORAL_DEEP = "5e3a33";

const A_BEZEL = "d9a08a";
const A_BEZEL_SHADE = "b07a6a";
const A_PLUM = "3b2a3f";
const A_CORE = "fff1e0";
const A_WARM = "ffc9a8";
const A_ROSE = "e8968c";
const A_DIM = "9a6470";

type Point = readonly [number, number];

const blank = (size: number): Frame =>
  Array.from({ length: size }, () => Array.from({ length: size }, (): Colour => null));

function set(frame: Frame, x: number, y: number, colour: Colour): void {
  const row = frame[y];
  if (row && x >= 0 && x < row.length) {
    row[x] = colour;
  }
}

function disc(frame: Frame, cx: number, cy: number, r: number, colour: string): void {
  for (const [y, row] of frame.entries()) {
    for (const x of row.keys()) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) {
        row[x] = colour;
      }
    }
  }
}

// Bresenham line, one pixel wide.
function line(frame: Frame, [x0, y0]: Point, [x1, y1]: Point, colour: string): void {
  const [dx, dy] = [Math.abs(x1 - x0), -Math.abs(y1 - y0)];
  const [sx, sy] = [x0 < x1 ? 1 : -1, y0 < y1 ? 1 : -1];
  let [x, y, error] = [x0, y0, dx + dy];
  for (;;) {
    set(frame, x, y, colour);
    if (x === x1 && y === y1) {
      return;
    }
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function inside(polygon: readonly Point[], x: number, y: number): boolean {
  let hit = false;
  for (const [i, [ax, ay]] of polygon.entries()) {
    const [bx, by] = polygon[(i + 1) % polygon.length]!;
    if (ay > y !== by > y && x < ax + ((bx - ax) * (y - ay)) / (by - ay)) {
      hit = !hit;
    }
  }
  return hit;
}

// A pixel is covered when at least half of its 4 x 4 samples fall inside.
function covered(test: (x: number, y: number) => boolean, x: number, y: number): boolean {
  let count = 0;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      count += test(x + (i + 0.5) / 4, y + (j + 0.5) / 4) ? 1 : 0;
    }
  }
  return count >= 8;
}

function octagon(cx: number, cy: number, r: number): Point[] {
  const k = r * Math.tan(Math.PI / 8);
  return [
    [cx - k, cy - r],
    [cx + k, cy - r],
    [cx + r, cy - k],
    [cx + r, cy + k],
    [cx + k, cy + r],
    [cx - k, cy + r],
    [cx - r, cy + k],
    [cx - r, cy - k],
  ];
}

// The drones' claw insignia (see crafts.ts): a horseshoe pincer opening up, closing on a disc.
const CLAW_HALF: readonly Point[] = [
  [0, 1],
  [0.5, 0.87],
  [0.87, 0.5],
  [1, 0],
  [1, -0.6],
  [0.78, -1],
  [0.2, -0.92],
  [0.36, -0.68],
  [0.5, -0.45],
  [0.5, 0],
  [0.44, 0.25],
  [0.25, 0.44],
  [0, 0.5],
];
const CLAW_DISC = { y: -0.2, r: 0.26 };

function claw(cx: number, cy: number, r: number): Point[] {
  const half = CLAW_HALF.map(([x, y]): Point => [cx + x * r, cy + y * r]);
  const flip = ([x, y]: Point): Point => [2 * cx - x, y];
  const [outer, inner] = [half.slice(0, 7), half.slice(7)];
  return [
    ...outer,
    ...inner,
    ...inner.slice(0, -1).toReversed().map(flip),
    ...outer.slice(1).toReversed().map(flip),
  ];
}

// Deterministic static (mulberry32).
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Astra = {
  size: number;
  centre: Point;
  ink: number;
  shade: number;
  bezel: number;
  lift: number;
  plum: number;
  dots: number;
  core: readonly number[];
  ring: number;
  ember: number;
  bars: readonly number[];
  barRow: number;
};

const ASTRA: Readonly<Record<"full" | "compact", Astra>> = {
  full: {
    size: FULL,
    centre: [15.5, 13.5],
    ink: 12.6,
    shade: 11.6,
    bezel: 11,
    lift: 0.6,
    plum: 9,
    dots: 6.6,
    core: [3.4, 3.9, 4.4, 3.9],
    ring: 1,
    ember: 2.6,
    bars: [9, 12, 16, 19, 22],
    barRow: 28,
  },
  compact: {
    size: COMPACT,
    centre: [10.5, 8],
    ink: 8.5,
    shade: 7.7,
    bezel: 7.2,
    lift: 0.5,
    plum: 5.6,
    dots: 4.4,
    core: [2, 2.3, 2.7, 2.3],
    ring: 0.8,
    ember: 1.8,
    bars: [4, 7, 10, 13, 16],
    barRow: 19,
  },
};
// Voice bar half-heights plus one, per speaking frame.
const BARS = [
  [1, 2, 3, 2, 1],
  [2, 3, 1, 3, 2],
  [1, 3, 2, 3, 1],
  [2, 1, 3, 1, 2],
];

// Astra's rose-gold porthole. Speaking: a pulsing warm core, six turning rose dots and voice
// bars. Idle: a dim ember and a flat voice line.
function astra(g: Astra, speaking: number | null): Frame {
  const frame = blank(g.size);
  const [cx, cy] = g.centre;
  disc(frame, cx, cy, g.ink, INK);
  disc(frame, cx, cy, g.shade, A_BEZEL_SHADE);
  disc(frame, cx, cy - g.lift, g.bezel, A_BEZEL);
  disc(frame, cx, cy, g.plum, A_PLUM);
  let heights = [1, 1, 1, 1, 1];
  let bar = A_DIM;
  if (speaking === null) {
    disc(frame, cx, cy, g.ember, A_DIM);
    set(frame, Math.floor(cx), Math.floor(cy), A_ROSE);
    set(frame, Math.ceil(cx), Math.floor(cy), A_ROSE);
  } else {
    const turn = (Math.PI / 6) * (speaking % 2);
    for (let k = 0; k < 6; k++) {
      const a = turn + (k * Math.PI) / 3;
      set(
        frame,
        Math.round(cx + g.dots * Math.cos(a)),
        Math.round(cy + g.dots * Math.sin(a)),
        A_ROSE,
      );
    }
    const r = g.core[speaking]!;
    disc(frame, cx, cy, r + g.ring, A_ROSE);
    disc(frame, cx, cy, r, A_WARM);
    disc(frame, cx, cy, r * 0.45, A_CORE);
    heights = BARS[speaking]!;
    bar = A_WARM;
  }
  for (const [i, x] of g.bars.entries()) {
    const reach = heights[i]! - 1;
    for (let y = g.barRow - reach; y <= g.barRow + reach; y++) {
      set(frame, x, y, bar);
      set(frame, x + 1, y, bar);
    }
  }
  return frame;
}

type Gadget = {
  size: number;
  centre: Point;
  plate: number;
  edge: number;
  claw: number;
  clawDrop: number;
  shade: number;
  bands: readonly [number, number, number, number];
  bandLimit: number;
  specks: number;
  speckRows: readonly [number, number];
  traceRow: number;
  traceX: number;
  idleTrace: readonly [number, number];
  waves: readonly (readonly number[])[];
};

const GADGET: Readonly<Record<"full" | "compact", Gadget>> = {
  full: {
    size: FULL,
    centre: [15.5, 13],
    plate: 11,
    edge: 12,
    claw: 8.6,
    clawDrop: 0.5,
    shade: 8.5,
    bands: [4, 3, 13, 5],
    bandLimit: 24,
    specks: 26,
    speckRows: [2, 25],
    traceRow: 27,
    traceX: 3,
    idleTrace: [3, 28],
    // Hard zigzag amplitude at x = 3, 5, ..., 31, never rounded.
    waves: [
      [0, 2, -3, 1, -1, 3, -2, 0, 2, -1, 3, -3, 1, -2, 0],
      [0, -1, 3, -2, 2, -3, 1, -1, 3, 0, -2, 2, -3, 1, 0],
      [0, 3, -1, -3, 2, 0, -2, 3, -1, -3, 1, 2, -1, -2, 0],
      [0, -2, 1, 3, -3, 2, -1, -2, 1, 3, -2, -1, 2, -1, 0],
    ],
  },
  compact: {
    size: COMPACT,
    centre: [10.5, 8.5],
    plate: 7.6,
    edge: 8.4,
    claw: 6,
    clawDrop: 0.4,
    shade: 5.9,
    bands: [3, 2, 9, 3],
    bandLimit: 16,
    specks: 12,
    speckRows: [2, 16],
    traceRow: 19,
    traceX: 1,
    idleTrace: [2, 19],
    // Amplitude at x = 1, 3, ..., 21.
    waves: [
      [0, 2, -2, 1, -1, 2, -2, 0, 2, -1, 0],
      [0, -1, 2, -2, 1, -2, 1, -1, 2, -2, 0],
      [0, 2, -1, -2, 2, 0, -2, 2, -1, 1, 0],
      [0, -2, 1, 2, -2, 1, -1, -2, 1, 2, 0],
    ],
  },
};

// General Gadget's faceless voice: static, the drones' claw on a coral octagon, and a hard amber
// trace. Unknown voice: the roundel is dim and torn by two glitch bands. Named: clean and lit.
function gadget(g: Gadget, known: boolean, speaking: number | null): Frame {
  const step = speaking ?? 0;
  const frame = blank(g.size);
  const next = random(g.size * 1000 + step * 31 + (known ? 0 : 500));
  const noise = known ? 0.07 : 0.13;
  for (const [y, row] of frame.entries()) {
    for (const x of row.keys()) {
      const v = next();
      row[x] = v < noise * 0.45 ? NAVY_LIGHT : v < noise ? LOCKED : null;
    }
    if ((y + step) % 4 === 0) {
      for (const x of row.keys()) {
        if (next() < 0.55) {
          row[x] = LOCKED;
        }
      }
    }
  }
  const [cx, cy] = g.centre;
  const plate = octagon(cx, cy, g.plate);
  const edge = octagon(cx, cy, g.edge);
  const mark = claw(cx, cy + g.clawDrop, g.claw);
  const hub = [cx, cy + g.clawDrop + CLAW_DISC.y * g.claw, CLAW_DISC.r * g.claw + 0.2] as const;
  const colours = known
    ? { hub: AMBER, plate: CORAL, shade: CORAL_SIDE }
    : { hub: AMBER_SIDE, plate: CORAL_REAR, shade: CORAL_DEEP };
  for (const [y, row] of frame.entries()) {
    for (const x of row.keys()) {
      if (covered((px, py) => inside(edge, px, py), x, y)) {
        row[x] = INK;
      }
      if (covered((px, py) => inside(plate, px, py), x, y)) {
        row[x] = x - cx + (y - cy) > g.shade ? colours.shade : colours.plate;
      }
      if (covered((px, py) => inside(mark, px, py), x, y)) {
        row[x] = INK;
      }
      if (covered((px, py) => (px - hub[0]) ** 2 + (py - hub[1]) ** 2 <= hub[2] ** 2, x, y)) {
        row[x] = colours.hub;
      }
    }
  }
  if (!known) {
    const [a, aStep, b, bStep] = g.bands;
    const span = g.bandLimit - 4;
    const bands = [((a + step * aStep) % span) + 2, ((b + step * bStep) % span) + 2];
    const shifts = [2 + (step % 2), -3 + (step % 2)];
    const snapshot = frame.map((row) => [...row]);
    for (const [i, band] of bands.entries()) {
      for (let y = band; y < Math.min(band + 2, g.bandLimit); y++) {
        for (const x of frame[y]!.keys()) {
          frame[y]![x] = snapshot[y]![x - shifts[i]!] ?? null;
        }
      }
    }
    const [top, bottom] = g.speckRows;
    for (let i = 0; i < g.specks; i++) {
      const x = Math.floor(next() * g.size);
      const y = top + Math.floor(next() * (bottom - top));
      set(frame, x, y, [NAVY_LIGHT, LOCKED, STATIC][Math.floor(next() * 3)]!);
    }
  }
  if (speaking === null) {
    line(frame, [g.idleTrace[0], g.traceRow], [g.idleTrace[1], g.traceRow], AMBER_SIDE);
  } else {
    const points = g.waves[speaking]!.map((a, i): Point => [g.traceX + 2 * i, g.traceRow - a]);
    for (let i = 1; i < points.length; i++) {
      line(frame, points[i - 1]!, points[i]!, AMBER);
    }
  }
  return frame;
}

const SPEAKING = [0, 1, 2, 3];

function astraTags(g: Astra): Tag[] {
  return [
    ["idle", [astra(g, null)], IDLE_MS],
    ["speaking", SPEAKING.map((i) => astra(g, i)), SPEAK_MS],
  ];
}

function gadgetTags(g: Gadget): Tag[] {
  return [false, true].flatMap((known): Tag[] => {
    const state = known ? "named" : "unknown";
    return [
      [`${state}-idle`, [gadget(g, known, null)], IDLE_MS],
      [`${state}-speaking`, SPEAKING.map((i) => gadget(g, known, i)), SPEAK_MS],
    ];
  });
}

interface AsepriteData {
  frames: Record<string, { duration: number; frame: { x: number; y: number } }>;
  meta: { frameTags: { from: number; name: string; to: number }[] };
}

// Compact frames of a reused sheet: the 22 x 22 window at `origin` of every source frame,
// keeping the source tags and durations. Pixels are copied exactly.
function cropTags(key: string, [ox, oy]: Point): Tag[] {
  const image = decodePng(readFileSync(`${output}${key}.png`));
  const data = JSON.parse(readFileSync(`${output}${key}.json`, "utf8")) as AsepriteData;
  const sources = Object.values(data.frames);
  const frames = sources.map(({ frame: { x, y } }): Frame =>
    Array.from({ length: COMPACT }, (_, row) =>
      Array.from({ length: COMPACT }, (_, column): Colour => {
        const at = ((y + oy + row) * image.width + x + ox + column) * 4;
        const [r = 0, g = 0, b = 0, a = 0] = image.data.subarray(at, at + 4);
        if (a !== 0 && a !== 255) {
          throw new RangeError(`${key} has partial alpha at ${x + ox + column},${y + oy + row}`);
        }
        return a === 0 ? null : [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      }),
    ),
  );
  return data.meta.frameTags.map(({ from, name, to }): Tag => [
    name,
    frames.slice(from, to + 1),
    sources.slice(from, to + 1).map(({ duration }) => duration),
  ]);
}

// Crop origins in source frame px: the face, from the hair bow to the chin.
const CROPS: Readonly<Record<string, Point>> = { ada: [5, 5], penny: [5, 3] };

type Sheet = { id: string; key: string; size: number; tags: Tag[] };

const sheets: Sheet[] = [
  { id: "astra-portrait", key: "astra", size: FULL, tags: astraTags(ASTRA.full) },
  { id: "gadget-portrait", key: "gadget", size: FULL, tags: gadgetTags(GADGET.full) },
  {
    id: "ada-portrait-compact",
    key: "ada-compact",
    size: COMPACT,
    tags: cropTags("ada", CROPS.ada!),
  },
  {
    id: "astra-portrait-compact",
    key: "astra-compact",
    size: COMPACT,
    tags: astraTags(ASTRA.compact),
  },
  {
    id: "gadget-portrait-compact",
    key: "gadget-compact",
    size: COMPACT,
    tags: gadgetTags(GADGET.compact),
  },
  {
    id: "penny-portrait-compact",
    key: "penny-compact",
    size: COMPACT,
    tags: cropTags("penny", CROPS.penny!),
  },
];

// Sprite data goes through the project's Prettier settings so the files stay Prettier-clean.
async function prettify(path: string): Promise<void> {
  const options = await resolveConfig(path);
  writeFileSync(path, await format(readFileSync(path, "utf8"), { ...options, filepath: path }));
}

for (const { key, tags } of sheets) {
  await writeSpriteSheet(
    { data: `${output}${key}.json`, sheet: `${output}${key}.png` },
    { key },
    tags,
  );
  await prettify(`${output}${key}.json`);
}

// Frame names: one per frame, `{tag}` for single-frame tags and `{tag}-{n}` within a loop.
function entry({ id, key, size, tags }: Sheet) {
  const frames: Record<string, number> = {};
  const loops: Record<string, { frame: number; name: string; ms: number }[]> = {};
  let index = 0;
  for (const [name, list, ms] of tags) {
    if (list.length === 1) {
      frames[name] = index++;
      continue;
    }
    loops[name] = list.map((_, i) => {
      const frame = index++;
      frames[`${name}-${i + 1}`] = frame;
      return { frame, name: `${name}-${i + 1}`, ms: typeof ms === "number" ? ms : ms[i]! };
    });
  }
  const count = index;
  return {
    id,
    path: `/art/portraits/${key}.png`,
    width: size * count,
    height: size,
    ...(size === COMPACT ? { displayWidth: size * 2, displayHeight: size * 2 } : {}),
    facing: "front",
    pivot: { x: 0.5, y: 0.5 },
    frameWidth: size,
    frameHeight: size,
    frames,
    ...(Object.keys(loops).length > 0 ? { loops } : {}),
  };
}

const penny = {
  id: "penny-portrait",
  path: "/art/portraits/penny.png",
  width: FULL * 3,
  height: FULL,
  facing: "front",
  pivot: { x: 0.5, y: 0.5 },
  frameWidth: FULL,
  frameHeight: FULL,
  frames: { happy: 0, neutral: 1, upset: 2 },
};

// The new portrait entries follow the reused portraits, full sheets then compact sheets.
const owned = [
  ...sheets.filter(({ size }) => size === FULL).map(entry),
  penny,
  ...sheets.filter(({ size }) => size === COMPACT).map(entry),
].toSorted(
  (a, b) =>
    Number(a.id.endsWith("-compact")) - Number(b.id.endsWith("-compact")) ||
    a.id.localeCompare(b.id),
);
const ids = new Set(owned.map(({ id }) => id));
editManifest("core", (manifest) => {
  const kept = manifest.assets.filter(({ id }) => !ids.has(id));
  const last = kept.findLastIndex(({ id }) => id.endsWith("-portrait"));
  manifest.assets = [...kept.slice(0, last + 1), ...owned, ...kept.slice(last + 1)];
});
