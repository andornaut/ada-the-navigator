// Whale models (art/friendly-redesign.md): one humpback at four lengths, as connected solids in
// mesh space (forward +x, port +y, up +z) in display px. A model is built per heading and loop
// frame: its rounded parts split their tones on the light as the heading sees it, and the swim
// loop bends the tail stock and fluke.
import { glow, mat } from "./friendly-models.ts";
import type { Point } from "./projection.ts";
import { type Mesh, meshBall, meshExtrude, meshLoft, type Tones } from "./solid.ts";

export const WHALE_KINDS = ["whale", "adult", "calf", "youngCalf"] as const;
export type WhaleKind = (typeof WHALE_KINDS)[number];
export const WHALE_LOOP_FRAMES = 8;

type Palette = { hull: Tones; throat: Tones; fin: Tones; glow: Tones; eye: Tones };
const INK: Tones = ["#181425", "#181425", "#181425"];
const WHALE: Palette = {
  hull: mat("#aaa5e6", "#7f78c2", "#544d91"),
  throat: mat("#e6e0f8", "#c9c0e8", "#9a90c4"),
  fin: mat("#9d97dd", "#746db8", "#4c4585"),
  glow: glow("#f7f2ff"),
  eye: INK,
};
const CALF: Palette = {
  hull: mat("#bfbaef", "#958ecc", "#6b64a6"),
  throat: mat("#eeeafb", "#d6cfef", "#a9a0ce"),
  fin: mat("#afa9e6", "#827bc0", "#504a87"),
  glow: glow("#fbf8ff"),
  eye: INK,
};

type Shape = {
  title: string;
  // Length in display px.
  length: number;
  // Stations of the spots along the back, as shares of the length, in pairs or in one row.
  spots: readonly number[];
  pairs: boolean;
  palette: Palette;
  // The head's and the eye's size against the adult's.
  head: number;
  eye: number;
};
export const WHALES: Readonly<Record<WhaleKind, Shape>> = {
  whale: {
    title: "Marlo",
    length: 100,
    spots: [0.26, 0.12, -0.02],
    pairs: true,
    palette: WHALE,
    head: 1,
    eye: 1,
  },
  adult: {
    title: "Whale family adult",
    length: 79,
    spots: [0.3, 0.2, 0.1, 0, -0.1],
    pairs: false,
    palette: WHALE,
    head: 1,
    eye: 1,
  },
  calf: {
    title: "Calf",
    length: 43,
    spots: [0.24, 0.06],
    pairs: true,
    palette: CALF,
    head: 1.12,
    eye: 1.35,
  },
  youngCalf: {
    title: "Young calf",
    length: 36,
    spots: [0.28, 0.14, 0],
    pairs: false,
    palette: CALF,
    head: 1.12,
    eye: 1.35,
  },
};

// The swim loop, in shares of the length. The body ahead of `PIVOT` stays stiff, so its tones
// hold still, and heaves a little against the tail. From `PIVOT` aft to `ROOT` the rear body and
// tail stock bend up and down as a wave that travels aft, so the stock leads and the fluke
// follows. Aft of `ROOT` the stock's end and the fluke turn as one stiff piece about the root,
// along the stock's slope there plus a pitch that lags the stock.
const PIVOT = -0.06;
const ROOT = -0.38;
const STOCK_LIFT = 0.035;
const WAVE_LAG = 0.9;
const FLUKE_PITCH = 0.15;
const FLUKE_LAG = 1;
const HEAVE = 0.01;

// How far the spine at station `x` rises at loop phase `phase`, for stations ahead of `ROOT`.
function lift(x: number, phase: number): number {
  const heave = -HEAVE * Math.sin(phase);
  if (x >= PIVOT) return heave;
  const s = (PIVOT - x) / (PIVOT - ROOT);
  return heave + STOCK_LIFT * s * s * Math.sin(phase - WAVE_LAG * s);
}

// The angle the fluke's aft end rises by at `phase`.
function flukeAngle(phase: number): number {
  const step = 1e-4;
  const slope = (lift(ROOT + step, phase) - lift(ROOT, phase)) / step;
  return Math.atan(-slope) + FLUKE_PITCH * Math.sin(phase - WAVE_LAG - FLUKE_LAG);
}

// Where the loop takes a point at station `x` and height `z`.
function swim(x: number, z: number, phase: number): readonly [number, number] {
  if (x >= ROOT) return [x, z + lift(x, phase)];
  const a = flukeAngle(phase);
  const [dx, c, s] = [x - ROOT, Math.cos(a), Math.sin(a)];
  return [ROOT + dx * c + z * s, -dx * s + z * c + lift(ROOT, phase)];
}

