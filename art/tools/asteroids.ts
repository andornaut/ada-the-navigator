// Asteroids: seeded low-poly rocks in the shared solid-model projection, flat fills, no strokes
// beyond a same-colour seam. Writes one SVG per frame to public/art/asteroids/, asteroids.json
// (frame, display, pivot, drawn collision parts, world footprints, drift and spin data, backdrop
// tints), resource-rocks.json (the medium and large shapes with an ore crystal cluster) and
// links both from the root manifest.
// Usage: node art/tools/asteroids.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";
import { format, resolveConfig } from "prettier";

import { linkData } from "./manifest.ts";
import { ORE_RAMP } from "./ore.ts";
import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { depth, facesViewer, json, type Point, projectAt } from "./projection.ts";
import {
  area,
  check,
  convexParts,
  cross,
  grow,
  rasterize,
  segDist,
  strictlyConvex,
  trace,
  union,
  type V2,
} from "./silhouette.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const svgDir = `${art}asteroids/`;
mkdirSync(svgDir, { recursive: true });

// Display px per frame px, as for Ada's ship (96 frame px at 42 display px).
const DISPLAY = 0.4375;
// World light, from above and screen-left of the viewer (ship.ts LIGHT).
const LIGHT = unit([-0.25, 0.45, 1]);

// Play-object stone ramp, lit to shadow: one warm neutral hue at low chroma in every galaxy, so
// asteroids read as solid matter, never as the coral hazard/enemy signal or as tinted field.
const STONE_HUE = 70;
const STONE_CHROMA = 0.016;
const STONE_L = [0.61, 0.545, 0.48, 0.42, 0.365] as const;
const STONE = STONE_L.map((L) => oklch(L, STONE_CHROMA, STONE_HUE));

// Backdrop rocks: greyscale, white tops and BACKDROP_SIDE sides, multiplied at runtime by the
// galaxy's backdropLit colour (Phaser setTint), so side = backdropLit * BACKDROP_SIDE exactly.
const BACKDROP_SIDE = 0.8;
// Backdrop tint rule: the galaxy's environmentDetail lightness plus BACKDROP_LIFT, at the galaxy
// hue with BACKDROP_CHROMA times the galaxy tint chroma. The base field keeps its own hue. A light
// galaxy's rocks sit below its background instead: its lightness minus BACKDROP_LIGHT_DROP, at
// the tint chroma and hue, so the darker sides read as the rock's shade.
const BACKDROP_LIFT = 0.035;
const BACKDROP_CHROMA = 1.5;
const BACKDROP_LIGHT_DROP = 0.045;
// Backdrop rocks stay field: backdropLit on the galaxy background stays below this contrast.
const BACKDROP_MAX_CONTRAST = 1.8;

type SizeClass = "small" | "medium" | "large" | "huge";

interface ClassSpec {
  vertices: [number, number];
  height: number; // model height / radius
  notches: [number, number]; // concave bays
  notchDepth: number; // bay radius factor
  peaks: number; // crown ridge peaks
  drift: { eligible: boolean; speed: [number, number] }; // logical px per second
  spin: { frames: number; degPerSecond: [number, number] } | null;
}

const CLASSES: Record<SizeClass, ClassSpec> = {
  small: {
    vertices: [7, 9],
    height: 0.72,
    notches: [0, 1],
    notchDepth: 0.6,
    peaks: 1,
    drift: { eligible: true, speed: [14, 32] },
    spin: { frames: 24, degPerSecond: [8, 18] },
  },
  medium: {
    vertices: [9, 12],
    height: 0.72,
    notches: [1, 1],
    notchDepth: 0.6,
    peaks: 2,
    drift: { eligible: true, speed: [8, 20] },
    spin: { frames: 24, degPerSecond: [4, 10] },
  },
  large: {
    vertices: [12, 15],
    height: 0.6,
    notches: [1, 2],
    notchDepth: 0.62,
    peaks: 2,
    drift: { eligible: false, speed: [0, 0] },
    spin: null,
  },
  huge: {
    vertices: [15, 20],
    height: 0.5,
    notches: [1, 2],
    notchDepth: 0.68,
    peaks: 3,
    drift: { eligible: false, speed: [0, 0] },
    spin: null,
  },
};

