// Needle's drones: the shared drone and heavy models recoloured into crimson lacquer, with silver
// plates and Gadget's amber guns, as the claim jumpers are for Cartwheel. Contract: art/needle.md
// (Needle drones) and art/heavies.md.
// Usage: node art/tools/needle-drones.ts [--offsets <file.json>]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import {
  amber,
  amberSide,
  coral,
  coralRear,
  coralSide,
  crafts,
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
import { jets, silhouettes, svg } from "./enemies.ts";
import {
  build,
  burn,
  ember as wreckEmber,
  heavies,
  place,
  readOffsets,
  scorch,
  scorchSide,
} from "./heavies.ts";
import { replaceEntries } from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

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

// Coral family colour to Needle colour. Gadget's amber guns and dark visor are unchanged.
const swap: Readonly<Record<string, string>> = {
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
    if (!allowed.has(color.toLowerCase())) {
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
for (const craft of heavies) {
  const result = build(craft, place(offsets, craft));
  for (const [file, content] of result.files) {
    files.set(file, content);
  }
  entries.push(...result.entries.map(needleEntry));
}

const dir = `${root}public/art/needle/enemies/`;
mkdirSync(dir, { recursive: true });
for (const [file, content] of files) {
  const path = `${dir}${file}`;
  // Hardpoint layouts carry no colour.
  const drawn = file.endsWith(".svg") || file.endsWith("-shards.json");
  const text = file.endsWith("-jets.json")
    ? swapColours(jetSwap, jetFamily, file, content)
    : drawn
      ? swapColours(swap, family, file, content)
      : content;
  writeFileSync(
    path,
    file.endsWith(".json")
      ? await format(text, { ...(await resolveConfig(path)), filepath: path })
      : text,
  );
}
// In Needle's manifest after the gates and debris, before the story craft.
replaceEntries(
  "needle",
  (id) => id.startsWith(PREFIX),
  entries,
  (id) => id.startsWith("craft-"),
);
console.log(`${files.size} files, ${entries.length} entries; offsets from ${offsetsPath}`);
