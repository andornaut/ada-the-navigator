// Review sheet of the friendly object producer:
// `node art/tools/friendly-contact-sheet.ts <dir> [scale ...]` writes `<dir>/friendly-objects.svg`,
// every frame of each object at the given display scales (1 and 2 by default) on its galaxy's
// field with the 1 px ink keyline; the objects every galaxy shows are on the lightest field and
// on Phantom's with its white edge. A 42 px square beside each row is Ada's frame.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { type DrawnObject, drawnObjects } from "./friendly.ts";

const INK = "#181425";
const FIELDS = {
  sunflower: { name: "Sunflower", field: "#D8C994", edge: INK },
  cartwheel: { name: "Cartwheel", field: "#BC9D90", edge: INK },
  whirlpool: { name: "Whirlpool", field: "#B8CEC4", edge: INK },
  needle: { name: "Needle", field: "#C6BBA6", edge: INK },
  andromeda: { name: "Andromeda", field: "#9298B5", edge: INK },
  phantom: { name: "Phantom", field: "#514955", edge: "#FFFFFF" },
} as const;
type Field = keyof typeof FIELDS;
const GAP = 8;
const LABEL = 14;
const ADA = 42;

function main() {
  const [out, ...rest] = process.argv.slice(2);
  if (!out) throw new Error("Usage: node art/tools/friendly-contact-sheet.ts <dir> [scale ...]");
  const scales = rest.length ? rest.map(Number) : [1, 2];
  const objects = drawnObjects();
  const bands: { field: Field; members: DrawnObject[] }[] = [
    ...(["sunflower", "phantom"] as const).map((field) => ({
      field,
      members: objects.filter(({ manifest }) => manifest === "core"),
    })),
    ...(["sunflower", "cartwheel", "whirlpool", "andromeda", "needle"] as const).map((field) => ({
      field,
      members: objects.filter(({ manifest }) => manifest === field),
    })),
  ];
  const parts: string[] = [];
  let y = 0;
  let width = 0;
  for (const { field, members } of bands) {
    const { name, field: fill, edge } = FIELDS[field];
    const top = y;
    const rows: string[] = [];
    y += GAP;
    for (const object of members) {
      rows.push(
        `<text x="${GAP}" y="${y + 10}" font-family="DejaVu Sans" font-size="10" fill="${edge}">${name}: ${object.name} (${object.drawn.map(({ id }) => id).join(", ")})</text>`,
      );
      y += LABEL;
      let x = GAP;
      let tall = ADA;
      rows.push(
        `<rect x="${x + 0.5}" y="${y + 0.5}" width="${ADA}" height="${ADA}" fill="none" stroke="${edge}" stroke-opacity="0.4"/>`,
      );
      x += ADA + GAP;
      for (const scale of scales) {
        const [w, h] = [
          object.width * DISPLAY_SCALE * scale,
          object.height * DISPLAY_SCALE * scale,
        ];
        for (const { silhouette, svg } of object.drawn) {
          const inner = svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");
          // One display px of edge at 1x, outside the silhouette.
          const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
          rows.push(
            `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${object.width} ${object.height}" overflow="visible">${keyline}${inner}</svg>`,
          );
          x += w + GAP;
        }
        tall = Math.max(tall, h);
      }
      width = Math.max(width, x);
      y += tall + GAP;
    }
    parts.push(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${fill}"/>`, ...rows);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/friendly-objects.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(width, 420)}" height="${y}">${parts.join("")}</svg>\n`,
  );
}

main();
