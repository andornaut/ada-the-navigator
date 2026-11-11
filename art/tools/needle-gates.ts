// Needle's ring gates: an upright hoop with its axis along the channel, dark and lit, in eight
// orientations, each split into a back layer (under a passing ship) and a front layer (over it),
// with gates.json for the runtime. Contract: art/needle.md (Ring gates).
// Usage: node art/tools/needle-gates.ts
import { mkdirSync, writeFileSync } from "node:fs";

import { unit } from "./debris.ts";
import { linkData, replaceEntries } from "./manifest.ts";
import {
  edgeContrast,
  lamp,
  lift,
  OUT,
  type Polygon,
  PUBLIC,
  screenAxis,
  squareFrame,
  svgFile,
} from "./needle-common.ts";
import { depth, facesViewer, json, type Point, projectAt, round } from "./projection.ts";
import { DISPLAY_SCALE } from "./solid.ts";

// Model units (world units at display scale): the opening Gameplay counts a pass through, the
// rim's outer radius and its depth along the axis.
export const OPENING = 66;
const R_IN = OPENING / 2;
const R_OUT = 40;
const AXIAL = 7;
const SEGMENTS = 32;
const LAMP_EVERY = 4;
export const ORIENTATIONS = 8;
// Gates sit at least this far off screen horizontal (Gameplay).
const MIN_SCREEN_ANGLE = 30;
// Edge floors at display size on the field.
const LIT_FLOOR = 3;
const DARK_FLOOR = 3;

const LIT = ["#F3EDE6", "#DED5CC", "#C4BAB0", "#A69C93", "#8A8178"];
// The dark ramp before its lift: a dimmed silver; lifted in Oklab L until its edge clears 3:1.
const DARK_BASE = ["#A0988F", "#8B837B", "#766F68", "#625C56", "#524C47"];
const LAMP_DARK = "#4d4640";
const VEIL_ALPHA = 0.16;

