// Stages CAST portrait pages without changing the authored sheets or their manifest rows.
// Usage: node art/tools/cast-portrait-pages.ts --candidate
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { constants } from "node:zlib";

import { packAtlas } from "@andornaut/art-kit/build/atlasLayout";
import { encodeIndexedPng } from "@andornaut/art-kit/build/indexedPng";
import { decodePng, encodeRgbaPng } from "@andornaut/art-kit/build/png";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { filledImage, paste } from "@andornaut/art-kit/build/raster";

import { CAST, type CastKey, castFrames, castSheet } from "../../src/data/cast.ts";

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
