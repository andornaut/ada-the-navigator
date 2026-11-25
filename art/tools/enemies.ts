import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type Craft,
  exportCrafts as allCrafts,
  drawOrder,
  faces,
  gadgetJets,
  hullEntries,
  jetsFile,
} from "./crafts.ts";
import { writeEnemyAssets } from "./enemy-jet-output.ts";
import { traceEnemyFills } from "./enemy-outline.ts";
import { packInstalledIndustrialHulls } from "./industrial-sheets.ts";
import { svgText } from "./svg-text.ts";
import {
  GALAXIES,
  fleetArchetypes,
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
const SMALL_FAMILIES = { andromeda: "garnet", cartwheel: "claim", needle: "needle" } as const;
type SmallFamilyManifest = keyof typeof SMALL_FAMILIES;
type AssetRow = { id: string; path?: string } & Record<string, unknown>;
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

export function packHullRoots(
  frame: number,
  sources: readonly { id: string; svg: string }[],
): string {
  const namespace = 'xmlns="http://www.w3.org/2000/svg"';
  const root = (size: number) =>
    `<svg ${namespace} width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  if (sources.length !== ENEMY_HEADINGS) throw new Error("A hull sheet needs 16 headings");
  const roots = sources.map(({ id, svg }, heading) => {
    if (!svg.startsWith(root(frame)) || !svg.endsWith("</svg>")) {
      throw new Error(`Invalid raw SVG dimensions for ${id}`);
    }
    const x = (heading % SHEET_COLUMNS) * frame;
    const y = Math.floor(heading / SHEET_COLUMNS) * frame;
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  return `${root(frame * SHEET_COLUMNS)}${roots.join("")}</svg>\n`;
}

function hullSheet(craft: Craft, traced: ReturnType<typeof silhouettes>) {
  const rows = hullEntries(craft.name, craft.frame);
  const sources = rows.map(({ id, directionIndex: heading }) => ({
    id,
    svg: svgText(svg(craft, heading, traced[heading]!.tips)),
  }));
  return {
    text: packHullRoots(craft.frame, sources),
    entries: rows.map(({ id, path, ...metadata }) => ({
      id,
      path: path.replace(/[^/]+$/u, sheetFile(craft)),
      svgSheet: true,
      ...metadata,
    })),
  };
}

function familyHullSheets(
  manifest: SmallFamilyManifest,
  entries: readonly AssetRow[],
  source: (file: string) => string | undefined,
  selecting: boolean,
) {
  const directory = `/art/${manifest}/enemies/`;
  const installed: AssetRow[] = readManifest(manifest).assets;
  const registered = new Map(installed.map((row) => [row.id, row]));
  const input = new Map(entries.map((row) => [row.id, row]));
  const groups = [];
  // The enemy fleet's craft have their own sheets (art/tools/fleet.ts).
  const fleet = fleetArchetypes(manifest);
  for (const name of SHEET_HULLS.filter((hull) => !fleet.has(hull))) {
    const family = SMALL_FAMILIES[manifest];
    const prefix = `enemy-${family}-${name}-`;
    const file = `${name}-sheet.svg`;
    const path = directory + file;
    const ids = Array.from({ length: ENEMY_HEADINGS }, (_, heading) => prefix + heading);
    const packed = ids.filter((id) => registered.get(id)?.svgSheet === true).length;
    if (!selecting && packed === 0) continue;
    if (packed !== (selecting ? 0 : ENEMY_HEADINGS)) {
      throw new Error(`Unexpected sheet selection for ${manifest} ${name}`);
    }
    const frame = input.get(ids[0]!)?.width;
    if (typeof frame !== "number" || !Number.isInteger(frame) || frame <= 0) {
      throw new Error(`Invalid raw frame for ${manifest} ${name}`);
    }
    const loose = ids.map((_, heading) => `${name}-${heading}.svg`);
    const originals = new Set(loose.map((file) => directory + file));
    const members = ids.map((id, heading) => {
      const entry = input.get(id);
      const original = directory + loose[heading]!;
      if (
        entry?.path !== original ||
        entry.directionIndex !== heading ||
        entry.family !== family ||
        entry.archetype !== name ||
        entry.width !== frame ||
        entry.height !== frame ||
        registered.get(id)?.path !== (selecting ? original : path)
      ) {
        throw new Error(`Unexpected family hull frame: ${id}`);
      }
      const svg = source(loose[heading]!);
      if (svg === undefined) throw new Error(`Missing family hull source: ${original}`);
      return { entry, svg };
    });
    const owned = new Set(ids);
    const other = [
      ...installed.filter(({ id }) => !owned.has(id)),
      ...["core" as const, ...GALAXIES]
        .filter((name) => name !== manifest)
        .flatMap((name): AssetRow[] => readManifest(name).assets),
    ];
    const referrer = other.find(
      ({ path: candidate }) => candidate === path || (candidate && originals.has(candidate)),
    );
    if (referrer) throw new Error(`Family hull art is also used by ${referrer.id}`);
    groups.push({
      file,
      loose,
      text: packHullRoots(
        frame,
        members.map(({ entry, svg }) => ({ id: entry.id, svg })),
      ),
      rows: members.map(({ entry }) => ({ ...entry, path, svgSheet: true })),
    });
  }
  return { directory, groups };
}

function writeReviewFamilySheets(): void {
  const manifests = Object.keys(SMALL_FAMILIES) as SmallFamilyManifest[];
  const plans = manifests.map((manifest) => {
    const directory = `/art/${manifest}/enemies/`;
    return {
      manifest,
      ...familyHullSheets(
        manifest,
        readManifest(manifest).assets,
        (file) => readFileSync(art + directory.slice("/art/".length) + file, "utf8"),
        true,
      ),
    };
  });
  for (const { directory, groups } of plans) {
    for (const { file, text } of groups) {
      const target = art + directory.slice("/art/".length) + file;
      if (existsSync(target) && readFileSync(target, "utf8") !== text) {
        throw new Error(`Review sheet already exists with different bytes: ${target}`);
      }
    }
  }
  for (const { directory, groups } of plans) {
    writeOnce(directory, new Map(), new Map(groups.map(({ file, text }) => [file, text])));
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(
        plans.map(({ manifest, groups }) => [manifest, groups.flatMap(({ rows }) => rows)]),
      ),
      null,
      2,
    ),
  );
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
  if (args.length === 1 && args[0] === "--family-small-hull-sheets") {
    writeReviewFamilySheets();
    return;
  }
  const selectedName = SHEET_HULLS.find((name) => args[0] === `--${name}-sheet`);
  if (args.length !== (selectedName ? 1 : 0)) {
    throw new Error(
      "Usage: node art/tools/enemies.ts [--fighter-sheet|--interceptor-sheet|--swarm-sheet|--family-small-hull-sheets]",
    );
  }
  const core = readManifest("core").assets;
  // The enemy fleet's craft are its own; this tool draws the rest.
  const fleet = fleetArchetypes("core");
  const crafts = allCrafts.filter(({ name }) => !fleet.has(name));
  const sheetCrafts = SHEET_HULLS.flatMap((name) => crafts.filter((craft) => craft.name === name));
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
  const outputEntries = packInstalledIndustrialHulls(files, entries);
  const paths = writeEnemyAssets("core", "/art/enemies/", new Map(), files);

  // Only this tool's hull frames, in place; heavies.ts owns the other `enemy-` entries.
  const names = crafts.map(({ name }) => name).join("|");
  const hull = new RegExp(`^enemy-(${names})-\\d+$`);
  mergeEntries(
    "core",
    (id) => hull.test(id),
    outputEntries.map((entry) => storedAt(paths, entry)),
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
