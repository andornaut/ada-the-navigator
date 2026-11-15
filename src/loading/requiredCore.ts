import { ECONOMY } from "../data/economy.ts";
import { hasPlayerHeadingPackage } from "../game/playerHeadingPackage.ts";
import { readQuantumJump } from "../game/quantumJump.ts";
import { readShipMaterialPalettes, readShipMaterials } from "../game/shipMaterials.ts";

/** Validate the canonical loader's actual cached package without another metadata download. */
export function validateBootCore(cache: { get(key: string): unknown }, shipReady: boolean): void {
  const root = cache.get("art-manifest");
  if (
    !hasPlayerHeadingPackage(
      ECONOMY.paintOrder.filter((paint) => paint !== ECONOMY.defaultPaint),
      root,
    )
  ) {
    throw new Error("Required player heading package is invalid");
  }
  if (
    !root ||
    typeof root !== "object" ||
    !("shipMaterials" in root) ||
    typeof root.shipMaterials !== "string"
  ) {
    throw new Error("Required ship material link is missing");
  }
  const jump = readQuantumJump(cache.get("quantum-jump"));
  const geometry =
    jump &&
    readShipMaterials(
      { poses: jump.warp.poses.map(({ id }) => id), warpHeading: jump.warp.heading },
      cache.get("ship-materials"),
    );
  const palettes = readShipMaterialPalettes(
    ECONOMY.paintOrder,
    cache.get("ship-material-palettes"),
  );
  if (!geometry || !palettes || !shipReady) {
    throw new Error("Required default ship materials or texture are invalid");
  }
}
