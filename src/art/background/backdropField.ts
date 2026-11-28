import { unit } from "../asteroidArt.ts";

// The layered backdrop's seeded placement (art/backdrop.md, Generation and Motif field), the same
// rules as Art's generator (art/tools/backdrop-field.ts), so the game draws the sky Art's
// contrast checks measured: the motif lattice, the checker and chunk placement.

export type Xy = readonly [number, number];
/** Left, top, right, bottom. */
export type Rect = readonly [number, number, number, number];

/** The scene's isometric projection without its centring: world (x, y) to screen offset. */
export const project = (x: number, y: number): Xy => [x - y, (x + y) / 2];

/** A layer's origin in layer px: the camera's projected position times the layer's parallax. */
export function layerOrigin(camera: Xy, parallax: number): Xy {
  const [sx, sy] = project(camera[0], camera[1]);
  return [sx * parallax, sy * parallax];
}

/** The view rectangle in a layer's px, for a view of `size` centred on the layer origin. */
export function viewRect(origin: Xy, size: Xy, margin: Xy = [0, 0]): Rect {
  return [
    origin[0] - size[0] / 2 - margin[0],
    origin[1] - size[1] / 2 - margin[1],
    origin[0] + size[0] / 2 + margin[0],
    origin[1] + size[1] / 2 + margin[1],
  ];
}

const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

/** Whether `i + j` is even: the checker's filled cells. */
export const evenCell = (i: number, j: number): boolean => mod(i + j, 2) === 0;

export interface MotifLattice {
  /** Node (i, j) is empty when `(i * empty.i + j * empty.j) mod empty.modulus` is 0. */
  readonly empty: { readonly i: number; readonly j: number; readonly modulus: number };
  /** Node (i, j) sits at `i e1 + j e2`. */
  readonly lattice: readonly [Xy, Xy];
}

/** A motif copy on its node: its rings in layer px, and whether its node's `i + j` is even. */
export interface MotifPlate {
  readonly even: boolean;
  readonly rings: readonly (readonly Xy[])[];
}

/**
 * The motif plates whose nodes lie within `reach` of `rect` (layer px): one copy of `motif`,
 * given about its node, on every filled node. `even` picks the first or the second of the
 * galaxy's two plate steps.
 */
export function motifPlates(
  rules: MotifLattice,
  motif: readonly (readonly Xy[])[],
  rect: Rect,
  reach: number,
): MotifPlate[] {
  const [[e1x, e1y], [e2x, e2y]] = rules.lattice;
  const det = e1x * e2y - e2x * e1y;
  const corners: Xy[] = [
    [rect[0] - reach, rect[1] - reach],
    [rect[2] + reach, rect[1] - reach],
    [rect[0] - reach, rect[3] + reach],
    [rect[2] + reach, rect[3] + reach],
  ];
  const ij = corners.map(([x, y]) => [(x * e2y - y * e2x) / det, (y * e1x - x * e1y) / det]);
  const i0 = Math.floor(Math.min(...ij.map(([a]) => a!)));
  const i1 = Math.ceil(Math.max(...ij.map(([a]) => a!)));
  const j0 = Math.floor(Math.min(...ij.map(([, b]) => b!)));
  const j1 = Math.ceil(Math.max(...ij.map(([, b]) => b!)));
  const { empty } = rules;
  const out: MotifPlate[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (mod(i * empty.i + j * empty.j, empty.modulus) === 0) {
        continue;
      }
      const [x, y] = [i * e1x + j * e2x, i * e1y + j * e2y];
      if (
        x < rect[0] - reach ||
        x > rect[2] + reach ||
        y < rect[1] - reach ||
        y > rect[3] + reach
      ) {
        continue;
      }
      out.push({
        even: evenCell(i, j),
        rings: motif.map((ring) => ring.map(([u, v]): Xy => [x + u, y + v])),
      });
    }
  }
  return out;
}

/** Whether a shape of rings covers a point, by the even-odd rule. */
export function insideRings(rings: readonly (readonly Xy[])[], x: number, y: number): boolean {
  let hit = false;
  for (const ring of rings) {
    if (inside(ring, x, y)) {
      hit = !hit;
    }
  }
  return hit;
}

/** Checker placement: the centre of every `step` layer px cell meeting `rect` whose i + j is even. */
export function checkerItems(step: number, rect: Rect): ChunkItem[] {
  const out: ChunkItem[] = [];
  for (let i = Math.floor(rect[0] / step); i <= Math.floor(rect[2] / step); i++) {
    for (let j = Math.floor(rect[1] / step); j <= Math.floor(rect[3] / step); j++) {
      if (evenCell(i, j)) {
        out.push({ i, id: `${i},${j}`, j, x: (i + 0.5) * step, y: (j + 0.5) * step });
      }
    }
  }
  return out;
}

export interface ChunkRule {
  readonly chance: number;
  readonly chunk: Xy;
}

export interface ChunkItem {
  readonly i: number;
  readonly id: string;
  readonly j: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Items of one chunked layer whose chunks meet `rect`: chunk (i, j) holds one item when
 * unit(seed, `i,j`, salt) is below `chance`, at ((i + 0.2 + 0.6 u) w, (j + 0.2 + 0.6 v) h) with
 * u and v from the salts `{salt}-x` and `{salt}-y`.
 */
export function chunkItems(seed: number, salt: string, rule: ChunkRule, rect: Rect): ChunkItem[] {
  const [w, h] = rule.chunk;
  const out: ChunkItem[] = [];
  for (let i = Math.floor(rect[0] / w); i <= Math.floor(rect[2] / w); i++) {
    for (let j = Math.floor(rect[1] / h); j <= Math.floor(rect[3] / h); j++) {
      const id = `${i},${j}`;
      if (unit(seed, id, salt) >= rule.chance) {
        continue;
      }
      out.push({
        i,
        id,
        j,
        x: (i + 0.2 + 0.6 * unit(seed, id, `${salt}-x`)) * w,
        y: (j + 0.2 + 0.6 * unit(seed, id, `${salt}-y`)) * h,
      });
    }
  }
  return out;
}

/** Even-odd point-in-polygon test. */
export function inside(points: readonly Xy[], x: number, y: number): boolean {
  let hit = false;
  for (let k = 0, l = points.length - 1; k < points.length; l = k++) {
    const [xk, yk] = points[k]!;
    const [xl, yl] = points[l]!;
    if (yk > y !== yl > y && x < ((xl - xk) * (y - yk)) / (yl - yk) + xk) {
      hit = !hit;
    }
  }
  return hit;
}
