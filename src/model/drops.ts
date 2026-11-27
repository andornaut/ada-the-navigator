import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import type { EnemyActorKind } from "../data/enemyActors.ts";
import { ENEMY_STARDUST_RANGES, type EnemyArchetype, HEAVIES } from "../data/enemyCatalog.ts";
import { wreckEnemyId } from "../data/enemyIdentity.ts";
import type { Weapon } from "../data/types.ts";
import type { SpaceObject } from "./types.ts";

/** Stardust pickups, from drops or discovery caches, carry an amount. */
export function carriesStardust(object: Pick<SpaceObject, "amount" | "kind" | "role">): boolean {
  return object.kind === "pickup" && object.role !== "cargo" && object.amount !== undefined;
}

export interface Drop {
  stardust: number;
  /** An upgrade pickup, whose gift is chosen when Ada collects it (upgradeDrops.ts). */
  upgrade: boolean;
}

/** A deterministic uniform [0, 1) sequence for one object in one flight. */
export function dropRandom(seed: number, id: string): () => number {
  let n = seed >>> 0;
  for (let index = 0; index < id.length; index++) {
    n = Math.imul(n ^ id.charCodeAt(index), 2654435761) >>> 0;
  }
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

interface EnemyPayoutIdentity {
  readonly id: string;
  readonly seed: number;
}

/** One payout per original actor and flight seed, independent of the upgrade and ammo streams. */
export function enemyStardust(identity: EnemyPayoutIdentity, archetype: EnemyActorKind): number {
  const [low, high] = ENEMY_STARDUST_RANGES[archetype];
  const count = high - low + 1;
  const next = dropRandom(identity.seed, `enemy-stardust:${wreckEnemyId(identity.id)}`);
  // Reject the short final bucket so each integer has exactly the same number of source draws.
  const range = 2 ** 32;
  const bucket = Math.floor(range / count);
  let offset: number;
  do {
    offset = Math.floor((next() * range) / bucket);
  } while (offset >= count);
  return low + offset;
}

/** A destroyed enemy's full payout; only small craft roll for an upgrade. */
export function rollEnemyDrop(
  catalog: EconomyCatalog,
  identity: EnemyPayoutIdentity,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  return {
    stardust: enemyStardust(identity, archetype),
    upgrade: !HEAVIES.includes(archetype) && next() < catalog.upgradeDropChance.small,
  };
}

/** Whether Ada owns a weapon an ammo pack can hold: any other than Laser, in any galaxy. */
function ownsAmmoWeapon(owned: readonly Weapon[]): boolean {
  return owned.some((weapon) => weapon !== "laser");
}

/**
 * Whether a destroyed small craft drops an ammo pack pickup: at the ammo drop chance, apart from
 * its upgrade roll, while Ada owns a weapon other than Laser; a destroyed heavy never does.
 */
export function rollAmmoDrop(
  catalog: EconomyCatalog,
  owned: readonly Weapon[],
  archetype: EnemyActorKind,
  next: () => number,
): boolean {
  const eligible =
    archetype === "fighter" ||
    archetype === "swarm" ||
    archetype === "interceptor" ||
    archetype === "retaliator";
  return eligible && ownsAmmoWeapon(owned) && next() < catalog.ammo.dropChance;
}

/**
 * Whether a destroyed asteroid drops an ammo pack pickup: at the rock ammo drop chance for its
 * size while Ada owns a weapon other than Laser. Ore field rocks skip this roll.
 */
export function rollRockAmmoDrop(
  catalog: EconomyCatalog,
  owned: readonly Weapon[],
  size: AsteroidSize,
  next: () => number,
): boolean {
  return ownsAmmoWeapon(owned) && next() < catalog.ammo.rockDropChance[size];
}

/**
 * A salvaged heavy's drop: its Stardust, half what destroying it gives, and an upgrade pickup
 * at the heavy chance.
 */
export function rollSalvageDrop(
  catalog: EconomyCatalog,
  identity: EnemyPayoutIdentity,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  return {
    stardust: Math.floor(enemyStardust(identity, archetype) / 2),
    upgrade: next() < catalog.upgradeDropChance.heavy,
  };
}

/** Split one resource reward into five-unit bundles, then its single-unit remainder. */
export function splitResourcePickup(amount: number): number[] {
  const total = Math.max(0, Math.floor(amount));
  return [...Array<number>(Math.floor(total / 5)).fill(5), ...Array<number>(total % 5).fill(1)];
}
