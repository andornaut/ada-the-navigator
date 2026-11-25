// Review sheets of the fleet producer's craft: `node art/tools/fleet-contact-sheet.ts <dir>`
// writes `<dir>/fleet-small-craft.svg` and `<dir>/fleet-retaliators.svg`, every heading of each
// craft at 1x and 2x display size on each family's field, with the 1 px ink keyline on light
// fields and Phantom's white edge. A craft with a launcher is composed as the game composes it,
// hull then collar then top, once aimed ahead and once aimed 112.5 degrees off the bow.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import {
  baseFrame,
  fleetCrafts,
  frame,
  placement,
  recolour,
  type Scaled,
  topFrame,
} from "./fleet.ts";
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
const OFF_BOW = 5;

const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");

// One row of a craft: per heading, the keyline's silhouette and the composed frame content.
function rows(craft: Scaled): { silhouette: string; body: string }[][] {
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, index) => index);
  const hulls = headings.map((yaw) => frame(craft, yaw));
  if (!craft.base || !craft.top) {
    return [hulls.map(({ silhouette, svg }) => ({ silhouette, body: inner(svg) }))];
  }
  const bases = headings.map((yaw) => baseFrame(craft, yaw));
  const tops = headings.map((aim) => topFrame(craft, aim));
  const [baseSize, topSize] = [craft.base.frame, craft.top.frame];
  const nested = (size: number, [x, y]: readonly [number, number], svg: string) =>
    `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner(svg)}</svg>`;
  return [0, OFF_BOW].map((turn) =>
    headings.map((yaw) => {
      const { anchor, pivot } = placement(craft, yaw);
      return {
        silhouette: hulls[yaw]!.silhouette,
        body:
          inner(hulls[yaw]!.svg) +
          nested(baseSize, anchor, bases[yaw]!.svg) +
          nested(topSize, pivot, tops[(yaw + turn) % ENEMY_HEADINGS]!.svg),
      };
    }),
  );
}

function sheet(crafts: readonly Scaled[]): string {
  const drawn = crafts.flatMap((craft) => rows(craft).map((row) => ({ craft, row })));
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const { name, field, edge, family } of FIELDS) {
    for (const scale of SCALES) {
      const top = y;
      const cells: string[] = [];
      y += LABEL;
      for (const { craft, row } of drawn) {
        const size = craft.frame * DISPLAY_SCALE * scale;
        let x = GAP;
        for (const { body, silhouette } of row) {
          // One display px of edge at 1x, outside the silhouette.
          const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-miterlimit="2.5"/>`;
          cells.push(
            `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${craft.frame} ${craft.frame}" overflow="visible">${keyline}${recolour(family, body)}</svg>`,
          );
          x += size + GAP;
        }
        width = Math.max(width, x);
        y += size + GAP;
      }
      parts.push(
        `<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`,
        `<text x="${GAP}" y="${top + 12}" font-family="DejaVu Sans" font-size="11" fill="${edge}">${name}, ${scale}x, headings 0 to 15</text>`,
        ...cells,
      );
      y += GAP;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`;
}

function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node art/tools/fleet-contact-sheet.ts <dir>");
  const crafts = fleetCrafts();
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/fleet-small-craft.svg`,
    sheet(crafts.filter(({ archetype }) => archetype !== "retaliator")),
  );
  writeFileSync(
    `${out}/fleet-retaliators.svg`,
    sheet(crafts.filter(({ archetype }) => archetype === "retaliator")),
  );
}

main();
