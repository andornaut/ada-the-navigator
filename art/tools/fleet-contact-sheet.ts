// Review sheets of the fleet producer's craft: `node art/tools/fleet-contact-sheet.ts <dir> [name]`
// writes `<dir>/fleet-small-craft.svg`, `<dir>/fleet-retaliators.svg` and one sheet per frigate and
// capital, every heading of each craft at 1x and 2x display size on the field of each galaxy that
// flies it, with the 1 px ink keyline. A craft with hardpoints is composed as the game composes it,
// hull then bases then tops. A retaliator shows once aimed ahead and once aimed 112.5 degrees off
// the bow; a frigate shows fully armed and aimed ahead, then at route positions 1 to 2 (spine and
// bow capped) aimed off the bow, then with every hardpoint destroyed. A capital shows its lance
// profile fully armed and aimed ahead, its mine profile aimed off the bow with the hopper held aft,
// route positions 1 to 2 (the claw and stern pairs capped), then every hardpoint destroyed.
// `<dir>/fleet-weapon-tops.svg` shows every weapon top on a mount collar at its 16 aims, at 1x, 2x
// and 4x. `<dir>/fleet-prow-lasers-{key}.svg` shows each frigate and capital at the even headings,
// fully armed and aimed ahead, then with its fixed front Lasers destroyed, then armed with a debug
// overlay: each Laser's shot origin as a ring (dashed where the hull hides the port) and the facing
// it fires along as a line.
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
  weaponTops,
} from "./fleet.ts";
import { type FleetFamily, HEAVY_TOPS, WEAPON_TOPS } from "./fleet-models.ts";
import { archie, build, place } from "./heavies.ts";
import { restrainHeavyHull } from "./heavy-restraint.ts";
import { ENEMY_HEADINGS, vector } from "./projection.ts";

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
  edge: "#181425",
  family: "coral",
};
const FIELDS: readonly Field[] = [SUNFLOWER, CARTWHEEL, ANDROMEDA, NEEDLE, PHANTOM];
const SCALES = [1, 2];
const GAP = 6;
const LABEL = 16;
const OFF_BOW = 5;

const inner = (svg: string) => svg.replace(/^<svg[^>]*>|<title>.*?<\/title>|<\/svg>$/gu, "");

