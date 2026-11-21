import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type Craft,
  exportCrafts as crafts,
  drawOrder,
  faces,
  gadgetJets,
  hullEntries,
  jetsFile,
} from "./crafts.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { svgText } from "./svg-text.ts";
import {
  GALAXIES,
  mergeEntries,
  mergeSidecars,
  readManifest,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";
import { anchor, ENEMY_HEADINGS, project, vector } from "./projection.ts";
import { type Fill, type V2 } from "./silhouette.ts";

const art = fileURLToPath(new URL("../../public/art/", import.meta.url));
const output = `${art}enemies/`;
const SHEET_COLUMNS = 4;
const SHEET_HULLS = ["fighter", "interceptor", "swarm"] as const;
const sheetFile = (craft: Craft) => `${craft.name}-sheet.svg`;
// Douglas-Peucker tolerance for the hull silhouettes, in frame px. At 0.5 the small swarm and
// interceptor frames fall below the intersection-over-union floor.
const SILHOUETTE_TOLERANCE = 0.4;

const point = (text: string) => text.split(",").map(Number) as V2;
const text = (points: readonly V2[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);

// The frame's polygons in draw order, in frame px rounded as the SVG writes them.
function drawn(craft: Craft, yaw: number): Fill[] {
  const centre = craft.frame / 2;
  return drawOrder(yaw, craft.parts[0]!.z1, craft.parts)
    .flatMap((part) => faces(yaw, part))
    .map(({ color, points }) => ({
      color,
      points: points.map((p) => point(project(centre, p))),
    }));
}

// `tips` fill notch tips under the facets, as the drawn silhouette cuts them.
export function svg(craft: Craft, yaw: number, tips: readonly Fill[] = []): string {
  const polygons = [...tips, ...drawn(craft, yaw)].map(
    ({ color, points }) => `  <polygon fill="${color}" points="${text(points).join(" ")}"/>`,
  );
  const size = craft.frame;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `  <title>${craft.title} ${yaw} idle</title>`,
    ...polygons,
    "</svg>",
    "",
  ].join("\n");
}

// Each heading's drawn silhouette as convex parts in frame px, traced from the frame's fills
// (no strokes, so no growth), and its notch tips.
export function silhouettes(craft: Craft): { collision: V2[][]; tips: Fill[] }[] {
  return Array.from({ length: ENEMY_HEADINGS }, (_, yaw) =>
    traceEnemyFills(
      `${craft.name} ${yaw}`,
      drawn(craft, yaw),
      [craft.frame, craft.frame],
      [SILHOUETTE_TOLERANCE],
    ),
  );
}

// `collision` adds each heading's drawn silhouette after its mouths.
export function jets(craft: Craft, collision?: (yaw: number) => V2[][]): string {
  const centre = craft.frame / 2;
  const half = craft.mouthWidth / 2;
  return jetsFile(
    craft.frame,
    (yaw) =>
      craft.mouths.map(([x, y]) => ({
        anchor: anchor(ENEMY_HEADINGS, centre, yaw, [x, y, craft.mouthZ ?? 2]),
        axis: vector(ENEMY_HEADINGS, yaw, [0, 1, 0]),
        half: vector(ENEMY_HEADINGS, yaw, [-half, 0, 0]),
      })),
    gadgetJets,
    {},
    (yaw) => (collision ? { collision: collision(yaw) } : {}),
  );
}

function hullSheet(craft: Craft, traced: ReturnType<typeof silhouettes>) {
  const rows = hullEntries(craft.name, craft.frame);
  const size = craft.frame * SHEET_COLUMNS;
  const roots = rows.map(({ id, directionIndex: heading }) => {
    const standalone = svgText(svg(craft, heading, traced[heading]!.tips));
    const x = (heading % SHEET_COLUMNS) * craft.frame;
    const y = Math.floor(heading / SHEET_COLUMNS) * craft.frame;
    return `<svg id="${id}" x="${x}" y="${y}" ${standalone.slice("<svg ".length)}`;
  });
  return {
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${roots.join("")}</svg>\n`,
    entries: rows.map(({ id, path, ...metadata }) => ({
      id,
      path: path.replace(/[^/]+$/u, sheetFile(craft)),
      svgSheet: true,
      ...metadata,
    })),
  };
}

function removeStandaloneHulls(craft: Craft) {
  for (const { directionIndex } of hullEntries(craft.name, craft.frame)) {
    rmSync(`${output}${craft.name}-${directionIndex}.svg`, { force: true });
  }
}

type CoreAssets = ReturnType<typeof readManifest>["assets"];

function sheetInstalled(core: CoreAssets, selecting: boolean, craft: Craft): boolean {
  const standalone = new Map(
    hullEntries(craft.name, craft.frame).map(({ id, path }) => [id, path]),
  );
  const rows = core.filter(({ id }) => standalone.has(id));
  const sheets = rows.filter((row) => "svgSheet" in row && row.svgSheet === true);
  if (!selecting && sheets.length === 0) return false;

  const installed = sheets.length === standalone.size;
  const sheetPath = `/art/enemies/${sheetFile(craft)}`;
  if (
    rows.length !== standalone.size ||
    (!installed && sheets.length > 0) ||
    rows.some(
      (row) => !("path" in row) || row.path !== (installed ? sheetPath : standalone.get(row.id)),
    )
  ) {
    throw new Error(
      `The core ${craft.name} set must own its 16 standalone frames or share one sheet`,
    );
  }
  const ownedPaths = new Set([...standalone.values(), sheetPath]);
  const otherRows = [
    ...core.filter(({ id }) => !standalone.has(id)),
    ...GALAXIES.flatMap((galaxy) => readManifest(galaxy).assets),
  ];
  const referrer = otherRows.find(
    (row) => "path" in row && typeof row.path === "string" && ownedPaths.has(row.path),
  );
  if (referrer) {
    throw new Error(`The core ${craft.name} sheet would change the art owned by ${referrer.id}`);
  }
  return installed;
}

function main() {
  const args = process.argv.slice(2);
  const selectedName = SHEET_HULLS.find((name) => args[0] === `--${name}-sheet`);
  if (args.length !== (selectedName ? 1 : 0)) {
    throw new Error(
      "Usage: node art/tools/enemies.ts [--fighter-sheet|--interceptor-sheet|--swarm-sheet]",
    );
  }
  const core = readManifest("core").assets;
  const sheetCrafts = SHEET_HULLS.map((name) => crafts.find((craft) => craft.name === name)!);
  if (selectedName) {
    const craft = sheetCrafts.find(({ name }) => name === selectedName)!;
    sheetInstalled(core, true, craft);
    const { text, entries } = hullSheet(craft, silhouettes(craft));
    const target = output + sheetFile(craft);
    if (!existsSync(target) || readFileSync(target, "utf8") !== text) {
      writeFileSync(target, text);
    }
    const ids = new Set(entries.map(({ id }) => id));
    mergeEntries("core", (id) => ids.has(id), entries);
    removeStandaloneHulls(craft);
    return;
  }

  const installed = new Set(sheetCrafts.filter((craft) => sheetInstalled(core, false, craft)));
  mkdirSync(output, { recursive: true });
  const files = new Map<string, string>();
  const entries = [];
  for (const craft of crafts) {
    const traced = silhouettes(craft);
    files.set(
      `${craft.name}-jets.json`,
      jets(craft, (yaw) => traced[yaw]!.collision),
    );
    if (installed.has(craft)) {
      const sheet = hullSheet(craft, traced);
      files.set(sheetFile(craft), sheet.text);
      entries.push(...sheet.entries);
    } else {
      for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
        files.set(`${craft.name}-${yaw}.svg`, svgText(svg(craft, yaw, traced[yaw]!.tips)));
      }
      entries.push(...hullEntries(craft.name, craft.frame));
    }
  }
  // A craft drawn like another (the cargo hauler is the retaliator) uses that craft's files.
  const paths = writeOnce("/art/enemies/", new Map(), files);

  // Only this tool's hull frames, in place; heavies.ts owns the other `enemy-` entries.
  const names = crafts.map(({ name }) => name).join("|");
  const hull = new RegExp(`^enemy-(${names})-\\d+$`);
  mergeEntries(
    "core",
    (id) => hull.test(id),
    entries.map((entry) => storedAt(paths, entry)),
  );
  for (const craft of installed) removeStandaloneHulls(craft);
  // These crafts' jets; heavies.ts writes the hardpoints and destruction.ts the shards.
  const jetCrafts = new Set(crafts.map(({ name }) => name));
  mergeSidecars(
    "core",
    (craft, kind) => kind === "jets" && jetCrafts.has(craft),
    sidecarsIn(paths),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