// Frame 0 silhouette width in display px; the generator scales each model to hit it. The widths
// put each footprint radius inside its class's world range (small 12 to 18, medium 24 to 34,
// large 52 to 70, huge 84 to 104) and keep each class's footprint radius order.
const SHAPES: readonly {
  id: string;
  size: SizeClass;
  width: number;
  seed: number;
  aspect: number;
}[] = [
  { id: "asteroid-s1", size: "small", width: 40, seed: 11, aspect: 1.15 },
  { id: "asteroid-s2", size: "small", width: 26.71, seed: 23, aspect: 1.45 },
  { id: "asteroid-s3", size: "small", width: 39.86, seed: 37, aspect: 1.0 },
  { id: "asteroid-s4", size: "small", width: 50, seed: 41, aspect: 1.3 },
  { id: "asteroid-m1", size: "medium", width: 84, seed: 53, aspect: 1.2 },
  { id: "asteroid-m2", size: "medium", width: 76.94, seed: 67, aspect: 1.6 },
  { id: "asteroid-m3", size: "medium", width: 79.11, seed: 71, aspect: 1.1 },
  { id: "asteroid-m4", size: "medium", width: 57.12, seed: 83, aspect: 1.4 },
  { id: "asteroid-l1", size: "large", width: 135.34, seed: 97, aspect: 1.35 },
  { id: "asteroid-l2", size: "large", width: 151.27, seed: 101, aspect: 1.7 },
  { id: "asteroid-l3", size: "large", width: 167.19, seed: 113, aspect: 1.15 },
  { id: "asteroid-h1", size: "huge", width: 260, seed: 127, aspect: 1.5 },
  { id: "asteroid-h2", size: "huge", width: 233.29, seed: 131, aspect: 1.25 },
  { id: "asteroid-h3", size: "huge", width: 258.36, seed: 139, aspect: 1.8 },
];

// Backdrop rocks reuse the medium model rules at backdrop widths.
const BACKDROP: readonly { id: string; width: number; seed: number; aspect: number }[] = [
  { id: "backdrop-1", width: 30, seed: 211, aspect: 1.3 },
  { id: "backdrop-2", width: 46, seed: 223, aspect: 1.6 },
  { id: "backdrop-3", width: 64, seed: 227, aspect: 1.2 },
  { id: "backdrop-4", width: 90, seed: 229, aspect: 1.5 },
];

// Resource rocks: every medium and large shape (same seed, aspect and width, so the same base
// ring and footprints) with an ore crystal cluster on the crown.
const RESOURCES = SHAPES.filter(({ size }) => size === "medium" || size === "large").map(
  (shape) => ({ ...shape, id: shape.id.replace("asteroid-", "resource-"), shape: shape.id }),
);

// ------------------------------------------------------------------ maths

