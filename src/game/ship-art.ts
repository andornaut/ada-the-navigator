import type { Vec } from "../model/types.ts";

export interface ShipAsset {
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  id: string;
  pivot: Vec;
}

const DIRECTIONAL = /^ship-(?:thrust-)?\d+$/;

/** Heading count from the manifest's directional ship frames; zero for legacy-only manifests. */
export function shipDirectionCount(assets: readonly ShipAsset[]): number {
  let count = 0;
  for (const asset of assets) {
    if (DIRECTIONAL.test(asset.id) && Number.isInteger(asset.directionIndex)) {
      count = Math.max(count, asset.directionIndex! + 1);
    }
  }
  return count;
}

/** Quantize the world heading into `count` equal steps before the authored isometric projection. */
export function shipDirection(count: number, facing: Vec): number {
  const index = Math.round(Math.atan2(facing.y, facing.x) / ((2 * Math.PI) / count));
  return ((index % count) + count) % count;
}

/** A missing thrust frame falls back to the matching idle view before legacy aliases. */
export function selectShipAsset<T extends ShipAsset>(
  assets: readonly T[],
  thrust: boolean,
  facing: Vec,
): T | undefined {
  const count = shipDirectionCount(assets);
  const direction = count > 0 ? shipDirection(count, facing) : undefined;
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
