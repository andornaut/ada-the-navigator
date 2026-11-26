import { SCREEN } from "../data/screen.ts";
import { unit } from "./asteroidArt.ts";
import { chunkItems, layerOrigin, viewRect, type Xy } from "./backdropField.ts";
export interface DecorationPolygon {
  readonly outer: readonly Xy[];
  readonly holes: readonly (readonly Xy[])[];
}
export interface DecorationBody {
  readonly id: string;
  readonly polygons: readonly DecorationPolygon[];
}
export interface DecorationSprite {
  readonly asset: string;
  readonly width: number;
  readonly height: number;
  readonly bodies?: readonly DecorationBody[];
}
export interface DecorationLayer {
  readonly chance: number;
  readonly chunk: Xy;
  readonly parallax: number;
  readonly salt: string;
  readonly scale: Xy;
  readonly rotation: Xy;
  readonly sprites: readonly DecorationSprite[];
  readonly sizes?: readonly { readonly scale: number; readonly weight: number }[];
}
export interface DecorationView extends DecorationSprite {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const pair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((item) => typeof item === "number" && Number.isFinite(item));
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

function readRing(value: unknown): Xy[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every((point) => pair(point) && point.every((n) => n >= 0 && n <= 1))
  ) {
    return undefined;
  }
  const ring = value as Xy[];
  const area = ring.reduce((sum, [x, y], index) => {
    const next = ring[(index + 1) % ring.length]!;
    return sum + x * next[1] - y * next[0];
  }, 0);
  return area === 0 ? undefined : ring;
}

function readBodies(value: unknown): DecorationBody[] | undefined {
  if (!Array.isArray(value) || !value.length) {
    return undefined;
  }
  const bodies: DecorationBody[] = [];
  for (const entry of value) {
    const { id, polygons } = object(entry);
    if (
      typeof id !== "string" ||
      !id.length ||
      bodies.some((body) => body.id === id) ||
      !Array.isArray(polygons) ||
      !polygons.length
    ) {
      return undefined;
    }
    const parsed: DecorationPolygon[] = [];
    for (const polygon of polygons) {
      const data = object(polygon);
      const outer = readRing(data.outer);
      const holes = data.holes === undefined ? [] : data.holes;
      if (!outer || !Array.isArray(holes)) {
        return undefined;
      }
      const rings = holes.map(readRing);
      if (rings.some((ring) => ring === undefined)) {
        return undefined;
      }
      parsed.push({ holes: rings as Xy[][], outer });
    }
    bodies.push({ id, polygons: parsed });
  }
  return bodies;
}
/** Optional visual data fails independently of the galaxy's existing backdrop. */
export function readDecorations(value: unknown): DecorationLayer | undefined {
  const data = object(value);
  const { chance, chunk, parallax, rotation, salt, scale, sizes, sprites } = data;
  if (
    typeof chance !== "number" ||
    !Number.isFinite(chance) ||
    chance < 0 ||
    chance > 1 ||
    !pair(chunk) ||
    !chunk.every(positive) ||
    typeof parallax !== "number" ||
    !Number.isFinite(parallax) ||
    parallax < 0 ||
    parallax > 1 ||
    typeof salt !== "string" ||
    !salt.length ||
    !pair(scale) ||
    !scale.every(positive) ||
    scale[0] > scale[1] ||
    !pair(rotation) ||
    rotation[0] > rotation[1] ||
    !Array.isArray(sprites) ||
    !sprites.length
  ) {
    return undefined;
  }
  let parsedSizes: { scale: number; weight: number }[] | undefined;
  if (sizes !== undefined) {
    if (!Array.isArray(sizes) || !sizes.length) {
      return undefined;
    }
    parsedSizes = [];
    for (const entry of sizes) {
      const size = object(entry);
      if (!positive(size.scale) || !positive(size.weight)) {
        return undefined;
      }
      parsedSizes.push({ scale: size.scale, weight: size.weight });
    }
    if (!Number.isFinite(parsedSizes.reduce((sum, size) => sum + size.weight, 0))) {
      return undefined;
    }
  }
  const parsed: DecorationSprite[] = [];
  for (const entry of sprites) {
    const { asset, bodies, height, width } = object(entry);
    if (typeof asset !== "string" || !asset.length || !positive(width) || !positive(height)) {
      return undefined;
    }
    const parsedBodies = bodies === undefined ? undefined : readBodies(bodies);
    if (bodies !== undefined && !parsedBodies) {
      return undefined;
    }
    parsed.push({ asset, height, width, ...(parsedBodies ? { bodies: parsedBodies } : {}) });
  }
  return {
    chance,
    chunk,
    parallax,
    rotation,
    salt,
    scale,
    sprites: parsed,
    ...(parsedSizes ? { sizes: parsedSizes } : {}),
  };
}

