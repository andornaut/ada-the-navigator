// Seeded generation shared by the layered backdrop: the hash, value noise, the plate step
// pattern, the plate lattice and chunk placement. The runtime follows the same rules, so the
// generator's contrast checks see the sky the game draws. Contract: art/backdrop.md.

export type Xy = readonly [number, number];
export type Rect = readonly [number, number, number, number];

/** asteroid-art.ts's hash: FNV-1a over the text from the seed, then a final mix. */
export function hash(seed: number, text: string): number {
  let value = seed >>> 0 || 0x811c9dc5;
  for (const character of text) {
    value = Math.imul(value ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d) >>> 0;
  return (value ^ (value >>> 12)) >>> 0;
}

/** A stable value in [0, 1) for a seed, a cell id `i,j` and a salt, as backdrop rocks use. */
export function unit(seed: number, id: string, salt: string): number {
  return hash(seed, `${id}:${salt}`) / 0x100000000;
}

/** The scene's isometric projection without its centring: world (x, y) to screen offset. */
export const project = (x: number, y: number): Xy => [x - y, (x + y) / 2];

/** A layer's origin in layer px: the camera's projected position times the layer's parallax. */
export function layerOrigin(camera: Xy, parallax: number): Xy {
  const [sx, sy] = project(camera[0], camera[1]);
  return [sx * parallax, sy * parallax];
}

/** The view rectangle in a layer's px, for a view of `size` centred on the layer origin. */
export function viewRect(origin: Xy, size: Xy, margin = 0): Rect {
  return [
    origin[0] - size[0] / 2 - margin,
    origin[1] - size[1] / 2 - margin,
    origin[0] + size[0] / 2 + margin,
    origin[1] + size[1] / 2 + margin,
  ];
}

export type Octave = {
  scale: number;
  weight: number;
  salt: string;
  // Optional anisotropy: coordinates turned by `angle` degrees, the along axis divided by
  // `stretch`.
  angle?: number;
  stretch?: number;
};
export type Warp =
  | { kind: "sine"; weight: number; direction: Xy; period: number }
  | { kind: "noise"; weight: number; octave: Octave };
export type Pattern = {
  noise?: readonly Octave[];
  wave?: { weight: number; direction: Xy; period: number; warp?: Warp };
  spokes?: {
    weight: number;
    cell: Xy;
    count: number;
    twist: number;
    squash: number;
    fade: number;
  };
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smoothstep-interpolated value noise in [-1, 1]; lattice values are unit(seed, `i,j`, salt). */
export function valueNoise(seed: number, octave: Octave, u: number, v: number): number {
  let [x, y] = [u, v];
  if (octave.angle !== undefined) {
    const a = (octave.angle * Math.PI) / 180;
    const along = u * Math.cos(a) + v * Math.sin(a);
    const across = -u * Math.sin(a) + v * Math.cos(a);
    [x, y] = [along / (octave.stretch ?? 1), across];
  }
  x /= octave.scale;
  y /= octave.scale;
  const [i, j] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [smooth(x - i), smooth(y - j)];
  const at = (a: number, b: number) => unit(seed, `${a},${b}`, octave.salt);
  const top = at(i, j) * (1 - fx) + at(i + 1, j) * fx;
  const bottom = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx;
  return (top * (1 - fy) + bottom * fy) * 2 - 1;
}

/** The plate pattern at layer point (u, v): weighted noise, wave and spokes terms. */
export function patternValue(seed: number, pattern: Pattern, u: number, v: number): number {
  let value = 0;
  for (const octave of pattern.noise ?? []) {
    value += octave.weight * valueNoise(seed, octave, u, v);
  }
  const { spokes, wave } = pattern;
  if (wave) {
    let phase = (wave.direction[0] * u + wave.direction[1] * v) / wave.period;
    const { warp } = wave;
    if (warp?.kind === "sine") {
      phase +=
        warp.weight * Math.sin((warp.direction[0] * u + warp.direction[1] * v) / warp.period);
    } else if (warp?.kind === "noise") {
      phase += warp.weight * valueNoise(seed, warp.octave, u, v);
    }
    value += wave.weight * Math.sin(phase);
  }
  if (spokes) {
    const cu = (Math.floor(u / spokes.cell[0]) + 0.5) * spokes.cell[0];
    const cv = (Math.floor(v / spokes.cell[1]) + 0.5) * spokes.cell[1];
    const [du, dv] = [u - cu, (v - cv) * spokes.squash];
    const r = Math.hypot(du, dv);
    const fade = Math.min(1, Math.max(0, 1.4 - r / spokes.fade));
    value += spokes.weight * Math.cos(spokes.count * Math.atan2(dv, du) + r / spokes.twist) * fade;
  }
  return value;
}

export type Step = -2 | -1 | 1 | 2;
export type PlateRules = {
  patternWeight: number;
  jitterWeight: number;
  // Ascending thresholds: a plate's step is the number of edges at or below its value, less 2.
  edges: readonly [number, number, number, number];
};
export type PlateSpec = {
  lattice: readonly [Xy, Xy];
  split: boolean;
  jitter: number;
  lighter: boolean;
  pattern: Pattern;
};
export type Plate = { points: Xy[]; step: Step };

/** The step for a pattern value; a galaxy without lighter plates keeps only the darker ones. */
export function stepFor(rules: PlateRules, lighter: boolean, value: number): number {
  const step = rules.edges.filter((edge) => edge <= value).length - 2;
  return lighter ? step : Math.min(step, 0);
}

/**
 * The plates whose lattice cells meet `rect` (layer px), sky plates (step 0) omitted. Node
 * (i, j) sits at i e1 + j e2, each lattice coordinate moved by (unit - 0.5) times `jitter`.
 * A split cell is two triangles along a seeded diagonal; otherwise the cell is one plate.
 */
export function plates(seed: number, rules: PlateRules, spec: PlateSpec, rect: Rect): Plate[] {
  const [[e1x, e1y], [e2x, e2y]] = spec.lattice;
  const det = e1x * e2y - e2x * e1y;
  const corners: Xy[] = [
    [rect[0], rect[1]],
    [rect[2], rect[1]],
    [rect[0], rect[3]],
    [rect[2], rect[3]],
  ];
  const ij = corners.map(([x, y]) => [(x * e2y - y * e2x) / det, (y * e1x - x * e1y) / det]);
  const i0 = Math.floor(Math.min(...ij.map(([a]) => a!))) - 1;
  const i1 = Math.ceil(Math.max(...ij.map(([a]) => a!))) + 1;
  const j0 = Math.floor(Math.min(...ij.map(([, b]) => b!))) - 1;
  const j1 = Math.ceil(Math.max(...ij.map(([, b]) => b!))) + 1;
  const node = (i: number, j: number): Xy => {
    const id = `${i},${j}`;
    const a = i + (unit(seed, id, "plate-jx") - 0.5) * spec.jitter;
    const b = j + (unit(seed, id, "plate-jy") - 0.5) * spec.jitter;
    return [a * e1x + b * e2x, a * e1y + b * e2y];
  };
  const out: Plate[] = [];
  for (let i = i0; i < i1; i++) {
    for (let j = j0; j < j1; j++) {
      const id = `${i},${j}`;
      const [a, b, c, d] = [node(i, j), node(i + 1, j), node(i + 1, j + 1), node(i, j + 1)];
      let polys: Xy[][];
      if (!spec.split) {
        polys = [[a, b, c, d]];
      } else if (unit(seed, id, "plate-split") < 0.5) {
        polys = [
          [a, b, c],
          [a, c, d],
        ];
      } else {
        polys = [
          [a, b, d],
          [b, c, d],
        ];
      }
      polys.forEach((points, k) => {
        const xs = points.map(([x]) => x);
        const ys = points.map(([, y]) => y);
        if (
          Math.max(...xs) < rect[0] ||
          Math.min(...xs) > rect[2] ||
          Math.max(...ys) < rect[1] ||
          Math.min(...ys) > rect[3]
        ) {
          return;
        }
        const cu = xs.reduce((s, x) => s + x, 0) / xs.length;
        const cv = ys.reduce((s, y) => s + y, 0) / ys.length;
        const value =
          rules.patternWeight * patternValue(seed, spec.pattern, cu, cv) +
          rules.jitterWeight * (unit(seed, id, `plate-tone-${k}`) - 0.5);
        const step = stepFor(rules, spec.lighter, value);
        if (step !== 0) {
          out.push({ points, step: step as Step });
        }
      });
    }
  }
  return out;
}

export type ChunkRule = { chunk: Xy; chance: number };
export type ChunkItem = { i: number; j: number; id: string; x: number; y: number };

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
        j,
        id,
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
