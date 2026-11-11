// Asteroids: seeded low-poly rocks in the shared solid-model projection, flat fills, no strokes
// beyond a same-colour seam. Writes one SVG per frame to public/art/asteroids/, asteroids.json
// (frame, display, pivot, collision parts, drift and spin data, backdrop tints) and links the
// data from the root manifest.
// Usage: node art/tools/asteroids.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { contrast } from "@andornaut/art-kit/colour";
import { format, resolveConfig } from "prettier";

import { fromOklab, hex, rgb, toOklab } from "./oklab.ts";
import { depth, facesViewer, json, type Point, projectAt } from "./projection.ts";

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
// hue with BACKDROP_CHROMA times the galaxy tint chroma. The base field keeps its own hue.
const BACKDROP_LIFT = 0.035;
const BACKDROP_CHROMA = 1.5;
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
    drift: { eligible: true, speed: [4, 10] },
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

// Target silhouette width in display px; the generator scales each model to hit it.
const SHAPES: readonly {
  id: string;
  size: SizeClass;
  width: number;
  seed: number;
  aspect: number;
}[] = [
  { id: "asteroid-s1", size: "small", width: 40, seed: 11, aspect: 1.15 },
  { id: "asteroid-s2", size: "small", width: 46, seed: 23, aspect: 1.45 },
  { id: "asteroid-s3", size: "small", width: 36, seed: 37, aspect: 1.0 },
  { id: "asteroid-s4", size: "small", width: 50, seed: 41, aspect: 1.3 },
  { id: "asteroid-m1", size: "medium", width: 84, seed: 53, aspect: 1.2 },
  { id: "asteroid-m2", size: "medium", width: 100, seed: 67, aspect: 1.6 },
  { id: "asteroid-m3", size: "medium", width: 118, seed: 71, aspect: 1.1 },
  { id: "asteroid-m4", size: "medium", width: 92, seed: 83, aspect: 1.4 },
  { id: "asteroid-l1", size: "large", width: 170, seed: 97, aspect: 1.35 },
  { id: "asteroid-l2", size: "large", width: 190, seed: 101, aspect: 1.7 },
  { id: "asteroid-l3", size: "large", width: 210, seed: 113, aspect: 1.15 },
  { id: "asteroid-h1", size: "huge", width: 260, seed: 127, aspect: 1.5 },
  { id: "asteroid-h2", size: "huge", width: 330, seed: 131, aspect: 1.25 },
  { id: "asteroid-h3", size: "huge", width: 400, seed: 139, aspect: 1.8 },
];

// Backdrop rocks reuse the medium model rules at backdrop widths.
const BACKDROP: readonly { id: string; width: number; seed: number; aspect: number }[] = [
  { id: "backdrop-1", width: 30, seed: 211, aspect: 1.3 },
  { id: "backdrop-2", width: 46, seed: 223, aspect: 1.6 },
  { id: "backdrop-3", width: 64, seed: 227, aspect: 1.2 },
  { id: "backdrop-4", width: 90, seed: 229, aspect: 1.5 },
];

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
// faceted crown: every face is a triangle, so each facet takes one flat tone.
function rockModel(spec: ClassSpec, seed: number, aspect: number): Face[] {
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
  return faces;
}

function yawed(faces: readonly Face[], yaw: number, scale: number): Face[] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return faces.map((f) =>
    f.map(([x, y, z]) => [(x * c - y * s) * scale, (x * s + y * c) * scale, z * scale] as Point),
  );
}

// ------------------------------------------------------------------ silhouette

type V2 = [number, number];