/** The producer's normalized opaque polygons in the same logical coordinates as the quad. */
export function decorationBodyPolygons(view: DecorationView): DecorationBody[] {
  const angle = (view.rotation * Math.PI) / 180;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const transform = ([x, y]: Xy): Xy => {
    const dx = (x - 0.5) * view.width,
      dy = (y - 0.5) * view.height;
    return [view.x + dx * cosine - dy * sine, view.y + dx * sine + dy * cosine];
  };
  return (view.bodies ?? []).map((body) => ({
    id: body.id,
    polygons: body.polygons.map(({ holes, outer }) => ({
      holes: holes.map((ring) => ring.map(transform)),
      outer: outer.map(transform),
    })),
  }));
}

function insideRing([x, y]: Xy, ring: readonly Xy[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function edgeInView(a: Xy, b: Xy): boolean {
  let low = 0,
    high = 1;
  for (const [axis, extent] of [
    [0, SCREEN.width],
    [1, SCREEN.height],
  ] as const) {
    const delta = b[axis] - a[axis];
    if (delta === 0) {
      if (a[axis] < 0 || a[axis] > extent) {
        return false;
      }
    } else {
      const start = -a[axis] / delta,
        end = (extent - a[axis]) / delta;
      low = Math.max(low, Math.min(start, end));
      high = Math.min(high, Math.max(start, end));
      if (low > high) {
        return false;
      }
    }
  }
  return true;
}

/** Polygons combine by union; a transparent hole alone is not a visible encounter. */
export function decorationVisible(view: DecorationView): boolean {
  if (!view.bodies) {
    return true;
  }
  const corners: readonly Xy[] = [
    [0, 0],
    [SCREEN.width, 0],
    [SCREEN.width, SCREEN.height],
    [0, SCREEN.height],
  ];
  return decorationBodyPolygons(view).some((body) =>
    body.polygons.some(({ holes, outer }) => {
      if (
        corners.some(
          (point) => insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole)),
        )
      ) {
        return true;
      }
      return [outer, ...holes].some((ring) =>
        ring.some((point, index) => edgeInView(point, ring[(index + 1) % ring.length]!)),
      );
    }),
  );
}
/** Fixed distant art never enters the zoom-dependent SVG raster registry. */
export function decorationRasterSize(
  width: number,
  height: number,
):
  | {
      width: number;
      height: number;
    }
  | undefined {
  if (!positive(width) || !positive(height)) {
    return undefined;
  }
  const scale = Math.min(1, 1024 / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
/** Seeded shared-texture quads, culled using their rotated display bounds. */
export function viewDecorations(
  backdrop: {
    readonly seed: number;
    readonly decorations?: DecorationLayer;
  },
  camera: Xy,
): DecorationView[] {
  const layer = backdrop.decorations;
  if (!layer || !camera.every(Number.isFinite)) {
    return [];
  }
  const origin = layerOrigin(camera, layer.parallax);
  const radius =
    Math.max(...layer.sprites.map(({ height, width }) => Math.hypot(width, height) / 2)) *
    layer.scale[1] *
    Math.max(...(layer.sizes?.map((size) => size.scale) ?? [1]));
  const rect = viewRect(origin, [SCREEN.width, SCREEN.height], [radius, radius]);
  const columns = Math.floor(rect[2] / layer.chunk[0]) - Math.floor(rect[0] / layer.chunk[0]) + 1;
  const rows = Math.floor(rect[3] / layer.chunk[1]) - Math.floor(rect[1] / layer.chunk[1]) + 1;
  // Invalid extreme recipes cannot turn a visual layer into unbounded chunk work.
  if (!Number.isFinite(radius) || columns * rows > 64) {
    return [];
  }
  const interpolate = (range: Xy, id: string, salt: string) =>
    range[0] + (range[1] - range[0]) * unit(backdrop.seed, id, `${layer.salt}-${salt}`);
  const out: DecorationView[] = [];
  for (const item of chunkItems(backdrop.seed, layer.salt, layer, rect)) {
    const sprite =
      layer.sprites[
        Math.floor(unit(backdrop.seed, item.id, `${layer.salt}-sprite`) * layer.sprites.length)
      ]!;
    let sizeScale = 1;
    if (layer.sizes) {
      let draw =
        unit(backdrop.seed, item.id, `${layer.salt}-size`) *
        layer.sizes.reduce((sum, size) => sum + size.weight, 0);
      for (const size of layer.sizes) {
        sizeScale = size.scale;
        if (draw < size.weight) {
          break;
        }
        draw -= size.weight;
      }
    }
    const scale = interpolate(layer.scale, item.id, "scale") * sizeScale;
    const rotation = interpolate(layer.rotation, item.id, "rotation");
    const width = sprite.width * scale;
    const height = sprite.height * scale;
    const angle = (rotation * Math.PI) / 180;
    const rx = (Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))) / 2;
    const ry = (Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))) / 2;
    const x = item.x - origin[0] + SCREEN.width / 2;
    const y = item.y - origin[1] + SCREEN.height / 2;
    if (x + rx < 0 || x - rx > SCREEN.width || y + ry < 0 || y - ry > SCREEN.height) {
      continue;
    }
    const view = {
      asset: sprite.asset,
      height,
      id: item.id,
      rotation,
      width,
      x,
      y,
      ...(sprite.bodies ? { bodies: sprite.bodies } : {}),
    };
    if (decorationVisible(view)) {
      out.push(view);
    }
  }
  return out;
}
