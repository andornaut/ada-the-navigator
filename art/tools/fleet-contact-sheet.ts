// Review sheet of the fleet producer's craft: `node art/tools/fleet-contact-sheet.ts <dir>`
// writes `<dir>/fleet-small-craft.svg`, every heading of each craft at 1x and 2x display size
// on a light field with the 1 px ink keyline and on Phantom's field with its white edge.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { fleetCrafts, frame, recolour } from "./fleet.ts";
import type { FleetFamily } from "./fleet-models.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

const FIELDS: readonly { name: string; field: string; edge: string; family: FleetFamily }[] = [
  { name: "Sunflower, coral", field: "#D8C994", edge: "#181425", family: "coral" },
  { name: "Cartwheel, claim", field: "#BC9D90", edge: "#181425", family: "claim" },
  { name: "Andromeda, garnet", field: "#9298B5", edge: "#181425", family: "garnet" },
  { name: "Needle, crimson", field: "#C6BBA6", edge: "#181425", family: "needle" },
  { name: "Phantom, coral", field: "#514955", edge: "#FFFFFF", family: "coral" },
];
const SCALES = [1, 2];
const GAP = 6;
const LABEL = 16;

function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node art/tools/fleet-contact-sheet.ts <dir>");
  const crafts = fleetCrafts().map((craft) => ({
    craft,
    frames: Array.from({ length: ENEMY_HEADINGS }, (_, yaw) => frame(craft, yaw)),
  }));
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const { name, field, edge, family } of FIELDS) {
    for (const scale of SCALES) {
      const top = y;
      const rows: string[] = [];
      y += LABEL;
      for (const { craft, frames } of crafts) {
        const size = craft.frame * DISPLAY_SCALE * scale;
        let x = GAP;
        for (const { silhouette, svg } of frames) {
          const inner = recolour(family, svg).replace(
            /^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu,
            "",
          );
          // One display px of edge at 1x, outside the silhouette.
          const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-miterlimit="2.5"/>`;
          rows.push(
            `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${craft.frame} ${craft.frame}" overflow="visible">${keyline}${inner}</svg>`,
          );
          x += size + GAP;
        }
        width = Math.max(width, x);
        y += size + GAP;
      }
      parts.push(
        `<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`,
        `<text x="${GAP}" y="${top + 12}" font-family="DejaVu Sans" font-size="11" fill="${edge}">${name}, ${scale}x, headings 0 to 15</text>`,
        ...rows,
      );
      y += GAP;
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/fleet-small-craft.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`,
  );
}

main();
