import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { format, resolveConfig } from "prettier";

import { recolour, recolourJets } from "./claim-jumpers.ts";
import { DISPLAY_SCALE, hullEntries } from "./crafts.ts";
import { svgText } from "./svg-text.ts";
import { writeUiIcon } from "./ui-icon-sources.ts";
import { recolourGarnet, recolourGarnetJets } from "./garnet-drones.ts";
import { build, place, STATION_FILL } from "./heavies.ts";
import { hostileStation } from "./hostile-station.ts";
import { rebaseStationField, stationFieldSvg } from "./hostile-station-field.ts";
import { hostileStationIcon } from "./hostile-station-icon.ts";
import {
  craftIds,
  GALAXIES,
  type ManifestFile,
  mergeEntries,
  mergeSidecars,
  readManifest,
  type Sidecars,
  sidecarCopies,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

type Entry = { id: string; path?: string } & Record<string, unknown>;
type Family = {
  manifest: ManifestFile;
  directory: string;
  prefix: string;
  family?: string;
  installedVariant?: "phantom" | "andromeda";
  colour: (file: string, text: string) => string;
  jets: (file: string, text: string) => string;
};
const unchanged = (_file: string, text: string) => text;
const claimFamily: Family = {
  manifest: "cartwheel",
  directory: "cartwheel/enemies",
  prefix: "enemy-claim-",
  family: "claim",
  colour: recolour,
  jets: recolourJets,
};
const families: Family[] = [
  {
    manifest: "core",
    directory: "enemies",
    prefix: "enemy-",
    installedVariant: "phantom",
    colour: unchanged,
    jets: unchanged,
  },
  {
    manifest: "andromeda",
    directory: "andromeda/enemies",
    prefix: "enemy-garnet-",
    family: "garnet",
    installedVariant: "andromeda",
    colour: recolourGarnet,
    jets: recolourGarnetJets,
  },
  claimFamily,
];

const WEAPON_STATES = ["intact", "destroyed", "capped"] as const;
const COLUMNS = 4;
const TOPS = ["pod", "dome"] as const;
const TOP_COUNT = TOPS.length * ENEMY_HEADINGS;
const WEAPON_BASE_COUNT = STATION_FILL.length * WEAPON_STATES.length * ENEMY_HEADINGS;
const stationWeaponBase = ({ archetype, hardpoint, top }: Entry) =>
  archetype === "hostileStation" &&
  top === undefined &&
  typeof hardpoint === "string" &&
  STATION_FILL.some((mount) => mount === hardpoint);

const stationVariants = new Map<ManifestFile, string>([
  ["core", "phantom"],
  ["andromeda", "andromeda"],
]);

// A selected variant owns its hull and layout as a pair. Leave that family to its exporter.
function retainsVariant(root: string, family: Family): boolean {
  const variant = stationVariants.get(family.manifest);
  if (!variant) return false;

  const manifest = readManifest(family.manifest);
  const sidecar = (manifest.sidecars as Sidecars | undefined)?.hostileStation?.hardpoints;
  const base = `/art/${family.directory}/hostileStation-${variant}`;
  const layout = `${base}-hardpoints.json`;
  const usesVariantSheet = (row: Entry) => row.path?.startsWith(`${base}-sheet-`) === true;
  const hulls: Entry[] = manifest.assets.filter(
    (row: Entry) =>
      row.archetype === "hostileStation" && row.top === undefined && row.hardpoint === undefined,
  );
  if (sidecar !== layout && !hulls.some(usesVariantSheet)) return false;

  const rows = new Map(hulls.map((row) => [row.id, row]));
  const exists = (url: string) => existsSync(root + url.slice("/art/".length));
  if (
    sidecar !== layout ||
    !exists(layout) ||
    hulls.length !== ENEMY_HEADINGS ||
    rows.size !== ENEMY_HEADINGS ||
    Array.from({ length: ENEMY_HEADINGS }, (_, heading) => {
      const row = rows.get(`${family.prefix}hostileStation-${heading}`);
      return (
        row?.directionIndex === heading &&
        row.svgSheet === true &&
        usesVariantSheet(row) &&
        exists(row.path!)
      );
    }).includes(false)
  ) {
    throw new Error(`Incomplete hostile station variant selection: ${family.manifest}`);
  }
  return true;
}

function weaponBaseFrames(
  family: Family,
  entries: readonly Entry[],
  standalone: (file: string) => string | undefined,
) {
  const directory = `/art/${family.directory}/`;
  const selected = entries.filter(stationWeaponBase);
  const rows = new Map(selected.map((entry) => [entry.id, entry]));
  const packed = selected.filter(({ svgSheet }) => svgSheet === true).length;
  if (
    selected.length !== WEAPON_BASE_COUNT ||
    rows.size !== WEAPON_BASE_COUNT ||
    (packed !== 0 && packed !== WEAPON_BASE_COUNT)
  ) {
    throw new Error(
      `${family.manifest}: expected ${WEAPON_BASE_COUNT} station weapon bases, all standalone or all sheets`,
    );
  }
  const groups = [];
  for (const hardpoint of STATION_FILL) {
    for (const state of WEAPON_STATES) {
      const group = `hostileStation-${hardpoint}-${state}`;
      const sheet = `${group}-sheet.svg`;
      const path = directory + sheet;
      const first = rows.get(`${family.prefix}${group}-0`);
      const width = first?.width;
      const height = first?.height;
      if (typeof width !== "number" || width <= 0 || typeof height !== "number" || height <= 0) {
        throw new Error(`Missing station weapon base group: ${family.prefix}${group}`);
      }
      const frames = Array.from({ length: ENEMY_HEADINGS }, (_, heading) => {
        const id = `${family.prefix}${group}-${heading}`;
        const file = `${group}-${heading}.svg`;
        const entry = rows.get(id);
        if (
          !entry ||
          entry.path !== (packed ? path : directory + file) ||
          entry.family !== family.family ||
          entry.hardpoint !== hardpoint ||
          entry.state !== state ||
          entry.directionIndex !== heading ||
          entry.width !== width ||
          entry.height !== height ||
          typeof entry.displayWidth !== "number" ||
          entry.displayWidth <= 0 ||
          entry.displayWidth > width ||
          typeof entry.displayHeight !== "number" ||
          entry.displayHeight <= 0 ||
          entry.displayHeight > height
        ) {
          throw new Error(`Invalid station weapon base: ${id}`);
        }
        const svg = standalone(file);
        const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.displayWidth}" height="${entry.displayHeight}" viewBox="0 0 ${width} ${height}">`;
        if (!svg?.startsWith(root) || !svg.endsWith("</svg>")) {
          throw new Error(
            `Station weapon base does not match its manifest dimensions: ${directory}${file}`,
          );
        }
        return { entry, file, svg };
      });
      groups.push({ sheet, path, width, height, frames });
    }
  }
  return groups;
}