// One row of a craft: per heading, the keyline's silhouette and the composed frame content.
function rows(craft: Scaled): Row[] {
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

// The prow Lasers' review rows of a frigate or capital at the even headings: armed and aimed
// ahead, with the Lasers destroyed, and armed with the shot origins and facings marked.
function prowRows(craft: Scaled): Row[] {
  const headings = Array.from({ length: ENEMY_HEADINGS / 2 }, (_, index) => index * 2);
  const hulls = headings.map((yaw) => frame(craft, yaw));
  const drawn = heavyFrames(craft);
  const layers = [...craft.layers!, ...craft.lasers!];
  const lasers = new Set(craft.lasers!.map(({ id }) => id));
  const { fill } = HEAVY_LAYOUTS[craft.archetype as keyof typeof HEAVY_LAYOUTS];
  const capital = craft.archetype === "capital";
  const special = capital ? "weapon-left" : "port";
  const armed = (id: string) =>
    id === special ? (capital ? "lance" : "rail") : capital ? "spread" : "gun";
  const nested = (size: number, [x, y]: readonly [number, number], svg: string) =>
    `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner(svg)}</svg>`;
  const compose = (destroyed: boolean, marked: boolean) =>
    headings.map((yaw, index) => {
      const body = layerOrder(craft, yaw, layers).map((id) => {
        if (id === "hull") return inner(hulls[index]!.svg);
        const layer = layers.find((entry) => entry.id === id)!;
        const { anchor, pivot } = layerPlacement(craft, layer, yaw);
        const state = destroyed && lasers.has(id) ? "destroyed" : "intact";
        const base = nested(layer.frame, anchor, drawn.bases.get(`${id}-${state}`)![yaw]!.svg);
        if (!pivot || !fill.includes(id) || hidden(drawn, layer, yaw)) return base;
        const top = craft.tops![armed(id)]!;
        return base + nested(top.frame, pivot, drawn.tops.get(armed(id))![yaw]!.svg);
      });
      const [fx, fy] = vector(ENEMY_HEADINGS, yaw, [0, -1, 0]);
      const reach = 80 / Math.hypot(fx, fy);
      const marks = marked
        ? craft.lasers!.map((layer) => {
            const [x, y] = layerPlacement(craft, layer, yaw).muzzle!;
            const dash = hidden(drawn, layer, yaw) ? ' stroke-dasharray="3 2"' : "";
            return `<line x1="${x}" y1="${y}" x2="${x + fx * reach}" y2="${y + fy * reach}" stroke="#00c853" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#ff1744" stroke-width="3"${dash}/>`;
          })
        : [];
      return { silhouette: hulls[index]!.silhouette, body: body.join("") + marks.join("") };
    });
  return [compose(false, false), compose(true, false), compose(false, true)];
}

type Row = { silhouette: string; body: string }[];

// Admiral Archie's flagship from art/tools/heavies.ts with its fixed front Lasers, in the prow
// Lasers' review rows. Its hull keyline strokes every hull polygon under the drawn hull.
function archieProw(): { frame: number; rows: Row[] } {
  const styled = restrainHeavyHull(archie);
  const { files } = build(styled, place({ version: 1, archetypes: {} }, styled));
  const layout = JSON.parse(files.get("archie-hardpoints.json")!) as {
    headings: {
      order: string[];
      hardpoints: {
        id: string;
        anchor: [number, number];
        pivot?: [number, number];
        muzzles?: [number, number][];
      }[];
    }[];
  };
  const lasers = new Set(styled.hardpoints.filter(({ model }) => model.muzzle).map(({ id }) => id));
  const fill = new Set(styled.mounts!.fill);
  const frameOf = (svg: string) => Number(/viewBox="0 0 (\d+)/u.exec(svg)![1]);
  const nested = (file: string, [x, y]: readonly [number, number]) => {
    const svg = files.get(file)!;
    const size = frameOf(svg);
    return `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner(svg.replace(/<svg[^>]*>/u, "").replace("</svg>", ""))}</svg>`;
  };
  const headings = Array.from({ length: ENEMY_HEADINGS / 2 }, (_, index) => index * 2);
  const compose = (destroyed: boolean, marked: boolean): Row =>
    headings.map((yaw) => {
      const heading = layout.headings[yaw]!;
      const hull = files
        .get(`archie-${yaw}.svg`)!
        .replace(/<svg[^>]*>|<title>.*?<\/title>|<\/svg>/gu, "");
      const body = heading.order.map((id) => {
        if (id === "hull") return hull;
        const placed = heading.hardpoints.find((part) => part.id === id)!;
        const state = destroyed && lasers.has(id) ? "destroyed" : "intact";
        const base = nested(`archie-${id}-${state}-${yaw}.svg`, placed.anchor);
        if (!placed.pivot || !fill.has(id)) return base;
        const top = id === "weapon-left" ? "lance" : "spread";
        return base + nested(`archie-${top}-top-${yaw}.svg`, placed.pivot);
      });
      const [fx, fy] = vector(ENEMY_HEADINGS, yaw, [0, -1, 0]);
      const reach = 80 / Math.hypot(fx, fy);
      const marks = marked
        ? heading.hardpoints
            .filter(({ id }) => lasers.has(id))
            .map(({ muzzles }) => {
              const [x, y] = muzzles![0]!;
              return `<line x1="${x}" y1="${y}" x2="${x + fx * reach}" y2="${y + fy * reach}" stroke="#00c853" stroke-width="3"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#ff1744" stroke-width="3"/>`;
            })
        : [];
      const silhouette = [...hull.matchAll(/points="([^"]+)"/gu)]
        .map(([, points]) => `M${points!.trim().split(/\s+/u).join("L")}Z`)
        .join("");
      return { silhouette, body: body.join("") + marks.join("") };
    });
  return {
    frame: styled.frame,
    rows: [compose(false, false), compose(true, false), compose(false, true)],
  };
}
function sheet<T extends { frame: number }>(
  crafts: readonly T[],
  fields: readonly Field[],
  rowsOf: (craft: T) => Row[],
  label = "headings 0 to 15",
): string {
  const drawn = crafts.flatMap((craft) => rowsOf(craft).map((row) => ({ craft, row })));
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
        `<text x="${GAP}" y="${top + 12}" font-family="DejaVu Sans" font-size="11" fill="${edge}">${name}, ${scale}x, ${label}</text>`,
        ...cells,
      );
      y += GAP;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}"><rect width="100%" height="100%" fill="#F4F4F2"/>${parts.join("")}</svg>\n`;
}

