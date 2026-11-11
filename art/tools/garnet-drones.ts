// Andromeda's garnet drones: the shared drone and heavy models recoloured from coral to garnet,
// keeping the amber guns, the visor, General Gadget's claw ink and the wreck ember. Contract:
// art/andromeda.md (Garnet drones). Usage: node art/tools/garnet-drones.ts [--offsets <file.json>]
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
import { jets, svg } from "./enemies.ts";
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

// Coral family colour to garnet colour, applied to every drawn file.
const swap: Readonly<Record<string, string>> = {
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
    if (!allowed.has(color.toLowerCase())) {
      throw new Error(`${file}: ${color} is not a garnet colour`);
    }
  }
  return result;
}

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
    for (let yaw = 0; yaw < ENEMY_HEADINGS; yaw++) {
      files.set(`${craft.name}-${yaw}.svg`, svg(craft, yaw));
    }
    files.set(`${craft.name}-jets.json`, jets(craft));
    files.set(`${craft.name}-shards.json`, shards(craft));
    entries.push(...hullEntries(craft.name, craft.frame).map(garnetEntry));
  }
  for (const craft of heavies) {
    const result = build(craft, place(offsets, craft));
    for (const [file, content] of result.files) {
      files.set(file, content);
    }
    entries.push(...result.entries.map(garnetEntry));
  }

  const dir = `${root}public/art/andromeda/enemies/`;
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
    // JSON goes through the project's Prettier settings so the files stay Prettier-clean.
    writeFileSync(
      path,
      file.endsWith(".json")
        ? await format(text, { ...(await resolveConfig(path)), filepath: path })
        : text,
    );
  }
  // In Andromeda's manifest after the destinations, before the story craft.
  replaceEntries(
    "andromeda",
    (id) => id.startsWith(PREFIX),
    entries,
    (id) => id.startsWith("craft-") || id.includes("portrait"),
  );
  console.log(`${files.size} files, ${entries.length} entries; offsets from ${offsetsPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
