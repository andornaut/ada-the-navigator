import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { recolour, recolourJets } from "./claim-jumpers.ts";
import { DISPLAY_SCALE, hullEntries } from "./crafts.ts";
import { svgText } from "./svg-text.ts";
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
  colour: (file: string, text: string) => string;
  jets: (file: string, text: string) => string;
};
const unchanged = (_file: string, text: string) => text;
const families: Family[] = [
  { manifest: "core", directory: "enemies", prefix: "enemy-", colour: unchanged, jets: unchanged },
  {
    manifest: "andromeda",
    directory: "andromeda/enemies",
    prefix: "enemy-garnet-",
    family: "garnet",
    colour: recolourGarnet,
    jets: recolourGarnetJets,
  },
  {
    manifest: "cartwheel",
    directory: "cartwheel/enemies",
    prefix: "enemy-claim-",
    family: "claim",
    colour: recolour,
    jets: recolourJets,
  },
];

const WEAPON_STATES = ["intact", "destroyed", "capped"] as const;
const COLUMNS = 4;
const WEAPON_BASE_COUNT = STATION_FILL.length * WEAPON_STATES.length * ENEMY_HEADINGS;
const stationWeaponBase = ({ archetype, hardpoint, top }: Entry) =>
  archetype === "hostileStation" &&
  top === undefined &&
  typeof hardpoint === "string" &&
  STATION_FILL.some((mount) => mount === hardpoint);

// Match the capital sheet contract: 16 independent, intrinsically sized roots in raw-sized cells.
function weaponBaseSheets(
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
  const sheets = new Map<string, string>();
  const replacements = new Map<string, Entry>();
  const sourceFiles = new Set<string>();
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
      const roots = Array.from({ length: ENEMY_HEADINGS }, (_, heading) => {
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
        const x = (heading % COLUMNS) * width;
        const y = Math.floor(heading / COLUMNS) * height;
        replacements.set(id, { ...entry, path, svgSheet: true });
        sourceFiles.add(file);
        return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
      });
      const wide = width * COLUMNS;
      const tall = height * Math.ceil(ENEMY_HEADINGS / COLUMNS);
      sheets.set(
        sheet,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${tall}" viewBox="0 0 ${wide} ${tall}">${roots.join("")}</svg>\n`,
      );
    }
  }
  return { replacements, sheets, sourceFiles };
}

function packRetainedWeaponBases(root: string): void {
  const manifests: ManifestFile[] = ["core", ...GALAXIES];
  const allAssets: Entry[] = manifests.flatMap((name) => readManifest(name).assets);
  const plans = families.map((family) => {
    const directory = `/art/${family.directory}/`;
    const plan = weaponBaseSheets(family, readManifest(family.manifest).assets, (file) =>
      readFileSync(`${root}${family.directory}/${file}`, "utf8"),
    );
    const owned = new Set([...plan.sheets.keys()].map((file) => directory + file));
    const referrer = allAssets.find(
      ({ id, path }) => path !== undefined && owned.has(path) && !plan.replacements.has(id),
    );
    if (referrer) throw new Error(`Station weapon sheet path is already used by ${referrer.id}`);
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
    (option !== undefined && option !== "--icon-only" && option !== "--weapon-base-sheets")
  ) {
    throw new Error(
      "Usage: node art/tools/hostile-station-export.ts [--icon-only|--weapon-base-sheets]",
    );
  }
  if (option === "--weapon-base-sheets") {
    packRetainedWeaponBases(root);
    return;
  }
  const craft = hostileStation();
  const iconOnly = option === "--icon-only";
  const result = iconOnly ? undefined : build(craft, place({ version: 1, archetypes: {} }, craft));
  const iconDirectory = `${root}ui/icons/`;
  mkdirSync(iconDirectory, { recursive: true });
  writeFileSync(`${iconDirectory}map-hostile-station.svg`, svgText(hostileStationIcon(craft)));
  if (!result) return;
  const layoutFile = `${craft.name}-hardpoints.json`;
  const { field, layout } = rebaseStationField(result.files.get(layoutFile)!);
  const hullFiles = new Set(
    hullEntries(craft.name, craft.frame).map(({ path }) => path.split("/").at(-1)!),
  );
  for (const family of families) {
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
    // The layout carries no colour: the recoloured families use the coral family's copy,
    // which the first family writes.
    const shared =
      family.manifest === "core"
        ? new Map<string, string>()
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
    const current: Entry[] = readManifest(family.manifest).assets;
    const installed = current.filter(stationWeaponBase);
    const packed = installed.filter(({ svgSheet }) => svgSheet === true).length;
    if (packed && (installed.length !== WEAPON_BASE_COUNT || packed !== WEAPON_BASE_COUNT)) {
      throw new Error(`Partial station weapon sheet installation in ${family.manifest}`);
    }
    const pack = packed ? weaponBaseSheets(family, entries, (file) => texts.get(file)) : undefined;
    if (pack) {
      for (const file of pack.sourceFiles) texts.delete(file);
      for (const [file, svg] of pack.sheets) texts.set(file, svg);
    }
    const paths = writeOnce(publicDir, shared, texts);
    mergeEntries(
      family.manifest,
      craftIds(family.prefix, [craft.name]),
      entries.map((entry) => storedAt(paths, pack?.replacements.get(entry.id) ?? entry)),
    );
    mergeSidecars(family.manifest, (name) => name === craft.name, sidecarsIn(paths));
  }
  console.log(
    `${craft.name}: three existing families, ${result.files.size} native files per family`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
