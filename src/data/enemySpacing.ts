import type { EnemyArchetype } from "./enemyCatalog.ts";
import {
  type EnemyGeometryKey,
  enemyGeometryKey,
  type EnemyIdentity,
  INDUSTRIAL_BODY_KEYS,
} from "./enemyIdentity.ts";
import type { RoutePosition } from "./galaxies.ts";

/** The designs with an approved spacing radius: every ship design and the ore-field platform. */
export type SpacedDesign = Exclude<
  EnemyGeometryKey,
  "hostileStation" | "hostileStationAndromeda" | "hostileStationPhantom"
>;

/**
 * Each design's spacing radius in world units (gameplay/ships.md "Hulls"): the larger of half its
 * drawn length and half its drawn width. It sets spawn footprints, group member spacing, escort
 * rings and capital spacing, never hits.
 */
export const SPACING_RADII: Readonly<Record<SpacedDesign, number>> = {
  capital: 85,
  capitalBroad: 75,
  capitalCrossbow: 88,
  capitalForked: 91,
  capitalManta: 82,
  capitalOutrigger: 81,
  fighter: 13,
  frigate: 63,
  frigateTwin: 58,
  gadget: 65,
  interceptor: 22,
  platform: 40,
  retaliator: 30,
  retaliatorCargoHauler: 45,
  retaliatorMiningFreighter: 30,
  swarm: 8,
};

function spaced(key: EnemyGeometryKey): key is SpacedDesign {
  return Object.hasOwn(SPACING_RADII, key);
}

/** A ship's spacing radius at a route position, or undefined for a design without one. */
export function spacingRadius(
  position: RoutePosition,
  identity: EnemyIdentity,
): number | undefined {
  const key = enemyGeometryKey(identity, position);
  return spaced(key) ? SPACING_RADII[key] : undefined;
}

/** The retaliator hulls: the Manta gunship, which flies the class's own design, and the bodies. */
const RETALIATOR_DESIGNS = ["retaliator", ...INDUSTRIAL_BODY_KEYS] as const;

/**
 * The spacing radius a planned ship of `archetype` takes at a route position, before it has a
 * ship id: its galaxy's design's. A retaliator rolls its hull from its ship id, so it takes its
 * largest hull's.
 */
export function plannedSpacingRadius(position: RoutePosition, archetype: EnemyArchetype): number {
  if (archetype === "retaliator") {
    return Math.max(...RETALIATOR_DESIGNS.map((design) => SPACING_RADII[design]));
  }
  return spacingRadius(position, { archetype })!;
}
