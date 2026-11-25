// Review sheets of the fleet producer's craft: `node art/tools/fleet-contact-sheet.ts <dir> [name]`
// writes `<dir>/fleet-small-craft.svg`, `<dir>/fleet-retaliators.svg` and one sheet per frigate
// and capital, every heading of each craft at 1x and 2x display size on the field of each galaxy
// that flies it, with the 1 px ink keyline on light fields and Phantom's white edge. A craft with
// hardpoints is composed as the game composes it, hull then bases then tops. A retaliator shows
// once aimed ahead and once aimed 112.5 degrees off the bow; a frigate shows fully armed and
// aimed ahead, then at route positions 1 to 2 (spine and bow capped) aimed off the bow, then
// with every hardpoint destroyed. A capital shows its lance profile fully armed and aimed ahead,
// its mine profile aimed off the bow with the hopper held aft, route positions 1 to 2 (the claw
// and stern pairs capped), then every hardpoint destroyed.
import { mkdirSync, writeFileSync } from "node:fs";

import { DISPLAY_SCALE } from "./crafts.ts";
import {
  baseFrame,
  fleetCrafts,
  frame,
  HEAVY_LAYOUTS,
  heavyFrames,
  hidden,
  layerOrder,
  layerPlacement,
  placement,
  recolour,
  type Scaled,
  topFrame,
} from "./fleet.ts";
import type { FleetFamily } from "./fleet-models.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

type Field = { name: string; field: string; edge: string; family: FleetFamily };
const SUNFLOWER: Field = {
  name: "Sunflower, coral",
  field: "#D8C994",
  edge: "#181425",
  family: "coral",
};
const WHIRLPOOL: Field = {
  name: "Whirlpool, coral",
  field: "#B8CEC4",
  edge: "#181425",
  family: "coral",
};
const CARTWHEEL: Field = {
  name: "Cartwheel, claim",
  field: "#BC9D90",
  edge: "#181425",
  family: "claim",
};
const ANDROMEDA: Field = {
  name: "Andromeda, garnet",
  field: "#9298B5",
  edge: "#181425",
  family: "garnet",
};
const NEEDLE: Field = {
  name: "Needle, crimson",
  field: "#C6BBA6",
  edge: "#181425",
  family: "needle",
};
const PHANTOM: Field = {
  name: "Phantom, coral",
  field: "#514955",
  edge: "#FFFFFF",
  family: "coral",
};
const FIELDS: readonly Field[] = [SUNFLOWER, CARTWHEEL, ANDROMEDA, NEEDLE, PHANTOM];
const SCALES = [1, 2];
const GAP = 6;
const LABEL = 16;
const OFF_BOW = 5;

const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");

