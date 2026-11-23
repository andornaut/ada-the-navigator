import type { EnemyActorKind } from "./enemyActors.ts";
import { enemyRandom } from "./enemyRandom.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { SHIP_PHYSICS } from "./shipPhysics.ts";

export const PHANTOM_FLAGSHIP_ID = "phantomFlagship";
export const WRECK_ID_PREFIX = "wreck:";
export const INDUSTRIAL_BODY_KEYS = ["retaliatorCargoHauler", "retaliatorMiningFreighter"] as const;
export type IndustrialBodyKey = (typeof INDUSTRIAL_BODY_KEYS)[number];
export const HEAVY_PROFILE_PART_CLASSES = {
  capitalCompact: "capital",
  capitalNarrow: "capital",
  frigateCompact: "frigate",
  frigateNarrow: "frigate",
} as const;
export type HeavyProfileAssetKey = keyof typeof HEAVY_PROFILE_PART_CLASSES;
export type HeavyHullProfile = "compact" | "narrow";
export type EnemyAssetKey =
  | Exclude<keyof typeof SHIP_PHYSICS, "ada">
  | "gadget"
  | "hostileStation"
  | HeavyProfileAssetKey
  | IndustrialBodyKey;
export type EnemyGeometryKey = EnemyAssetKey | "hostileStationAndromeda" | "hostileStationPhantom";

export interface EnemyIdentity {
  readonly archetype: EnemyActorKind;
  readonly id?: string | undefined;
  /** Absent on standard hulls, including pre-profile saves. */
  readonly hullProfile?: HeavyHullProfile | undefined;
}

function canCarryHeavyProfile({ archetype, id }: EnemyIdentity): boolean {
  return (
    (archetype === "frigate" || archetype === "capital") &&
    Boolean(id && id !== PHANTOM_FLAGSHIP_ID && !id.startsWith("route:"))
  );
}

export function isHeavyHullProfile(
  identity: EnemyIdentity,
  value: unknown,
): value is HeavyHullProfile {
  return canCarryHeavyProfile(identity) && (value === "compact" || value === "narrow");
}

/** Resolve only caller-authorized profiles for a newly admitted ordinary ship. */
export function selectOrdinaryHeavyProfile(
  choices: readonly (HeavyHullProfile | undefined)[],
  identity: EnemyIdentity,
): HeavyHullProfile | undefined {
  if (!canCarryHeavyProfile(identity)) {
    return undefined;
  }
  const candidates = [...new Set(choices)];
  const roll = enemyRandom(`heavy-hull-profile:${identity.id}`)();
  return candidates[Math.floor(roll * candidates.length)];
}

export function heavyProfilePartClass(asset: string): "frigate" | "capital" | undefined {
  return Object.hasOwn(HEAVY_PROFILE_PART_CLASSES, asset)
    ? HEAVY_PROFILE_PART_CLASSES[asset as HeavyProfileAssetKey]
    : undefined;
}

/** Visual identity uses its own stream and never changes the gameplay archetype or world rolls. */
export function enemyAssetKey(identity: EnemyIdentity): EnemyAssetKey {
  if (identity.archetype === "capital" && identity.id === PHANTOM_FLAGSHIP_ID) {
    return "gadget";
  }
  const { archetype, hullProfile } = identity;
  if (
    (archetype === "capital" || archetype === "frigate") &&
    isHeavyHullProfile(identity, hullProfile)
  ) {
    return `${archetype}${hullProfile === "compact" ? "Compact" : "Narrow"}`;
  }
  return retaliatorVariant(identity) ?? archetype;
}

/** Shares the rendering identity stream with idle navigation. */
export function retaliatorVariant(identity: EnemyIdentity): IndustrialBodyKey | undefined {
  if (identity.archetype !== "retaliator" || !identity.id) {
    return undefined;
  }
  return INDUSTRIAL_BODY_KEYS[
    Math.floor(enemyRandom(`retaliator-body:${identity.id}`)() * INDUSTRIAL_BODY_KEYS.length)
  ];
}

/** The art family supplies station geometry while the actor and texture identities stay stable. */
export function enemyGeometryKey(
  identity: EnemyIdentity,
  position?: RoutePosition,
): EnemyGeometryKey {
  if (identity.archetype === "hostileStation") {
    if (position === 4) {
      return "hostileStationAndromeda";
    }
    if (position === 6) {
      return "hostileStationPhantom";
    }
  }
  return enemyAssetKey(identity);
}

export function wreckEnemyId(id: string): string {
  return id.startsWith(WRECK_ID_PREFIX) ? id.slice(WRECK_ID_PREFIX.length) : id;
}
