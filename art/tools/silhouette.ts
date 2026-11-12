// Drawn silhouettes: a frame's drawn alpha as convex collision parts in frame px.
// Rasterize at SS cells per frame px (cell centres), trace the outer boundary along cell edges,
// simplify it by Douglas-Peucker (TOLERANCE by default), fill narrow notch tips, ear-clip the
// outline and merge the triangles into convex parts (Hertel-Mehlhorn). `check` fails unless every
// part is strictly convex, the parts' union matches the drawing with intersection over union
// MIN_IOU or more, and no boundary lies more than MAX_DISTANCE frame px from the drawing.
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

export type V2 = [number, number];

// A binary raster at SS cells per frame px.
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

export const SS = 4;
export const TOLERANCE = 0.75;
export const MIN_IOU = 0.98;
export const MAX_DISTANCE = 1;

export const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const cross = (o: V2, a: V2, b: V2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function segDist(p: V2, a: V2, b: V2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function area(poly: readonly V2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [poly[i]!, poly[(i + 1) % poly.length]!];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ rasters

// Fill polygons (frame px, nonzero winding, as SVG fills them) into a w by h frame px mask: a
// cell is filled when its centre is inside.
export function rasterize(polys: readonly (readonly V2[])[], w: number, h: number): Mask {
  const W = w * SS;
  const H = h * SS;
  const cells = new Uint8Array(W * H);
  for (const t of polys) {
    const ys = t.map((p) => p[1] * SS);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      const hits: { x: number; dir: number }[] = [];
      for (let i = 0; i < t.length; i++) {
        const [ax, ay] = [t[i]![0] * SS, t[i]![1] * SS];
        const [bx, by] = [t[(i + 1) % t.length]![0] * SS, t[(i + 1) % t.length]![1] * SS];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
          hits.push({ dir: by > ay ? 1 : -1, x: ax + ((cy - ay) / (by - ay)) * (bx - ax) });
        }
      }
      hits.sort((a, b) => a.x - b.x);
      let winding = 0;
      for (let i = 0; i < hits.length - 1; i++) {
        winding += hits[i]!.dir;
        if (!winding) continue;
        const [lo, hi] = [hits[i]!.x, hits[i + 1]!.x];
        for (
          let x = Math.max(0, Math.ceil(lo - 0.5));
          x <= Math.min(W - 1, Math.floor(hi - 0.5));
          x++
        ) {
          cells[y * W + x] = 1;
        }
      }
    }
  }
  return { cells, height: H, width: W };
}

// A decoded sprite's alpha at SS cells per frame px: a pixel is drawn at `threshold` or more.
// Its alpha already includes any outline, so it is never grown.
export function alphaMask(image: RgbaImage, threshold = 128): Mask {
  const W = image.width * SS;
  const H = image.height * SS;
  const cells = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = Math.floor(y / SS) * image.width + Math.floor(x / SS);
      if (image.data[px * 4 + 3]! >= threshold) cells[y * W + x] = 1;
    }
  return { cells, height: H, width: W };
}

// Grow a vector drawing's mask by its own stroke half-width (frame px), as a round stroke grows
// it: a cell fills when a drawn cell centre lies within the half-width of its centre. The
// nearest drawn cell to any outside cell is an edge cell, so only edge cells stamp the disc.
export function grow(mask: Mask, halfWidth: number): Mask {
  const { cells: src, height: H, width: W } = mask;
  const cells = src.slice();
  const r = halfWidth * SS;
  const R = Math.floor(r);
  const disc: [number, number][] = [];
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r) disc.push([dx, dy]);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x] === 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!at(x, y) || (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1))) continue;
      for (const [dx, dy] of disc) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) cells[ny * W + nx] = 1;
      }
    }
  return { cells, height: H, width: W };
}

export function union(a: Mask, b: Mask): Mask {
  return { ...a, cells: a.cells.map((v, i) => v | b.cells[i]!) };
}