function weaponBaseMember({ id }: Entry, x: number, y: number, svg: string): string {
  return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
}

function weaponBaseSheet(width: number, height: number, roots: readonly string[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${roots.join("")}</svg>\n`;
}

// Stock exports keep the named 16-frame groups until the manifest selects pages.
function weaponBaseSheets(
  family: Family,
  entries: readonly Entry[],
  standalone: (file: string) => string | undefined,
) {
  const sheets = new Map<string, string>();
  const replacements = new Map<string, Entry>();
  const sourceFiles = new Set<string>();
  for (const { sheet, path, width, height, frames } of weaponBaseFrames(
    family,
    entries,
    standalone,
  )) {
    const roots = frames.map(({ entry, file, svg }, heading) => {
      const x = (heading % COLUMNS) * width;
      const y = Math.floor(heading / COLUMNS) * height;
      replacements.set(entry.id, { ...entry, path, svgSheet: true });
      sourceFiles.add(file);
      return weaponBaseMember(entry, x, y, svg);
    });
    sheets.set(
      sheet,
      weaponBaseSheet(width * COLUMNS, height * Math.ceil(ENEMY_HEADINGS / COLUMNS), roots),
    );
  }
  return { replacements, sheets, sourceFiles };
}

const WEAPON_PAGE_WIDTH = 1024;
const WEAPON_PAGE_HEIGHT = 768;
const WEAPON_BASE_SIZE = 64;
const WEAPON_BASE_DISPLAY = 28;
const WEAPON_PAGE_COUNT = 2;
const WEAPON_PAGE_MEMBERS = WEAPON_BASE_COUNT / WEAPON_PAGE_COUNT;
const weaponPageFile = (page: number) => `hostileStation-weapon-bases-page-${page}.svg`;
const weaponPagePath = (family: Family, page: number) =>
  `/art/${family.directory}/${weaponPageFile(page)}`;

function weaponBasePages(
  family: Family,
  entries: readonly Entry[],
  standalone: (file: string) => string | undefined,
) {
  const frames = new Map(
    weaponBaseFrames(family, entries, standalone).flatMap(({ frames }) =>
      frames.map((frame) => [frame.entry.id, frame] as const),
    ),
  );
  const ids = [...frames.keys()].sort();
  const replacements = new Map<string, Entry>();
  const sheets = new Map<string, string>();
  const sourceFiles = new Set<string>();
  for (let page = 1; page <= WEAPON_PAGE_COUNT; page++) {
    const pageIds = ids.slice((page - 1) * WEAPON_PAGE_MEMBERS, page * WEAPON_PAGE_MEMBERS);
    const rectangles = pageIds.map((id) => {
      const { width, height, displayWidth, displayHeight } = frames.get(id)!.entry;
      if (
        width !== WEAPON_BASE_SIZE ||
        height !== WEAPON_BASE_SIZE ||
        displayWidth !== WEAPON_BASE_DISPLAY ||
        displayHeight !== WEAPON_BASE_DISPLAY
      ) {
        throw new Error(`Invalid station weapon page dimensions: ${id}`);
      }
      return { width, height };
    });
    const packed = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: WEAPON_PAGE_WIDTH, widths: [WEAPON_PAGE_WIDTH] },
      [{ rectangles, value: page }],
    )?.pages;
    const layout = packed?.[0];
    const slots = layout?.placed[0]?.at;
    if (
      packed?.length !== 1 ||
      layout?.width !== WEAPON_PAGE_WIDTH ||
      layout.height !== WEAPON_PAGE_HEIGHT ||
      slots?.length !== WEAPON_PAGE_MEMBERS
    ) {
      throw new Error(`Station weapon page does not fit: ${family.manifest} ${page}`);
    }
    const path = weaponPagePath(family, page);
    const roots = pageIds.map((id, index) => {
      const { entry, file, svg } = frames.get(id)!;
      const { x, y } = slots[index]!;
      replacements.set(id, { ...entry, path, svgSheet: true });
      sourceFiles.add(file);
      return weaponBaseMember(entry, x, y, svg);
    });
    sheets.set(weaponPageFile(page), weaponBaseSheet(layout.width, layout.height, roots));
  }
  return { replacements, sheets, sourceFiles };
}

// The retained migration reads the installed group sheets, whose loose bases may be retired.
function retainedWeaponBaseRoots(root: string, family: Family) {
  const groups = new Map<string, Map<string, string>>();
  return (file: string): string | undefined => {
    const stem = file.replace(/-\d+\.svg$/u, "");
    let roots = groups.get(stem);
    if (!roots) {
      const path = `${root}${family.directory}/${stem}-sheet.svg`;
      const text = readFileSync(path, "utf8");
      const members = Array.from(
        text.matchAll(/<svg id="([^"]+)" x="\d+" y="\d+" ([\s\S]*?<\/svg>)/gu),
        ([, id, svg]) => [id!, "<svg " + svg] as const,
      );
      roots = new Map(members);
      if (members.length !== ENEMY_HEADINGS || roots.size !== ENEMY_HEADINGS) {
        throw new Error(`Invalid retained station weapon bases: ${path}`);
      }
      groups.set(stem, roots);
    }
    return roots.get(family.prefix + file.slice(0, -".svg".length));
  };
}

// Cartwheel alone retains the original 568-frame station hull. Keep the 9/7 split
// from the checked station layout and keep each drawable root at intrinsic size.
const CLAIM_HULL_SHEET_EDGE = 1704;
const CLAIM_DISPLAY_SHEET = "hostileStation-sheet-display-1.svg";
const claimDisplayPath = `/art/${claimFamily.directory}/${CLAIM_DISPLAY_SHEET}`;
const claimHull = ({ id }: Entry) => /^enemy-claim-hostileStation-\d+$/u.test(id);

function selectsClaimDisplaySheet(entries: readonly Entry[]): boolean {
  const selected = entries.filter(({ path }) => path === claimDisplayPath);
  if (!selected.length) return false;
  if (
    selected.length !== ENEMY_HEADINGS ||
    new Set(selected.map(({ id }) => id)).size !== ENEMY_HEADINGS ||
    selected.some((row) => !claimHull(row) || row.svgSheet !== true)
  ) {
    throw new Error("CLAIM display sheet requires all sixteen selected hull frames");
  }
  return true;
}

function claimHullSheets(
  entries: readonly Entry[],
  standalone: (file: string) => string | undefined,
  displayCells: boolean,
) {
  const directory = `/art/${claimFamily.directory}/`;
  const group = "hostileStation";
  const selected = entries.filter(claimHull);
  const rows = new Map(selected.map((entry) => [entry.id, entry]));
  const packed = selected.filter(({ svgSheet }) => svgSheet === true).length;
  if (
    selected.length !== ENEMY_HEADINGS ||
    rows.size !== ENEMY_HEADINGS ||
    (packed !== 0 && packed !== ENEMY_HEADINGS)
  ) {
    throw new Error("Expected all sixteen CLAIM hull frames as standalone roots or sheets");
  }
  const replacements = new Map<string, Entry>();
  const sheets = new Map<string, string>();
  const sourceFiles = new Set<string>();
  const firstRow = rows.get(`${claimFamily.prefix}${group}-0`);
  const width = firstRow?.width;
  const height = firstRow?.height;
  if (typeof width !== "number" || width <= 0 || typeof height !== "number" || height <= 0) {
    throw new Error(`Missing station hull group: ${claimFamily.prefix}${group}`);
  }
  const displayWidth = firstRow?.displayWidth;
  const displayHeight = firstRow?.displayHeight;
  let cellWidth = width;
  let cellHeight = height;
  if (displayCells) {
    if (
      typeof displayWidth !== "number" ||
      !Number.isFinite(displayWidth) ||
      displayWidth <= 0 ||
      displayWidth > width ||
      typeof displayHeight !== "number" ||
      !Number.isFinite(displayHeight) ||
      displayHeight <= 0 ||
      displayHeight > height
    ) {
      throw new Error("Missing CLAIM display cell dimensions");
    }
    cellWidth = Math.ceil(displayWidth);
    cellHeight = Math.ceil(displayHeight);
  }
  const columns = displayCells
    ? COLUMNS
    : Math.min(COLUMNS, Math.floor(CLAIM_HULL_SHEET_EDGE / Math.max(width, height)));
  if (columns < 1) throw new Error(`Station hull frame does not fit: ${group}`);
  const capacity = columns * columns;
  const wide = cellWidth * columns;
  if (
    displayCells &&
    (capacity !== ENEMY_HEADINGS || Math.max(wide, cellHeight * columns) > CLAIM_HULL_SHEET_EDGE)
  ) {
    throw new Error("CLAIM display sheet exceeds its checked layout");
  }
  for (let first = 0; first < ENEMY_HEADINGS; first += capacity) {
    const pageCount = Math.min(capacity, ENEMY_HEADINGS - first);
    const tall = cellHeight * Math.ceil(pageCount / columns);
    const sheet = displayCells
      ? CLAIM_DISPLAY_SHEET
      : first === 0
        ? `${group}-sheet.svg`
        : `${group}-sheet-${first / capacity + 1}.svg`;
    const path = directory + sheet;
    const layout = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: Math.max(wide, tall), widths: [wide] },
      [
        {
          rectangles: Array.from({ length: pageCount }, () => ({
            width: cellWidth,
            height: cellHeight,
          })),
          value: group,
        },
      ],
    )?.pages[0];
    if (!layout || layout.height !== tall)
      throw new Error(`Station hull page does not fit: ${sheet}`);

    const roots = Array.from({ length: pageCount }, (_, cell) => {
      const heading = first + cell;
      const id = `${claimFamily.prefix}${group}-${heading}`;
      const file = `${group}-${heading}.svg`;
      const entry = rows.get(id);
      if (
        !entry ||
        entry.path !== (packed ? path : directory + file) ||
        entry.family !== claimFamily.family ||
        entry.top !== undefined ||
        entry.hardpoint !== undefined ||
        entry.archetype !== group ||
        entry.directionIndex !== heading ||
        entry.width !== width ||
        entry.height !== height ||
        typeof entry.displayWidth !== "number" ||
        entry.displayWidth <= 0 ||
        entry.displayWidth > width ||
        typeof entry.displayHeight !== "number" ||
        entry.displayHeight <= 0 ||
        entry.displayHeight > height ||
        (displayCells &&
          (entry.displayWidth !== displayWidth || entry.displayHeight !== displayHeight))
      ) {
        throw new Error(`Invalid station hull: ${id}`);
      }
      const svg = standalone(file);
      const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.displayWidth}" height="${entry.displayHeight}" viewBox="0 0 ${width} ${height}">`;
      if (!svg?.startsWith(root) || !svg.endsWith("</svg>")) {
        throw new Error(`Station hull does not match its manifest dimensions: ${directory}${file}`);
      }
      const { x, y } = layout.placed[0]!.at[cell]!;
      replacements.set(id, { ...entry, path, svgSheet: true });
      sourceFiles.add(file);
      return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
    });
    sheets.set(
      sheet,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${tall}" viewBox="0 0 ${wide} ${tall}">${roots.join("")}</svg>\n`,
    );
  }
  return { replacements, sheets, sourceFiles };
}

