import { byGalaxy } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { type EnemyFrame, enemyPartFrame } from "./enemyArt.ts";
import { whaleFrameAsset } from "./whaleArt.ts";

// Art's split manifest (art/README.md): the core manifest at public/art/manifest.json holds the
// boot set and shared data links and maps each galaxy to its own manifest, which holds the
// entries and data links only that galaxy uses.

/** The core manifest's assets and links that the game reads. */
export interface CoreManifest<T> {
  readonly assets: T[];
  /** The backdrop layers' shared rules (public/art/backdrop.json). */
  readonly backdropLayers?: string;
  /** Each galaxy's manifest path, by stable galaxy id. */
  readonly galaxies?: unknown;
  /** Each galaxy's field palette and the light field (public/art/galaxies.json). */
  readonly galaxyFields?: unknown;
  /** The station jobs' art in flight and on the Map (public/art/jobs.json). */
  readonly jobs?: string;
  /** The enemy-only weapon effects (public/art/enemy-weapons.json). */
  readonly enemyWeapons?: string;
  readonly quantumJump?: string;
  readonly resourceRocks?: string;
  readonly spacePalette?: string;
  /** The start screen's field, ship and wordmark placement (public/art/title-screen.json). */
  readonly titleScreen?: string;
  readonly tow?: string;
}

/** A galaxy manifest's data links, by the names the scene loads them under. */
export interface GalaxyLinks {
  /** The galaxy's backdrop layers: its tones and recipes (backdrop.json). */
  readonly backdrop?: string;
  /** The galaxy's backdrop haze placement (haze.json). */
  readonly backdropHaze?: string;
  readonly cartwheelDebris?: string;
  /** Needle's edge-on band (band.json), a fixed backdrop layer like a haze. */
  readonly needleBand?: string;
  readonly oreField?: string;
  readonly whales?: string;
  readonly whirlpoolCurrents?: string;
  readonly whirlpoolDebris?: string;
  readonly whirlpoolProjects?: string;
}

export interface GalaxyManifest<T> {
  readonly assets: readonly T[];
  readonly links: GalaxyLinks;
  /**
   * The galaxy's stranded craft data (its tow.json), kept apart from the links so core's `tow`,
   * which also holds the tow line, keeps its name when a galaxy's links merge.
   */
  readonly tow?: string;
}

const LINKS: readonly (keyof GalaxyLinks)[] = [
  "backdrop",
  "backdropHaze",
  "cartwheelDebris",
  "needleBand",
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
export function galaxyManifestKey(galaxy: GalaxyNumber): string {
  return `art-manifest-galaxy-${galaxy}`;
}

/**
 * Each galaxy's manifest path from the core manifest's galaxies map, keyed by stable galaxy id;
 * a value other than a path under /art/ drops. A galaxy without a manifest loads no galaxy art.
 */
export function galaxyManifestPaths(value: unknown): Partial<Record<GalaxyNumber, string>> {
  const path = (entry: unknown) =>
    typeof entry === "string" && entry.startsWith("/art/") ? entry : null;
  const paths: Partial<Record<GalaxyNumber, string>> = {};
  for (const [galaxy, entry] of byGalaxy(path, value) ?? []) {
    if (entry) {
      paths[galaxy] = entry;
    }
  }
  return paths;
}

/** The loader's cache key for a galaxy's stranded craft data. */
export function galaxyTowKey(galaxy: GalaxyNumber): string {
  return `tow-galaxy-${galaxy}`;
}

/**
 * A galaxy manifest, version 1, with its assets, string data links and string `tow` path;
 * undefined if invalid.
 */
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
  const tow = record.tow;
  return { assets: data.assets as T[], links, ...(typeof tow === "string" ? { tow } : {}) };
}
