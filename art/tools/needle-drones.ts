// Needle's drones: the shared drone and heavy models recoloured into crimson lacquer, with silver
// plates and Gadget's amber guns, as the claim jumpers are for Cartwheel. Contract: art/needle.md
// (Needle drones) and art/heavies.md.
// Usage: node art/tools/needle-drones.ts [--offsets <file.json>]
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
import { heavySurface } from "./heavy-surface.ts";
import { svgText } from "./svg-text.ts";
import { jets, silhouettes, svg } from "./enemies.ts";
import {
  build,
  burn,
  ember as wreckEmber,
  heavies,
  industrialHeavies,
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

// Crimson lacquer at Oklab hue 14, redder than coral (39) and the claim jumpers' rust (50), with
// plates in Needle's silver and a darker soot so wrecks read on crimson.
export const needle = {
  crimson: "#d65b6c",
  crimsonSide: "#a14350",
  crimsonRear: "#75313a",
  plate: "#d7cfc9",
  turretTop: "#b44858",
  scorch: "#452a2c",
  scorchSide: "#2e1d1e",
  burn: "#58302f",
} as const;

// Small craft: dark fighter oxide and the interceptor's bone, violet and blue.
const smallCraftSwap = {
  "#282644": "#242a45",
  "#342d58": "#30395d",
  "#35252e": "#30232b",
  "#38242f": "#39252e",
  "#474582": "#464f89",
  "#4b3038": "#4d2d3a",
  "#4d427d": "#4b5084",
  "#514575": "#4d4b76",
  "#55313a": "#5e2e3e",
  "#596ccc": "#536ece",
  "#78443f": "#793947",
  "#8170cc": "#7c79d0",
  "#a9d9ff": "#aedfff",
  "#bcaac1": "#b1b5cd",
  "#f1e5c9": "#f0ece4",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Cool hull materials authored on the swarm and fighter.
const swarmFighterSwap = {
  "#202a44": "#202937",
  "#233940": "#253548",
  "#263755": "#26334b",
  "#2e4065": "#293950",
  "#355b63": "#384e68",
  "#374b73": "#324664",
  "#405785": "#3a5278",
  "#4c64a0": "#4c668c",
  "#629483": "#5c7794",
  "#718bd0": "#728eaf",
  "#d5e0eb": "#d6e2eb",
} satisfies Readonly<Record<`#${string}`, `#${string}`>>;

// Coral family colour to Needle colour. Gadget's amber guns and dark visor are unchanged.
const swap: Readonly<Record<string, string>> = {
  ...smallCraftSwap,
  ...swarmFighterSwap,
  [coral]: needle.crimson,
  [coralSide]: needle.crimsonSide,
  [coralRear]: needle.crimsonRear,
  [plate]: needle.plate,
  [turretTop]: needle.turretTop,
  [scorch]: needle.scorch,
  [scorchSide]: needle.scorchSide,
  [burn]: needle.burn,
};
const family = new Set<string>([
  ...Object.values(needle),
  ...Object.values(smallCraftSwap),
  ...Object.values(swarmFighterSwap),
  amber,
  amberSide,
  visor,
  visorSide,
  ink,
  wreckEmber,
]);

// Speed jets, slow to fast: a deep crimson tail opening to rose, round a crimson core that runs to
// a near-white warm centre.
const needleJets: JetColors = {
  outer: ["#993847", "#ed7477"],
  core: [needle.crimson, "#ffe7e9"],
};
const jetSwap: Readonly<Record<string, string>> = Object.fromEntries(
  (["outer", "core"] as const).flatMap((layer) =>
    gadgetJets[layer].map((color, i) => [color, needleJets[layer][i]!]),
  ),
);
const jetFamily = new Set<string>([...needleJets.outer, ...needleJets.core]);

// Swaps every coral colour in a file through `map` and fails on any colour outside `allowed`.
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
      throw new Error(`${file}: ${color} is not a Needle drone colour`);
    }
  }
  return result;
}

type Entry = Record<string, unknown> & { id: string; path?: string };

const PATH = "/art/needle/enemies/";
const PREFIX = "enemy-needle-";

const needleEntry = (entry: Entry): Entry => ({
  ...entry,
  id: `${PREFIX}${entry.id.slice("enemy-".length)}`,
  path: `${PATH}${entry.path!.slice("/art/enemies/".length)}`,
  family: "needle",
});

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
  entries.push(...hullEntries(craft.name, craft.frame).map(needleEntry));
}
for (const craft of [...heavies, ...industrialHeavies]) {
  const result = build(craft, place(offsets, craft));
  for (const [file, content] of result.files) {
    files.set(file, content);
  }
  entries.push(...result.entries.map(needleEntry));
}

const dir = `${root}public/art/needle/enemies/`;
mkdirSync(dir, { recursive: true });
const texts = new Map<string, string>();
for (const [file, content] of files) {
  const path = `${dir}${file}`;
  // Hardpoint layouts carry no colour.
  const drawn = file.endsWith(".svg") || file.endsWith("-shards.json");
  const text = file.endsWith("-jets.json")
    ? swapColours(jetSwap, jetFamily, file, content)
    : drawn
      ? (heavySurface("needle", file, content) ?? swapColours(swap, family, file, content))
      : content;
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
const paths = writeOnce(PATH, copies, texts);
// In Needle's manifest after the gates and debris, before the story craft.
// Only these crafts' ids, not the whole `enemy-needle-` family prefix.
mergeEntries(
  "needle",
  craftIds(
    PREFIX,
    [...crafts, ...heavies, ...industrialHeavies].map(({ name }) => name),
  ),
  entries.map((entry) => storedAt(paths, entry)),
  (id) => id.startsWith("craft-"),
);
const names = new Set([...crafts, ...heavies, ...industrialHeavies].map(({ name }) => name));
mergeSidecars("needle", (craft) => names.has(craft), sidecarsIn(paths));
console.log(`${files.size} files, ${entries.length} entries; offsets from ${offsetsPath}`);
