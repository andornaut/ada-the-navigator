// Andromeda's garnet drones: the shared drone and heavy models recoloured from coral to garnet,
// keeping the amber guns, the visor, General Gadget's claw ink and the wreck ember. Contract:
// art/andromeda.md (Garnet drones). Usage: node art/tools/garnet-drones.ts [--offsets <file.json>]
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import {
  amber,
  amberSide,
  coral,
  coralRear,
  coralSide,
  exportCrafts as crafts,
  gadgetJets,
  hullEntries,
  ink,
  type JetColors,
  plate,
  turretTop,
  visor,
  visorSide,
} from "./crafts.ts";
import { shards } from "./destruction.ts";
import { restrainHeavyHull } from "./heavy-restraint.ts";
import { heavySurface } from "./heavy-surface.ts";
import { svgText } from "./svg-text.ts";
import { jets, packInstalledSmallHullSheets, silhouettes, svg } from "./enemies.ts";
import {
  build,
  burn,
  ember as wreckEmber,
  heavies,
  industrialHeavies,
  packInstalledHeavyParts,
  place,
  readOffsets,
  scorch,
  scorchSide,
} from "./heavies.ts";
import {
  craftIds,
  mergeEntries,
  mergeSidecars,
  sidecarCopies,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";
import { isIndustrialHullColor } from "./retaliator-models.ts";

// ---------------------------------------------------------------- palette

// Coral turned to Oklab hue 12 at higher chroma: garnet hulls, rose plates, and soot wrecks of the
// same hue so scorch still reads on the hull.
export const garnet = {
  hull: "#e47485",
  hullSide: "#b0495b",
  hullRear: "#823643",
  plate: "#deb7b6",
  turretTop: "#c65c6d",
  scorch: "#583237",
  scorchSide: "#3f2125",
  burn: "#6b3a41",
  jetSlow: "#c1445c",
  jetFast: "#fb8898",
  jetCore: "#ffe0e0",
} as const;

// Small craft: dark fighter oxide and the interceptor's bone, violet and blue.
const smallCraftSwap = {
  "#282644": "#302541",
  "#342d58": "#493352",
  "#35252e": "#36252e",
  "#38242f": "#3d2533",
  "#474582": "#59457d",
  "#4b3038": "#51313d",
  "#4d427d": "#664781",
  "#514575": "#604465",
  "#55313a": "#613243",
  "#596ccc": "#7264c5",
  "#78443f": "#874653",
  "#8170cc": "#9c71cb",
  "#a9d9ff": "#c4d8ff",
  "#bcaac1": "#c7aec9",
  "#f1e5c9": "#f6e4dc",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Cool hull materials authored on the swarm and fighter.
const swarmFighterSwap = {
  "#202a44": "#2e263c",
  "#233940": "#352b49",
  "#263755": "#3a2d4c",
  "#2e4065": "#41354f",
  "#355b63": "#594771",
  "#374b73": "#4c3b63",
  "#405785": "#56446d",
  "#4c64a0": "#705c91",
  "#629483": "#876b9f",
  "#718bd0": "#a089b8",
  "#d5e0eb": "#d9d4e7",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Coral family colour to garnet colour, applied to every drawn file.
const swap: Readonly<Record<string, string>> = {
  ...smallCraftSwap,
  ...swarmFighterSwap,
  [coral]: garnet.hull,
  [coralSide]: garnet.hullSide,
  [coralRear]: garnet.hullRear,
  [plate]: garnet.plate,
  [turretTop]: garnet.turretTop,
  [scorch]: garnet.scorch,
  [scorchSide]: garnet.scorchSide,
  [burn]: garnet.burn,
};
// The amber guns, the visor, the claw ink and the wreck ember stay as in the coral family.
const family = new Set<string>([
  ...Object.values(garnet),
  ...Object.values(smallCraftSwap),
  ...Object.values(swarmFighterSwap),
  amber,
  amberSide,
  visor,
  visorSide,
  ink,
  wreckEmber,
]);

// Speed jets, slow to fast: a garnet tail opening to rose, round a garnet core that runs to a
// near-white rose centre.
export const garnetJets: JetColors = {
  outer: [garnet.jetSlow, garnet.jetFast],
  core: [garnet.hull, garnet.jetCore],
};
const jetSwap: Readonly<Record<string, string>> = Object.fromEntries(
  (["outer", "core"] as const).flatMap((layer) =>
    gadgetJets[layer].map((color, i) => [color, garnetJets[layer][i]!]),
  ),
);
const jetFamily = new Set<string>([...garnetJets.outer, ...garnetJets.core]);

// Swaps every coral colour in a file through `map` and fails on any colour outside `allowed`, so a
// new coral colour cannot slip through unmapped.
function swapColours(
  map: Readonly<Record<string, string>>,
  allowed: ReadonlySet<string>,
  file: string,
  text: string,
): string {
  const result = text.replace(/#[0-9a-f]{6}\b/gi, (color) => map[color.toLowerCase()] ?? color);
  for (const color of result.match(/#[0-9a-f]{6}\b/gi) ?? []) {
    const hex = color.toLowerCase();
    if (!allowed.has(hex) && !isIndustrialHullColor(file, hex)) {
      throw new Error(`${file}: ${color} is not a garnet colour`);
    }
  }
  return result;
}

export const recolourGarnet = (file: string, text: string): string =>
  swapColours(swap, family, file, text);
export const recolourGarnetJets = (file: string, text: string): string =>
  swapColours(jetSwap, jetFamily, file, text);

// ---------------------------------------------------------------- export

type Entry = Record<string, unknown> & { id: string; path?: string };

const PATH = "/art/andromeda/enemies/";
const PREFIX = "enemy-garnet-";

// A coral family entry as its garnet entry: its own id and path, tagged with the family.
const garnetEntry = (entry: Entry): Entry => ({
  ...entry,
  id: `${PREFIX}${entry.id.slice("enemy-".length)}`,
  path: `${PATH}${entry.path!.slice("/art/enemies/".length)}`,
  family: "garnet",
});

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--offsets");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const offsetsPath = at === -1 ? `${root}tools/enemy-hardpoints.json` : args[at + 1]!;
  const offsets = readOffsets(JSON.parse(readFileSync(offsetsPath, "utf8")));

  const files = new Map<string, string>();
  const entries: Entry[] = [];
  for (const craft of crafts) {
    // The coral silhouettes: notch tips drawn into the frames and collision in the jets file.
    const traced = silhouettes(craft);
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      files.set(`${craft.name}-${yaw}.svg`, svg(craft, yaw, traced[yaw]!.tips));
    }
    files.set(
      `${craft.name}-jets.json`,
      jets(craft, (yaw) => traced[yaw]!.collision),
    );
    files.set(`${craft.name}-shards.json`, shards(craft));
    entries.push(...hullEntries(craft.name, craft.frame).map(garnetEntry));
  }
  for (const craft of [...heavies, ...industrialHeavies]) {
    const styled = restrainHeavyHull(craft);
    const result = build(styled, place(offsets, styled));
    for (const [file, content] of result.files) {
      files.set(file, content);
    }
    entries.push(...result.entries.map(garnetEntry));
  }

  const dir = `${root}public/art/andromeda/enemies/`;
  mkdirSync(dir, { recursive: true });
  const texts = new Map<string, string>();
  for (const [file, content] of files) {
    const path = `${dir}${file}`;
    // Hardpoint layouts carry no colour.
    const drawn = file.endsWith(".svg") || file.endsWith("-shards.json");
    const text = file.endsWith("-jets.json")
      ? swapColours(jetSwap, jetFamily, file, content)
      : drawn
        ? (heavySurface("andromeda", file, content) ?? swapColours(swap, family, file, content))
        : content;
    // JSON goes through the project's Prettier settings so the files stay Prettier-clean.
    texts.set(
      file,
      file.endsWith(".json")
        ? await format(text, { ...(await resolveConfig(path)), filepath: path })
        : file.endsWith(".svg")
          ? svgText(text)
          : text,
    );
  }
  // The shared heavies' layouts are the coral ones in /art/enemies/, and a craft drawn like
  // another (the cargo hauler is the retaliator) uses that craft's files. Byte-identical industrial
  // hulls also use the core SVGs, checked by writeOnce against the generated bytes.
  const shared = [...heavies, ...industrialHeavies].map(({ name }) => name);
  const copies = sidecarCopies("core", "hardpoints", shared);
  for (const file of texts.keys()) {
    if (/^retaliator(?:MiningFreighter)?-\d+\.svg$/u.test(file)) {
      copies.set(file, `/art/enemies/${file}`);
    }
  }
  const heavy = packInstalledHeavyParts("andromeda", texts, entries);
  const outputEntries = packInstalledSmallHullSheets("andromeda", texts, heavy.outputEntries);
  const paths = writeOnce(PATH, copies, texts);
  // In Andromeda's manifest after the destinations, before the story craft.
  // Only these crafts' ids; hostile-station-export.ts writes `enemy-garnet-hostileStation-`.
  mergeEntries(
    "andromeda",
    craftIds(
      PREFIX,
      [...crafts, ...heavies, ...industrialHeavies].map(({ name }) => name),
    ),
    outputEntries.map((entry) => storedAt(paths, entry)),
    (id) => id.startsWith("craft-") || id.includes("portrait"),
  );
  const names = new Set([...crafts, ...heavies, ...industrialHeavies].map(({ name }) => name));
  mergeSidecars("andromeda", (craft) => names.has(craft), sidecarsIn(paths));
  console.log(`${files.size} files, ${entries.length} entries; offsets from ${offsetsPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