function unit([x, y, z]: Point): Point {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normal(points: readonly Point[]): Point {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

function oklch(L: number, C: number, h: number): string {
  const r = (h * Math.PI) / 180;
  return hex(fromOklab(L, C * Math.cos(r), C * Math.sin(r))).toUpperCase();
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ model

type Face = Point[];

// A star-shaped plan, extruded through a tapered base, a full girth, an inset shoulder and a
// faceted crown: every face is a triangle, so each facet takes one flat tone. `base` is the ring
// on the world plane (z = 0) that the rock stands on.
function rockModel(
  spec: ClassSpec,
  seed: number,
  aspect: number,
): { base: Point[]; faces: Face[] } {
  const rnd = mulberry(seed);
  const range = ([a, b]: [number, number]) => a + Math.floor(rnd() * (b - a + 1));
  const n = range(spec.vertices);
  const phase = [rnd() * 6.283, rnd() * 6.283, rnd() * 6.283];
  const notchAt = new Set<number>();
  const notches = range(spec.notches);
  while (notchAt.size < notches) notchAt.add(Math.floor(rnd() * n));
  const turn = rnd() * Math.PI;
  const plan: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + (rnd() - 0.5) * 0.55) / n) * Math.PI * 2;
    let r =
      1 +
      0.14 * Math.sin(2 * t + phase[0]!) +
      0.08 * Math.sin(3 * t + phase[1]!) +
      0.05 * Math.sin(5 * t + phase[2]!);
    r *= 0.86 + rnd() * 0.24;
    if (notchAt.has(i)) r *= spec.notchDepth + rnd() * 0.12;
    const x = Math.cos(t) * r * Math.sqrt(aspect);
    const y = (Math.sin(t) * r) / Math.sqrt(aspect);
    plan.push([x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)]);
  }
  const h = spec.height;
  const ring = (scale: number, z: number, jitter: number): Point[] =>
    plan.map(([x, y]) => {
      const k = scale * (1 + (rnd() - 0.5) * jitter);
      return [x * k, y * k, z * (1 + (rnd() - 0.5) * 0.35)];
    });
  const rings = [ring(0.74, 0.0001, 0.1), ring(1, h * 0.42, 0.06), ring(0.7, h * 0.82, 0.16)];
  const big = spec.vertices[0] >= 12;
  if (big) rings.push(ring(0.36, h * 0.97, 0.3));
  for (const p of rings[0]!) p[2] = 0;
  // Crown: one to three peaks on a ridge along the plan's long axis, so large rocks get a
  // ridgeline instead of a radial star. Each top vertex joins its nearest peak along the axis.
  const peaks = spec.peaks;
  const axis: [number, number] = [Math.cos(turn), Math.sin(turn)];
  const along = (p: Point) => p[0] * axis[0] + p[1] * axis[1];
  const top = rings.at(-1)!;
  const span = Math.max(...top.map(along)) - Math.min(...top.map(along));
  const apexes: Point[] = Array.from({ length: peaks }, (_, k) => {
    const t = peaks === 1 ? 0 : (k / (peaks - 1) - 0.5) * span * 0.55;
    const off = (rnd() - 0.5) * 0.18;
    return [axis[0] * t - axis[1] * off, axis[1] * t + axis[0] * off, h * (0.98 + rnd() * 0.16)];
  });
  const nearest = (p: Point) =>
    apexes.reduce(
      (b, a, k) => (Math.abs(along(a) - along(p)) < Math.abs(along(apexes[b]!) - along(p)) ? k : b),
      0,
    );
  const faces: Face[] = [];
  for (let r = 0; r + 1 < rings.length; r++) {
    const a = rings[r]!;
    const b = rings[r + 1]!;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // Alternate the quad diagonal so neighbouring facets do not all lean one way.
      if ((i + r) % 2) {
        faces.push([a[i]!, a[j]!, b[j]!], [a[i]!, b[j]!, b[i]!]);
      } else {
        faces.push([a[i]!, a[j]!, b[i]!], [a[j]!, b[j]!, b[i]!]);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ki, kj] = [nearest(top[i]!), nearest(top[j]!)];
    faces.push([top[i]!, top[j]!, apexes[kj]!]);
    if (ki !== kj) faces.push([top[i]!, apexes[kj]!, apexes[ki]!]);
  }
  // The plan runs counterclockwise and every face is listed lower-ring-first in plan order, so
  // each one is already wound outward; concave bays need no per-face test.
  return { base: rings[0]!, faces };
}

function yawed(faces: readonly Face[], yaw: number, scale: number): Face[] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return faces.map((f) =>
    f.map(([x, y, z]) => [(x * c - y * s) * scale, (x * s + y * c) * scale, z * scale] as Point),
  );
}

// ------------------------------------------------------------------ resource inset

// A facet with the ramp its tones come from.
type Painted = { face: Face; ramp: readonly string[] };

