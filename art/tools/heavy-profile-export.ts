// Emit an inactive heavy-profile bundle with the established family materials and stock part IDs.
// Usage: node art/tools/heavy-profile-export.ts --out <scratch directory> [--family-sheets]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { format, resolveConfig } from "prettier";

import { hullEntries, type JetColors, jetsFile } from "./crafts.ts";
import { heavyProfile } from "./heavy-profile-models.ts";
import { restrainHeavyHull } from "./heavy-restraint.ts";
import { heavySurface } from "./heavy-surface.ts";
import { build, jetMouths, place } from "./heavies.ts";
import { readManifest } from "./manifest.ts";
import { ENEMY_HEADINGS, json } from "./projection.ts";
import { svgText } from "./svg-text.ts";

const families = {
  core: { prefix: "enemy-", directory: "/art/enemies/" },
  andromeda: { prefix: "enemy-garnet-", directory: "/art/andromeda/enemies/", family: "garnet" },
  cartwheel: { prefix: "enemy-claim-", directory: "/art/cartwheel/enemies/", family: "claim" },
  needle: { prefix: "enemy-needle-", directory: "/art/needle/enemies/", family: "needle" },
} as const;
type Family = keyof typeof families;

const profiles = [
  ["frigateNarrow", "frigate", "narrow"],
  ["frigateCompact", "frigate", "compact"],
  ["capitalNarrow", "capital", "narrow"],
  ["capitalCompact", "capital", "compact"],
] as const;
type Profile = (typeof profiles)[number][0];
type PartClass = (typeof profiles)[number][1];

const namespace = "http://www.w3.org/2000/svg";
const sheetEdge = 1728;
const columns = 3;
const pageCapacity = columns * columns;

type BodyRow = ReturnType<typeof hullEntries>[number] & { family?: string; svgSheet: true };

function memberSvg(row: BodyRow, source: string, { x, y }: { x: number; y: number }): string {
  const svg = source.trimEnd();
  const root = `<svg xmlns="${namespace}" width="${row.displayWidth}" height="${row.displayHeight}" viewBox="0 0 ${row.width} ${row.height}">`;
  if (!svg.startsWith(root) || !svg.endsWith("</svg>")) {
    throw new Error(`Invalid body sheet member: ${row.id}`);
  }
  return `<svg id="${row.id}" x="${x}" y="${y}" ${svg.slice("<svg ".length)}`;
}

function packBody(rows: readonly BodyRow[], roots: readonly string[]): Map<string, string> {
  const size = rows[0]!.width;
  const edge = columns * size;
  if (rows.length !== ENEMY_HEADINGS || roots.length !== rows.length || edge > sheetEdge) {
    throw new Error(`Invalid body group: ${rows[0]!.archetype}`);
  }

  const files = new Map<string, string>();
  for (let first = 0; first < rows.length; first += pageCapacity) {
    const page = rows.slice(first, first + pageCapacity);
    const path = page[0]!.path;
    const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: edge, widths: [edge] }, [
      { rectangles: page.map(() => ({ width: size, height: size })), value: path },
    ])?.pages[0];
    if (!layout || layout.height > sheetEdge) throw new Error(`Cannot pack body sheet ${path}`);

    const members = page.map((row, index) => {
      const heading = first + index;
      if (row.directionIndex !== heading || row.path !== path) {
        throw new Error(`Invalid body sheet member: ${row.id}`);
      }
      return memberSvg(row, roots[heading]!, layout.placed[0]!.at[index]!);
    });
    files.set(
      path,
      `<svg xmlns="${namespace}" width="${edge}" height="${layout.height}" viewBox="0 0 ${edge} ${layout.height}">${members.join("")}</svg>\n`,
    );
  }
  return files;
}

type Body = { row: BodyRow; source: string };

function packFamilyBodies(path: string, bodies: readonly Body[]): string {
  const rectangles = bodies.map(({ row }) => ({
    width: row.displayWidth,
    height: row.displayHeight,
  }));
  const width = 8 * Math.max(...rectangles.map((rect) => rect.width));
  if (bodies.length !== profiles.length * ENEMY_HEADINGS || width > sheetEdge) {
    throw new Error(`Invalid family body group: ${path}`);
  }
  const layout = packAtlas({ compare: () => 0, extrude: 0, maxSize: sheetEdge, widths: [width] }, [
    { rectangles, value: path },
  ])?.pages[0];
  const cells = layout?.placed[0]?.at;
  if (!layout || cells?.length !== bodies.length) {
    throw new Error(`Cannot pack family body sheet ${path}`);
  }
  const members = bodies.map(({ row, source }, index) => memberSvg(row, source, cells[index]!));
  const { height } = layout;
  return `<svg xmlns="${namespace}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${members.join("")}</svg>\n`;
}

function familySheetPath(family: Family): string {
  return `${families[family].directory}heavy-profiles-sheet.svg`;
}

function familySheetInstalled(family: Family, manifest: ReturnType<typeof readManifest>): boolean {
  const path = familySheetPath(family);
  const entries: { id: string; path?: unknown; svgSheet?: unknown }[] = manifest.assets;
  const selected = entries.filter((entry) => entry.path === path);
  if (!selected.length) return false;
  const expected = new Set(
    profiles.flatMap(([profile]) =>
      Array.from(
        { length: ENEMY_HEADINGS },
        (_, heading) => `${families[family].prefix}${profile}-${heading}`,
      ),
    ),
  );
  if (
    selected.length !== expected.size ||
    selected.some(({ id, svgSheet }) => svgSheet !== true || !expected.delete(id))
  ) {
    throw new Error(`Incomplete heavy profile family sheet selection: ${family}`);
  }
  return true;
}