function projected(faces: readonly Face[], pivot: V2): { pts: V2[]; face: Face }[] {
  return faces
    .filter((f) => facesViewer(f))
    .toSorted((a, b) => depth(b) - depth(a))
    .map((face) => ({ face, pts: face.map((p) => projectAt(pivot[0], pivot[1], p)) }));
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

// Fill triangles into a grid at SS cells per frame px (cell centres), then trace the outer
// boundary along cell edges, simplify it and split it into convex parts.
const SS = 4;
// Seam stroke width in frame px: hides anti-aliasing cracks between facets.
const SEAM = 1.2;

function silhouette(tris: readonly V2[][], w: number, h: number): V2[] {
  const W = w * SS;
  const H = h * SS;
  const grid = new Uint8Array(W * H);
  for (const t of tris) {
    const ys = t.map((p) => p[1] * SS);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < t.length; i++) {
        const [ax, ay] = [t[i]![0] * SS, t[i]![1] * SS];
        const [bx, by] = [t[(i + 1) % t.length]![0] * SS, t[(i + 1) % t.length]![1] * SS];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
          const x = ax + ((cy - ay) / (by - ay)) * (bx - ax);
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
      if (lo > hi) continue;
      for (
        let x = Math.max(0, Math.ceil(lo - 0.5));
        x <= Math.min(W - 1, Math.floor(hi - 0.5));
        x++
      ) {
        grid[y * W + x] = 1;
      }
    }
  }
  // The same-colour seam stroke (SEAM frame px) grows the drawing by SEAM / 2: grow the grid to
  // match, in 3x3 max passes of one cell each.
  for (let pass = 0; pass < Math.round((SEAM / 2) * SS); pass++) {
    const src = grid.slice();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (src[y * W + x]) continue;
        // Alternate square and cross neighbourhoods to approximate a round offset.
        const square = pass % 2 === 0;
        for (let dy = -1; dy <= 1 && !grid[y * W + x]; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!square && dx && dy) continue;
            const [nx, ny] = [x + dx, y + dy];
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && src[ny * W + nx]) {
              grid[y * W + x] = 1;
              break;
            }
          }
      }
  }
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y * W + x]! : 0);
  // Directed boundary edges with the filled cell on the left (y down): key = start corner.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (W + 1) + x;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = key(x0, y0);
    (next.get(k) ?? next.set(k, []).get(k)!).push(key(x1, y1));
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x + 1, y, x, y);
      if (!at(x, y + 1)) add(x, y + 1, x + 1, y + 1);
      if (!at(x - 1, y)) add(x, y, x, y + 1);
      if (!at(x + 1, y)) add(x + 1, y + 1, x + 1, y);
    }
  // The longest boundary loop is the outer outline; holes and specks are dropped.
  let best: number[] = [];
  const used = new Set<string>();
  for (const [start, ends] of next) {
    for (const first of ends) {
      if (used.has(`${start}>${first}`)) continue;
      const loop = [start];
      let a = start;
      let b = first;
      while (true) {
        used.add(`${a}>${b}`);
        if (b === start) break;
        loop.push(b);
        const options = next.get(b)!.filter((c) => !used.has(`${b}>${c}`));
        a = b;
        b = options[0]!;
      }
      if (loop.length > best.length) best = loop;
    }
  }
  const pts: V2[] = best.map((k) => [(k % (W + 1)) / SS, Math.floor(k / (W + 1)) / SS]);
  return simplifyClosed(pts, 0.75);
}

function simplifyClosed(pts: V2[], tol: number): V2[] {
  // Split at the point farthest from the first and Douglas-Peucker each half.
  let far = 0;
  for (let i = 0; i < pts.length; i++)
    if (dist(pts[0]!, pts[i]!) > dist(pts[0]!, pts[far]!)) far = i;
  const a = dp(pts.slice(0, far + 1), tol);
  const b = dp([...pts.slice(far), pts[0]!], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function dp(pts: V2[], tol: number): V2[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0]!, pts.at(-1)!];
  let idx = 0;
  let max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i]!, a, b);
    if (d > max) [max, idx] = [d, i];
  }
  if (max <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segDist(p: V2, a: V2, b: V2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

const cross = (o: V2, a: V2, b: V2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function area(poly: readonly V2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [poly[i]!, poly[(i + 1) % poly.length]!];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// Ear-clip triangulation, then Hertel-Mehlhorn: drop each diagonal whose removal keeps both
// neighbours convex. At most four times the minimum number of convex parts.
function convexParts(poly: V2[]): V2[][] {
  const P = area(poly) > 0 ? poly : poly.toReversed(); // y-down: positive = clockwise on screen
  const idx = P.map((_, i) => i);
  const tris: number[][] = [];
  const inside = (p: V2, a: V2, b: V2, c: V2) =>
    cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const [ia, ib, ic] = [
        idx[(i + idx.length - 1) % idx.length]!,
        idx[i]!,
        idx[(i + 1) % idx.length]!,
      ];
      const [a, b, c] = [P[ia]!, P[ib]!, P[ic]!];
      if (cross(a, b, c) <= 1e-9) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inside(P[j]!, a, b, c))) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) idx.splice(0, 1); // degenerate collinear vertex
  }
  tris.push([...idx]);
  let parts = tris.map((t) => [...t]);
  const convex = (ring: number[]) =>
    ring.every(
      (_, i) =>
        cross(P[ring[i]!]!, P[ring[(i + 1) % ring.length]!]!, P[ring[(i + 2) % ring.length]!]!) >=
        -1e-9,
    );
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let a = 0; a < parts.length; a++)
      for (let b = a + 1; b < parts.length; b++) {
        const A = parts[a]!;
        const B = parts[b]!;
        for (let i = 0; i < A.length; i++) {
          const [u, v] = [A[i]!, A[(i + 1) % A.length]!];
          const j = B.findIndex((x, k) => x === v && B[(k + 1) % B.length] === u);
          if (j < 0) continue;
          // Splice B into A along the shared edge u-v.
          const tail = [];
          for (let k = 2; k < B.length; k++) tail.push(B[(j + k) % B.length]!);
          const ring = [...A.slice(0, i + 1), ...tail, ...A.slice(i + 1)];
          if (!convex(ring)) continue;
          parts[a] = ring;
          parts.splice(b, 1);
          merged = true;
          break outer;
        }
      }
  }
  parts = parts.filter((r) => r.length >= 3);
  return parts.map((r) => r.map((i) => P[i]!));
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