// ------------------------------------------------------------------ outline

// The longest boundary loop along cell edges, in frame px, simplified at `tolerance` frame px.
// Holes and specks are dropped.
export function outline(mask: Mask, tolerance = TOLERANCE): V2[] {
  const { cells, height: H, width: W } = mask;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? cells[y * W + x]! : 0);
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
  return simplifyClosed(pts, tolerance);
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

// A notch narrower than NOTCH_ANGLE tapers into a hairline of background that a raster closes
// at a different depth from the drawing. Its tip, up to where the notch is NOTCH_WIDTH frame px
// wide, must be filled in the drawing (each returned tip triangle) and is cut from the outline,
// so both end at the same chord.
export const NOTCH_ANGLE = 30;
export const NOTCH_WIDTH = 0.6;

export function fillNotches(closed: readonly V2[]): { outline: V2[]; tips: V2[][] } {
  const sign = Math.sign(area(closed));
  const out: V2[] = [];
  const tips: V2[][] = [];
  for (const [i, v] of closed.entries()) {
    const a = closed[(i + closed.length - 1) % closed.length]!;
    const b = closed[(i + 1) % closed.length]!;
    const [la, lb] = [dist(a, v), dist(b, v)];
    const ua: V2 = [(a[0] - v[0]) / la, (a[1] - v[1]) / la];
    const ub: V2 = [(b[0] - v[0]) / lb, (b[1] - v[1]) / lb];
    const opening = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
    if (cross(a, v, b) * sign >= 0 || (opening * 180) / Math.PI >= NOTCH_ANGLE) {
      out.push(v);
      continue;
    }
    // Along each wall to the chord NOTCH_WIDTH wide, kept short of the neighbouring vertices.
    const s = Math.min(NOTCH_WIDTH / (2 * Math.sin(opening / 2)), la / 2, lb / 2);
    const pa: V2 = [v[0] + ua[0] * s, v[1] + ua[1] * s];
    const pb: V2 = [v[0] + ub[0] * s, v[1] + ub[1] * s];
    out.push(pa, pb);
    tips.push([pa, v, pb]);
  }
  return { outline: out, tips };
}

// ------------------------------------------------------------------ convex parts

