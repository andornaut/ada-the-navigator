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

// Ship heading 2k of SHIP_HEADINGS (32) faces enemy heading k of ENEMY_HEADINGS (16).
const DIRECTIONAL = /^ship-(?:thrust-)?\d+$/;
const IDLE = /^ship-\d+$/;

/**
 * Whether every one of the 32 idle headings is present, so the sprite can snap to the nearest.
 * Thrust frames are optional; painted entries and legacy aliases do not count.
 */
export function hasShipHeadings(assets: readonly ShipAsset[]): boolean {
  const indices = new Set<number>();
  for (const asset of assets) {
    if (
      IDLE.test(asset.id) &&
      asset.paint === undefined &&
      Number.isInteger(asset.directionIndex)
    ) {
      indices.add(asset.directionIndex!);
    }
  }
  return Array.from({ length: SHIP_HEADINGS }, (_, index) => indices.has(index)).every(Boolean);
}

/** Quantize the world heading into `count` equal steps before the authored isometric projection. */
export function shipDirection(count: number, facing: Vec): number {
  const index = Math.round(Math.atan2(facing.y, facing.x) / ((2 * Math.PI) / count));
  return ((index % count) + count) % count;
}

/**
 * The nearest of the 32 headings: aim and movement stay continuous and only the sprite snaps.
 * A missing thrust frame falls back to the matching idle view, and an incomplete heading set
 * to the legacy aliases.
 */
export function selectShipAsset<T extends ShipAsset>(
  assets: readonly T[],
  thrust: boolean,
  facing: Vec,
): T | undefined {
  const direction = hasShipHeadings(assets) ? shipDirection(SHIP_HEADINGS, facing) : undefined;
  const directional = (prefix: string) =>
    direction === undefined
      ? undefined
      : assets.find(
          (asset) =>
            DIRECTIONAL.test(asset.id) &&
            asset.id.startsWith(`${prefix}-`) &&
            (prefix === "ship-thrust" || !asset.id.startsWith("ship-thrust")) &&
            asset.directionIndex === direction,
        );
  return (
    (thrust ? directional("ship-thrust") : undefined) ??
    directional("ship") ??
    (thrust ? assets.find((asset) => asset.id === "ship-thrust") : undefined) ??
    assets.find((asset) => asset.id === "ship")
  );
}

/** A paint scheme's idle frames, which load only while that scheme is in use. */
export function paintFrames<T extends ShipAsset>(assets: readonly T[], paint: string): T[] {
  return assets.filter((asset) => asset.paint === paint);
}

const THRUST = /^ship-thrust(?:-\d+)?$/;

/** The thrust frames and their alias, drawn only when the speed jets are missing or invalid. */
export function thrustFrames<T extends { readonly id: string }>(assets: readonly T[]): T[] {
  return assets.filter((asset) => THRUST.test(asset.id));
}

/**
 * Ship frames the scene loads on demand instead of in preload: painted frames while their
 * scheme is in use, thrust frames only without valid jets.
 */
export function loadsOnDemand(asset: { readonly id: string; readonly paint?: string }): boolean {
  return asset.paint !== undefined || THRUST.test(asset.id);
}

/**
 * The frame for the scheme in use: a painted scheme's idle frame at the heading, else the
 * Classic selection. Painted schemes have no thrust frames, and a frame not yet loaded falls
 * back to Classic.
 */
export function selectPaintedShipAsset<T extends ShipAsset>(
  assets: readonly T[],
  paint: string | null,
  thrust: boolean,
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
  return selectShipAsset(classic, thrust, facing);
}
