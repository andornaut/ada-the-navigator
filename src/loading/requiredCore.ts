import { hasPlayerHeadingPackage, readEnemyWeaponsArt } from "../art/index.ts";
import { ECONOMY } from "../data/economy.ts";
import { readQuantumJump } from "../game/quantumJump.ts";
import { readEngineJets } from "../game/shipJets.ts";
import { readShipMaterialPalettes, readShipMaterials } from "../game/shipMaterials.ts";
import { SHIP_HEADINGS } from "../model/shipHeadingContract.ts";

/** Decode both required jet files before constructing the first playable scene. */
export function requireBootJets(cache: { get(key: string): unknown }) {
  const normal = readEngineJets(cache.get("ship-jets"));
  if (!normal) {
    throw new Error("Required ship-jets geometry is invalid");
  }
  const retro = readEngineJets(cache.get("ship-retro-jets"));
  if (!retro) {
    throw new Error("Required ship-retro-jets geometry is invalid");
  }
  return { normal, retro };
}

/** Validate the canonical loader's actual cached package without another metadata download. */
export function validateBootCore(
  cache: { get(key: string): unknown },
  textureReady: (id: string) => boolean,
): void {
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
  if (!readEnemyWeaponsArt(cache.get("enemy-weapons"))) {
    throw new Error("Required enemy weapon art is invalid");
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
  if (
    !geometry ||
    !palettes ||
    !textureReady("ship") ||
    !Array.from({ length: SHIP_HEADINGS }, (_, heading) => textureReady(`ship-${heading}`)).every(
      Boolean,
    )
  ) {
    throw new Error("Required default ship materials or texture are invalid");
  }
}
