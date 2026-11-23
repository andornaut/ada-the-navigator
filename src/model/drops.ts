import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { EconomyCatalog } from "../data/economy.ts";
import { type EnemyArchetype, enemyStardust, HEAVIES } from "../data/enemyCatalog.ts";
import type { GalaxyNumber, Weapon } from "../data/types.ts";
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

/**
 * A destroyed enemy's drop: a small craft's Stardust plus, at the small-craft chance, an
 * upgrade pickup; a destroyed heavy's twice its Stardust and no upgrade.
 */
export function rollEnemyDrop(
  catalog: EconomyCatalog,
  galaxy: GalaxyNumber,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  if (HEAVIES.includes(archetype)) {
    return { stardust: enemyStardust(galaxy, archetype) * 2, upgrade: false };
  }
  return {
    stardust: enemyStardust(galaxy, archetype),
    upgrade: next() < catalog.upgradeDropChance.small,
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
  archetype: EnemyArchetype,
  next: () => number,
): boolean {
  return !HEAVIES.includes(archetype) && ownsAmmoWeapon(owned) && next() < catalog.ammo.dropChance;
}

/**
 * Whether a destroyed asteroid or ore rock drops an ammo pack pickup: at the rock ammo drop
 * chance for its size while Ada owns a weapon other than Laser.
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
  galaxy: GalaxyNumber,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  return {
    stardust: enemyStardust(galaxy, archetype),
    upgrade: next() < catalog.upgradeDropChance.heavy,
  };
}

/** Split one resource reward into five-unit bundles, then its single-unit remainder. */
export function splitResourcePickup(amount: number): number[] {
  const total = Math.max(0, Math.floor(amount));
  return [...Array<number>(Math.floor(total / 5)).fill(5), ...Array<number>(total % 5).fill(1)];
}
