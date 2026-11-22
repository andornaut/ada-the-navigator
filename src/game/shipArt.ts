import { SHIP_HEADINGS } from "../model/nose.ts";
import type { Vec } from "../model/types.ts";

export interface ShipAsset {
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  id: string;
  /** The paint scheme of a painted idle frame; Classic frames have none. */
  paint?: string;
  pivot: Vec;
}

// Ship heading 4k of SHIP_HEADINGS (64) faces enemy heading k of ENEMY_HEADINGS (16).
const IDLE = /^ship-\d+$/;

/**
 * Whether every one of the 64 idle headings is present, so the sprite can snap to the nearest.
 * Thrust frames are optional; painted entries and legacy aliases do not count.
 */
export function hasShipHeadings(assets: readonly ShipAsset[]): boolean {
  const indices = new Set<number>();
  for (const asset of assets) {
    if (IDLE.test(asset.id) && asset.paint === undefined) {
      const index = asset.directionIndex;
      if (
        !Number.isInteger(index) ||
        index! < 0 ||
        index! >= SHIP_HEADINGS ||
        Number(asset.id.slice(5)) !== index ||
        indices.has(index!)
      ) {
        return false;
      }
      indices.add(index!);
    }
  }
  return Array.from({ length: SHIP_HEADINGS }, (_, index) => indices.has(index)).every(Boolean);
}

/** Quantize the world heading into `count` equal steps before the authored isometric projection. */
export function shipDirection(count: number, facing: Vec): number {
  const index = Math.round(Math.atan2(facing.y, facing.x) / ((2 * Math.PI) / count));
  return ((index % count) + count) % count;
}

/** The nearest of the 64 hull headings. Aim and movement stay continuous. */
export function selectShipAsset<T extends ShipAsset>(
  assets: readonly T[],
  facing: Vec,
): T | undefined {
  if (!hasShipHeadings(assets)) {
    return undefined;
  }
  const direction = shipDirection(SHIP_HEADINGS, facing);
  return assets.find(
    (asset) =>
      IDLE.test(asset.id) && asset.paint === undefined && asset.directionIndex === direction,
  );
}

/** A paint scheme's idle frames, which load only while that scheme is in use. */
export function paintFrames<T extends ShipAsset>(assets: readonly T[], paint: string): T[] {
  return assets.filter((asset) => asset.paint === paint);
}

const THRUST = /^ship-thrust(?:-\d+)?$/;

/** Painted hulls load on demand. Legacy thrust frames are unused. */
export function skipShipPreload(asset: { readonly id: string; readonly paint?: string }): boolean {
  return asset.paint !== undefined || THRUST.test(asset.id);
}

/**
 * The frame for the scheme in use: a painted scheme's idle frame at the heading, else the
 * Classic selection if the painted frame is unavailable.
 */
export function selectPaintedShipAsset<T extends ShipAsset>(
  assets: readonly T[],
  paint: string | null,
  facing: Vec,
): T | undefined {
  const classic = assets.filter((asset) => asset.paint === undefined);
  const painted = paint === null ? [] : paintFrames(assets, paint);
  if (painted.length && hasShipHeadings(classic)) {
    const direction = shipDirection(SHIP_HEADINGS, facing);
    const frame = painted.find((asset) => asset.directionIndex === direction);
    if (frame) {
      return frame;
    }
  }
  return selectShipAsset(classic, facing);
}
