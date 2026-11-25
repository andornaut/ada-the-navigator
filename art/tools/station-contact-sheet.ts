// Review sheet of the station producer's structures: `node art/tools/station-contact-sheet.ts
// <dir>` writes `<dir>/stations.svg`, the lit and dim frame of each structure at 1x and 2x
// display size on its galaxy's field, with the 2 px ink destination keyline on light fields and
// Phantom's 1 px white edge. A cross marks each pivot and a dot each berth.
import { mkdirSync, writeFileSync } from "node:fs";

import { draw, STRUCTURES } from "./stations.ts";
import { projectAt } from "./projection.ts";

const FIELDS: Readonly<Record<string, { field: string; edge: string; width: number }>> = {
  core: { field: "#D8C994", edge: "#181425", width: 2 },
  sunflower: { field: "#D8C994", edge: "#181425", width: 2 },
  cartwheel: { field: "#BC9D90", edge: "#181425", width: 2 },
  whirlpool: { field: "#B8CEC4", edge: "#181425", width: 2 },
  needle: { field: "#C6BBA6", edge: "#181425", width: 2 },
  andromeda: { field: "#9298B5", edge: "#181425", width: 2 },
  phantom: { field: "#514955", edge: "#FFFFFF", width: 1 },
};
const SCALES = [1, 2];
const GAP = 12;
const LABEL = 30;

function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node art/tools/station-contact-sheet.ts <dir>");
  const marks = process.argv[3] === "marks";
  const parts: string[] = [];
  let y = 0;
  let wide = 0;
  for (const structure of STRUCTURES) {
    const drawn = draw(structure);
    const { field, edge, width: keyline } = FIELDS[structure.manifest]!;
    const { width, height, above } = drawn;
    const top = y;
    let x = GAP;
    for (const scale of SCALES) {
      const k = structure.scale * scale;
      for (const lit of [true, false]) {
        // The keyline is `keyline` display px at 1x outside the silhouette, with square corners.
        const stroke = `<path d="${drawn.silhouette}" fill="${edge}" stroke="${edge}" stroke-width="${(2 * keyline) / structure.scale}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
        const pivot = marks
          ? `<path d="M${width / 2 - 6},${above}h12M${width / 2},${above - 6}v12" stroke="#ff00ff" stroke-width="1.5" fill="none"/>` +
            (structure.berths ?? [])
              .map(({ at }) => {
                const [bx, by] = projectAt(width / 2, above, [
                  at[0] / structure.scale,
                  at[1] / structure.scale,
                  (at[2] - structure.plane) / structure.scale,
                ]);
                return `<circle cx="${bx}" cy="${by}" r="3" fill="#00e5ff" stroke="#181425"/>`;
              })
              .join("")
          : "";
        parts.push(
          `<svg x="${x}" y="${top + LABEL}" width="${width * k}" height="${height * k}" viewBox="0 0 ${width} ${height}" overflow="visible">${stroke}${drawn.body(lit)}${pivot}</svg>`,
        );
        x += width * k + GAP;
      }
    }
    y += LABEL + height * structure.scale * 2 + GAP;
    const [w, h] = drawn.size;
    parts.unshift(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`);
    parts.push(
      `<text x="${GAP}" y="${top + 19}" font-family="DejaVu Sans" font-size="12" fill="${edge}">${structure.title} (${structure.frames.map(({ id }) => id).join(", ")}): lit and dim at 1x and 2x; silhouette ${w.toFixed(0)} by ${h.toFixed(0)} px</text>`,
    );
    wide = Math.max(wide, x);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/stations${marks ? "-marks" : ""}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`,
  );
}

main();
