// Stages CAST portrait pages without changing the authored sheets or their manifest rows.
// Usage: node art/tools/cast-portrait-pages.ts --candidate
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { constants } from "node:zlib";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { encodeIndexedPng } from "@andornaut/art-kit/build/indexedPng";
import { decodePng, encodeRgbaPng } from "@andornaut/art-kit/build/png";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { filledImage, paste } from "@andornaut/art-kit/build/raster";
import { spriteSheet } from "@andornaut/art-kit/build/spriteSheet";

import { CAST, type CastKey, castFrames, castSheet } from "../../src/data/cast.ts";
import { type Portrait, portraitSheets, writePortraits } from "./bust-sheets.ts";
import { readManifest } from "./manifest.ts";

type Point = { x: number; y: number };
type SheetRow = {
  id: string;
  path: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frames: Record<string, number>;
};
const base = new URL("../../", import.meta.url);
const output = new URL(".check-results/ada-0281-cast-portrait-pages/", base);
const maxEdge = 512;
const art = new URL("public/", base);
const byId = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

function readStrip(key: CastKey, compact: boolean, rows: readonly SheetRow[]) {
  const id = `${key}-portrait${compact ? "-compact" : ""}`;
  const path = castSheet(key, compact);
  const strip = rows.find((row) => row.id === id);
  const { frames, neutral } = castFrames(key);
  const size = compact ? 22 : 32;
  if (
    !strip ||
    strip.path !== path ||
    strip.frameWidth !== size ||
    strip.frameHeight !== size ||
    strip.width !== size * frames ||
    strip.height !== size ||
    strip.frames.neutral !== neutral
  ) {
    throw new Error(`Unexpected cast manifest row: ${id}`);
  }
  const image = decodePng(readFileSync(new URL(path.slice(1), art)));
  if (image.width !== strip.width || image.height !== strip.height)
    throw new Error(`Unexpected cast PNG dimensions: ${path}`);
  return { image, strip };
}

type Strip = { image: RgbaImage; strip: Pick<SheetRow, "id"> };

export function packCastStrips(strips: readonly Strip[]) {
  const widths = new Set([strips.reduce((sum, { image }) => sum + image.width + 1, -1)]);
  for (const { image } of strips) {
    for (let cells = 1; cells <= Math.min(strips.length, 8); cells++)
      widths.add(cells * (image.width + 1) - 1);
  }
  const items = strips.map((value) => ({
    rectangles: [{ height: value.image.height, width: value.image.width }],
    value,
  }));
  let best:
    { bytes: Uint8Array; width: number; height: number; origins: Map<string, Point> } | undefined;
  // The caller supplies logical ID order. Stable shelf order and width ties preserve placements.
  for (const width of [...widths].filter((width) => width <= maxEdge).sort((a, b) => a - b)) {
    const candidate = packAtlas(
      { compare: () => 0, extrude: 0, maxSize: maxEdge, padding: 1, widths: [width] },
      items,
    );
    if (candidate?.pages.length !== 1) continue;
    const placements = candidate.pages[0]!.placed.map(({ at, item }) => ({
      origin: at[0]!,
      ...item.value,
    }));
    const usedWidth = Math.max(...placements.map(({ image, origin }) => origin.x + image.width));
    const usedHeight = Math.max(...placements.map(({ image, origin }) => origin.y + image.height));
    const page = filledImage([0, 0, 0, 0], usedWidth, usedHeight);
    for (const { image, origin } of placements) paste({ at: origin }, image, page);
    const indexed = encodeIndexedPng({ level: 9, memLevel: 9 }, page);
    const rgba = encodeRgbaPng(
      { deflateLevel: 9, deflateStrategy: constants.Z_DEFAULT_STRATEGY, filterType: -1 },
      page,
    );
    const bytes = indexed && indexed.length < rgba.length ? indexed : rgba;
    if (
      best &&
      (best.bytes.length < bytes.length ||
        (best.bytes.length === bytes.length && best.width * best.height <= usedWidth * usedHeight))
    )
      continue;
    best = {
      bytes,
      height: usedHeight,
      origins: new Map(placements.map(({ origin, strip }) => [strip.id, origin])),
      width: usedWidth,
    };
  }
  if (!best) throw new Error("Cast strips exceed the checked page envelope");
  return best;
}

