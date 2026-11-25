import { isDeepStrictEqual } from "node:util";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";

import { fleetArchetypes, GALAXIES, readManifest } from "./manifest.ts";
import { ENEMY_HEADINGS } from "./projection.ts";

type Row = { id: string; path?: string } & Record<string, unknown>;

const directory = "/art/cartwheel/enemies/";
const filename = "claim-stock-hulls-sheet.svg";
const path = directory + filename;
const prefix = "enemy-claim-";
// Largest intrinsic cells first. The installed eager reader uses display dimensions for the
// stock heavies, and raw dimensions for the small hulls and the Retaliator/Cargo Hauler.
// The enemy fleet's craft (art/tools/fleet.ts) have their own sheets and leave the page.
const stock = ["capital", "retaliator", "frigate", "fighter", "interceptor", "swarm"] as const;

export function packInstalledClaimHullPage(files: Map<string, string>, entries: readonly Row[]) {
  const fleet = fleetArchetypes("cartwheel");
  const groups = stock.filter((craft) => !fleet.has(craft));
  const manifest: Row[] = readManifest("cartwheel").assets;
  const selected = manifest.filter((row) => row.path === path);
  if (!selected.length) return undefined;
  if (selected.length !== (groups.length + 1) * ENEMY_HEADINGS) {
    throw new Error("Incomplete Claim stock hull page selection");
  }

  const expected = new Map(selected.map((row) => [row.id, row]));
  const input = new Map(entries.map((row) => [row.id, row]));
  const replacements = new Map<string, Row>();
  const loose = new Set<string>();
  const retired = new Set([path, directory + "capital-sheet-2.svg"]);
  const members = groups.flatMap((craft) => {
    retired.add(`${directory}${craft}-sheet.svg`);
    const displaySized = craft === "capital" || craft === "frigate";
    return Array.from({ length: ENEMY_HEADINGS }, (_, heading) => {
      const name = `${craft}-${heading}.svg`;
      const id = `${prefix}${craft}-${heading}`;
      const row = input.get(id);
      const svg = files.get(name);
      const width = displaySized ? row?.displayWidth : row?.width;
      const height = displaySized ? row?.displayHeight : row?.height;
      if (
        !row ||
        row.path !== directory + name ||
        row.directionIndex !== heading ||
        row.archetype !== craft ||
        row.family !== "claim" ||
        typeof width !== "number" ||
        typeof height !== "number" ||
        !svg?.startsWith(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${row.width} ${row.height}">`,
        ) ||
        !svg.endsWith("</svg>")
      ) {
        throw new Error(`Invalid Claim stock hull source: ${id}`);
      }
      const replacement = { ...row, path, svgSheet: true };
      if (!isDeepStrictEqual(expected.get(id), replacement)) {
        throw new Error(`Invalid Claim stock hull selector: ${id}`);
      }
      replacements.set(id, replacement);
      loose.add(name);
      if (craft === "retaliator") {
        const alias = `retaliatorCargoHauler-${heading}`;
        const aliasId = prefix + alias;
        const aliasFile = alias + ".svg";
        const original = { ...row, id: aliasId, path: directory + aliasFile };
        const replacement = { ...original, path, svgSheet: true, svgSheetMember: id };
        if (
          !isDeepStrictEqual(input.get(aliasId), original) ||
          !isDeepStrictEqual(expected.get(aliasId), replacement) ||
          files.get(aliasFile) !== svg
        ) {
          throw new Error(`Invalid Claim stock hull alias: ${aliasId}`);
        }
        replacements.set(aliasId, replacement);
        loose.add(aliasFile);
      }
      return { id, svg, width, height };
    });
  });

  for (const file of loose) retired.add(directory + file);
  const outside: Row[] = ["core" as const, ...GALAXIES].flatMap((owner) =>
    owner === "cartwheel"
      ? manifest.filter(({ id }) => !replacements.has(id))
      : readManifest(owner).assets,
  );
  const referrer = outside.find((row) => row.path && retired.has(row.path));
  if (referrer) throw new Error(`Claim stock hull page would change the art of ${referrer.id}`);

  const width = 1728;
  const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: width, widths: [width] }, [
    { rectangles: members, value: filename },
  ])?.pages[0];
  const cells = layout?.placed[0]?.at;
  if (!layout || cells?.length !== members.length) throw new Error("Cannot pack Claim stock hulls");
  const roots = members.map(({ id, svg }, index) => {
    const { x, y } = cells[index]!;
    return `<svg id="${id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
  });
  const { height } = layout;
  for (const file of loose) files.delete(file);
  files.set(
    filename,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${roots.join("")}</svg>\n`,
  );
  return entries.map((row) => replacements.get(row.id) ?? row);
}
