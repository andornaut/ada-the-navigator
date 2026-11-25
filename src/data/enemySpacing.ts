import type { EnemyArchetype } from "./enemyCatalog.ts";
import {
  type EnemyGeometryKey,
  enemyGeometryKey,
  type EnemyIdentity,
  INDUSTRIAL_BODY_KEYS,
} from "./enemyIdentity.ts";
import type { RoutePosition } from "./galaxies.ts";

/** The identity of a ship of an `EnemyArchetype`. */
export type ShipIdentity = EnemyIdentity & { readonly archetype: EnemyArchetype };

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

/** A ship's spacing radius at a route position: every ship of an `EnemyArchetype` has one. */
export function shipSpacingRadius(position: RoutePosition, identity: ShipIdentity): number {
  return spacingRadius(position, identity)!;
}

/**
 * The largest spacing radius a ship of `archetype` can have at a route position, for bounds that
 * hold before its ship id is known: its galaxy's design's, or for a retaliator, which rolls its
 * hull from its ship id, its largest hull's.
 */
export function classSpacingRadius(position: RoutePosition, archetype: EnemyArchetype): number {
  return archetype === "retaliator"
    ? Math.max(...RETALIATOR_DESIGNS.map((design) => SPACING_RADII[design]))
    : shipSpacingRadius(position, { archetype });
}
