import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { recolour, recolourJets } from "./claim-jumpers.ts";
import { DISPLAY_SCALE, hullEntries } from "./crafts.ts";
import { svgText } from "./svg-text.ts";
import { recolourGarnet, recolourGarnetJets } from "./garnet-drones.ts";
import { build, place } from "./heavies.ts";
import { hostileStation } from "./hostile-station.ts";
import { rebaseStationField, stationFieldSvg } from "./hostile-station-field.ts";
import { hostileStationIcon } from "./hostile-station-icon.ts";
import {
  craftIds,
  type ManifestFile,
  mergeEntries,
  mergeSidecars,
  sidecarCopies,
  sidecarsIn,
  storedAt,
  writeOnce,
} from "./manifest.ts";

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

/** Exports the existing v1 assembly only after the canonical station size is available. */
async function main() {
  const craft = hostileStation();
  const root = fileURLToPath(new URL("../../public/art/", import.meta.url));
  const iconOnly = process.argv.includes("--icon-only");
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
    const paths = writeOnce(`/art/${family.directory}/`, shared, texts);
    const entries = result.entries.map((entry): Entry =>
      storedAt(paths, {
        ...entry,
        ...(typeof entry.path === "string" && hullFiles.has(entry.path.split("/").at(-1)!)
          ? {
              width: field.frame,
              height: field.frame,
              displayWidth: field.frame * DISPLAY_SCALE,
              displayHeight: field.frame * DISPLAY_SCALE,
            }
          : {}),
        id: family.prefix + entry.id.slice("enemy-".length),
        ...(family.family ? { family: family.family } : {}),
      }),
    );
    mergeEntries(family.manifest, craftIds(family.prefix, [craft.name]), entries);
    mergeSidecars(family.manifest, (name) => name === craft.name, sidecarsIn(paths));
  }
  console.log(
    `${craft.name}: three existing families, ${result.files.size} native files per family`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
