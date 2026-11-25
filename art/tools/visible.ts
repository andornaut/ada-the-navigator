// Depth-resolved drawing of a mesh (art/tools/solid.ts): each face keeps only the part no nearer
// face covers, resolved face against face with exact planar depth, and the visible fragments
// merge into outlines per flat tone.
import { type Point, projectAt } from "./projection.ts";
import type { FaceKind, Mesh, Tones } from "./solid.ts";

export type V2 = [number, number];
// A visible convex piece of one face, in screen px from the pivot. `slot` is the index of the
// face's tone in its material and `tones` that material.
export type Fragment = { points: V2[]; tones: Tones; slot: 0 | 1 | 2; group?: number };

// The one light, from the upper left, in view space.
const LIGHT = (() => {
  const light = [-0.2, 0.5, 0.84] as const;
  const length = Math.hypot(...light);
  return light.map((v) => v / length) as unknown as Point;
})();
// A face turned less than this toward the viewer at +(1, 1, 1) is not drawn.
const FACING = 0.05;
const DEPTH = 1e-5;
const AREA = 1e-7;

// The tone slot of a face from its unit view normal: tops lightest, walls facing screen left mid,
// walls facing right darkest; round faces take two tones on the light terminator.
export function toneSlot(kind: FaceKind, [nx, ny, nz]: Point): 0 | 1 | 2 {
  if (kind === "round") {
    return nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] > 0.42 ? 0 : 1;
  }
  if (nz > (kind === "curved" ? 0.95 : 0.6)) return 0;
  if (nz < -0.6) return 2;
  return ny >= nx ? 1 : 2;
}

const area = (poly: readonly V2[]) => {
  let sum = 0;
  for (const [i, a] of poly.entries()) {
    const b = poly[(i + 1) % poly.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

// The part of a convex polygon where a * x + b * y + c >= 0.
function clipHalf(poly: readonly V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = [];
  for (const [i, p] of poly.entries()) {
    const q = poly[(i + 1) % poly.length]!;
    const [sp, sq] = [a * p[0] + b * p[1] + c, a * q[0] + b * q[1] + c];
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// A polygon without the points that repeat their neighbour, whose edges have no direction.
const distinct = (poly: readonly V2[]) =>
  poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
  });

// The inward half-plane of each edge of a positively wound convex polygon, in unit normals.
const edges = (poly: readonly V2[]) => {
  const ring = distinct(poly);
  return ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    const length = Math.hypot(p[0] - q[0], p[1] - q[1]);
    const [a, b] = [(p[1] - q[1]) / length, (q[0] - p[0]) / length];
    return [a, b, -(a * p[0] + b * p[1])] as const;
  });
};

function intersect(subject: readonly V2[], clip: readonly V2[]): V2[] {
  let out = [...subject];
  for (const [a, b, c] of edges(clip)) {
    out = clipHalf(out, a, b, c);
    if (out.length < 3) return [];
  }
  return out;
}

// A convex piece less a convex cover, as convex pieces.
function subtract(piece: V2[], cover: readonly V2[]): V2[][] {
  if (area(intersect(piece, cover)) < AREA) return [piece];
  const out: V2[][] = [];
  let rest = piece;
  for (const [a, b, c] of edges(cover)) {
    const outside = clipHalf(rest, -a, -b, -c);
    if (outside.length >= 3 && area(outside) > AREA) out.push(outside);
    rest = clipHalf(rest, a, b, c);
    if (rest.length < 3 || area(rest) < AREA) break;
  }
  return out;
}

// The visible fragments of a mesh that `view` turns from mesh space to view space (a rotation
// about the vertical axis, so normals turn with it).
export function visibleFragments(mesh: Mesh, view: (point: Point) => Point): Fragment[] {
  const root3 = Math.sqrt(3);
  const drawn = mesh.flatMap((face) => {
    const normal = view(face.normal);
    const facing = normal[0] + normal[1] + normal[2];
    if (facing <= FACING) return [];
    const points = face.points.map(view);
    let poly = points.map((p) => projectAt(0, 0, p));
    let size = area(poly);
    if (size < 0) {
      poly = poly.toReversed();
      size = -size;
    }
    if (size < AREA) return [];
    // Distance toward the viewer as an exact linear function of screen position.
    const q = facing / 3;
    const centre = points.reduce(
      (sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]] as const,
      [0, 0, 0] as Point,
    );
    const offset =
      (normal[0] * centre[0] + normal[1] * centre[1] + normal[2] * centre[2]) / points.length;
    const plane = [
      -(normal[0] - normal[1]) / root3 / q,
      -(normal[0] + normal[1] - 2 * normal[2]) / 3 / q,
      offset / q,
    ] as const;
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    return [
      {
        poly,
        plane,
        box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const,
        fragment: {
          tones: face.tones,
          slot: toneSlot(face.kind, normal),
          ...(face.group === undefined ? {} : { group: face.group }),
        },
      },
    ];
  });
  const out: Fragment[] = [];
  for (const [i, face] of drawn.entries()) {
    let pieces: V2[][] = [face.poly];
    for (const [j, other] of drawn.entries()) {
      if (
        i === j ||
        other.box[0] >= face.box[2] ||
        other.box[2] <= face.box[0] ||
        other.box[1] >= face.box[3] ||
        other.box[3] <= face.box[1]
      ) {
        continue;
      }
      const shared = intersect(face.poly, other.poly);
      if (shared.length < 3 || area(shared) < AREA) continue;
      const [a, b, c] = [
        other.plane[0] - face.plane[0],
        other.plane[1] - face.plane[1],
        other.plane[2] - face.plane[2],
      ];
      const nearer = shared.map(([x, y]) => a * x + b * y + c);
      const [low, high] = [Math.min(...nearer), Math.max(...nearer)];
      let cover: V2[];
      if (high <= DEPTH) {
        // Coplanar faces: the later one draws.
        if (low < -DEPTH || j < i) continue;
        cover = shared;
      } else if (low >= -DEPTH) {
        cover = shared;
      } else {
        const length = Math.hypot(a, b);
        cover = clipHalf(shared, a, b, c - 1e-6 * length);
        if (cover.length < 3 || area(cover) < AREA) continue;
      }
      pieces = pieces.flatMap((piece) => subtract(piece, cover));
      if (pieces.length === 0) break;
    }
    for (const points of pieces) {
      if (area(points) > 1e-6) out.push({ ...face.fragment, points });
    }
  }
  return out;
}

