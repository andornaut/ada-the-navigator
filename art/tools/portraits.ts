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

// Astra's teal, anchored on the in-between shimmer `#8fe0f2`, and the in-between's darkest value.
const A_GLOW = "1d4a63";
const A_SHADE = "2a7b96";
const A_RING = "47b2cc";
const A_LIGHT = "8fe0f2";
const A_GLINT = "d6f7fc";
const A_WHITE = "ffffff";
const A_FACE = "1f1a38";

type Point = readonly [number, number];

const blank = (size: number): Frame =>
  Array.from({ length: size }, () => Array.from({ length: size }, (): Colour => null));

function set(frame: Frame, x: number, y: number, colour: Colour): void {
  const row = frame[y];
  if (row && x >= 0 && x < row.length) {
    row[x] = colour;
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

function hexagon(cx: number, cy: number, r: number): Point[] {
  return Array.from({ length: 6 }, (_, k): Point => {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function fill(frame: Frame, polygon: readonly Point[], colour: (x: number, y: number) => Colour) {
  for (const [y, row] of frame.entries()) {
    for (const x of row.keys()) {
      if (covered((px, py) => inside(polygon, px, py), x, y)) {
        row[x] = colour(x, y);
      }
    }
  }
}

// Dithered glow on the clear pixels round the ink edge, stepping up with `level` (1 to 3): ring one
// is the 4-neighbour border, ring two the next border out (full sheet only).
function glow(frame: Frame, level: number, rings: number): void {
  const size = frame.length;
  const key = (x: number, y: number) => y * size + x;
  const body = new Set<number>();
  for (const [y, row] of frame.entries()) {
    for (const [x, c] of row.entries()) {
      if (c !== null) {
        body.add(key(x, y));
      }
    }
  }
  const border = (cells: ReadonlySet<number>): Set<number> => {
    const out = new Set<number>();
    for (const cell of cells) {
      const [x, y] = [cell % size, Math.floor(cell / size)];
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx >= 0 && nx < size && ny >= 0 && ny < size && !cells.has(key(nx, ny))) {
          out.add(key(nx, ny));
        }
      }
    }
    return out;
  };
  const one = border(body);
  for (const cell of one) {
    const [x, y] = [cell % size, Math.floor(cell / size)];
    const on = (x + y) % 2 === 0;
    const colour = level === 3 ? (on ? A_SHADE : A_GLOW) : on ? [A_GLOW, A_SHADE][level - 1] : null;
    if (colour) {
      set(frame, x, y, colour);
    }
  }
  if (rings < 2) {
    return;
  }
  for (const cell of border(new Set([...body, ...one]))) {
    const [x, y] = [cell % size, Math.floor(cell / size)];
    if ((level === 2 && x % 2 === 0 && y % 2 === 0) || (level === 3 && (x + y) % 2 === 0)) {
      set(frame, x, y, A_GLOW);
    }
  }
}

type Astra = {
  size: number;
  centre: Point;
  edge: number;
  ring: number;
  face: number;
  inner: number;
  line: number;
  eyeX: number;
  eyeRow: number;
  mouthRow: number;
  mouths: readonly number[];
  idleMouth: number;
  rings: number;
  glint: number;
};

// Pixel k spans [k, k + 1], so a frame's centre is size / 2.
const ASTRA: Readonly<Record<"full" | "compact", Astra>> = {
  full: {
    size: FULL,
    centre: [16, 15.5],
    edge: 13.6,
    ring: 12.4,
    face: 10.4,
    inner: 7.6,
    line: 1.15,
    eyeX: 4,
    eyeRow: 13,
    mouthRow: 19,
    mouths: [4, 8, 2, 6],
    idleMouth: 4,
    rings: 2,
    glint: 9,
  },
  compact: {
    size: COMPACT,
    centre: [11, 11],
    edge: 10.2,
    ring: 9.2,
    face: 7.6,
    inner: 5.6,
    line: 1.1,
    eyeX: 3,
    eyeRow: 9,
    mouthRow: 13,
    mouths: [2, 6, 4, 6],
    idleMouth: 2,
    rings: 1,
    glint: 7,
  },
};
// Glow level per speaking frame.
const GLOW = [1, 2, 3, 2];
const EYE_HALO: readonly Point[] = [
  [-1, 0],
  [-1, 1],
  [2, 0],
  [2, 1],
  [0, -1],
  [1, -1],
  [0, 2],
  [1, 2],
];

// Astra's line-art face: concentric hexagons (a ring lit from the upper left, a dark face, an
// inner line), two eye lights and a voice-line mouth. Speaking: white eyes, the mouth stepping
// through its widths, a catch-light on the ring and a pulsing dithered glow. Idle: dim eyes, a flat
// mouth, the ring one step darker and no glow.
function astra(g: Astra, speaking: number | null): Frame {
  const frame = blank(g.size);
  const [cx, cy] = g.centre;
  const lit = speaking !== null;
  fill(frame, hexagon(cx, cy, g.edge), () => INK);
  const shade = (x: number, y: number) => x + 0.5 - cx + (y + 0.5 - cy) > 2;
  fill(frame, hexagon(cx, cy, g.ring), (x, y) => {
    const ring = shade(x, y) ? A_SHADE : A_RING;
    return lit ? ring : ring === A_RING ? A_SHADE : A_GLOW;
  });
  fill(frame, hexagon(cx, cy, g.face), () => A_FACE);
  fill(frame, hexagon(cx, cy, g.inner), () => A_GLOW);
  fill(frame, hexagon(cx, cy, g.inner - g.line), () => A_FACE);
  for (const side of [-1, 1]) {
    const ex = Math.trunc(cx + side * g.eyeX - 1);
    for (const [dx, dy] of EYE_HALO) {
      set(frame, ex + dx, g.eyeRow + dy, lit ? A_RING : A_SHADE);
    }
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      set(frame, ex + dx, g.eyeRow + dy, lit ? A_WHITE : A_LIGHT);
    }
  }
  const width = lit ? g.mouths[speaking]! : g.idleMouth;
  const x0 = Math.trunc(cx - width / 2);
  for (let x = x0; x < x0 + width; x++) {
    const end = (x === x0 || x === x0 + width - 1) && width > 2;
    set(frame, x, g.mouthRow, lit ? (end ? A_LIGHT : A_WHITE) : A_SHADE);
  }
  if (!lit) {
    return frame;
  }
  for (const [y, row] of frame.entries()) {
    for (const [x, c] of row.entries()) {
      const angle = (Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * 180) / Math.PI;
      if (c === A_RING && Math.abs(angle + 120) <= g.glint) {
        row[x] = A_GLINT;
      }
    }
  }
  glow(frame, GLOW[speaking]!, g.rings);
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