// Ear-clip triangulation, then Hertel-Mehlhorn: drop each diagonal whose removal keeps both
// neighbours convex. At most four times the minimum number of convex parts.
export function convexParts(poly: V2[]): V2[][] {
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

// An outline's convex parts, rounded to 0.01 frame px.
export function parts(closed: V2[]): V2[][] {
  return convexParts(closed).map((part) => part.map(([x, y]) => [r2(x), r2(y)] as V2));
}

// A mask's outline with notch tips cut and its convex parts. The caller draws `tips` into the
// frame whenever there are any.
export function trace(
  mask: Mask,
  tolerance = TOLERANCE,
): { collision: V2[][]; outline: V2[]; tips: V2[][] } {
  const cut = fillNotches(outline(mask, tolerance));
  return { collision: parts(cut.outline), ...cut };
}

// ------------------------------------------------------------------ checks

// Strictly convex with one turn sign.
export function strictlyConvex(part: readonly V2[]): boolean {
  let sign = 0;
  for (let i = 0; i < part.length; i++) {
    const c = cross(part[i]!, part[(i + 1) % part.length]!, part[(i + 2) % part.length]!);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return part.length >= 3 && sign !== 0;
}

// The mask with enclosed background filled, as the traced outline drops holes.
function solid(mask: Mask): Mask {
  const { cells, height: H, width: W } = mask;
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * W + x;
    if (!cells[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const [x, y] = [i % W, Math.floor(i / W)];
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  return { ...mask, cells: outside.map((v) => 1 - v) };
}

// Frame px from cell (x, y) to the nearest cell of `b`, centre to centre.
function nearest(b: Mask, x: number, y: number): number {
  const r = 2 * MAX_DISTANCE * SS;
  let best = Infinity;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= b.width || ny >= b.height || !b.cells[ny * b.width + nx])
        continue;
      best = Math.min(best, Math.hypot(dx, dy));
    }
  if (best <= r) return best / SS;
  for (let j = 0; j < b.cells.length; j++)
    if (b.cells[j])
      best = Math.min(best, Math.hypot((j % b.width) - x, Math.floor(j / b.width) - y));
  return best / SS;
}

// Fail unless every part is strictly convex, the parts' union matches `drawn` (enclosed
// background filled) with intersection over union MIN_IOU or more, and every cell one has and
// the other lacks lies within MAX_DISTANCE frame px of the other.
export function check(
  id: string,
  collision: readonly V2[][],
  drawn: Mask,
): { iou: number; distance: number } {
  const bad = collision.findIndex((part) => !strictlyConvex(part));
  if (bad >= 0) throw new Error(`${id}: collision part ${bad} is not convex`);
  const d = solid(drawn);
  const u = rasterize(collision, d.width / SS, d.height / SS);
  let both = 0;
  let either = 0;
  let distance = 0;
  for (let i = 0; i < d.cells.length; i++) {
    const [a, b] = [d.cells[i]!, u.cells[i]!];
    if (a && b) both++;
    if (a || b) either++;
    if (a !== b) {
      const [x, y] = [i % d.width, Math.floor(i / d.width)];
      distance = Math.max(distance, nearest(a ? u : d, x, y));
    }
  }
  const iou = either ? both / either : 0;
  if (iou < MIN_IOU) throw new Error(`${id}: collision IoU ${iou.toFixed(4)} is below ${MIN_IOU}`);
  if (distance > MAX_DISTANCE)
    throw new Error(
      `${id}: collision boundary lies ${distance.toFixed(2)} frame px from the drawing`,
    );
  return { distance, iou };
}

// ------------------------------------------------------------------ vector fills

// One filled polygon as an SVG writes it, in frame px.
export type Fill = { color: string; points: V2[] };

// Whether a polygon covers a point, within `reach` of its edges.
function near(poly: readonly V2[], p: V2, reach: number): boolean {
  const sign = Math.sign(area(poly));
  return (
    poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) * sign >= 0) ||
    poly.some((a, i) => segDist(p, a, poly[(i + 1) % poly.length]!) <= reach)
  );
}

// The drawn silhouette of a width by height frame of fills, at the first of `tolerances` that
// passes `check`, and its notch tips. `halfWidth` is the fills' own stroke half-width, which
// grows the drawing. Each tip takes the colour of the topmost fill within NOTCH_WIDTH of its
// apex, stroke included, and rounds to 0.01 frame px. The frame draws the tips first, under the
// fills; the check covers the fills plus the tips.
export function traceFills(
  id: string,
  fills: readonly Fill[],
  [width, height]: readonly [number, number],
  tolerances: readonly number[],
  halfWidth = 0,
): { collision: V2[][]; tips: Fill[]; tolerance: number } {
  const mask = grow(
    rasterize(
      fills.map(({ points }) => points),
      width,
      height,
    ),
    halfWidth,
  );
  for (const [i, tolerance] of tolerances.entries()) {
    const { collision, tips } = trace(mask, tolerance);
    const drawn = tips.map((tip) => ({
      color:
        fills.findLast(({ points }) => near(points, tip[1]!, NOTCH_WIDTH + halfWidth))?.color ??
        fills[0]!.color,
      points: tip.map(([x, y]) => [Number(x.toFixed(2)), Number(y.toFixed(2))] as V2),
    }));
    try {
      check(
        id,
        collision,
        union(
          mask,
          rasterize(
            drawn.map(({ points }) => points),
            width,
            height,
          ),
        ),
      );
    } catch (error) {
      if (i === tolerances.length - 1) throw error;
      continue;
    }
    return { collision, tips: drawn, tolerance };
  }
  throw new Error(`${id}: no tolerance`);
}
