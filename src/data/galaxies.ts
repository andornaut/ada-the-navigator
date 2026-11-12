import type { SectorId } from "./types.ts";

// The galaxies' route (gameplay/rules.md): each galaxy's position along it, by the numeric
// galaxy id the code keys galaxies by. Unlocks, galaxy selection and per-galaxy tuning follow
// position; a galaxy's own content stays keyed by its id.

/** Every galaxy id. */
export const SECTORS: readonly SectorId[] = [1, 2, 3, 4, 5, 6];

/** The galaxies in galaxy selection, one page per route position. */
export const GALAXY_COUNT = SECTORS.length;

/** A position along the route, 1 to 6. */
export type RoutePosition = 1 | 2 | 3 | 4 | 5 | 6;

/** Each galaxy's route position. */
export const ROUTE_POSITION: Readonly<Record<SectorId, RoutePosition>> = {
  1: 1, // Sunflower
  2: 5, // Cartwheel
  3: 2, // Whirlpool
  4: 3, // Needle
  5: 4, // Andromeda
  6: 6, // Black Eye
};

/** The galaxies in route order. */
export const ROUTE: readonly SectorId[] = [...SECTORS].sort(
  (a, b) => ROUTE_POSITION[a] - ROUTE_POSITION[b],
);

/** The galaxy at a route position. */
export function galaxyAt(position: RoutePosition): SectorId {
  return ROUTE[position - 1]!;
}

/**
 * Galaxies with their story, holodisk and art built. The others are placeholders: flyable, in
 * the default field, with generic enemies and rocks and nothing of their own.
 */
export const BUILT: ReadonlySet<SectorId> = new Set<SectorId>([1, 2, 3]);

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

/** A per-position table's entry for a galaxy, placeholders reading the built galaxy before them. */
export function byPosition<T>(
  table: Readonly<Partial<Record<RoutePosition, T>>>,
  galaxy: SectorId,
): T {
  return table[ROUTE_POSITION[galaxy]] ?? table[tuningPosition(ROUTE_POSITION[galaxy])]!;
}

/**
 * The galaxies a completed galaxy unlocks: the next on the route, and while that one is a
 * placeholder, each after it up to and including the next built galaxy.
 */
export function unlockedBy(galaxy: SectorId): SectorId[] {
  const unlocks: SectorId[] = [];
  for (let at = ROUTE_POSITION[galaxy] + 1; at <= ROUTE.length; at++) {
    const next = galaxyAt(at as RoutePosition);
    unlocks.push(next);
    if (BUILT.has(next)) {
      break;
    }
  }
  return unlocks;
}
