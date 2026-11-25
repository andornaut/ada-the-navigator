// Review sheet of the hostile station producer: `node art/tools/hostile-station-contact-sheet.ts
// <dir>` writes `<dir>/hostile-stations.svg`, each design at its 16 headings on its field with
// the enemy keyline, at 1x with every base intact and at 2x with the last two mounts capped and
// the first destroyed. Tops are the enemy fleet's and are not drawn; a dot marks each top's pivot,
// hollow where the hull hides the mount.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { baseKey, DESIGNS, draw, order } from "./hostile-stations.ts";

const FIELDS: Readonly<Record<string, { field: string; edge: string }>> = {
  core: { field: "#514955", edge: "#FFFFFF" },
  cartwheel: { field: "#BC9D90", edge: "#181425" },
  andromeda: { field: "#9298B5", edge: "#181425" },
};
const BASE_FRAME = 32;
const GAP = 8;
const LABEL = 26;
const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");

function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Usage: node art/tools/hostile-station-contact-sheet.ts <dir>");
  const parts: string[] = [];
  let y = 0;
  let wide = 0;
  for (const source of DESIGNS) {
    const drawn = draw(source);
    const { design, hulls, bases, placements } = drawn;
    const { field, edge } = FIELDS[design.manifest]!;
    const top = y;
    y += LABEL;
    for (const [scale, perRow] of [
      [1, 16],
      [2, 8],
    ] as const) {
      const k = DISPLAY_SCALE * scale;
      const size = design.frame * k;
      const mounts = design.mounts.map(({ id }) => id);
      const state = (id: string) =>
        scale === 1
          ? "intact"
          : mounts.indexOf(id) >= mounts.length - (mounts.length > 3 ? 2 : 1)
            ? "capped"
            : mounts.indexOf(id) === 0
              ? "destroyed"
              : "intact";
      for (const [yaw, hull] of hulls.entries()) {
        const x = GAP + (yaw % perRow) * (size + GAP);
        const row = y + Math.floor(yaw / perRow) * (size + GAP);
        // One display px of edge at 1x, outside the silhouette.
        const stroke = (d: string) =>
          `<path d="${d}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-miterlimit="2.5"/>`;
        const layers = order(drawn, yaw).map((id) => {
          const { anchor, pivot, share } = placements.get(id)![yaw]!;
          const base = bases.get(baseKey(id, state(id)))![yaw]!;
          const at = `translate(${anchor[0] - BASE_FRAME / 2},${anchor[1] - BASE_FRAME / 2})`;
          return {
            under: `<g transform="${at}">${stroke(base.silhouette)}</g>`,
            over: `<g transform="${at}">${inner(base.svg)}</g><circle cx="${pivot[0]}" cy="${pivot[1]}" r="1.6" fill="${share < 0.5 ? "none" : "#00e5ff"}" stroke="#00e5ff" stroke-width="0.8"/>`,
          };
        });
        parts.push(
          `<svg x="${x}" y="${row}" width="${size}" height="${size}" viewBox="0 0 ${design.frame} ${design.frame}">${stroke(hull.silhouette)}${layers.map(({ under }) => under).join("")}${inner(hull.svg)}${layers.map(({ over }) => over).join("")}</svg>`,
        );
        wide = Math.max(wide, x + size + GAP);
      }
      y += Math.ceil(16 / perRow) * (size + GAP);
    }
    parts.unshift(`<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`);
    parts.push(
      `<text x="${GAP}" y="${top + 17}" font-family="DejaVu Sans" font-size="12" fill="${edge}">${design.title} (${design.prefix}-0 to -15), frame ${design.frame}: headings 0 to 15 at 1x, then at 2x with capped and destroyed bases</text>`,
    );
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/hostile-stations.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`,
  );
}

main();
