import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { linkData } from "./manifest.ts";
import { json } from "./projection.ts";
import { shipMaterialGeometry } from "./ship-material-geometry.ts";

/** Writes shared material paths and their core manifest link. */
export function writeShipMaterials(): void {
  writeFileSync(
    fileURLToPath(new URL("../../public/art/ship-materials.json", import.meta.url)),
    json(shipMaterialGeometry()),
  );
  linkData("core", { shipMaterials: "/art/ship-materials.json" });
}

if (import.meta.main) writeShipMaterials();
