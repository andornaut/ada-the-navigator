import { readFileSync } from "node:fs";

import manifest from "../../public/art/manifest.json" with { type: "json" };
import quantum from "../../public/art/quantum-jump.json" with { type: "json" };
import paints from "../../public/art/ship-paint.json" with { type: "json" };
import title from "../../public/art/title-screen.json" with { type: "json" };
import { ECONOMY } from "../data/economy.ts";
import {
  readShipMaterialPalettes,
  readShipMaterials,
  ShipMaterialSources,
} from "../game/shipMaterials.ts";

/** The active shipped geometry, with invalid linked material documents rejected. */
function shippedShipSources(): ShipMaterialSources | null {
  const path = (manifest as typeof manifest & { readonly shipMaterials?: string }).shipMaterials;
  if (path === undefined) {
    return null;
  }
  const geometry = readShipMaterials(
    { poses: quantum.warp.poses.map(({ id }) => id), warpHeading: quantum.warp.heading },
    JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8")),
  );
  const palettes = readShipMaterialPalettes(ECONOMY.paintOrder, paints);
  if (!geometry || !palettes) {
    throw new Error("The linked shipped ship material package is invalid");
  }
  return new ShipMaterialSources(geometry, palettes);
}

export const SHIPPED_SHIP_SOURCES = shippedShipSources();
export const SHIPPED_TITLE_SHIP = SHIPPED_SHIP_SOURCES
  ? SHIPPED_SHIP_SOURCES.ship(ECONOMY.defaultPaint, title.ship.frame)!.url
  : `/art/ship-${title.ship.frame}.svg`;
