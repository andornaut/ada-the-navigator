// Review sheet of the friendly object producer:
// `node art/tools/friendly-contact-sheet.ts <dir> [scale ...]` writes `<dir>/friendly-objects.svg`,
// every frame of each object at the given display scales (1 and 2 by default) on its galaxy's
// field with the 1 px ink keyline; the objects every galaxy shows are on the lightest field and
// on Phantom's with its white edge. A 42 px square beside each row is Ada's frame. The ring gate
// rows show each axis lit and dark with a stand-in for Ada between the back and front layers,
// then each layer alone.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { type DrawnObject, drawnObjects, drawGates, type GateFrame } from "./friendly.ts";

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
  // Ring gates on Needle's field.
  {
    const { name, field: fill, edge } = FIELDS.needle;
    const gates = drawGates();
    const frame = 288;
    const top = y;
    const rows: string[] = [];
    const layerArt = ({ silhouette, svg }: GateFrame, x: number, size: number) => {
      const inner = svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");
      const keyline = `<path d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${frame} ${frame}" overflow="visible">${keyline}${inner}</svg>`;
    };
    // A 42 px dart heading screen right: Ada's frame size, not her art.
    const ada = (x: number, size: number, scale: number) => {
      const [cx, cy] = [x + size / 2, y + size / 2];
      const p = (dx: number, dy: number) => `${cx + dx * scale},${cy + dy * scale}`;
      return `<polygon points="${p(-17, -8)} ${p(19, 0)} ${p(-17, 8)} ${p(-11, 0)}" fill="#FFFFFF" stroke="${edge}" stroke-width="${scale}"/><circle cx="${cx - 2 * scale}" cy="${cy}" r="${3.5 * scale}" fill="#2585D0"/>`;
    };
    y += GAP;
    for (const scale of scales) {
      const size = frame * DISPLAY_SCALE * scale;
      for (const [label, state, layers, ship] of [
        ["lit, Ada between the layers", "lit", ["back", "front"], true],
        ["dark, Ada between the layers", "dark", ["back", "front"], true],
        ["lit back layer", "lit", ["back"], false],
        ["lit front layer", "lit", ["front"], false],
      ] as const) {
        rows.push(
          `<text x="${GAP}" y="${y + 10}" font-family="DejaVu Sans" font-size="10" fill="${edge}">${name}: ring gate, ${label}, axes 0 to 4, ${scale}x</text>`,
        );
        y += LABEL;
        let x = GAP;
        for (let orientation = 0; orientation < 5; orientation++) {
          const pick = (layer: string) =>
            gates.frames.find(
              (f) => f.state === state && f.orientation === orientation && f.layer === layer,
            )!;
          rows.push(layerArt(pick(layers[0]), x, size));
          if (ship) rows.push(ada(x, size, scale));
          if (layers[1]) rows.push(layerArt(pick(layers[1]), x, size));
          x += size + GAP;
        }
        width = Math.max(width, x);
        y += size + GAP;
      }
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