function svgFrame(title: string, w: number, h: number, polys: { pts: V2[]; fill: string }[]) {
  const body = polys
    .map(({ fill, pts }) => {
      const points = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
      return `  <polygon fill="${fill}" stroke="${fill}" stroke-width="${SEAM}" stroke-linejoin="round" points="${points}"/>`;
    })
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <title>${title}</title>\n${body}\n</svg>\n`;
}

interface Built {
  file: string;
  collision: V2[][];
  outline: V2[];
}

function build(
  id: string,
  model: Face[],
  frames: number,
  widthDisplay: number,
  ramp: readonly string[],
) {
  // Scale so frame 0's silhouette is the target width.
  const e0 = extent(model);
  const scale = widthDisplay / DISPLAY / (e0.maxX - e0.minX);
  const yaws = Array.from({ length: frames }, (_, k) => (k * 2 * Math.PI) / frames);
  const posed = yaws.map((y) => yawed(model, y, scale));
  const bounds = posed.map(extent).reduce((a, b) => ({
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
    const fills = polys.map(({ face, pts }) => ({ fill: tone(face, ramp), pts }));
    writeFileSync(`${svgDir}${file}`, svgFrame(`${id} ${k}`, w, h, fills));
    const outline = silhouette(
      polys.map((p) => p.pts),
      w,
      h,
    );
    const collision = convexParts(outline).map((part) =>
      part.map(([x, y]) => [r2(x), r2(y)] as V2),
    );
    return { collision, file, outline };
  });
  const radius = Math.max(...built.flatMap((b) => b.outline.map((p) => dist(p, pivot))));
  return { built, h, pivot, radius, w };
}

// ------------------------------------------------------------------ tint

const palette = JSON.parse(readFileSync(`${art}space-palette.json`, "utf8")) as {
  colors: Record<string, string>;
};
const galaxies = JSON.parse(readFileSync(`${art}galaxies.json`, "utf8")) as {
  galaxies: {
    id: string;
    tint: { lightness: number; chroma: number; hue: number };
    colors: Record<string, string>;
  }[];
};

function backdropLit(field: Record<string, string>, chroma: number, hue: number): string {
  const [L] = toOklab(rgb(field.environmentDetail!));
  return oklch(L + BACKDROP_LIFT, chroma * BACKDROP_CHROMA, hue);
}

function multiply(colour: string, k: number): string {
  const scaled = rgb(colour).map((c) => Math.round(c * k)) as unknown as [number, number, number];
  return hex(scaled).toUpperCase();
}

const [, ba, bb] = toOklab(rgb(palette.colors.environmentDetail!));
const baseHue = (Math.atan2(bb, ba) * 180) / Math.PI;
const baseChroma = Math.hypot(ba, bb);
const fields = [
  { id: "base", colors: palette.colors, lit: backdropLit(palette.colors, baseChroma, baseHue) },
  ...galaxies.galaxies.map((g) => ({
    id: g.id,
    colors: g.colors,
    lit: backdropLit(g.colors, g.tint.chroma, g.tint.hue),
  })),
];
for (const { colors, id, lit } of fields) {
  const ratio = contrast(colors.background!.slice(1), lit.slice(1));
  if (ratio >= BACKDROP_MAX_CONTRAST) {
    throw new Error(
      `backdropLit on ${id} is ${ratio.toFixed(2)}:1, not below ${BACKDROP_MAX_CONTRAST}:1`,
    );
  }
}
const tints = Object.fromEntries(
  fields.map(({ id, lit }) => [
    id,
    { backdropLit: lit, backdropSide: multiply(lit, BACKDROP_SIDE) },
  ]),
);

// ------------------------------------------------------------------ main

const asteroids = SHAPES.map((shape) => {
  const spec = CLASSES[shape.size];
  const model = rockModel(spec, shape.seed, shape.aspect);
  const frames = spec.spin?.frames ?? 1;
  const { built, h, pivot, radius, w } = build(shape.id, model, frames, shape.width, STONE);
  return {
    id: shape.id,
    size: shape.size,
    frame: { width: w, height: h },
    display: { width: r2(w * DISPLAY), height: r2(h * DISPLAY) },
    pivot: [r5(pivot[0] / w), r5(pivot[1] / h)],
    radius: r2(radius),
    drift: spec.drift,
    spin: spec.spin ? { degPerSecond: spec.spin.degPerSecond } : false,
    frames: built.map((b) => ({ file: `/art/asteroids/${b.file}`, collision: b.collision })),
  };
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
        rule: { lift: BACKDROP_LIFT, chromaScale: BACKDROP_CHROMA },
        sprites,
      },
      tints,
    }),
    { ...(await resolveConfig(dataPath)), filepath: dataPath },
  ),
);

// The root manifest names the asteroid data next to the other data files.
const manifestPath = `${art}manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
if (manifest.asteroids !== "/art/asteroids.json") {
  manifest.asteroids = "/art/asteroids.json";
  writeFileSync(manifestPath, json(manifest));
}