function writeClaimHullSheets(plan: ReturnType<typeof claimHullSheets>): void {
  const directory = `/art/${claimFamily.directory}/`;
  const owned = new Set([...plan.sheets.keys()].map((file) => directory + file));
  const manifests: ManifestFile[] = ["core", ...GALAXIES];
  for (const manifest of manifests) {
    const referrer = readManifest(manifest).assets.find(
      ({ id, path }) =>
        path !== undefined &&
        owned.has(path) &&
        (manifest !== "cartwheel" || !plan.replacements.has(id)),
    );
    if (referrer) throw new Error(`CLAIM hull page path is already used by ${referrer.id}`);
  }
  const paths = writeOnce(directory, new Map(), plan.sheets);
  mergeEntries(
    "cartwheel",
    (id) => plan.replacements.has(id),
    [...plan.replacements.values()].map((entry) => storedAt(paths, entry)),
  );
}

const stationTop = ({ archetype, top }: Entry) =>
  archetype === "hostileStation" && top !== undefined;

function stationTopSheets(
  family: Family,
  entries: readonly Entry[],
  standalone: (file: string) => string | undefined,
) {
  const directory = `/art/${family.directory}/`;
  const selected = entries.filter(stationTop);
  const rows = new Map(selected.map((entry) => [entry.id, entry]));
  const packed = selected.filter(({ svgSheet }) => svgSheet === true).length;
  if (
    selected.length !== TOP_COUNT ||
    rows.size !== TOP_COUNT ||
    (packed && packed !== TOP_COUNT)
  ) {
    throw new Error(
      `${family.manifest}: expected ${TOP_COUNT} station tops, all standalone or all sheets`,
    );
  }

  const replacements = new Map<string, Entry>();
  const sheets = new Map<string, string>();
  const sourceFiles = new Set<string>();
  for (const top of TOPS) {
    const group = `hostileStation-${top}-top`;
    const sheet = `${group}-sheet.svg`;
    const path = directory + sheet;
    const first = rows.get(`${family.prefix}${group}-0`);
    const width = first?.width;
    const height = first?.height;
    if (typeof width !== "number" || width <= 0 || typeof height !== "number" || height <= 0) {
      throw new Error(`Missing station top group: ${family.prefix}${group}`);
    }
    const wide = width * COLUMNS;
    const tall = height * (ENEMY_HEADINGS / COLUMNS);
    const layout = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: Math.max(wide, tall), widths: [wide] },
      [
        {
          rectangles: Array.from({ length: ENEMY_HEADINGS }, () => ({ width, height })),
          value: group,
        },
      ],
    )?.pages[0];
    if (!layout || layout.height !== tall)
      throw new Error(`Station top group does not fit: ${group}`);

    const roots = Array.from({ length: ENEMY_HEADINGS }, (_, aim) => {
      const id = `${family.prefix}${group}-${aim}`;
      const file = `${group}-${aim}.svg`;
      const entry = rows.get(id);
      if (
        !entry ||
        entry.path !== (packed ? path : directory + file) ||
        entry.family !== family.family ||
        entry.top !== top ||
        entry.hardpoint !== undefined ||
        entry.aimIndex !== aim ||
        entry.width !== width ||
        entry.height !== height ||
        typeof entry.displayWidth !== "number" ||
        entry.displayWidth <= 0 ||
        entry.displayWidth > width ||
        typeof entry.displayHeight !== "number" ||
        entry.displayHeight <= 0 ||
        entry.displayHeight > height
      ) {
        throw new Error(`Invalid station top: ${id}`);
      }
      const svg = standalone(file);
      const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${entry.displayWidth}" height="${entry.displayHeight}" viewBox="0 0 ${width} ${height}">`;
      if (!svg?.startsWith(root) || !svg.endsWith("</svg>")) {
        throw new Error(`Station top does not match its manifest dimensions: ${directory}${file}`);
      }
      const { x, y } = layout.placed[0]!.at[aim]!;
      replacements.set(id, { ...entry, path, svgSheet: true });
      sourceFiles.add(file);
      return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
    });
    sheets.set(
      sheet,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${tall}" viewBox="0 0 ${wide} ${tall}">${roots.join("")}</svg>\n`,
    );
  }
  return { replacements, sheets, sourceFiles };
}