export function authoredCastPages(home: string, portraits: readonly Portrait[]) {
  const authored = portraits
    .toSorted((a, b) => byId(a.key, b.key))
    .map((portrait) => ({
      key: portrait.key,
      sheets: portraitSheets(portrait),
    }));
  return (["full", "compact"] as const).map((size, index) => {
    const strips = authored.map(({ key, sheets }) => {
      const { names, sheet, tags } = sheets[index]!;
      const { sheet: png } = spriteSheet({ image: `${sheet}.png`, key: sheet }, tags);
      const id = size === "compact" ? `${key}-portrait-compact` : `${key}-portrait`;
      return { image: decodePng(png), names, strip: { id } };
    });
    const { bytes, height, origins, width } = packCastStrips(strips);
    const members = strips.map(({ image, names, strip }) => ({
      crop: { ...origins.get(strip.id)!, height: image.height, width: image.width },
      frames: Object.fromEntries(names.map((name, i) => [name, i])),
      id: strip.id,
    }));
    return { bytes, file: `${home}-${size}.png`, height, members, size, width };
  });
}

type VerticalHome = "cartwheel" | "sunflower" | "whirlpool";
type PortraitSelectionRow = {
  id: string;
  path?: string;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: unknown;
  portraitCrop?: unknown;
};

export async function writeVerticalCast(home: VerticalHome, portraits: readonly Portrait[]) {
  const folder = `${home}/portraits`;
  const prefix = `/art/${folder}/`;
  const legacyPaths = new Map(
    portraits.flatMap(({ key }) => [
      [`${key}-portrait`, `${prefix}${key}.png`],
      [`${key}-portrait-compact`, `${prefix}${key}-compact.png`],
    ]),
  );
  const rows = (readManifest(home).assets as PortraitSelectionRow[]).filter(({ id }) =>
    legacyPaths.has(id),
  );
  const packed = rows.some(
    ({ id, path, portraitCrop }) => portraitCrop !== undefined || path !== legacyPaths.get(id),
  );
  if (!packed) {
    const ids = await writePortraits(home, folder, portraits, (id) => legacyPaths.has(id));
    console.log(`wrote ${ids.join(", ")}`);
    return;
  }

  if (rows.length !== legacyPaths.size) throw new Error(`Incomplete ${home} portrait selection`);
  const pages = authoredCastPages(home, portraits);
  for (const { file, height, members, size, width } of pages) {
    const displaySize = size === "compact" ? 44 : undefined;
    for (const { crop, frames, id } of members) {
      const row = rows.find((entry) => entry.id === id);
      if (
        !row ||
        row.path !== prefix + file ||
        row.width !== width ||
        row.height !== height ||
        crop.x !== 0 ||
        !isDeepStrictEqual(frames, { neutral: 0 }) ||
        row.frameWidth !== undefined ||
        row.frameHeight !== undefined ||
        row.displayWidth !== displaySize ||
        row.displayHeight !== displaySize ||
        !isDeepStrictEqual(row.frames, frames) ||
        !isDeepStrictEqual(row.portraitCrop, crop)
      ) {
        throw new Error(`Invalid packed ${home} portrait selection: ${id}`);
      }
    }
  }

  const output = new URL(`art/${folder}/`, art);
  mkdirSync(output, { recursive: true });
  for (const { bytes, file } of pages) writeFileSync(new URL(file, output), bytes);
  console.log(`wrote the selected ${home} portrait pages`);
}

function writeCandidate(): void {
  if (process.argv.length !== 3 || process.argv[2] !== "--candidate")
    throw new Error("Usage: node art/tools/cast-portrait-pages.ts --candidate");

  const keys = (Object.keys(CAST) as CastKey[]).sort(byId);
  const homes = [...new Set(keys.map((key) => CAST[key].home))].sort(byId);
  const pages: { home: string; size: string; file: string; width: number; height: number }[] = [];
  const entries: {
    manifest: string;
    current: SheetRow;
    candidate: { file: string; x: number; y: number } | null;
  }[] = [];

  mkdirSync(output, { recursive: true });
  for (const home of homes) {
    const folder = home === "core" ? "art" : `art/${home}`;
    const manifest = `${folder}/manifest.json`;
    const { assets } = JSON.parse(readFileSync(new URL(manifest, art), "utf8")) as {
      assets: SheetRow[];
    };
    const cast = keys.filter((key) => CAST[key].home === home);
    for (const size of ["compact", "full"]) {
      const strips = cast.map((key) => readStrip(key, size === "compact", assets));
      const file = `${home}-${size}.png`;
      const page = strips.length > 1 ? packCastStrips(strips) : undefined;
      if (page) {
        writeFileSync(new URL(file, output), page.bytes);
        pages.push({ file, height: page.height, home, size, width: page.width });
      }
      for (const { strip } of strips) {
        const origin = page?.origins.get(strip.id);
        entries.push({ candidate: origin ? { file, ...origin } : null, current: strip, manifest });
      }
    }
  }

  writeFileSync(
    new URL("placement.json", output),
    JSON.stringify({ entries, firstSelectableHome: "phantom", pages }, null, 2) + "\n",
  );
}

if (import.meta.main) writeCandidate();
