import type { SectorId } from "../data/types.ts";

// Art's split manifest (art/README.md): the core manifest at public/art/manifest.json holds the
// boot set and shared data links and maps each galaxy to its own manifest, which holds the
// entries and data links only that galaxy uses.

const SECTORS: readonly SectorId[] = [1, 2, 3];

/** The core manifest's assets and links that the game reads. */
export interface CoreManifest<T> {
  readonly assets: T[];
  /** Each galaxy's manifest path, by SectorId. */
  readonly galaxies?: unknown;
  /** Each galaxy's field palette and the light field (public/art/galaxies.json). */
  readonly galaxyFields?: unknown;
  readonly quantumJump?: string;
  readonly resourceRocks?: string;
  readonly spacePalette?: string;
  readonly tow?: string;
}

/** A galaxy manifest's data links, by the names the scene loads them under. */
export interface GalaxyLinks {
  readonly cartwheelDebris?: string;
  readonly oreField?: string;
  readonly whales?: string;
  readonly whirlpoolCurrents?: string;
  readonly whirlpoolDebris?: string;
}

export interface GalaxyManifest<T> {
  readonly assets: readonly T[];
  readonly links: GalaxyLinks;
}

const LINKS: readonly (keyof GalaxyLinks)[] = [
  "cartwheelDebris",
  "oreField",
  "whales",
  "whirlpoolCurrents",
  "whirlpoolDebris",
];

/** The loader's cache key for a galaxy's manifest. */
export function galaxyManifestKey(sector: SectorId): string {
  return `art-manifest-galaxy-${sector}`;
}

/** Each galaxy's manifest path from the core manifest's galaxies map; non-string values drop. */
export function galaxyManifestPaths(value: unknown): Partial<Record<SectorId, string>> {
  const map = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const paths: Partial<Record<SectorId, string>> = {};
  for (const sector of SECTORS) {
    const path = map[String(sector)];
    if (typeof path === "string" && path.startsWith("/art/")) {
      paths[sector] = path;
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