type StockJets = { layers: { name: string; colors: [string, string] }[] };

// The installed family jet data is the palette input. The variant model supplies the complete
// jet geometry and the generator supplies the rest of the v1 sidecar as for stock heavies.
function stockJetColors(manifest: ReturnType<typeof readManifest>, kind: PartClass): JetColors {
  const sidecars = manifest.sidecars as Record<string, { jets?: string }>;
  const path = sidecars[kind]?.jets;
  if (!path?.startsWith("/art/")) throw new Error(`Missing stock jets for ${kind}`);
  const stock = JSON.parse(
    readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"),
  ) as StockJets;
  const layer = (name: keyof JetColors): [string, string] => {
    const colors = stock.layers.find((entry) => entry.name === name)?.colors;
    if (colors?.length !== 2 || colors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) {
      throw new Error(`Invalid ${name} jet palette in ${path}`);
    }
    return colors;
  };
  return { outer: layer("outer"), core: layer("core") };
}

type Selection = {
  assets: BodyRow[];
  sidecars: Partial<Record<Profile, { hardpoints: string; jets: string }>>;
  partClasses: Partial<Record<Profile, PartClass>>;
};

export async function buildHeavyProfileBundle(reviewFamilySheets = false) {
  const files = new Map<string, string>();
  const selections: Partial<Record<Family, Selection>> = {};
  const familyNames = Object.keys(families) as Family[];
  const manifests = new Map(familyNames.map((name) => [name, readManifest(name)]));
  const installed = new Map(
    familyNames.map((name) => [name, new Set(manifests.get(name)!.assets.map(({ id }) => id))]),
  );
  const familyBodies = new Map<Family, Body[]>();
  for (const family of familyNames) {
    if (familySheetInstalled(family, manifests.get(family)!) || reviewFamilySheets) {
      familyBodies.set(family, []);
    }
  }
  const options = await resolveConfig(new URL("../../package.json", import.meta.url).pathname);
  const formatSidecar = (source: string) => format(source, { ...options, parser: "json" });

  for (const [profile, kind, shape] of profiles) {
    const craft = restrainHeavyHull(heavyProfile(kind, shape), { profile: shape });
    // The catalog offsets validate the stock model. Profile offsets come from the same adjusted
    // plan as the body, so the candidate uses the producer's explicit authored mount placement.
    const placed = place({ version: 1, archetypes: {} }, craft);
    const result = build(craft, placed);
    const hardpoints = `/art/enemies/${profile}-hardpoints.json`;
    files.set(hardpoints, await formatSidecar(result.files.get(`${kind}-hardpoints.json`)!));

    for (const family of familyNames) {
      const target = families[family];
      const selection = (selections[family] ??= { assets: [], sidecars: {}, partClasses: {} });
      // The profile only contributes body entries. The existing family supplies every base/top
      // record and SVG sheet at its unchanged logical part IDs.
      for (const entry of result.entries) {
        if (
          (entry.hardpoint !== undefined || entry.top !== undefined) &&
          !installed.get(family)!.has(target.prefix + entry.id.slice("enemy-".length))
        ) {
          throw new Error(`Missing ${family} stock part: ${entry.id}`);
        }
      }
      const rows = hullEntries(profile, craft.frame).map((entry): BodyRow => {
        const page = entry.directionIndex < pageCapacity ? "" : "-2";
        return {
          ...entry,
          archetype: profile,
          id: `${target.prefix}${profile}-${entry.directionIndex}`,
          path: familyBodies.has(family)
            ? familySheetPath(family)
            : `${target.directory}${profile}-sheet${page}.svg`,
          svgSheet: true,
          ...("family" in target ? { family: target.family } : {}),
        };
      });
      const roots = rows.map(({ directionIndex }) => {
        const filename = `${kind}-${directionIndex}.svg`;
        const painted = heavySurface(family, filename, result.files.get(filename)!);
        if (!painted) throw new Error(`Missing ${family} armour material for ${filename}`);
        return svgText(painted);
      });
      const bodies = familyBodies.get(family);
      if (bodies) {
        bodies.push(...rows.map((row, index) => ({ row, source: roots[index]! })));
      } else {
        for (const [path, sheet] of packBody(rows, roots)) files.set(path, sheet);
      }

      const jets = `${target.directory}${profile}-jets.json`;
      const colors = stockJetColors(manifests.get(family)!, kind);
      const jetSidecar = jetsFile(
        craft.frame,
        (heading) => jetMouths(craft.frame, heading, placed),
        colors,
      );
      files.set(jets, await formatSidecar(jetSidecar));
      selection.assets.push(...rows);
      selection.sidecars[profile] = { hardpoints, jets };
      selection.partClasses[profile] = kind;
    }
  }
  for (const [family, bodies] of familyBodies) {
    const path = familySheetPath(family);
    files.set(path, packFamilyBodies(path, bodies));
  }
  return { files, selections };
}

if (import.meta.main) {
  const [flag, output, review, ...extra] = process.argv.slice(2);
  if (flag !== "--out" || !output || (review && review !== "--family-sheets") || extra.length) {
    throw new Error(
      "Usage: node art/tools/heavy-profile-export.ts --out <scratch directory> [--family-sheets]",
    );
  }
  const { files, selections } = await buildHeavyProfileBundle(review === "--family-sheets");
  const root = resolve(output);
  mkdirSync(root, { recursive: true });
  for (const [path, data] of files) {
    const destination = join(root, "public", path.slice(1));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, data);
  }
  writeFileSync(join(root, "selections.json"), json(selections));
}
