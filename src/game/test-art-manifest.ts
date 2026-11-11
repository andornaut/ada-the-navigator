import { readFileSync } from "node:fs";

import type { SectorId } from "../data/types.ts";
import { type GalaxyManifest, galaxyManifestPaths, readGalaxyManifest } from "./art-manifest.ts";

// Test support: Art's split manifests read from public/art, so no test reads or merges them by
// hand. The core manifest holds the boot set and shared links; each galaxy manifest holds that
// galaxy's own entries and data links.

/** One manifest entry, with the fields every entry carries and Art's per-kind fields. */
export interface ArtEntry {
  readonly [field: string]: unknown;
  readonly height: number;
  readonly id: string;
  readonly path: string;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly width: number;
}

/** A public file's JSON, by its site path ("/art/..."). */
export function publicJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
}

/** The core manifest as Art wrote it. */
export const CORE_MANIFEST = publicJson("/art/manifest.json") as {
  readonly [link: string]: unknown;
  readonly assets: readonly ArtEntry[];
  readonly galaxies: Readonly<Record<string, string>>;
};

/** Each galaxy's manifest, by SectorId. */
export const GALAXY_MANIFESTS: ReadonlyMap<SectorId, GalaxyManifest<ArtEntry>> = new Map(
  Object.entries(galaxyManifestPaths(CORE_MANIFEST.galaxies)).map(([sector, path]) => [
    Number(sector) as SectorId,
    readGalaxyManifest<ArtEntry>(publicJson(path))!,
  ]),
);

/**
 * Every entry and data link the game knows once every galaxy has loaded: the core manifest's,
 * then each galaxy's in SectorId order.
 */
export const ART_MANIFEST = {
  ...CORE_MANIFEST,
  ...Object.assign({}, ...[...GALAXY_MANIFESTS.values()].map(({ links }) => links)),
  assets: [
    ...CORE_MANIFEST.assets,
    ...[...GALAXY_MANIFESTS.values()].flatMap(({ assets }) => assets),
  ],
} as {
  readonly assets: ArtEntry[];
  readonly cartwheelDebris: string;
  readonly galaxyFields: string;
  readonly resourceRocks: string;
  readonly tow: string;
  readonly whales: string;
  readonly whirlpoolCurrents: string;
  readonly whirlpoolDebris: string;
};
