// Write review sheets and print candidate rows with node art/tools/debris-sheets.ts.
import { existsSync, readFileSync } from "node:fs";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { GALAXIES, readManifest, writeOnce } from "./manifest.ts";

const targets = ["needle", "whirlpool"] as const;
type DebrisGalaxy = "cartwheel" | (typeof targets)[number];
type AssetRow = { id: string; path?: string } & Record<string, unknown>;
const publicSvg = (path: string) => new URL(`../../public${path}`, import.meta.url);
const svgRoot = (width: number, height: number, rawWidth = width, rawHeight = height) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${rawWidth} ${rawHeight}">`;

function planSheets(
  galaxy: DebrisGalaxy,
  entries: readonly AssetRow[],
  source: (file: string) => string | undefined,
  review: boolean,
) {
  const directory = `/art/${galaxy}/`;
  const installed: AssetRow[] = readManifest(galaxy).assets;
  const current = new Map(installed.map((row) => [row.id, row]));
  const input = new Map(entries.map((row) => [row.id, row]));
  const groups = [];
  for (const suffix of galaxy === "cartwheel" ? [""] : ["-plate", "-girder"]) {
    const id = `${galaxy}-debris${suffix}`;
    const stem = galaxy === "needle" ? `debris${suffix}` : id;
    const names = Array.from({ length: 8 }, (_, index) => `${stem}-${index}.svg`);
    const ids = names.map((_, index) => `${id}-${index}`);
    const packed = ids.filter((name) => current.get(name)?.svgSheet === true).length;
    if (!review && packed === 0) continue;
    if (packed !== (review ? 0 : ids.length)) throw new Error(`Unexpected selection for ${id}`);
    const sheet = `${stem}-sheet.svg`;
    const path = directory + sheet;
    const { width, height } = input.get(ids[0]!) ?? {};
    if (
      typeof width !== "number" ||
      !Number.isInteger(width) ||
      width <= 0 ||
      typeof height !== "number" ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      throw new Error(`Invalid raw frame for ${id}`);
    }
    const wide = 4 * width;
    const tall = 2 * height;
    const layout = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: Math.max(wide, tall), widths: [wide] },
      [{ value: id, rectangles: names.map(() => ({ width, height })) }],
    )?.pages[0];
    if (!layout || layout.height !== tall) throw new Error(`Cannot pack ${id}`);

    const paths = new Set([path, ...names.map((name) => directory + name)]);
    const manifests = ["core" as const, ...GALAXIES];
    const referrer = manifests
      .flatMap((name) => {
        const rows: AssetRow[] = name === galaxy ? installed : readManifest(name).assets;
        return name === galaxy ? rows.filter((row) => !ids.includes(row.id)) : rows;
      })
      .find((row) => row.path && paths.has(row.path));
    if (referrer) throw new Error(`Debris art is also used by ${referrer.id}`);

    const rows: AssetRow[] = [];
    const roots = ids.map((id, index) => {
      const original = directory + names[index]!;
      const row = input.get(id);
      if (
        row?.path !== original ||
        row.tumbleIndex !== index ||
        row.width !== width ||
        row.height !== height ||
        typeof row.displayWidth !== "number" ||
        typeof row.displayHeight !== "number" ||
        current.get(id)?.path !== (review ? original : path)
      ) {
        throw new Error(`Invalid registration for ${id}`);
      }
      const svg = source(names[index]!);
      if (
        !svg?.startsWith(svgRoot(row.displayWidth, row.displayHeight, width, height)) ||
        !svg.endsWith("</svg>")
      ) {
        throw new Error(`Invalid SVG root for ${id}`);
      }
      const { x, y } = layout.placed[0]!.at[index]!;
      rows.push({ ...row, path, svgSheet: true });
      return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
    });
    groups.push({ names, sheet, rows, svg: `${svgRoot(wide, tall)}${roots.join("")}</svg>\n` });
  }
  return { directory, groups };
}

export function writeDebrisFrames(
  galaxy: DebrisGalaxy,
  entries: readonly AssetRow[],
  files: Map<string, string>,
): readonly AssetRow[] {
  const { directory, groups } = planSheets(galaxy, entries, (file) => files.get(file), false);
  const replacements = new Map(groups.flatMap(({ rows }) => rows.map((row) => [row.id, row])));
  for (const { names, sheet, svg } of groups) {
    for (const file of names) files.delete(file);
    files.set(sheet, svg);
  }
  writeOnce(directory, new Map(), files);
  return entries.map((row) => replacements.get(row.id) ?? row);
}

function writeReviewSheets(): void {
  const plans = targets.map((galaxy) => ({
    galaxy,
    ...planSheets(
      galaxy,
      readManifest(galaxy).assets,
      (file) => readFileSync(publicSvg(`/art/${galaxy}/${file}`), "utf8"),
      true,
    ),
  }));
  for (const { directory, groups } of plans) {
    for (const { sheet, svg } of groups) {
      const file = publicSvg(directory + sheet);
      if (existsSync(file) && readFileSync(file, "utf8") !== svg) {
        throw new Error(`Review sheet already exists with different bytes: ${directory}${sheet}`);
      }
    }
  }
  for (const { directory, groups } of plans) {
    writeOnce(directory, new Map(), new Map(groups.map(({ sheet, svg }) => [sheet, svg])));
  }
  console.log(
    JSON.stringify(
      Object.fromEntries(
        plans.map(({ galaxy, groups }) => [galaxy, groups.flatMap(({ rows }) => rows)]),
      ),
      null,
      2,
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) writeReviewSheets();
