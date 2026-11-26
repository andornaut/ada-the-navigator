// Review sheet of the station producer's structures: `node art/tools/station-contact-sheet.ts
// <dir>` writes `<dir>/stations.svg`, the frames of each state at 1x and 2x display size on its
// galaxy's field, with the 2 px ink destination keyline. An overlay shows on its whole model, then
// alone. A third argument `marks` writes `<dir>/stations-marks.svg` with a cross on each pivot, a
// dot on each berth and a square on each dock.
import { mkdirSync, writeFileSync } from "node:fs";

import { projectAt } from "./projection.ts";
import { draw, STRUCTURES } from "./stations.ts";

const LIGHT = { edge: "#181425", keyline: 2 };
const FIELDS: Readonly<Record<string, { field: string; edge: string; keyline: number }>> = {
  core: { field: "#D8C994", ...LIGHT },
  sunflower: { field: "#D8C994", ...LIGHT },
  cartwheel: { field: "#BC9D90", ...LIGHT },
  whirlpool: { field: "#B8CEC4", ...LIGHT },
  needle: { field: "#C6BBA6", ...LIGHT },
  andromeda: { field: "#9298B5", ...LIGHT },
  phantom: { field: "#514955", ...LIGHT },
};
const SCALES = [1, 2];
const GAP = 14;
const LABEL = 30;

function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node art/tools/station-contact-sheet.ts <dir> [marks]");
  const marks = process.argv[3] === "marks";
  const parts: string[] = [];
  let y = 0;
  let wide = 0;
  for (const structure of STRUCTURES) {
    const drawn = draw(structure);
    const { field, edge, keyline } = FIELDS[structure.manifest]!;
    const { width, height, above } = drawn;
    const { origin, scale } = structure;
    const point = ([px, py, pz]: readonly [number, number, number]) =>
      projectAt(width / 2, above, [
        (px - origin[0]) / scale,
        (py - origin[1]) / scale,
        (pz - origin[2]) / scale,
      ]);
    for (const { state, size, silhouette, body, scenes = [] } of drawn.states) {
      const top = y;
      let x = GAP;
      const views = [...scenes, { silhouette, body }];
      // An overlay's whole model reaches past its frame.
      const pad = scenes.length > 0 && structure.anchor ? 180 : 0;
      // The lit states the state's frames draw.
      const lights = [...new Set(state.frames.map(({ lit }) => lit))];
      for (const view of views) {
        for (const k of SCALES.map((s) => s * scale)) {
          for (const lit of lights) {
            // The keyline is `keyline` display px at 1x outside the silhouette, square cornered.
            const stroke = `<path d="${view.silhouette}" fill="${edge}" stroke="${edge}" stroke-width="${(2 * keyline) / scale}" stroke-linejoin="miter" stroke-miterlimit="2.5"/>`;
            const [bx, by] = [width / 2, above];
            const cross = `<path d="M${bx - 6},${by}h12M${bx},${by - 6}v12" stroke="#ff00ff" stroke-width="1.5" fill="none"/>`;
            const berths = (state.berths ?? []).map(({ at }) => {
              const [cx, cy] = point(at);
              return `<circle cx="${cx}" cy="${cy}" r="3" fill="#00e5ff" stroke="#181425"/>`;
            });
            const dock = state.dock
              ? [
                  point([
                    origin[0] + state.dock.radius * Math.SQRT1_2,
                    origin[1] + state.dock.radius * Math.SQRT1_2,
                    origin[2],
                  ]),
                ].map(
                  ([cx, cy]) =>
                    `<rect x="${cx - 3}" y="${cy - 3}" width="6" height="6" fill="#00e5ff" stroke="#181425"/>`,
                )
              : [];
            const marked = marks ? cross + berths.join("") + dock.join("") : "";
            const shift = view.body === body ? 0 : pad * k;
            parts.push(
              `<svg x="${x + shift}" y="${top + LABEL + shift}" width="${width * k}" height="${height * k}" viewBox="0 0 ${width} ${height}" overflow="visible">${stroke}${view.body(lit)}${marked}</svg>`,
            );
            x += width * k + GAP + 2 * shift;
          }
        }
      }
      y += LABEL + (height + 2 * pad) * scale * 2 + GAP;
      parts.unshift(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`);
      const ids = state.frames.map(({ id }) => id);
      parts.push(
        `<text x="${GAP}" y="${top + 19}" font-family="DejaVu Sans" font-size="12" fill="${edge}">${state.title} (${ids[0]} to ${ids.at(-1)}): 1x and 2x; drawn ${size[0].toFixed(0)} by ${size[1].toFixed(0)} px</text>`,
      );
      wide = Math.max(wide, x);
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/stations${marks ? "-marks" : ""}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`,
  );
}

main();