function packRetainedParts(root: string, pack: typeof weaponBaseSheets): void {
  const manifests: ManifestFile[] = ["core", ...GALAXIES];
  const allAssets: Entry[] = manifests.flatMap((name) => readManifest(name).assets);
  const plans = families.map((family) => {
    const directory = `/art/${family.directory}/`;
    const plan = pack(family, readManifest(family.manifest).assets, (file) =>
      readFileSync(`${root}${family.directory}/${file}`, "utf8"),
    );
    const owned = new Set([...plan.sheets.keys()].map((file) => directory + file));
    const referrer = allAssets.find(
      ({ id, path }) => path !== undefined && owned.has(path) && !plan.replacements.has(id),
    );
    if (referrer) throw new Error(`Station part sheet path is already used by ${referrer.id}`);
    return { ...plan, family, directory };
  });
  for (const { directory, family, replacements, sheets } of plans) {
    const paths = writeOnce(directory, new Map(), sheets);
    mergeEntries(
      family.manifest,
      (id) => replacements.has(id),
      [...replacements.values()].map((entry) => storedAt(paths, entry)),
    );
  }
}

/** Exports the existing v1 assembly only after the canonical station size is available. */
async function main() {
  const root = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const [option, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    (option !== undefined &&
      option !== "--icon-only" &&
      option !== "--weapon-base-sheets" &&
      option !== "--weapon-base-pages" &&
      option !== "--top-sheets" &&
      option !== "--variant-candidate" &&
      option !== "--claim-hull-sheets")
  ) {
    throw new Error(
      "Usage: node art/tools/hostile-station-export.ts [--icon-only|--weapon-base-sheets|--weapon-base-pages|--top-sheets|--claim-hull-sheets|--variant-candidate]",
    );
  }
  if (option === "--weapon-base-sheets") {
    packRetainedParts(root, weaponBaseSheets);
    return;
  }
  if (option === "--weapon-base-pages") {
    packRetainedParts(root, (family, entries) =>
      weaponBasePages(family, entries, retainedWeaponBaseRoots(root, family)),
    );
    return;
  }
  if (option === "--top-sheets") {
    packRetainedParts(root, stationTopSheets);
    return;
  }
  if (option === "--variant-candidate") {
    const { exportStationVariants } = await import("./hostile-station-variants.ts");
    await exportStationVariants(
      root,
      fileURLToPath(
        new URL("../../.check-results/hostile-station-variant-output/", import.meta.url),
      ),
    );
    return;
  }
  const craft = hostileStation();
  const iconOnly = option === "--icon-only";
  const claimHullsOnly = option === "--claim-hull-sheets";
  const retained = new Set(
    iconOnly || claimHullsOnly ? [] : families.filter((family) => retainsVariant(root, family)),
  );
  const result = iconOnly ? undefined : build(craft, place({ version: 1, archetypes: {} }, craft));
  if (!claimHullsOnly) {
    writeUiIcon("map-hostile-station", svgText(hostileStationIcon(craft)));
  }
  if (!result) return;
  const layoutFile = `${craft.name}-hardpoints.json`;
  const { field, layout } = rebaseStationField(result.files.get(layoutFile)!);
  const hullFiles = new Set(
    hullEntries(craft.name, craft.frame).map(({ path }) => path.split("/").at(-1)!),
  );
  const coreRetained = retained.has(families[0]!);
  for (const family of claimHullsOnly ? [claimFamily] : families) {
    if (retained.has(family)) continue;
    const manifest = readManifest(family.manifest);
    const directory = `${root}${family.directory}/`;
    mkdirSync(directory, { recursive: true });
    const texts = new Map<string, string>();
    for (const [file, content] of result.files) {
      const path = directory + file;
      const text =
        file === layoutFile
          ? layout
          : file.endsWith("-jets.json")
            ? family.jets(file, content)
            : file.endsWith(".svg")
              ? family.colour(file, content)
              : content;
      texts.set(
        file,
        file.endsWith(".json")
          ? await format(text, { ...(await resolveConfig(path)), filepath: path })
          : file.endsWith(".svg")
            ? svgText(
                hullFiles.has(file)
                  ? stationFieldSvg(field, family.family === "claim", text)
                  : text,
              )
            : text,
      );
    }
    const claimDisplay = family === claimFamily && selectsClaimDisplaySheet(manifest.assets);
    if (claimHullsOnly) {
      writeClaimHullSheets(
        claimHullSheets(manifest.assets, (file) => texts.get(file), claimDisplay),
      );
      return;
    }
    // Unselected recolours share the legacy layout, even when core selects a variant.
    const shared =
      family.manifest === "core"
        ? new Map<string, string>()
        : coreRetained
          ? new Map([[layoutFile, `/art/enemies/${layoutFile}`]])
          : sidecarCopies("core", "hardpoints", [craft.name]);
    const publicDir = `/art/${family.directory}/`;
    const entries = result.entries.map((entry): Entry => {
      const file = typeof entry.path === "string" ? entry.path.split("/").at(-1) : undefined;
      return {
        ...entry,
        ...(file ? { path: publicDir + file } : {}),
        ...(file && hullFiles.has(file)
          ? {
              width: field.frame,
              height: field.frame,
              displayWidth: field.frame * DISPLAY_SCALE,
              displayHeight: field.frame * DISPLAY_SCALE,
            }
          : {}),
        id: family.prefix + entry.id.slice("enemy-".length),
        ...(family.family ? { family: family.family } : {}),
      };
    });
    const current: Entry[] = manifest.assets;
    const installed = current.filter(stationWeaponBase);
    const packed = installed.filter(({ svgSheet }) => svgSheet === true).length;
    if (packed && (installed.length !== WEAPON_BASE_COUNT || packed !== WEAPON_BASE_COUNT)) {
      throw new Error(`Partial station weapon sheet installation in ${family.manifest}`);
    }
    const paged = installed.some(
      ({ path }) => path === weaponPagePath(family, 1) || path === weaponPagePath(family, 2),
    );
    if (paged && packed !== WEAPON_BASE_COUNT) {
      throw new Error(`Partial station weapon page installation in ${family.manifest}`);
    }
    const packBases = paged ? weaponBasePages : weaponBaseSheets;
    const pack = packed ? packBases(family, entries, (file) => texts.get(file)) : undefined;
    if (paged && installed.some((row) => !isDeepStrictEqual(row, pack?.replacements.get(row.id)))) {
      throw new Error(
        `Station weapon page selection differs from canonical source: ${family.manifest}`,
      );
    }
    const installedHulls = family === claimFamily ? current.filter(claimHull) : [];
    const hullPack = installedHulls.some(({ svgSheet }) => svgSheet === true)
      ? claimHullSheets(entries, (file) => texts.get(file), claimDisplay)
      : undefined;
    if (
      hullPack &&
      (installedHulls.length !== hullPack.replacements.size ||
        installedHulls.some((row) => !isDeepStrictEqual(row, hullPack.replacements.get(row.id))))
    ) {
      throw new Error("CLAIM hull selection differs from the generated rows");
    }
    const installedTops = current.filter(stationTop);
    const topSelected = installedTops.some(
      (row) => row.svgSheet === true || row.path?.endsWith("-sheet.svg"),
    );
    let topPack: ReturnType<typeof stationTopSheets> | undefined;
    if (topSelected) {
      if (
        installedTops.length !== TOP_COUNT ||
        installedTops.some(({ svgSheet }) => svgSheet !== true)
      ) {
        throw new Error(`Partial station top sheet installation in ${family.manifest}`);
      }
      topPack = stationTopSheets(family, entries, (file) => texts.get(file));
      for (const row of installedTops) {
        if (!isDeepStrictEqual(row, topPack.replacements.get(row.id))) {
          throw new Error(`Station top selection differs from the canonical source: ${row.id}`);
        }
      }
    }
    for (const selected of [pack, hullPack, topPack]) {
      if (!selected) continue;
      for (const file of selected.sourceFiles) texts.delete(file);
      for (const [file, svg] of selected.sheets) texts.set(file, svg);
    }
    const paths = writeOnce(publicDir, shared, texts);
    mergeEntries(
      family.manifest,
      craftIds(family.prefix, [craft.name]),
      entries.map((entry) =>
        storedAt(
          paths,
          hullPack?.replacements.get(entry.id) ??
            topPack?.replacements.get(entry.id) ??
            pack?.replacements.get(entry.id) ??
            entry,
        ),
      ),
    );
    mergeSidecars(family.manifest, (name) => name === craft.name, sidecarsIn(paths));
  }
  console.log(
    `${craft.name}: ${families.length - retained.size} legacy families, ${retained.size} retained variants`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