// World light and tone steps of the shared debris shading.
const LIGHT = unit([-0.25, 0.45, 1]);
const STEPS = [0.9, 0.7, 0.45, 0.15];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normal(points: readonly Point[]): Point {
  let [nx, ny, nz] = [0, 0, 0];
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

const tone = (ramp: readonly string[], face: readonly Point[]) => {
  const i = STEPS.findIndex((s) => dot(unit(normal(face)), LIGHT) >= s);
  return ramp[i < 0 ? ramp.length - 1 : i]!;
};

type Layer = "back" | "front";
type Quad = {
  points: Point[];
  color?: string;
  ramp?: readonly string[];
  layer: Layer;
  veil?: true;
};

// The hoop's plan axis for orientation o: o * 22.5 degrees in the art's model plane.
const axisAngle = (o: number) => (o * Math.PI) / ORIENTATIONS;

// Hoop quads for orientation `o`. A quad is in the front layer when its centre lies toward the
// viewer at +(1, 1, 1) from the hoop's centre, else in the back layer.
function hoop(o: number, lit: boolean, dark: readonly string[]): Quad[] {
  const t = axisAngle(o);
  const ax: Point = [Math.cos(t), Math.sin(t), 0];
  const across: Point = [-Math.sin(t), Math.cos(t), 0];
  const ramp = lit ? LIT : dark;
  const p = (r: number, a: number, d: number): Point => [
    r * Math.cos(a) * across[0] + d * ax[0],
    r * Math.cos(a) * across[1] + d * ax[1],
    r * Math.sin(a) + d * ax[2],
  ];
  const side = (pts: readonly Point[]): Layer => {
    const c = pts.reduce<Point>((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]);
    return dot(c, [1, 1, 1]) > 0 ? "front" : "back";
  };
  const box = (r0: number, r1: number, a0: number, a1: number, d0: number, d1: number) => {
    const c = [
      p(r0, a0, d0),
      p(r1, a0, d0),
      p(r1, a1, d0),
      p(r0, a1, d0),
      p(r0, a0, d1),
      p(r1, a0, d1),
      p(r1, a1, d1),
      p(r0, a1, d1),
    ] as const;
    return { c, layer: side(c) };
  };
  const quads: Quad[] = [];
  const h = AXIAL / 2;
  for (let i = 0; i < SEGMENTS; i++) {
    const [a0, a1] = [(2 * Math.PI * i) / SEGMENTS, (2 * Math.PI * (i + 1)) / SEGMENTS];
    const { c, layer } = box(R_IN, R_OUT, a0, a1, -h, h);
    for (const face of [
      [c[4], c[5], c[6], c[7]],
      [c[3], c[2], c[1], c[0]],
      [c[1], c[2], c[6], c[5]],
      [c[3], c[0], c[4], c[7]],
    ]) {
      quads.push({ points: [...face], ramp, layer });
    }
    // Eight lamps: studs on both axial faces at every fourth segment.
    if (i % LAMP_EVERY === 0) {
      const am = (a0 + a1) / 2;
      for (const s of [-1, 1]) {
        const stud = box(R_IN + 1.5, R_OUT - 1.5, am - 0.07, am + 0.07, s * h, s * (h + 1.6));
        const k = stud.c;
        for (const face of [
          [k[4], k[5], k[6], k[7]],
          [k[3], k[2], k[1], k[0]],
          [k[0], k[1], k[5], k[4]],
          [k[1], k[2], k[6], k[5]],
          [k[2], k[3], k[7], k[6]],
          [k[3], k[0], k[4], k[7]],
        ]) {
          quads.push({ points: [...face], color: lit ? lamp : LAMP_DARK, layer: stud.layer });
        }
      }
    }
  }
  if (lit) {
    // A warm veil across the opening in the hoop's plane, under the ship.
    const veil = Array.from({ length: SEGMENTS }, (_, i) =>
      p(R_IN, (2 * Math.PI * i) / SEGMENTS, 0),
    );
    quads.push({ points: veil, color: lamp, layer: "back", veil: true });
  }
  return quads;
}

function draw(quads: readonly Quad[], centre: number, layer?: Layer): Polygon[] {
  return quads
    .filter((q) => (layer === undefined || q.layer === layer) && (q.veil || facesViewer(q.points)))
    .toSorted((a, b) => (a.veil ? -1 : b.veil ? 1 : depth(b.points) - depth(a.points)))
    .map((q) => ({
      color: q.color ?? tone(q.ramp!, q.points),
      points: q.points.map((pt) => projectAt(centre, centre, pt)),
      ...(q.veil ? { opacity: VEIL_ALPHA } : {}),
    }));
}

// Orientation o's screen axis and how open the hoop reads: |axis . view| over the unit view
// (1, 1, 1); 0 is edge-on.
const screenAngle = (o: number) => {
  const [x, y] = screenAxis(axisAngle(o));
  return (Math.atan2(y, x) * 180) / Math.PI;
};
const openness = (o: number) =>
  round(Math.abs(Math.cos(axisAngle(o)) + Math.sin(axisAngle(o))) / Math.sqrt(3));
// Degrees off screen horizontal, 0 to 90.
const offHorizontal = (o: number) => {
  const a = Math.abs(screenAngle(o)) % 180;
  return round(Math.min(a, 180 - a));
};

// Orientations a gate can take: its channel tangent stays MIN_SCREEN_ANGLE off screen
// horizontal, so 5 to 7 (13.5 and 0 degrees off) are never drawn.
const USED = Array.from({ length: ORIENTATIONS }, (_, o) => o).filter(
  (o) => offHorizontal(o) >= MIN_SCREEN_ANGLE,
);

const frame = squareFrame(
  USED.map((o) => hoop(o, true, DARK_BASE))
    .flat()
    .flatMap(({ points }) => points),
);
const centre = frame / 2;

// The least lift (0.01 steps) that puts every dark orientation's full silhouette over the floor.
const worst = (ramp: readonly string[], lit: boolean) =>
  Math.min(...USED.map((o) => edgeContrast(frame, frame, draw(hoop(o, lit, ramp), centre)).median));
let darkLift = 0;
while (worst(lift(DARK_BASE, darkLift), false) < DARK_FLOOR) {
  darkLift = round(darkLift + 0.01);
  if (darkLift > 0.3) throw new Error("dark gate cannot reach its edge floor");
}
const DARK = lift(DARK_BASE, darkLift);
const litEdge = worst(LIT, true);
if (litEdge < LIT_FLOOR) {
  throw new Error(`lit gate edge median ${litEdge.toFixed(2)} is under ${LIT_FLOOR}:1`);
}

mkdirSync(OUT, { recursive: true });
const entries: Record<string, unknown>[] = [];
for (const state of ["dark", "lit"] as const) {
  for (const o of USED) {
    const quads = hoop(o, state === "lit", DARK);
    for (const layer of ["back", "front"] as const) {
      const name = `gate-${state}-${o}-${layer}`;
      writeFileSync(
        `${OUT}${name}.svg`,
        svgFile(`Ring gate ${state} ${o} ${layer}`, frame, frame, draw(quads, centre, layer)),
      );
      entries.push({
        id: `needle-${name}`,
        path: `${PUBLIC}${name}.svg`,
        width: frame,
        height: frame,
        displayWidth: round(frame * DISPLAY_SCALE),
        displayHeight: round(frame * DISPLAY_SCALE),
        facing: `axis-${o}`,
        pivot: { x: 0.5, y: 0.5 },
        gate: state,
        orientation: o,
        layer,
      });
    }
  }
}

const data = {
  version: 1,
  frame,
  displayScale: DISPLAY_SCALE,
  opening: OPENING,
  rim: { inner: R_IN, outer: R_OUT, depth: AXIAL },
  minScreenAngle: MIN_SCREEN_ANGLE,
  layers: ["back", "front"],
  light: { fadeMs: 240, easing: "cubicOut" },
  orientations: USED.map((o) => ({
    index: o,
    axis: screenAxis(axisAngle(o)),
    open: openness(o),
    offHorizontal: offHorizontal(o),
    files: Object.fromEntries(
      (["dark", "lit"] as const).map((state) => [
        state,
        Object.fromEntries(
          (["back", "front"] as const).map((layer) => [
            layer,
            `needle-gate-${state}-${o}-${layer}`,
          ]),
        ),
      ]),
    ),
  })),
  colors: {
    lit: LIT,
    dark: DARK,
    lampLit: lamp,
    lampDark: LAMP_DARK,
    veil: { color: lamp, alpha: VEIL_ALPHA },
  },
};
writeFileSync(`${OUT}gates.json`, json(data));

replaceEntries("needle", (id) => id.startsWith("needle-gate-"), entries);
linkData("needle", { needleGates: `${PUBLIC}gates.json` });

console.log(
  `gate frame ${frame}; dark lift ${darkLift}; worst dark ${worst(DARK, false).toFixed(2)}, lit ${litEdge.toFixed(2)}`,
);