// ------------------------------------------------------------------ outlines

const WELD = 1e-4;

// The boundary loops of the union of non-overlapping positively wound polygons. Vertices within
// WELD weld together, edges split at every vertex on them, and edges shared by two polygons
// cancel. Outer loops wind positively and holes negatively.
export function outlines(polys: readonly (readonly V2[])[]): V2[][] {
  const cell = 4 * WELD;
  const vertices: V2[] = [];
  const cells = new Map<string, number[]>();
  const weld = ([x, y]: V2): number => {
    const [cx, cy] = [Math.floor(x / cell), Math.floor(y / cell)];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const index of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          const v = vertices[index]!;
          if (Math.hypot(v[0] - x, v[1] - y) <= WELD) return index;
        }
      }
    }
    vertices.push([x, y]);
    const key = `${cx},${cy}`;
    cells.set(key, [...(cells.get(key) ?? []), vertices.length - 1]);
    return vertices.length - 1;
  };
  const rings = polys.map((poly) => poly.map(weld));
  // Coarse buckets of vertices, to find the ones lying on an edge.
  const BUCKET = 2;
  const buckets = new Map<string, number[]>();
  for (const [index, [x, y]] of vertices.entries()) {
    const key = `${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`;
    const list = buckets.get(key);
    if (list) list.push(index);
    else buckets.set(key, [index]);
  }
  const count = new Map<string, number>();
  const edge = (from: number, to: number) => {
    if (from === to) return;
    const back = `${to}>${from}`;
    const pending = count.get(back) ?? 0;
    if (pending > 0) {
      if (pending === 1) count.delete(back);
      else count.set(back, pending - 1);
      return;
    }
    const key = `${from}>${to}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  };
  for (const ring of rings) {
    for (const [i, from] of ring.entries()) {
      const to = ring[(i + 1) % ring.length]!;
      if (from === to) continue;
      const [a, b] = [vertices[from]!, vertices[to]!];
      const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
      const length2 = ex * ex + ey * ey;
      const on: { at: number; index: number }[] = [];
      const [x0, x1] = [Math.min(a[0], b[0]) - WELD, Math.max(a[0], b[0]) + WELD];
      const [y0, y1] = [Math.min(a[1], b[1]) - WELD, Math.max(a[1], b[1]) + WELD];
      for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
        for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) {
          for (const index of buckets.get(`${bx},${by}`) ?? []) {
            if (index === from || index === to) continue;
            const v = vertices[index]!;
            const at = ((v[0] - a[0]) * ex + (v[1] - a[1]) * ey) / length2;
            if (at <= 0 || at >= 1) continue;
            const away = Math.abs((v[0] - a[0]) * ey - (v[1] - a[1]) * ex) / Math.sqrt(length2);
            if (away <= WELD) on.push({ at, index });
          }
        }
      }
      on.sort((p, q) => p.at - q.at || p.index - q.index);
      let last = from;
      for (const { index } of on) {
        edge(last, index);
        last = index;
      }
      edge(last, to);
    }
  }
  const next = new Map<number, number[]>();
  for (const key of count.keys()) {
    const [from, to] = key.split(">").map(Number) as [number, number];
    const list = next.get(from);
    if (list) list.push(to);
    else next.set(from, [to]);
  }
  const loops: V2[][] = [];
  for (const start of next.keys()) {
    for (;;) {
      const first = next.get(start)!.shift();
      if (first === undefined) break;
      const loop = [start];
      let at = first;
      while (at !== start) {
        loop.push(at);
        const to = next.get(at)?.shift();
        if (to === undefined) throw new Error("An outline does not close");
        at = to;
      }
      loops.push(loop.map((index) => vertices[index]!));
    }
  }
  return loops;
}

// A loop rounded to `decimals`, without repeated or collinear points; empty when it encloses
// less than `least` square px.
export function tidy(loop: readonly V2[], decimals: number, least = 0.002): V2[] {
  const scale = 10 ** decimals;
  let points = loop.map(([x, y]): V2 => [
    Math.round(x * scale) / scale + 0,
    Math.round(y * scale) / scale + 0,
  ]);
  for (let changed = true; changed && points.length >= 3;) {
    changed = false;
    const kept: V2[] = [];
    for (const [i, p] of points.entries()) {
      const a = points[(i + points.length - 1) % points.length]!;
      const b = points[(i + 1) % points.length]!;
      const turn = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
      const along = (p[0] - a[0]) * (b[0] - p[0]) + (p[1] - a[1]) * (b[1] - p[1]);
      const same = p[0] === a[0] && p[1] === a[1];
      // A spike (a turn straight back) is dropped with its repeated or collinear points.
      if (same || (Math.abs(turn) < 1e-9 && (along >= 0 || (b[0] === a[0] && b[1] === a[1])))) {
        changed = true;
      } else {
        kept.push(p);
      }
    }
    points = kept;
  }
  return points.length >= 3 && Math.abs(area(points)) >= least ? points : [];
}

export const loopArea = area;
