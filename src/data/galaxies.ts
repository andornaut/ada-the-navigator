import type { GalaxyNumber } from "./types.ts";

// The galaxies' route (gameplay/rules.md): each galaxy's position along it, by the numeric
// galaxy id the code keys galaxies by. Unlocks, galaxy selection and per-galaxy tuning follow
// position; a galaxy's own content stays keyed by its id.

/** Every galaxy id. */
export const GALAXY_NUMBERS: readonly GalaxyNumber[] = [1, 2, 3, 4, 5, 6];

/**
 * Each galaxy's stable id, which Art keys every per-galaxy file by (art/galaxies.md): the core
 * manifest's galaxy map, galaxies.json, the backdrop tints and the selector previews.
 */
export const GALAXY_ID: Readonly<Record<GalaxyNumber, string>> = {
  1: "sunflower",
  2: "cartwheel",
  3: "whirlpool",
  4: "needle",
  5: "andromeda",
  6: "phantom",
};

/**
 * The entries of a map keyed by stable galaxy id, by GalaxyNumber, each through `read`: a galaxy
 * missing from the map drops, as does an id no galaxy has. Undefined if `read` rejects any entry
 * present, or if the value is not a map.
 */
export function byGalaxy<T>(
  read: (entry: unknown) => T | undefined,
  value: unknown,
): ReadonlyMap<GalaxyNumber, T> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const map = value as Record<string, unknown>;
  const entries = new Map<GalaxyNumber, T>();
  for (const galaxy of GALAXY_NUMBERS) {
    if (!Object.hasOwn(map, GALAXY_ID[galaxy])) {
      continue;
    }
    const entry = read(map[GALAXY_ID[galaxy]]);
    if (entry === undefined) {
      return undefined;
    }
    entries.set(galaxy, entry);
  }
  return entries;
}

/** The galaxies in galaxy selection, one page per route position. */
export const GALAXY_COUNT = GALAXY_NUMBERS.length;

/** A position along the route, 1 to 6. */
export type RoutePosition = 1 | 2 | 3 | 4 | 5 | 6;

/** Each galaxy's route position. */
export const ROUTE_POSITION: Readonly<Record<GalaxyNumber, RoutePosition>> = {
  1: 1, // Sunflower
  2: 5, // Cartwheel
  3: 2, // Whirlpool
  4: 3, // Needle
  5: 4, // Andromeda
  6: 6, // Phantom
};

/** The galaxies in route order. */
export const ROUTE: readonly GalaxyNumber[] = [...GALAXY_NUMBERS].sort(
  (a, b) => ROUTE_POSITION[a] - ROUTE_POSITION[b],
);

/** The galaxy at a route position. */
export function galaxyAt(position: RoutePosition): GalaxyNumber {
  return ROUTE[position - 1]!;
}

/**
 * Galaxies with their story, holodisk and art built. The others are placeholders: flyable, in
 * the default field, with generic enemies and rocks and nothing of their own.
 */
export const BUILT: ReadonlySet<GalaxyNumber> = new Set<GalaxyNumber>(GALAXY_NUMBERS);

/**
 * Per-position tuning for the placeholders until their own: each copies the built galaxy before
 * it on the route.
 */
export function tuningPosition(position: RoutePosition): RoutePosition {
  for (let at = position; at >= 1; at--) {
    if (BUILT.has(galaxyAt(at as RoutePosition))) {
      return at as RoutePosition;
    }
  }
  return 1;
}

/** A galaxy's explicit row, or the nearest built predecessor with an entry in this table. */
export function byPosition<T>(
  table: Readonly<Partial<Record<RoutePosition, T>>>,
  galaxy: GalaxyNumber,
): T {
  const position = ROUTE_POSITION[galaxy];
  const own = table[position];
  if (own !== undefined) {
    return own;
  }
  for (let at = position - 1; at >= 1; at--) {
    const previous = at as RoutePosition;
    if (BUILT.has(galaxyAt(previous)) && table[previous] !== undefined) {
      return table[previous]!;
    }
  }
  throw new RangeError(`No tuning row for galaxy ${galaxy}`);
}

/**
 * The galaxies a completed galaxy unlocks: the next on the route, and while that one is a
 * placeholder, each after it up to and including the next built galaxy.
 */
export function unlockedBy(galaxy: GalaxyNumber): GalaxyNumber[] {
  const unlocks: GalaxyNumber[] = [];
  for (let at = ROUTE_POSITION[galaxy] + 1; at <= ROUTE.length; at++) {
    const next = galaxyAt(at as RoutePosition);
    unlocks.push(next);
    if (BUILT.has(next)) {
      break;
    }
  }
  return unlocks;
}
