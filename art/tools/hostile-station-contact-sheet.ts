// Review sheet of the hostile station producer: `node art/tools/hostile-station-contact-sheet.ts
// <dir> [tops]` writes `<dir>/hostile-stations.svg`, each design at its 16 headings on its field
// with the enemy keyline, at 1x and at 2x. Each design shows its galaxy's armed count: the mounts
// past it are capped, and at 2x the first mount is destroyed. `tops` is a folder holding the
// enemy fleet's top sheets under their public paths (`enemies/fleetTop-pod-sheet.svg` and so on);
// with it each armed mount the hull does not hide carries its top, aimed outward. A dot marks
// each top's pivot, hollow where the hull hides the mount.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import { baseKey, DESIGNS, draw, order } from "./hostile-stations.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

const FIELDS: Readonly<Record<string, { field: string; edge: string }>> = {
  core: { field: "#514955", edge: "#181425" },
  cartwheel: { field: "#BC9D90", edge: "#181425" },
  andromeda: { field: "#9298B5", edge: "#181425" },
};
// The mounts each design arms where its galaxy flies it, and the top each mount carries.
const ARMED: Readonly<Record<string, number>> = {
  hostileStationCoral: 8,
  hostileStationClaim: 7,
  hostileStationGarnet: 6,
  platformWheel: 2,
};
const topOf = (key: string, mount: string) =>
  key === "platformWheel" ? "turret" : mount === "weapon-5" ? "dome" : "pod";
const SHEETS: Readonly<Record<string, string>> = { turret: "gun", pod: "pod", dome: "dome" };
const BASE_FRAME = 32;
const GAP = 8;
const LABEL = 26;
const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");

function main() {
  const [out, tops] = process.argv.slice(2);
  if (!out) throw new Error("Usage: node art/tools/hostile-station-contact-sheet.ts <dir> [tops]");
  const sheets = new Map<string, string>();
  // One top's root: its frame size and content.
  const top = (folder: string, name: string, id: string) => {
    const path = `${tops}/${folder}fleetTop-${SHEETS[name]}-sheet.svg`;
    if (!tops || !existsSync(path)) return undefined;
    if (!sheets.has(path)) sheets.set(path, readFileSync(path, "utf8"));
    const root = new RegExp(`<svg id="${id}"[^>]* width="(\\d+)"[^>]*>(.*?)</svg>`, "u").exec(
      sheets.get(path)!,
    );
    if (!root) throw new Error(`${path} has no ${id}`);
    return { size: Number(root[1]), body: root[2]!.replace(/<title>.*?<\/title>/u, "") };
  };
  const parts: string[] = [];
  let y = 0;
  let wide = 0;
  for (const source of DESIGNS) {
    const drawn = draw(source);
    const { design, hulls, bases, placements } = drawn;
    const { field, edge } = FIELDS[design.manifest]!;
    const folder = design.manifest === "core" ? "enemies/" : `${design.manifest}/enemies/`;
    const mounts = design.mounts.map(({ id }) => id);
    const armed = ARMED[design.key]!;
    const start = y;
    y += LABEL;
    for (const [scale, perRow] of [
      [1, 16],
      [2, 8],
    ] as const) {
      const k = DISPLAY_SCALE * scale;
      const size = design.frame * k;
      const state = (id: string) =>
        mounts.indexOf(id) >= armed
          ? "capped"
          : scale === 2 && mounts.indexOf(id) === 0
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
          // An outward top: the aim that faces the way the mount stands from the hull's axis.
          const mount = design.mounts.find((m) => m.id === id)!.at;
          const outward = Math.round((Math.atan2(mount[1], mount[0]) / Math.PI) * 8);
          const aim = (((yaw + outward) % ENEMY_HEADINGS) + ENEMY_HEADINGS) % ENEMY_HEADINGS;
          const name = topOf(design.key, id);
          const carried =
            state(id) === "intact" && share >= 0.5
              ? top(folder, name, `${design.prefix}-${name}-top-${aim}`)
              : undefined;
          const dot = `<circle cx="${pivot[0]}" cy="${pivot[1]}" r="1.6" fill="${share < 0.5 ? "none" : "#00e5ff"}" stroke="#00e5ff" stroke-width="0.8"/>`;
          return {
            under: `<g transform="${at}">${stroke(base.silhouette)}</g>`,
            over:
              `<g transform="${at}">${inner(base.svg)}</g>` +
              (carried
                ? `<g transform="translate(${pivot[0] - carried.size / 2},${pivot[1] - carried.size / 2})">${carried.body}</g>`
                : dot),
          };
        });
        parts.push(
          `<svg x="${x}" y="${row}" width="${size}" height="${size}" viewBox="0 0 ${design.frame} ${design.frame}">${stroke(hull.silhouette)}${layers.map(({ under }) => under).join("")}${inner(hull.svg)}${layers.map(({ over }) => over).join("")}</svg>`,
        );
        wide = Math.max(wide, x + size + GAP);
      }
      y += Math.ceil(16 / perRow) * (size + GAP);
    }
    parts.unshift(`<rect x="0" y="${start}" width="100%" height="${y - start}" fill="${field}"/>`);
    parts.push(
      `<text x="${GAP}" y="${start + 17}" font-family="DejaVu Sans" font-size="12" fill="${edge}">${design.title} (${design.prefix}-0 to -15), frame ${design.frame}, ${armed} of ${mounts.length} mounts armed: headings 0 to 15 at 1x, then at 2x with the first mount destroyed</text>`,
    );
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/hostile-stations.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`,
  );
}

main();
