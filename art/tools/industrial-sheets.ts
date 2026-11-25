import { isDeepStrictEqual } from "node:util";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { GALAXIES, readManifest } from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

// The manifests whose retaliator and Mining Freighter rows share the core hull sheets.
const prefixes = {
  core: "",
  andromeda: "garnet-",
  needle: "needle-",
} as const;
type IndustrialFamily = keyof typeof prefixes;
type Row = { id: string; path?: string } & Record<string, unknown>;

const svgRoot = (size: number, intrinsic = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${intrinsic}" height="${intrinsic}" viewBox="0 0 ${size} ${size}">`;

function headingOrigins(name: string, size: number) {
  const wide = size * 4;
  const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: wide, widths: [wide] }, [
    {
      value: name,
      rectangles: Array.from({ length: ENEMY_HEADINGS }, () => ({ width: size, height: size })),
    },
  ])?.pages[0];
  if (!layout || layout.height !== wide) throw new Error(`Cannot pack ${name}`);
  return layout.placed[0]!.at;
}

const industrialHulls = ["retaliator", "retaliatorMiningFreighter"] as const;
const consumers = Object.keys(prefixes) as IndustrialFamily[];
const directory = "/art/enemies/";
const hullId = (family: IndustrialFamily, name: string, heading: number) =>
  `enemy-${prefixes[family]}${name}-${heading}`;

export function packInstalledIndustrialHulls(
  files: Map<string, string>,
  entries: readonly Row[],
): readonly Row[] {
  const installed: Row[] = (["core", ...GALAXIES] as const).flatMap(
    (key) => readManifest(key).assets,
  );
  const registered = new Map(installed.map((row) => [row.id, row]));
  const input = new Map(entries.map((row) => [row.id, row]));
  const output = new Map<string, Row>();
  const groups = [];

  for (const craft of industrialHulls) {
    const names = craft === "retaliator" ? [craft, "retaliatorCargoHauler"] : [craft];
    const headings = Array.from({ length: ENEMY_HEADINGS }, (_, heading) => heading);
    const sheet = craft + "-sheet.svg";
    const ids = new Set(
      consumers.flatMap((key) =>
        names.flatMap((name) => headings.map((i) => hullId(key, name, i))),
      ),
    );
    const path = directory + sheet;
    if (
      ![...ids].some(
        (id) => registered.get(id)?.svgSheet === true || registered.get(id)?.path === path,
      )
    ) {
      continue;
    }

    const filenames = names.flatMap((name) => headings.map((i) => `${name}-${i}.svg`));
    const paths = new Set([path, ...filenames.map((file) => directory + file)]);
    const referrer = installed.find((row) => row.path && paths.has(row.path) && !ids.has(row.id));
    if (referrer) throw new Error(`Industrial hull is also used by ${referrer.id}`);

    const size = input.get(hullId("core", craft, 0))?.width;
    if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
      throw new Error(`Invalid raw frame for core ${craft}`);
    }
    const origins = headingOrigins(craft, size);
    const roots = headings.map((i) => {
      const id = hullId("core", craft, i);
      const row = input.get(id);
      const svg = files.get(`${craft}-${i}.svg`);
      if (
        !row ||
        row.archetype !== "retaliator" ||
        row.directionIndex !== i ||
        row.width !== size ||
        row.height !== size ||
        !svg?.startsWith(svgRoot(size)) ||
        !svg.endsWith("</svg>")
      ) {
        throw new Error(`Invalid industrial hull root for ${id}`);
      }

      const member = hullId("core", craft, i);
      const metadata = { ...row };
      delete metadata.family;
      for (const key of consumers) {
        for (const name of names) {
          const id = hullId(key, name, i);
          const family = prefixes[key].slice(0, -1);
          const source: Row = { ...metadata, id, path, ...(family && { family }) };
          const selected = {
            ...source,
            svgSheet: true,
            ...(id !== member && { svgSheetMember: member }),
          };
          if (!isDeepStrictEqual(registered.get(id), selected)) {
            throw new Error(`Invalid industrial hull selection for ${id}`);
          }
        }
      }
      for (const name of names) {
        const id = hullId("core", name, i);
        const file = `${name}-${i}.svg`;
        const original = { ...row, id, path: directory + file };
        if (!isDeepStrictEqual(input.get(id), original) || files.get(file) !== svg) {
          throw new Error(`Industrial hull alias source differs for ${id}`);
        }
        output.set(id, registered.get(id)!);
      }

      const { x, y } = origins[i]!;
      return `<svg id="${member}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
    });
    groups.push({
      filenames,
      sheet,
      svg: `${svgRoot(size * 4)}${roots.join("")}</svg>
`,
    });
  }

  for (const { filenames, sheet, svg } of groups) {
    for (const file of filenames) files.delete(file);
    files.set(sheet, svg);
  }
  return output.size ? entries.map((row) => output.get(row.id) ?? row) : entries;
}
