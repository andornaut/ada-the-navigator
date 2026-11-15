import type { EnemyActorKind } from "./enemyActors.ts";
import { enemyRandom } from "./enemyRandom.ts";
import type { SHIP_PHYSICS } from "./shipPhysics.ts";

export const PHANTOM_FLAGSHIP_ID = "phantomFlagship";
export const WRECK_ID_PREFIX = "wreck:";
export const INDUSTRIAL_BODY_KEYS = ["retaliatorCargoHauler", "retaliatorMiningFreighter"] as const;
export type EnemyAssetKey =
  | Exclude<keyof typeof SHIP_PHYSICS, "ada">
  | "gadget"
  | "hostileStation"
  | (typeof INDUSTRIAL_BODY_KEYS)[number];
export interface EnemyIdentity {
  readonly archetype: EnemyActorKind;
  readonly id?: string;
}

/** Visual identity uses its own stream and never changes the gameplay archetype or world rolls. */
export function enemyAssetKey(identity: EnemyIdentity): EnemyAssetKey {
  if (identity.archetype === "capital" && identity.id === PHANTOM_FLAGSHIP_ID) {
    return "gadget";
  }
  if (identity.archetype === "retaliator" && identity.id !== undefined && identity.id !== "") {
    return INDUSTRIAL_BODY_KEYS[
      Math.floor(enemyRandom(`retaliator-body:${identity.id}`)() * INDUSTRIAL_BODY_KEYS.length)
    ]!;
  }
  return identity.archetype;
}

export function wreckEnemyId(id: string): string {
  return id.startsWith(WRECK_ID_PREFIX) ? id.slice(WRECK_ID_PREFIX.length) : id;
}
