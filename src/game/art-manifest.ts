import { bySector } from "../data/galaxies.ts";
import type { SectorId } from "../data/types.ts";
import { type EnemyFrame, enemyPartFrame } from "./enemy-art.ts";
import { whaleFrameAsset } from "./whale-art.ts";

// Art's split manifest (art/README.md): the core manifest at public/art/manifest.json holds the
// boot set and shared data links and maps each galaxy to its own manifest, which holds the
// entries and data links only that galaxy uses.

/** The core manifest's assets and links that the game reads. */
export interface CoreManifest<T> {
  readonly assets: T[];
  /** Each galaxy's manifest path, by stable galaxy id. */
  readonly galaxies?: unknown;
  /** Each galaxy's field palette and the light field (public/art/galaxies.json). */
  readonly galaxyFields?: unknown;
  readonly quantumJump?: string;
  readonly resourceRocks?: string;
  readonly spacePalette?: string;
  /** The start screen's field, ship and wordmark placement (public/art/title-screen.json). */
  readonly titleScreen?: string;
  readonly tow?: string;
}

/** A galaxy manifest's data links, by the names the scene loads them under. */
export interface GalaxyLinks {
  /** The galaxy's backdrop haze placement (haze.json). */
  readonly backdropHaze?: string;
  readonly cartwheelDebris?: string;
  readonly oreField?: string;
  readonly whales?: string;
  readonly whirlpoolCurrents?: string;
  readonly whirlpoolDebris?: string;
  readonly whirlpoolProjects?: string;
}

export interface GalaxyManifest<T> {
  readonly assets: readonly T[];
  readonly links: GalaxyLinks;
}

const LINKS: readonly (keyof GalaxyLinks)[] = [
  "backdropHaze",
  "cartwheelDebris",
  "oreField",
  "whales",
  "whirlpoolCurrents",
  "whirlpoolDebris",
  "whirlpoolProjects",
];

/**
 * Whether a galaxy manifest's asset loads with the galaxy's first flight: hull headings, props and
 * sheets do; hardpoint and turret frames wait for their craft, and whale frames for a whale.
 */
export function galaxyLoadsAtOnce(asset: EnemyFrame & { readonly kind?: unknown }): boolean {
  return !enemyPartFrame(asset) && !whaleFrameAsset(asset);
}

/** The loader's cache key for a galaxy's manifest. */
export function galaxyManifestKey(sector: SectorId): string {
  return `art-manifest-galaxy-${sector}`;
}

/**
 * Each galaxy's manifest path from the core manifest's galaxies map, keyed by stable galaxy id;
 * a value other than a path under /art/ drops. A galaxy without a manifest loads no galaxy art.
 */
export function galaxyManifestPaths(value: unknown): Partial<Record<SectorId, string>> {
  const path = (entry: unknown) =>
    typeof entry === "string" && entry.startsWith("/art/") ? entry : null;
  const paths: Partial<Record<SectorId, string>> = {};
  for (const [sector, entry] of bySector(path, value) ?? []) {
    if (entry) {
      paths[sector] = entry;
    }
  }
  return paths;
}

/** A galaxy manifest, version 1, with its assets and string data links; undefined if invalid. */
export function readGalaxyManifest<T>(value: unknown): GalaxyManifest<T> | undefined {
  const data = value as { assets?: unknown; version?: unknown } | null | undefined;
  if (!data || data.version !== 1 || !Array.isArray(data.assets)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const links: Record<string, string> = {};
  for (const name of LINKS) {
    if (typeof record[name] === "string") {
      links[name] = record[name];
    }
  }
  return { assets: data.assets as T[], links };
}
