import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import { type EconomyCatalog, unlockedWeapons } from "../data/economy.ts";
import { type EnemyArchetype, enemyStardust, HEAVIES } from "../data/enemyCatalog.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import type { GalaxyNumber, Weapon } from "../data/types.ts";
import type { SpaceObject } from "./types.ts";

/** Stardust pickups, from drops or discovery caches, carry an amount. */
export function carriesStardust(object: Pick<SpaceObject, "amount" | "kind">): boolean {
  return object.kind === "pickup" && object.amount !== undefined;
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

/**
 * Whether a destroyed small craft in the galaxy at route `position` drops an ammo pack pickup: at
 * the ammo drop chance, apart from its upgrade roll, while Ada owns a weapon other than Laser
 * that the galaxy unlocks; a destroyed heavy never does.
 */
export function rollAmmoDrop(
  catalog: EconomyCatalog,
  position: RoutePosition,
  owned: readonly Weapon[],
  archetype: EnemyArchetype,
  next: () => number,
): boolean {
  const unlocked: readonly Weapon[] = unlockedWeapons(position);
  return (
    !HEAVIES.includes(archetype) &&
    owned.some((weapon) => unlocked.includes(weapon)) &&
    next() < catalog.ammo.dropChance
  );
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

export function rollAsteroidStardust(
  catalog: EconomyCatalog,
  size: AsteroidSize,
  next: () => number,
): number {
  const [low, high] = catalog.asteroidStardust[size];
  return low + Math.floor(next() * (high - low + 1));
}

/**
 * Splits an amount into whole-Stardust pickups, one per Stardust up to `cap`, as evenly
 * as possible with the larger pieces first.
 */
export function splitStardust(cap: number, amount: number): number[] {
  const total = Math.max(0, Math.floor(amount));
  const count = Math.min(total, Math.max(1, Math.floor(cap)));
  return Array.from(
    { length: count },
    (_, index) => Math.floor(total / count) + (index < total % count ? 1 : 0),
  );
}
