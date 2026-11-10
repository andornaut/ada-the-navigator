import type { Vec } from "../model/types.ts";

export interface ShipAsset {
  directionIndex?: number;
  displayHeight?: number;
  displayWidth?: number;
  id: string;
  pivot: Vec;
}

/** Quantize the world heading before the authored isometric projection. */
export function shipDirection(facing: Vec): number {
  const index = Math.round(Math.atan2(facing.y, facing.x) / (Math.PI / 4));
  return ((index % 8) + 8) % 8;
}

/** A missing thrust frame falls back to the matching idle view before legacy aliases. */
export function selectShipAsset(
  assets: readonly ShipAsset[],
  thrust: boolean,
  facing: Vec,
): ShipAsset | undefined {
  const direction = shipDirection(facing);
  const directional = (prefix: string) =>
    assets.find((asset) => asset.id.startsWith(`${prefix}-`) && asset.directionIndex === direction);
  return (
    (thrust ? directional("ship-thrust") : undefined) ??
    assets.find(
      (asset) =>
        asset.id.startsWith("ship-") &&
        !asset.id.startsWith("ship-thrust") &&
        asset.directionIndex === direction,
    ) ??
    (thrust ? assets.find((asset) => asset.id === "ship-thrust") : undefined) ??
    assets.find((asset) => asset.id === "ship")
  );
}
