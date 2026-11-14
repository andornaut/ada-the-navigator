import { SCREEN } from "../data/screen.ts";
import { unit } from "./asteroidArt.ts";
import { chunkItems, layerOrigin, viewRect, type Xy } from "./backdropField.ts";
export interface DecorationSprite {
  readonly asset: string;
  readonly width: number;
  readonly height: number;
}
export interface DecorationLayer {
  readonly chance: number;
  readonly chunk: Xy;
  readonly parallax: number;
  readonly salt: string;
  readonly scale: Xy;
  readonly rotation: Xy;
  readonly sprites: readonly DecorationSprite[];
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
/** Optional visual data fails independently of the galaxy's existing backdrop. */
export function readDecorations(value: unknown): DecorationLayer | undefined {
  const data = object(value);
  const { chance, chunk, parallax, rotation, salt, scale, sprites } = data;
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
  const parsed: DecorationSprite[] = [];
  for (const entry of sprites) {
    const { asset, height, width } = object(entry);
    if (typeof asset !== "string" || !asset.length || !positive(width) || !positive(height)) {
      return undefined;
    }
    parsed.push({ asset, height, width });
  }
  return { chance, chunk, parallax, rotation, salt, scale, sprites: parsed };
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
    layer.scale[1];
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
    const scale = interpolate(layer.scale, item.id, "scale");
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
    out.push({ asset: sprite.asset, height, id: item.id, rotation, width, x, y });
  }
  return out;
}
