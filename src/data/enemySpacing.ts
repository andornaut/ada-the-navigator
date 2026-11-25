import type { EnemyArchetype } from "./enemyCatalog.ts";
import {
  type EnemyGeometryKey,
  enemyGeometryKey,
  type EnemyIdentity,
  INDUSTRIAL_BODY_KEYS,
} from "./enemyIdentity.ts";
import type { RoutePosition } from "./galaxies.ts";

/**
 * Each design's spacing radius in world units (gameplay/ships.md "Hulls"): the larger of half its
 * drawn length and half its drawn width. It sets spawn footprints, group member spacing, escort
 * rings and capital spacing, never hits.
 */
export const SPACING_RADII: Readonly<Record<EnemyGeometryKey, number>> = {
  archie: 65,
  capital: 85,
  capitalBroad: 75,
  capitalCrossbow: 88,
  capitalForked: 91,
  capitalManta: 82,
  capitalOutrigger: 81,
  fighter: 13,
  frigate: 63,
  frigateTwin: 58,
  hostileStation: 70,
  hostileStationAndromeda: 70,
  hostileStationPhantom: 70,
  interceptor: 22,
  platform: 37,
  retaliator: 30,
  retaliatorCargoHauler: 45,
  retaliatorMiningFreighter: 30,
  swarm: 8,
};

/** A ship's spacing radius at a route position: its design's. */
export function spacingRadius(position: RoutePosition, identity: EnemyIdentity): number {
  return SPACING_RADII[enemyGeometryKey(identity, position)];
}

/** The retaliator hulls: the Manta gunship, which flies the class's own design, and the bodies. */
const RETALIATOR_DESIGNS = ["retaliator", ...INDUSTRIAL_BODY_KEYS] as const;

/**
 * The largest spacing radius a ship of `archetype` can have at a route position, for bounds that
 * hold before its ship id is known: its galaxy's design's, or for a retaliator, which rolls its
 * hull from its ship id, its largest hull's.
 */
export function classSpacingRadius(position: RoutePosition, archetype: EnemyArchetype): number {
  return archetype === "retaliator"
    ? Math.max(...RETALIATOR_DESIGNS.map((design) => SPACING_RADII[design]))
    : spacingRadius(position, { archetype });
}
