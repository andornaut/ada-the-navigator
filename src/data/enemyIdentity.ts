import type { EnemyActorKind } from "./enemyActors.ts";
import { enemyRandom } from "./enemyRandom.ts";
import { GALAXY_ID, ROUTE, type RoutePosition } from "./galaxies.ts";
import type { SHIP_PHYSICS } from "./shipPhysics.ts";

export const PHANTOM_FLAGSHIP_ID = "phantomFlagship";
export const FLAGSHIP_SURRENDER_HP = 16;
export const WRECK_ID_PREFIX = "wreck:";
export const INDUSTRIAL_BODY_KEYS = ["retaliatorCargoHauler", "retaliatorMiningFreighter"] as const;
export type IndustrialBodyKey = (typeof INDUSTRIAL_BODY_KEYS)[number];
export type OrdinaryHeavy = "capital" | "frigate";
/** A retired narrow or compact hull profile, which older saves may record and no hull draws. */
export type HeavyHullProfile = "compact" | "narrow";
export const HULL_DESIGN_KEYS = [
  "capitalBroad",
  "capitalCrossbow",
  "capitalForked",
  "capitalManta",
  "capitalOutrigger",
  "frigateTwin",
] as const;
export type HullDesignKey = (typeof HULL_DESIGN_KEYS)[number];
/**
 * The galaxies whose frigates and capitals fly a design other than the class's own, by stable
 * galaxy id (art/enemy-redesign.md "Frigates" and "Capitals"). The others fly the class's own:
 * the Shoulder frigate and the Hammer capital.
 */
export const HULL_DESIGNS: Readonly<
  Record<OrdinaryHeavy, Readonly<Record<string, HullDesignKey>>>
> = {
  capital: {
    andromeda: "capitalBroad",
    cartwheel: "capitalOutrigger",
    needle: "capitalCrossbow",
    phantom: "capitalForked",
    whirlpool: "capitalManta",
  },
  frigate: { andromeda: "frigateTwin", needle: "frigateTwin", whirlpool: "frigateTwin" },
};
export type EnemyAssetKey =
  Exclude<keyof typeof SHIP_PHYSICS, "ada"> | "archie" | "hostileStation" | IndustrialBodyKey;
export type EnemyGeometryKey =
  EnemyAssetKey | HullDesignKey | "hostileStationAndromeda" | "hostileStationPhantom";

export interface EnemyIdentity {
  readonly archetype: EnemyActorKind;
  readonly id?: string | undefined;
  /** A retired profile; absent on every new hull. */
  readonly hullProfile?: HeavyHullProfile | undefined;
}

export function ordinaryHeavy(kind: EnemyActorKind): kind is OrdinaryHeavy {
  return kind === "capital" || kind === "frigate";
}

/**
 * The design an ordinary heavy flies in the galaxy `galaxyId`, where it is not the class's own.
 * Admiral Archie's flagship keeps its own design.
 */
export function hullDesign(
  { archetype, id }: Pick<EnemyIdentity, "archetype" | "id">,
  galaxyId: string | undefined,
): HullDesignKey | undefined {
  if (!ordinaryHeavy(archetype) || galaxyId === undefined || id === PHANTOM_FLAGSHIP_ID) {
    return undefined;
  }
  const designs = HULL_DESIGNS[archetype];
  return Object.hasOwn(designs, galaxyId) ? designs[galaxyId] : undefined;
}

/** The class whose frames and hardpoints schema a hull design shares, or undefined for a class. */
export function hullDesignClass(key: string): "capital" | "frigate" | "retaliator" | undefined {
  if (INDUSTRIAL_BODY_KEYS.some((body) => body === key)) {
    return "retaliator";
  }
  if (!HULL_DESIGN_KEYS.some((design) => design === key)) {
    return undefined;
  }
  return key.startsWith("capital") ? "capital" : "frigate";
}

/** A saved hull profile, kept only where an ordinary ship could have carried one. */
export function isHeavyHullProfile(
  { archetype, id }: EnemyIdentity,
  value: unknown,
): value is HeavyHullProfile {
  return (
    ordinaryHeavy(archetype) &&
    Boolean(id && id !== PHANTOM_FLAGSHIP_ID && !id.startsWith("route:")) &&
    (value === "compact" || value === "narrow")
  );
}

/** Visual identity uses its own stream and never changes the gameplay archetype or world rolls. */
export function enemyAssetKey(identity: EnemyIdentity): EnemyAssetKey {
  if (identity.archetype === "capital" && identity.id === PHANTOM_FLAGSHIP_ID) {
    return "archie";
  }
  return retaliatorVariant(identity) ?? identity.archetype;
}

/** The retaliator hulls, rolled with equal weight in every galaxy: the Manta gunship first. */
const RETALIATOR_BODIES = [undefined, ...INDUSTRIAL_BODY_KEYS] as const;

/**
 * A retaliator's industrial body, or undefined for the Manta gunship, which flies the class's
 * own hull. Shares the rendering identity stream with idle navigation.
 */
export function retaliatorVariant(identity: EnemyIdentity): IndustrialBodyKey | undefined {
  if (identity.archetype !== "retaliator" || !identity.id) {
    return undefined;
  }
  return RETALIATOR_BODIES[
    Math.floor(enemyRandom(`retaliator-body:${identity.id}`)() * RETALIATOR_BODIES.length)
  ];
}

/**
 * The art family supplies station geometry while the actor and texture identities stay stable;
 * a frigate or capital takes its galaxy's design.
 */
export function enemyGeometryKey(
  identity: EnemyIdentity,
  position?: RoutePosition,
): EnemyGeometryKey {
  const galaxyId = position === undefined ? undefined : GALAXY_ID[ROUTE[position - 1]!];
  const design = hullDesign(identity, galaxyId);
  if (design) {
    return design;
  }
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
