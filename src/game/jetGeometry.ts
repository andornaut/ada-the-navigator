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
  outerCorner?: JetPoint;
  coreOutboard?: true;
  rearClip?: { readonly constant: number; readonly normal: JetPoint };
}

export interface JetShapePolygon {
  layerIndex: number;
  points: readonly JetPoint[];
}

export function layerAlpha(layer: JetShapeLayer, f: number): number {
  if (!layer.alpha) {
    return 1;
  }
  const { from, max, to } = layer.alpha;
  return Math.min(1, Math.max(0, (f - from) / (to - from))) * max;
}

/** Outboard displacement in signed half-mouth units, bounded by outer/core containment. */
export function coreOutboardOffset(layers: readonly JetShapeLayer[]): number | undefined {
  const outer = layers.find((layer) => layer.name === "outer");
  const core = layers.find((layer) => layer.name === "core");
  if (
    !outer ||
    !core ||
    ![outer.width, outer.length, core.width, core.length].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    return undefined;
  }
  const offset = Math.min(outer.width - core.width, outer.width * (1 - core.length / outer.length));
  return Number.isFinite(offset) && offset >= 0 ? offset : undefined;
}

/** Clips in calibrated frame space before display scaling, retaining boundary vertices. */
function clipRear(
  clip: NonNullable<JetShapeMouth["rearClip"]>,
  polygon: readonly JetPoint[],
): JetPoint[] {
  const distance = (point: JetPoint) =>
    clip.normal.x * point.x + clip.normal.y * point.y - clip.constant;
  const out: JetPoint[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const da = distance(a),
      db = distance(b);
    const aInside = da <= 1e-10,
      bInside = db <= 1e-10;
    if (aInside) {
      out.push(a);
    }
    if (aInside !== bInside && Math.abs(da) > 1e-10 && Math.abs(db) > 1e-10) {
      const fraction = da / (da - db);
      out.push({
        x: a.x + (b.x - a.x) * fraction,
        y: a.y + (b.y - a.y) * fraction,
      });
    }
  }
  return out;
}

/** Visible layer polygons in authored order, before colour and display mapping. */
export function jetShapePolygons(
  mouth: JetShapeMouth,
  layers: readonly JetShapeLayer[],
  length: number,
  f: number,
): JetShapePolygon[] {
  const fraction = Math.min(1, f);
  if (!(fraction > 0)) {
    return [];
  }
  const polygons: JetShapePolygon[] = [];
  const { axis, coreOutboard, half, outerCorner, rearClip } = mouth;
  const coreOffset = coreOutboard ? coreOutboardOffset(layers) : 0;
  if (coreOffset === undefined) {
    return [];
  }
  const groupWidth = outerCorner
    ? layers.reduce(
        (width, layer) => (layerAlpha(layer, fraction) > 0 ? Math.max(width, layer.width) : width),
        0,
      )
    : 0;
  if (outerCorner && !(groupWidth > 0)) {
    return [];
  }
  const anchor = outerCorner
    ? {
        x: outerCorner.x - half.x * groupWidth,
        y: outerCorner.y - half.y * groupWidth,
      }
    : mouth.anchor;
  for (const [layerIndex, layer] of layers.entries()) {
    const alpha = layerAlpha(layer, fraction);
    if (alpha <= 0) {
      continue;
    }
    const hx = half.x * layer.width;
    const hy = half.y * layer.width;
    const tip = length * layer.length;
    const offset = coreOutboard && layer.name === "core" ? coreOffset : 0;
    const x = anchor.x + half.x * offset;
    const y = anchor.y + half.y * offset;
    const polygon = [
      { x: x + hx, y: y + hy },
      { x: x + axis.x * tip, y: y + axis.y * tip },
      { x: x - hx, y: y - hy },
    ];
    const clipped = rearClip ? clipRear(rearClip, polygon) : polygon;
    polygons.push({ layerIndex, points: clipped });
  }
  return polygons;
}