// Every weapon top on a mount collar at its 16 aims, at 1x, 2x and 4x on each family's field.
function topSheet(): string {
  const { gun, pod, dome, triple, dish } = WEAPON_TOPS;
  const { rail } = HEAVY_TOPS.frigate;
  const { spread, lance, hopper } = HEAVY_TOPS.capital;
  const set = weaponTops({
    gun: gun!,
    triple: triple!,
    dish: dish!,
    pod: pod!,
    rail: { build: rail! },
    spread: { build: spread! },
    lance: { build: lance! },
    hopper: { build: hopper! },
    dome: dome!,
  });
  const cell = Math.max(set.collarFrame, ...set.tops.map(({ top }) => top.frame));
  const nested = (size: number, svg: string) =>
    `<svg x="${(cell - size) / 2}" y="${(cell - size) / 2}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner(svg)}</svg>`;
  const parts: string[] = [];
  let y = GAP;
  let width = 0;
  for (const { name, field, edge, family } of FIELDS) {
    for (const scale of [1, 2, 4]) {
      const top = y;
      const size = cell * DISPLAY_SCALE * scale;
      const cells: string[] = [];
      y += LABEL;
      for (const design of set.tops) {
        let x = GAP;
        for (const frame of design.frames) {
          const outline = (silhouette: string, frameSize: number) =>
            `<path transform="translate(${(cell - frameSize) / 2} ${(cell - frameSize) / 2})" d="${silhouette}" fill="none" stroke="${edge}" stroke-width="${2 / DISPLAY_SCALE}" stroke-miterlimit="2.5"/>`;
          cells.push(
            `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 ${cell} ${cell}" overflow="visible">${outline(set.collar.silhouette, set.collarFrame)}${outline(frame.silhouette, design.top.frame)}${recolour(family, nested(set.collarFrame, set.collar.svg) + nested(design.top.frame, frame.svg))}</svg>`,
          );
          x += size + GAP;
        }
        cells.push(
          `<text x="${x}" y="${y + size / 2 + 4}" font-family="DejaVu Sans" font-size="11" fill="${edge}">${design.name}</text>`,
        );
        width = Math.max(width, x + 60);
        y += size + GAP;
      }
      parts.push(
        `<rect x="0" y="${top}" width="100%" height="${y - top}" fill="${field}"/>`,
        `<text x="${GAP}" y="${top + 12}" font-family="DejaVu Sans" font-size="11" fill="${edge}">${name}, ${scale}x, aims 0 to 15</text>`,
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
    writeFileSync(`${out}/fleet-${name}.svg`, sheet(drawn, fields, rows));
  }
  if (!only || "prow-lasers".includes(only)) {
    const heavies: readonly (readonly [string, readonly Field[]])[] = [
      ["fleetFrigate", [SUNFLOWER, CARTWHEEL, PHANTOM]],
      ["fleetFrigateTwin", [WHIRLPOOL, ANDROMEDA, NEEDLE]],
      ["fleetCapital", [SUNFLOWER]],
      ["fleetCapitalManta", [WHIRLPOOL]],
      ["fleetCapitalOutrigger", [CARTWHEEL]],
      ["fleetCapitalBroad", [ANDROMEDA]],
      ["fleetCapitalCrossbow", [NEEDLE]],
      ["fleetCapitalForked", [PHANTOM]],
    ];
    for (const [key, fields] of heavies) {
      writeFileSync(
        `${out}/fleet-prow-lasers-${key}.svg`,
        sheet(keyed(key), fields, prowRows, "even headings 0 to 14"),
      );
    }
    writeFileSync(
      `${out}/fleet-prow-lasers-archie.svg`,
      sheet([archieProw()], [PHANTOM], ({ rows: drawn }) => drawn, "even headings 0 to 14"),
    );
  }
  if (!only || "weapon-tops".includes(only)) {
    writeFileSync(`${out}/fleet-weapon-tops.svg`, topSheet());
  }
}

main();