// An elliptical section at station `l`: half width, half height and centre height.
type Ring = readonly [l: number, half: number, rise: number, centre: number];
const ellipse = ([l, half, rise, centre]: Ring, sides: number): Point[] =>
  Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.5)) / sides;
    return [l, half * Math.cos(a), centre + rise * Math.sin(a)];
  });

// The half plan of the fluke from the root to the notch, and the flipper's plan, as shares of
// the length: forward and port.
const FLUKE = [
  [-0.38, 0],
  [-0.41, 0.06],
  [-0.455, 0.125],
  [-0.52, 0.175],
  [-0.555, 0.185],
  [-0.525, 0.11],
  [-0.5, 0.045],
  [-0.485, 0],
] as const;
const FLIPPER = [
  [0.24, 0.1],
  [0.2, 0.19],
  [0.12, 0.25],
  [0.02, 0.275],
  [-0.07, 0.262],
  [-0.03, 0.225],
  [0.05, 0.19],
  [0.1, 0.1],
] as const;
const FLIPPER_STATION = 0.1;
const SLAB = 0.04;

// A whale at loop frame `frame` of `WHALE_LOOP_FRAMES`, or at rest without one. `light` is the
// light in mesh space.
export function whale(kind: WhaleKind, light: Point, frame?: number): Mesh {
  const { length: L, spots, pairs, palette, head: h, eye } = WHALES[kind];
  const phase = frame === undefined ? undefined : (2 * Math.PI * frame) / WHALE_LOOP_FRAMES;
  const at = (x: number, z: number) =>
    phase === undefined ? ([x, z] as const) : swim(x, z, phase);
  const rise = (x: number) => at(x, 0)[1];
  const mesh: Mesh = [];
  const stations: Ring[] = [
    [-0.47, 0.02, 0.022, 0],
    [-0.38, 0.032, 0.04, 0],
    [-0.24, 0.062, 0.078, -0.004],
    [-0.06, 0.112, 0.118, -0.008],
    [0.14, 0.142, 0.13, -0.01],
    [0.32, 0.146 * h, 0.124 * h, -0.012],
    [0.43, 0.126 * h, 0.104 * h, -0.016],
    [0.49, 0.088 * h, 0.072 * h, -0.02],
    [0.52, 0.036 * h, 0.03 * h, -0.022],
  ];
  const ring = ([l, half, up, centre]: Ring): Point[] => {
    const [x, z] = at(l, centre);
    return ellipse([x * L, half * L, up * L, z * L], 12);
  };
  // The rounded body, and the pale jaw along the lower head.
  meshLoft(mesh, stations.map(ring), palette.hull);
  meshLoft(
    mesh,
    stations
      .slice(3)
      .map(([l, half, up, centre]) => ring([l, half * 1.035, up * 0.6, centre - up * 0.5])),
    palette.throat,
  );
  const ball = (centre: Point, radii: Point, tones: Tones, sides: number, bands: number) =>
    meshBall(
      mesh,
      [centre[0] * L, centre[1] * L, (centre[2] + rise(centre[0])) * L],
      [radii[0] * L, radii[1] * L, radii[2] * L],
      tones,
      { sides, bands, light },
    );
  // The low back hump.
  ball([-0.14, 0, 0.088], [0.07, 0.03, 0.035], palette.fin, 12, 8);
  // The notched fluke: one horizontal slab, turned with the end of the stock.
  const fluke = [
    ...FLUKE,
    ...FLUKE.toReversed()
      .filter(([, w]) => w > 1e-9)
      .map(([l, w]) => [l, -w] as const),
  ];
  const corner = (l: number, w: number, z: number): Point => {
    const [x, up] = at(l, z);
    return [x * L, w * L, up * L];
  };
  const [low, high] = [corner(ROOT, 0, -0.02), corner(ROOT, 0, -0.02 + SLAB)];
  meshExtrude(
    mesh,
    fluke.map(([l, w]) => corner(l, w, -0.02)),
    [high[0] - low[0], high[1] - low[1], high[2] - low[2]],
    palette.fin,
  );
  // The flippers, curved and swept back along the flanks, and the eyes.
  for (const side of [1, -1]) {
    meshExtrude(
      mesh,
      FLIPPER.map(([l, w]): Point => [l * L, side * w * L, (-0.1 + rise(FLIPPER_STATION)) * L]),
      [0, 0, SLAB * L],
      palette.fin,
    );
    const r = 0.014 * eye;
    ball([0.39, side * 0.136 * h, -0.012], [r, r, r], palette.eye, 8, 6);
  }
  // The spots: one ordered run of lamps along the back.
  for (const x of spots) {
    for (const y of pairs ? [-0.04, 0.04] : [0]) {
      const z = 0.118 * (x > 0.2 ? h : 1) - (x < 0.05 ? 0.014 : 0);
      ball([x, y, z], [0.026, 0.022, 0.012], palette.glow, 10, 6);
    }
  }
  return mesh;
}