const centroid = (f: Face): Point => {
  const n = f.length;
  return [
    f.reduce((s, p) => s + p[0], 0) / n,
    f.reduce((s, p) => s + p[1], 0) / n,
    f.reduce((s, p) => s + p[2], 0) / n,
  ];
};
const add = (a: Point, b: Point, k = 1): Point => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
const cross3 = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// A cluster of hexagonal ore crystals growing from the crown facets nearest the highest one, each
// tilted out along its facet's normal, so the silhouette changes as well as the colour. Compact
// seat facets under the cluster take the ore ramp's shadow tones; long slivers stay stone so no
// stripe runs down the flank. Crystals never lean down-screen past the rock. Model units, before
// the yaw and scale, so the cluster turns with the rock.
function crystals(
  faces: readonly Face[],
  spec: ClassSpec,
  seed: number,
  ore: readonly string[],
): Painted[] {
  const rnd = mulberry(seed * 13 + 5);
  const big = spec.vertices[0] >= 12;
  const count = big ? 5 : 3;
  const seat = [ore[2]!, ore[3]!, ore[4]!, ore[4]!, ore[4]!];
  const out: Painted[] = faces.map((face) => ({ face, ramp: STONE }));
  const tops = faces
    .map((face, i) => ({ c: centroid(face), face, i, n: unit(normal(face)) }))
    .filter(({ c, n }) => n[2] > 0.6 && c[2] > spec.height * 0.8)
    .sort((a, b) => b.c[2] - a.c[2]);
  const peak = tops[0]!.c;
  const reach = (c: Point) => Math.hypot(c[0] - peak[0], c[1] - peak[1]);
  const chosen = tops.toSorted((a, b) => reach(a.c) - reach(b.c)).slice(0, count);
  for (const { c, face, i, n } of chosen) {
    if (Math.min(...face.map((p) => p[2])) > spec.height * 0.62 && n[2] > 0.85 && c[2] > 0) {
      out[i]!.ramp = seat;
    }
  }
  chosen.forEach(({ c, n }, k) => {
    let [lx, ly] = [n[0] * 0.9 + (rnd() - 0.5) * 0.6, n[1] * 0.9 + (rnd() - 0.5) * 0.6];
    const lh = Math.hypot(lx, ly);
    if (lh > 0.55) [lx, ly] = [(lx * 0.55) / lh, (ly * 0.55) / lh];
    if (lx + ly > 0.35) [lx, ly] = [lx - (lx + ly - 0.35) / 2, ly - (lx + ly - 0.35) / 2];
    const lean = unit([lx, ly, 1]);
    const r = (big ? 0.06 : 0.085) * (0.8 + rnd() * 0.4) * (k === 0 ? 1.2 : 1);
    const length = (big ? 0.4 : 0.52) * (0.7 + rnd() * 0.45) * (k === 0 ? 1.3 : 1);
    const ref: Point = Math.abs(lean[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = unit(cross3(lean, ref));
    const v = cross3(lean, u);
    const base = add(c, lean, -0.04);
    // Each ring vertex draws once from the sequence, unused, so the approved cluster's later
    // crystals keep their sizes.
    const ring = (along: number, scale: number) =>
      Array.from({ length: 6 }, (_, i) => {
        rnd();
        const a = (i * Math.PI) / 3;
        return add(
          add(add(base, lean, along), u, Math.cos(a) * r * scale),
          v,
          Math.sin(a) * r * scale,
        );
      });
    const b0 = ring(0, 1);
    const t0 = ring(length * 0.68, 0.92);
    const tip = add(base, lean, length);
    const axisAt = (p: Point) =>
      add(base, lean, dot([p[0] - base[0], p[1] - base[1], p[2] - base[2]], lean));
    const outward = (f: Face): Face => {
      const fc = centroid(f);
      const o = axisAt(fc);
      return dot(normal(f), [fc[0] - o[0], fc[1] - o[1], fc[2] - o[2]]) >= 0 ? f : f.toReversed();
    };
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      out.push({ face: outward([b0[i]!, b0[j]!, t0[j]!, t0[i]!]), ramp: ore });
      out.push({ face: outward([t0[i]!, t0[j]!, tip]), ramp: ore });
    }
  });
  return out;
}

// ------------------------------------------------------------------ silhouette

function projected(faces: readonly Painted[], pivot: V2): (Painted & { pts: V2[] })[] {
  return faces
    .filter(({ face }) => facesViewer(face))
    .toSorted((a, b) => depth(b.face) - depth(a.face))
    .map((p) => ({ ...p, pts: p.face.map((q) => projectAt(pivot[0], pivot[1], q)) }));
}

function extent(faces: readonly Face[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of faces)
    for (const p of f) {
      const [x, y] = projectAt(0, 0, p);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return { maxX, maxY, minX, minY };
}

// Seam stroke width in frame px: hides anti-aliasing cracks between facets.
const SEAM = 1.2;

// Whether a convex polygon covers a point, within SEAM / 2 of its edges.
function covers(poly: readonly V2[], p: V2): boolean {
  const sign = Math.sign(area(poly));
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    return cross(a, b, p) * sign >= 0 || segDist(p, a, b) <= SEAM / 2;
  });
}