// One row of a craft: per heading, the keyline's silhouette and the composed frame content.
function rows(craft: Scaled): { silhouette: string; body: string }[][] {
  const headings = Array.from({ length: ENEMY_HEADINGS }, (_, index) => index);
  const hulls = headings.map((yaw) => frame(craft, yaw));
  const nested = (size: number, [x, y]: readonly [number, number], svg: string) =>
    `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner(svg)}</svg>`;
  if (craft.layers && craft.tops) {
    const drawn = heavyFrames(craft);
    const { fill, weaponTops } = HEAVY_LAYOUTS[craft.archetype as keyof typeof HEAVY_LAYOUTS];
    const capital = craft.archetype === "capital";
    // The top on each mount: the class's special weapon on `special`, its common one elsewhere.
    const load = (special: string, top: string, common: string) =>
      Object.fromEntries(fill.map((id) => [id, id === special ? top : common]));
    const lance = capital ? load("weapon-left", "lance", "spread") : load("port", "rail", "gun");
    const mine = load("stern-right", "hopper", "spread");
    const fixed = new Set(
      Object.values(weaponTops)
        .filter(({ aim }) => aim === "aft")
        .map(({ top }) => top),
    );
    const outer = new Set(fill.slice(0, capital ? 4 : 2));
    const compose = (
      state: (id: string) => string,
      tops: boolean,
      turn: number,
      armed: Record<string, string> = lance,
    ) =>
      headings.map((yaw) => ({
        silhouette: hulls[yaw]!.silhouette,
        body: layerOrder(craft, yaw)
          .map((id) => {
            if (id === "hull") return inner(hulls[yaw]!.svg);
            const layer = craft.layers!.find((entry) => entry.id === id)!;
            const { anchor, pivot } = layerPlacement(craft, layer, yaw);
            const base = nested(
              layer.frame,
              anchor,
              drawn.bases.get(`${id}-${state(id)}`)![yaw]!.svg,
            );
            if (!tops || !pivot || state(id) !== "intact" || hidden(drawn, layer, yaw)) return base;
            const name = armed[id]!;
            const aim = (yaw + (fixed.has(name) ? ENEMY_HEADINGS / 2 : turn)) % ENEMY_HEADINGS;
            return base + nested(craft.tops![name]!.frame, pivot, drawn.tops.get(name)![aim]!.svg);
          })
          .join(""),
      }));
    const early = (id: string) =>
      craft.layers!.find((layer) => layer.id === id)!.role !== "turret" || outer.has(id)
        ? "intact"
        : "capped";
    return [
      compose(() => "intact", true, 0),
      ...(capital ? [compose(() => "intact", true, OFF_BOW, mine)] : []),
      compose(early, true, OFF_BOW),
      compose(() => "destroyed", false, 0),
    ];
  }
  if (!craft.base || !craft.top) {
    return [hulls.map(({ silhouette, svg }) => ({ silhouette, body: inner(svg) }))];
  }
  const bases = headings.map((yaw) => baseFrame(craft, yaw));
  const tops = headings.map((aim) => topFrame(craft, aim));
  const [baseSize, topSize] = [craft.base.frame, craft.top.frame];
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

function sheet(crafts: readonly Scaled[], fields: readonly Field[] = FIELDS): string {
  const drawn = crafts.flatMap((craft) => rows(craft).map((row) => ({ craft, row })));
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const { name, field, edge, family } of fields) {
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
  const [out, only] = process.argv.slice(2);
  if (!out) throw new Error("Usage: node art/tools/fleet-contact-sheet.ts <dir> [name]");
  const crafts = fleetCrafts();
  const small = new Set(["swarm", "fighter", "interceptor"]);
  const keyed = (key: string) => crafts.filter((craft) => craft.key === key);
  // Each sheet's name, craft and fields. `name` limits the run to the sheets whose name has it.
  const sheets: readonly (readonly [string, Scaled[], readonly Field[]])[] = [
    ["small-craft", crafts.filter(({ archetype }) => small.has(archetype)), FIELDS],
    ["retaliators", crafts.filter(({ archetype }) => archetype === "retaliator"), FIELDS],
    ["frigate-slim-delta", keyed("fleetFrigate"), [SUNFLOWER, CARTWHEEL, PHANTOM]],
    ["frigate-twin-hull", keyed("fleetFrigateTwin"), [WHIRLPOOL, ANDROMEDA, NEEDLE]],
    ["capital-hammer", keyed("fleetCapital"), [SUNFLOWER]],
    ["capital-manta-dreadnought", keyed("fleetCapitalManta"), [WHIRLPOOL]],
    ["capital-outrigger-carrier", keyed("fleetCapitalOutrigger"), [CARTWHEEL]],
    ["capital-broad-wing", keyed("fleetCapitalBroad"), [ANDROMEDA]],
    ["capital-crossbow", keyed("fleetCapitalCrossbow"), [NEEDLE]],
    ["capital-forked-fortress", keyed("fleetCapitalForked"), [PHANTOM]],
  ];
  mkdirSync(out, { recursive: true });
  for (const [name, drawn, fields] of sheets) {
    if (only && !name.includes(only)) continue;
    writeFileSync(`${out}/fleet-${name}.svg`, sheet(drawn, fields));
  }
}

main();
