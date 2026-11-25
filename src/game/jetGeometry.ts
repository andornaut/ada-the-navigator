/** Model-unit outer length for authored static warp and map thrust cues. */
export const AUTHORED_JET_LENGTH = 16;

/** Projected frame-space geometry, independent of rendering and material colours. */
export interface JetPoint {
  x: number;
  y: number;
}

export interface JetShapeLayer {
  name?: string;
  alpha?: { from: number; max: number; to: number };
  length: number;
  width: number;
}

export interface JetShapeMouth {
  anchor: JetPoint;
  axis: JetPoint;
  half: JetPoint;
}

/**
 * A plume outline as `[t, w]` samples: `t` the fraction of a layer's length from the root, `w` the
 * fraction of its half width. Samples run from the root (t 0) to the tip (t 1).
 */
export type JetProfile = readonly (readonly [number, number])[];

export type JetShapeTriangle = readonly [JetPoint, JetPoint, JetPoint];

export interface JetShapePolygon {
  layerIndex: number;
  /** The outline: down one side to the tip and back up the other. */
  points: readonly JetPoint[];
  /** The outline's fill as triangles, exact for the concave teardrop. */
  triangles: readonly JetShapeTriangle[];
}

/** A plain triangle from the mouth sides to the tip, for jet files without a profile. */
const TRIANGLE_PROFILE: JetProfile = [
  [0, 1],
  [1, 0],
];

export function layerAlpha(layer: JetShapeLayer, f: number): number {
  if (!layer.alpha) {
    return 1;
  }
  const { from, max, to } = layer.alpha;
  return Math.min(1, Math.max(0, (f - from) / (to - from))) * max;
}

/** Valid when samples start at the root, end at the tip, advance strictly and keep w >= 0. */
export function validJetProfile(profile: JetProfile): boolean {
  return (
    profile.length >= 2 &&
    profile[0]![0] === 0 &&
    profile[profile.length - 1]![0] === 1 &&
    profile.every(
      ([t, w], i) =>
        Number.isFinite(t) && Number.isFinite(w) && w >= 0 && (i === 0 || t > profile[i - 1]![0]),
    )
  );
}

const area = ([a, b, c]: JetShapeTriangle): number =>
  Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));

/** One layer's plume: `anchor + axis * t * length * layer.length +- half * w * layer.width`. */
function plume(
  mouth: JetShapeMouth,
  layer: JetShapeLayer,
  length: number,
  profile: JetProfile,
): Omit<JetShapePolygon, "layerIndex"> {
  const { anchor, axis, half } = mouth;
  const reach = length * layer.length;
  const side = (sign: 1 | -1) =>
    profile.map(([t, w]) => ({
      x: anchor.x + axis.x * t * reach + sign * half.x * w * layer.width,
      y: anchor.y + axis.y * t * reach + sign * half.y * w * layer.width,
    }));
  const left = side(1);
  const right = side(-1);
  const triangles: JetShapeTriangle[] = [];
  for (let i = 0; i + 1 < profile.length; i++) {
    for (const triangle of [
      [left[i]!, left[i + 1]!, right[i + 1]!],
      [left[i]!, right[i + 1]!, right[i]!],
    ] as const) {
      if (area(triangle) > 1e-12) {
        triangles.push(triangle);
      }
    }
  }
  return { points: [...left, ...right.slice(0, -1).reverse()], triangles };
}

/** Visible layer polygons in authored order, before colour and display mapping. */
export function jetShapePolygons(
  mouth: JetShapeMouth,
  layers: readonly JetShapeLayer[],
  length: number,
  f: number,
  profile: JetProfile = TRIANGLE_PROFILE,
): JetShapePolygon[] {
  const fraction = Math.min(1, f);
  if (!(fraction > 0)) {
    return [];
  }
  const polygons: JetShapePolygon[] = [];
  for (const [layerIndex, layer] of layers.entries()) {
    if (layerAlpha(layer, fraction) <= 0) {
      continue;
    }
    polygons.push({ layerIndex, ...plume(mouth, layer, length, profile) });
  }
  return polygons;
}
