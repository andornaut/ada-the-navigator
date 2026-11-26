import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { editManifest, linkData } from "./manifest.ts";
import { anchor, json, SHIP_HEADINGS, SHIP_HEADING_CONTRACT } from "./projection.ts";
import { forwardFlightJson } from "./ship-forward-flight.ts";
import {
  classic,
  DISPLAY,
  drawn,
  FRAME,
  forwardJetMouths,
  nose,
  SCHEMES,
  UP,
} from "./ship-model.ts";
import { JET_LENGTH, JET_LEVELS, JET_PROFILE, jetLayers, plumeReach } from "./ship-jet-layers.ts";
import { writeShipMaterials } from "./ship-materials.ts";
import { check, rasterize, trace, type V2 } from "./silhouette.ts";

// Writes Ada's logical ship frames, material geometry, paint, speed jets, nose and collision
// from the shared model in ship-model.ts.
const output = fileURLToPath(new URL("../../public/art/", import.meta.url));
const paintOnly = process.argv.includes("--paint-only");
const jetsOnly = process.argv.includes("--jets-only");
const forwardFlightOnly = process.argv.includes("--forward-flight-only");

// Speed jets: plume roots at the mouth centres per heading, the profile and the layers by
// Engine level, with the hull regions that draw over a plume at its longest.
function jets(): string {
  const reach = plumeReach(JET_LENGTH.base + JET_LENGTH.scale);
  const headings = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => ({
    index: yaw,
    mouths: forwardJetMouths(FRAME / 2, { yaw }, reach),
  }));
  const contract = {
    version: 1,
    shipHeadings: SHIP_HEADING_CONTRACT,
    frame: 96,
    length: JET_LENGTH,
    profile: JET_PROFILE,
    engineLevels: JET_LEVELS.map((entry) => ({ level: entry.level, layers: jetLayers(entry) })),
    headings,
  };
  return json(contract);
}

// Douglas-Peucker tolerance for the ship's silhouette, in frame px. The default 0.75 leaves the
// long straight edges of the small hull below the intersection-over-union floor.
const SILHOUETTE_TOLERANCE = 0.5;

// The drawn silhouette of idle heading `yaw` as convex parts in frame px, traced from the
// frame's fills (no strokes, so no growth) and checked against them. The solid is the same
// under every paint, so the one set serves all six.
function collision(yaw: number): V2[][] {
  const mask = rasterize(
    drawn(FRAME / 2, classic.paint, { yaw }).map(({ outline }) => outline),
    FRAME,
    FRAME,
  );
  const { collision: parts, tips } = trace(mask, SILHOUETTE_TOLERANCE);
  if (tips.length) throw new Error(`ship ${yaw}: the outline has a notch tip`);
  check(`ship ${yaw}`, parts, mask);
  return parts;
}

// Nose and drawn silhouette per heading in frame px, projected like the frames; shots leave
// from the nose.
function noses(): string {
  return json({
    version: 1,
    shipHeadings: SHIP_HEADING_CONTRACT,
    frame: FRAME,
    displayScale: DISPLAY / FRAME,
    noses: Array.from({ length: SHIP_HEADINGS }, (_, yaw) =>
      anchor(SHIP_HEADINGS, FRAME / 2, yaw, nose()),
    ),
    collision: Array.from({ length: SHIP_HEADINGS }, (_, yaw) => collision(yaw)),
  });
}

mkdirSync(output, { recursive: true });
if (forwardFlightOnly || (!paintOnly && !jetsOnly)) {
  const file = "ship-forward-flight.json";
  writeFileSync(`${output}${file}`, forwardFlightJson());
  linkData("core", { shipForwardFlight: `/art/${file}` });
}
if (!forwardFlightOnly && !paintOnly) writeFileSync(`${output}ship-jets.json`, jets());
if (!forwardFlightOnly && !jetsOnly)
  writeFileSync(
    `${output}ship-paint.json`,
    json({
      version: 1,
      schemes: SCHEMES.map(({ canopySides, id, name, paint }) => ({
        id,
        name,
        ...paint,
        canopySides,
      })),
    }),
  );

if (!forwardFlightOnly && !paintOnly && !jetsOnly && !process.argv.includes("--data-only")) {
  writeFileSync(`${output}ship-nose.json`, noses());

  // All hulls use shared material geometry and retain their logical manifest entries.
  const painted = SCHEMES.filter((scheme) => scheme !== classic);

  // Ship entries open the manifest: the up alias, then Classic per heading, then
  // the paid rows, which mirror ship-N with their own logical path and paint id.
  const entry = (id: string, path: string, yaw: number) => ({
    id,
    path,
    width: FRAME,
    height: FRAME,
    displayWidth: DISPLAY,
    displayHeight: DISPLAY,
    facing: `world-${yaw}`,
    directionIndex: yaw,
    pivot: { x: 0.5, y: 0.5 },
  });
  const yaws = Array.from({ length: SHIP_HEADINGS }, (_, yaw) => yaw);
  const entries = [
    entry("ship", "/art/ship.svg", UP),
    ...yaws.map((yaw) => entry(`ship-${yaw}`, `/art/ship-${yaw}.svg`, yaw)),
    ...painted.flatMap((scheme) =>
      yaws.map((yaw) => ({
        ...entry(`ship-${scheme.id}-${yaw}`, `/art/paint/${scheme.id}/ship-${yaw}.svg`, yaw),
        paint: scheme.id,
      })),
    ),
  ];
  const isShip = ({ id }: { id: string }) => id === "ship" || id.startsWith("ship-");
  editManifest("core", (manifest) => {
    manifest.assets = [...entries, ...manifest.assets.filter((asset) => !isShip(asset))];
    manifest.shipNose = "/art/ship-nose.json";
    manifest.shipHeadings = SHIP_HEADING_CONTRACT;
  });
}

if (!forwardFlightOnly && !paintOnly && !jetsOnly) writeShipMaterials();
