import { STORY_BACKGROUND } from "../layout/storyPage.ts";
import type { ArtAsset, StoryOverlay, StorySourceRect } from "./storyArt.ts";

interface CompositionAsset extends ArtAsset {
  readonly height: number;
  readonly pixelRatio: 2;
  readonly width: number;
}

const fields = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function readAsset(value: unknown): CompositionAsset | undefined {
  const asset = fields(value);
  if (
    !asset ||
    typeof asset.id !== "string" ||
    !asset.id ||
    typeof asset.path !== "string" ||
    !asset.path.startsWith("/art/") ||
    !positive(asset.width) ||
    !positive(asset.height) ||
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.pixelRatio !== 2 ||
    asset.displayWidth !== asset.width / 2 ||
    asset.displayHeight !== asset.height / 2
  ) {
    return undefined;
  }
  return asset as unknown as CompositionAsset;
}

/** Encoded sheet coordinates, before the common logical-scene transform. */
export function validStorySourceRect(
  sheet: { readonly height: number; readonly width: number },
  rect: StorySourceRect,
): boolean {
  return (
    [rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= sheet.width &&
    rect.y + rect.height <= sheet.height
  );
}

/** Resolve one complete composition document into the existing story asset and overlay model. */
export function readStoryCompositionAssets(
  assets: readonly ArtAsset[],
  value: unknown,
): readonly ArtAsset[] | undefined {
  const root = fields(value);
  const canvas = fields(root?.canvas);
  const scenes = fields(root?.scenes);
  if (
    root?.version !== 1 ||
    canvas?.width !== STORY_BACKGROUND.width ||
    canvas.height !== STORY_BACKGROUND.height ||
    !Array.isArray(root.assets) ||
    !scenes
  ) {
    return undefined;
  }
  const sources = root.assets.map(readAsset);
  if (sources.some((asset) => asset === undefined)) {
    return undefined;
  }
  const declared = new Map(sources.map((asset) => [asset!.id, asset!]));
  if (declared.size !== sources.length) {
    return undefined;
  }
  const resolved = new Map(assets.map((asset) => [asset.id, asset]));
  for (const source of declared.values()) {
    resolved.set(source.id, source);
  }
  for (const [id, value] of Object.entries(scenes)) {
    const scene = fields(value);
    const subject = fields(scene?.subject);
    const original = assets.find((asset) => asset.id === id);
    const base = typeof scene?.base === "string" ? declared.get(scene.base) : undefined;
    if (
      !original ||
      !base ||
      base.displayWidth !== STORY_BACKGROUND.width ||
      base.displayHeight !== STORY_BACKGROUND.height ||
      !Array.isArray(scene?.layers) ||
      !finite(subject?.top) ||
      !finite(subject.bottom) ||
      subject.top < 0 ||
      subject.bottom <= subject.top ||
      subject.bottom > STORY_BACKGROUND.height
    ) {
      return undefined;
    }
    const overlays: string[] = [];
    for (const [index, value] of scene.layers.entries()) {
      const layer = fields(value);
      const source = typeof layer?.asset === "string" ? declared.get(layer.asset) : undefined;
      const at = fields(layer?.atLogical);
      const rect = fields(layer?.sourceRect);
      if (
        !source ||
        !finite(at?.x) ||
        !finite(at.y) ||
        !positive(layer?.displayWidth) ||
        !positive(layer.displayHeight)
      ) {
        return undefined;
      }
      const sourceRect = (rect ?? {
        height: source.height,
        width: source.width,
        x: 0,
        y: 0,
      }) as unknown as StorySourceRect;
      if (
        (layer.sourceRect !== undefined && !rect) ||
        !validStorySourceRect(source, sourceRect) ||
        layer.displayWidth !== sourceRect.width / 2 ||
        layer.displayHeight !== sourceRect.height / 2
      ) {
        return undefined;
      }
      const overlayId = `${id}:layer:${index}`;
      if (resolved.has(overlayId)) {
        return undefined;
      }
      overlays.push(overlayId);
      resolved.set(overlayId, {
        at: { x: at.x, y: at.y },
        displayHeight: layer.displayHeight,
        displayWidth: layer.displayWidth,
        height: source.height,
        id: overlayId,
        path: source.path,
        sourceRect,
        width: source.width,
      });
    }
    resolved.set(id, {
      ...original,
      overlays,
      path: base.path,
      subject: { bottom: subject.bottom, top: subject.top },
    });
  }
  return [...resolved.values()];
}

/** Crop the encoded sheet inside the existing overlay box, before the shared scene transform. */
export function storyOverlayCrop(source: StoryOverlay["source"]): {
  readonly backgroundPosition: string;
  readonly backgroundSize: string;
} {
  if (!source) {
    return { backgroundPosition: "0 0", backgroundSize: "100% 100%" };
  }
  const { height, rect, width } = source;
  const x = width === rect.width ? 0 : (100 * rect.x) / (width - rect.width);
  const y = height === rect.height ? 0 : (100 * rect.y) / (height - rect.height);
  return {
    backgroundPosition: `${x}% ${y}%`,
    backgroundSize: `${(100 * width) / rect.width}% ${(100 * height) / rect.height}%`,
  };
}
