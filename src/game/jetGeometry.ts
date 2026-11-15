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
  normalAperture?: { readonly coreWidth: number };
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

/** The normal aperture's widest authored layer is solid at any positive thrust. */
export function jetShapeLayerAlpha(
  mouth: Pick<JetShapeMouth, "normalAperture">,
  layer: JetShapeLayer,
  layerIndex: number,
  f: number,
): number {
  if (f <= 0) {
    return 0;
  }
  return mouth.normalAperture && layerIndex === 0 && layer.name !== "core"
    ? 1
    : layerAlpha(layer, f);
}

/** Compatibility name for existing normal aperture consumers. */
export const jetLayerAlpha = jetShapeLayerAlpha;

/** Art supplies authored colours; runtime supplies its existing interpolated fallback. */
export function jetShapeLayerColor<C>(
  mouth: Pick<JetShapeMouth, "normalAperture">,
  layer: { name?: string; normalColor?: C },
  layerIndex: number,
  fallback: C,
): C {
  return mouth.normalAperture &&
    layerIndex === 0 &&
    layer.name !== "core" &&
    layer.normalColor !== undefined
    ? layer.normalColor
    : fallback;
}

/** Centered reverse shape roles retain descending authored widths and relative lengths. */
export function validCenteredReverseShapes(shapes: readonly JetShapeLayer[]): boolean {
  const roles = ["halo", "outer", "core"];
  return (
    shapes.length === roles.length &&
    shapes.every(
      (layer, i) =>
        layer.name === roles[i] &&
        Number.isFinite(layer.width) &&
        layer.width > 0 &&
        Number.isFinite(layer.length) &&
        layer.length > 0 &&
        (i === 0 || (layer.width <= shapes[i - 1]!.width && layer.length <= shapes[i - 1]!.length)),
    )
  );
}

/** Reuses selected main materials on authored centered, opaque reverse shapes. */
export function centeredReverseLayers<C>(
  main: readonly (JetShapeLayer & { colors: readonly [C, C]; normalColor?: C })[],
  selected: readonly (JetShapeLayer & { colors: readonly [C, C] })[],
  shapes: readonly JetShapeLayer[],
): (JetShapeLayer & { colors: readonly [C, C] })[] | undefined {
  const dark = main.find(
    (layer) => layer.name !== "core" && layer.normalColor !== undefined,
  )?.normalColor;
  const outer = selected.find((layer) => layer.name === "outer");
  const core = selected.find((layer) => layer.name === "core");
  if (dark === undefined || !outer || !core || !validCenteredReverseShapes(shapes)) {
    return undefined;
  }
  return shapes.map((layer, i) => ({
    colors: i === 0 ? [dark, dark] : (i === 1 ? outer : core).colors,
    length: layer.length,
    name: layer.name!,
    width: layer.width,
  }));
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

/** Centered, nested triangles rooted at the complete physical engine opening. */
function normalAperturePolygons(
  mouth: JetShapeMouth,
  layers: readonly JetShapeLayer[],
  length: number,
  fraction: number,
): JetShapePolygon[] {
  const coreWidth = mouth.normalAperture!.coreWidth;
  if (
    !Number.isFinite(coreWidth) ||
    coreWidth <= 0 ||
    coreWidth >= 1 ||
    mouth.outerCorner !== undefined ||
    mouth.coreOutboard !== undefined ||
    mouth.rearClip !== undefined
  ) {
    return [];
  }
  const cores = layers.filter((layer) => layer.name === "core");
  if (cores.length > 1) {
    return [];
  }
  const core = cores[0];
  const polygons: JetShapePolygon[] = [];
  let previousWidth = 1;
  let previousLength = Infinity;
  for (const [layerIndex, layer] of layers.entries()) {
    if (
      !Number.isFinite(layer.width) ||
      layer.width <= 0 ||
      !Number.isFinite(layer.length) ||
      layer.length <= 0
    ) {
      return [];
    }
    const width =
      layer.name === "core"
        ? coreWidth
        : layerIndex === 0
          ? 1
          : core && core.width > 0
            ? (coreWidth * layer.width) / core.width
            : NaN;
    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      width > previousWidth ||
      layer.length > previousLength
    ) {
      return [];
    }
    previousWidth = width;
    previousLength = layer.length;
    if (jetShapeLayerAlpha(mouth, layer, layerIndex, fraction) <= 0) {
      continue;
    }
    const { anchor, axis, half } = mouth;
    const tip = length * layer.length;
    polygons.push({
      layerIndex,
      points: [
        { x: anchor.x + half.x * width, y: anchor.y + half.y * width },
        { x: anchor.x + axis.x * tip, y: anchor.y + axis.y * tip },
        { x: anchor.x - half.x * width, y: anchor.y - half.y * width },
      ],
    });
  }
  return polygons;
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
  if (mouth.normalAperture !== undefined) {
    return normalAperturePolygons(mouth, layers, length, fraction);
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
