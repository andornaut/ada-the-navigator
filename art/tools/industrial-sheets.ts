import { isDeepStrictEqual } from "node:util";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { GALAXIES, readManifest } from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

const prefixes = {
  core: "",
  andromeda: "garnet-",
  cartwheel: "claim-",
  needle: "needle-",
} as const;
type IndustrialFamily = keyof typeof prefixes;
type Row = { id: string; path?: string } & Record<string, unknown>;

const svgRoot = (size: number, intrinsic = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${intrinsic}" height="${intrinsic}" viewBox="0 0 ${size} ${size}">`;

function planSheets(family: IndustrialFamily, entries: readonly Row[], files: Map<string, string>) {
  const directory = family === "core" ? "/art/enemies/" : `/art/${family}/enemies/`;
  const manifest: Row[] = readManifest(family).assets;
  const current = new Map(manifest.map((row) => [row.id, row]));
  const input = new Map(entries.map((row) => [row.id, row]));
  const prefix = `enemy-${prefixes[family]}`;
  const groups = [];

  for (const craft of ["retaliator", "retaliatorMiningFreighter"]) {
    for (const suffix of ["-turret-intact", "-turret-top"]) {
      const name = craft + suffix;
      const alias = craft === "retaliator" ? "retaliatorCargoHauler" + suffix : undefined;
      const names = Array.from({ length: ENEMY_HEADINGS }, (_, i) => `${name}-${i}`);
      const aliases = alias
        ? Array.from({ length: ENEMY_HEADINGS }, (_, i) => `${alias}-${i}`)
        : [];
      const members = [...names, ...aliases];
      const ids = new Set(members.map((member) => prefix + member));
      const sheet = `${name}-sheet.svg`;
      const path = directory + sheet;
      if (
        ![...ids].some((id) => current.get(id)?.svgSheet === true || current.get(id)?.path === path)
      ) {
        continue;
      }
      const filenames = members.map((member) => member + ".svg");
      const paths = new Set([path, ...filenames.map((file) => directory + file)]);
      const referrer = ["core" as const, ...GALAXIES]
        .flatMap((file) => {
          const assets: Row[] = file === family ? manifest : readManifest(file).assets;
          return file === family ? assets.filter(({ id }) => !ids.has(id)) : assets;
        })
        .find((row) => row.path && paths.has(row.path));
      if (referrer) throw new Error(`Industrial turret is also used by ${referrer.id}`);

      const size = input.get(prefix + names[0]!)?.width;
      if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
        throw new Error(`Invalid raw frame for ${name}`);
      }
      const wide = size * 4;
      const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: wide, widths: [wide] }, [
        { value: name, rectangles: names.map(() => ({ width: size, height: size })) },
      ])?.pages[0];
      if (!layout || layout.height !== wide) throw new Error(`Cannot pack ${name}`);

      const rows: Row[] = [];
      const selectedRow = (member: string, source: Row, frame: string, sheetMember?: string) => {
        const id = prefix + member;
        const row = {
          ...source,
          id,
          path,
          svgSheet: true,
          ...(sheetMember && { svgSheetMember: sheetMember }),
        };
        if (
          input.get(id)?.path !== directory + member + ".svg" ||
          files.get(member + ".svg") !== frame ||
          !isDeepStrictEqual(current.get(id), row)
        ) {
          throw new Error(`Invalid industrial turret selection or source for ${id}`);
        }
        rows.push(row);
      };
      const roots = names.map((member, i) => {
        const id = prefix + member;
        const row = input.get(id);
        const svg = files.get(member + ".svg");
        if (
          !row ||
          row.archetype !== "retaliator" ||
          (row.aimIndex ?? row.directionIndex) !== i ||
          row.width !== size ||
          row.height !== size ||
          typeof row.displayWidth !== "number" ||
          row.displayHeight !== row.displayWidth ||
          !svg?.startsWith(svgRoot(size, row.displayWidth)) ||
          !svg.endsWith("</svg>")
        ) {
          throw new Error(`Invalid raw frame or intrinsic size for ${id}`);
        }
        selectedRow(member, row, svg);
        const aliasName = aliases[i];
        if (aliasName) {
          const aliasRow = input.get(prefix + aliasName);
          if (!aliasRow || !isDeepStrictEqual({ ...aliasRow, id, path: row.path }, row)) {
            throw new Error(`Industrial turret alias geometry differs for ${prefix + aliasName}`);
          }
          selectedRow(aliasName, aliasRow, svg, id);
        }
        const { x, y } = layout.placed[0]!.at[i]!;
        return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
      });
      groups.push({ filenames, sheet, rows, svg: `${svgRoot(wide)}${roots.join("")}</svg>\n` });
    }
  }
  return groups;
}

export function packInstalledIndustrialTurrets(
  family: IndustrialFamily,
  files: Map<string, string>,
  entries: readonly Row[],
): readonly Row[] {
  const groups = planSheets(family, entries, files);
  if (!groups.length) return entries;
  const replacements = new Map(groups.flatMap(({ rows }) => rows.map((row) => [row.id, row])));
  for (const { filenames, sheet, svg } of groups) {
    for (const name of filenames) files.delete(name);
    files.set(sheet, svg);
  }
  return entries.map((row) => replacements.get(row.id) ?? row);
}