// ------------------------------------------------------------------ render

const r2 = (v: number) => Math.round(v * 100) / 100;
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

function tone(face: Face, ramp: readonly string[]): string {
  const l = dot(unit(normal(face)), LIGHT);
  // Lit facets spread over the upper tones; facets turned from the light take the deepest.
  const steps = [0.9, 0.78, 0.6, 0.3];
  const i = steps.findIndex((s) => l >= s);
  return ramp[i < 0 ? ramp.length - 1 : i]!;
}

// The viewBox is always frame px. `declared` is the SVG's intrinsic size: frame px for the plain
// and backdrop rocks, which Tech loads at `displayScale`, or display px for the resource rocks,
// which rasterize at the size they are drawn.
type Declared = "frame" | "display";

function svgFrame(
  title: string,
  w: number,
  h: number,
  polys: { pts: V2[]; fill: string }[],
  declared: Declared,
  tips: readonly { pts: V2[]; fill: string }[] = [],
) {
  const points = (pts: readonly V2[]) =>
    pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  // Notch tips sit under the facets with no seam, so they fill only the gap.
  const body = [
    ...tips.map(({ fill, pts }) => `  <polygon fill="${fill}" points="${points(pts)}"/>`),
    ...polys.map(
      ({ fill, pts }) =>
        `  <polygon fill="${fill}" stroke="${fill}" stroke-width="${SEAM}" stroke-linejoin="round" points="${points(pts)}"/>`,
    ),
  ].join("\n");
  const k = declared === "display" ? DISPLAY : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}">\n  <title>${title}</title>\n${body}\n</svg>\n`;
}

// World units from the pivot for a point on the art's world plane (model units at frame scale):
// the art projects it to display px as DISPLAY * ((x - y) sqrt(3) / 2, (x + y) / 2), and the
// game projects world (X, Y) to display px as (X - Y, (X + Y) / 2), so X and Y invert the latter.
function world([x, y]: Point): V2 {
  const sx = (DISPLAY * (x - y) * Math.sqrt(3)) / 2;
  const sy = (DISPLAY * (x + y)) / 2;
  return [sx / 2 + sy, sy - sx / 2];
}

// The base ring as convex parts in world units from the pivot, from the same posed model.
function footprint(id: string, base: readonly Point[]): V2[][] {
  const parts = convexParts(base.map(world)).map((part) =>
    part.map(([x, y]) => [r2(x), r2(y)] as V2),
  );
  if (!parts.every(strictlyConvex)) throw new Error(`${id} footprint part is not convex`);
  return parts;
}

interface Built {
  file: string;
  collision: V2[][];
  footprint: V2[][];
}

// `drawn` defaults to the model's facets in `ramp`; a resource rock passes its stone facets plus
// the crystal cluster. The scale always comes from the stone model, so a resource rock keeps its
// plain shape's size, base ring and footprints.
function build(
  id: string,
  { base, faces: model }: { base: Point[]; faces: Face[] },
  frames: number,
  widthDisplay: number,
  ramp: readonly string[],
  {
    drawn = model.map((face) => ({ face, ramp })),
    declared = "frame",
  }: { drawn?: readonly Painted[]; declared?: Declared } = {},
) {
  // Scale so frame 0's silhouette is the target width.
  const e0 = extent(model);
  const scale = widthDisplay / DISPLAY / (e0.maxX - e0.minX);
  const yaws = Array.from({ length: frames }, (_, k) => (k * 2 * Math.PI) / frames);
  const posed = yaws.map((y) => {
    const faces = yawed(
      drawn.map((p) => p.face),
      y,
      scale,
    );
    return faces.map((face, i): Painted => ({ face, ramp: drawn[i]!.ramp }));
  });
  const bases = yaws.map((y) => yawed([base], y, scale)[0]!);
  const bounds = posed
    .map((p) => extent(p.map(({ face }) => face)))
    .reduce((a, b) => ({
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
    }));
  const margin = 2;
  // Symmetric horizontal margins keep the pivot at the frame's horizontal centre.
  const half = Math.ceil(Math.max(-bounds.minX, bounds.maxX)) + margin;
  const w = half * 2;
  const top = Math.ceil(-bounds.minY) + margin;
  const h = top + Math.ceil(bounds.maxY) + margin;
  const pivot: V2 = [half, top];
  const built: Built[] = posed.map((faces, k) => {
    const polys = projected(faces, pivot);
    const file = frames > 1 ? `${id}-${k}.svg` : `${id}.svg`;
    const fills = polys.map(({ face, pts, ramp: own }) => ({ fill: tone(face, own), pts }));
    // The same-colour seam stroke grows the drawing by SEAM / 2.
    const drawn = grow(
      rasterize(
        polys.map((p) => p.pts),
        w,
        h,
      ),
      SEAM / 2,
    );
    const { collision, tips } = trace(drawn);
    // A tip takes the colour of the topmost facet over its apex.
    const filled = tips.map((pts) => ({
      fill: fills.findLast((f) => covers(f.pts, pts[1]!))?.fill ?? ramp.at(-1)!,
      pts: pts.map(([x, y]) => [r2(x), r2(y)] as V2),
    }));
    writeFileSync(`${svgDir}${file}`, svgFrame(`${id} ${k}`, w, h, fills, declared, filled));
    check(`${id} ${k}`, collision, union(drawn, rasterize(tips, w, h)));
    return { collision, file, footprint: footprint(`${id} ${k}`, bases[k]!) };
  });
  const footprintRadius = Math.max(
    ...bases.flatMap((ring) => ring.map((p) => Math.hypot(...world(p)))),
  );
  return { built, footprintRadius, h, pivot, w };
}

// ------------------------------------------------------------------ tint

const palette = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const galaxies = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  galaxies: Record<
    string,
    {
      tint: { lightness: number; chroma: number; hue: number; light?: boolean };
      colors: Record<string, string>;
    }
  >;
};

function backdropLit(
  field: Record<string, string>,
  { chroma, hue, light }: { chroma: number; hue: number; light?: boolean },
): string {
  if (light) {
    const [L] = toOklab(rgb(field.background!));
    return oklch(L - BACKDROP_LIGHT_DROP, chroma, hue);
  }
  const [L] = toOklab(rgb(field.environmentDetail!));
  return oklch(L + BACKDROP_LIFT, chroma * BACKDROP_CHROMA, hue);
}

function multiply(colour: string, k: number): string {
  const scaled = rgb(colour).map((c) => Math.round(c * k)) as unknown as [number, number, number];
  return hex(scaled).toUpperCase();
}

const [, ba, bb] = toOklab(rgb(palette.colors.environmentDetail!));
const baseTint = { chroma: Math.hypot(ba, bb), hue: (Math.atan2(bb, ba) * 180) / Math.PI };
const fields = [
  { id: "base", colors: palette.colors, tint: baseTint },
  ...Object.entries(galaxies.galaxies).map(([id, g]) => ({ id, colors: g.colors, tint: g.tint })),
].map(({ colors, id, tint }) => {
  const lit = backdropLit(colors, tint);
  return { colors, id, lit, side: multiply(lit, BACKDROP_SIDE) };
});
// Both tones stay field: on a light field the side is the darker, higher-contrast tone.
for (const { colors, id, lit, side } of fields) {
  for (const [name, colour] of [
    ["backdropLit", lit],
    ["backdropSide", side],
  ] as const) {
    const ratio = contrast(colors.background!.slice(1), colour.slice(1));
    if (ratio >= BACKDROP_MAX_CONTRAST) {
      throw new Error(
        `${name} on ${id} is ${ratio.toFixed(2)}:1, not below ${BACKDROP_MAX_CONTRAST}:1`,
      );
    }
  }
}
const tints = Object.fromEntries(
  fields.map(({ id, lit, side }) => [id, { backdropLit: lit, backdropSide: side }]),
);

// ------------------------------------------------------------------ main

// Ore ramp, lit to shadow (art/tools/ore.ts): resource rock crystals read as the same ore as the
// nugget a rock releases.
const ORE = ORE_RAMP;

function rock(
  shape: { id: string; size: SizeClass; width: number; seed: number; aspect: number },
  resource: boolean,
) {
  const spec = CLASSES[shape.size];
  const model = rockModel(spec, shape.seed, shape.aspect);
  const frames = spec.spin?.frames ?? 1;
  const { built, footprintRadius, h, pivot, w } = build(
    shape.id,
    model,
    frames,
    shape.width,
    STONE,
    resource ? { declared: "display", drawn: crystals(model.faces, spec, shape.seed, ORE) } : {},
  );
  return {
    id: shape.id,
    size: shape.size,
    frame: { width: w, height: h },
    display: { width: r2(w * DISPLAY), height: r2(h * DISPLAY) },
    pivot: [r5(pivot[0] / w), r5(pivot[1] / h)],
    footprintRadius: r2(footprintRadius),
    drift: spec.drift,
    spin: spec.spin ? { degPerSecond: spec.spin.degPerSecond } : false,
    frames: built.map((b) => ({
      file: `/art/asteroids/${b.file}`,
      collision: b.collision,
      footprint: b.footprint,
    })),
  };
}

const asteroids = SHAPES.map((shape) => rock(shape, false));

// A resource rock stands on its plain shape's base: the footprints must match exactly.
const resources = RESOURCES.map((shape) => {
  const entry = rock(shape, true);
  const plain = asteroids.find(({ id }) => id === shape.shape)!;
  const same =
    entry.footprintRadius === plain.footprintRadius &&
    entry.frames.every(
      (frame, k) => JSON.stringify(frame.footprint) === JSON.stringify(plain.frames[k]!.footprint),
    );
  if (!same) throw new Error(`${shape.id} footprints differ from ${shape.shape}`);
  return entry;
});

const white = "#FFFFFF";
const grey = [
  white,
  white,
  multiply(white, (1 + BACKDROP_SIDE) / 2),
  multiply(white, BACKDROP_SIDE),
  multiply(white, BACKDROP_SIDE),
];
const sprites = BACKDROP.map((b) => {
  const model = rockModel(CLASSES.medium, b.seed, b.aspect);
  const { h, pivot, w } = build(b.id, model, 1, b.width, grey);
  return {
    id: b.id,
    file: `/art/asteroids/${b.id}.svg`,
    frame: { width: w, height: h },
    display: { width: r2(w * DISPLAY), height: r2(h * DISPLAY) },
    pivot: [r5(pivot[0] / w), r5(pivot[1] / h)],
    tint: "backdropLit",
  };
});

const dataPath = `${art}asteroids.json`;
writeFileSync(
  dataPath,
  await format(
    json({
      version: 1,
      displayScale: DISPLAY,
      stone: STONE,
      asteroids,
      backdrop: {
        sideScale: BACKDROP_SIDE,
        rule: { lift: BACKDROP_LIFT, chromaScale: BACKDROP_CHROMA, lightDrop: BACKDROP_LIGHT_DROP },
        sprites,
      },
      tints,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

// Each `rocks[i]` has the `asteroids[i]` schema; `ore` is the crystals' ramp.
const resourcePath = `${art}resource-rocks.json`;
writeFileSync(
  resourcePath,
  await format(
    json({ version: 1, displayScale: DISPLAY, stone: STONE, ore: ORE, rocks: resources }),
    {
      ...(await resolveConfig(resourcePath)),
      filepath: resourcePath,
    },
  ),
);

// The root manifest names the asteroid and resource rock data next to the other data files.
linkData("core", { asteroids: "/art/asteroids.json", resourceRocks: "/art/resource-rocks.json" });
