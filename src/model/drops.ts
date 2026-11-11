import type { EconomyCatalog, UpgradeWeapon } from "../data/economy.ts";
import type { EnemyArchetype } from "../data/enemy-catalog.ts";
import type { SpaceObject } from "./types.ts";
import { UPGRADE_WEAPONS } from "./weapons.ts";

/** Stardust pickups, from drops or discovery caches, carry an amount. */
export function carriesStardust(object: Pick<SpaceObject, "amount" | "kind">): boolean {
  return object.kind === "pickup" && object.amount !== undefined;
}

export interface Drop {
  stardust: number;
  weapon: UpgradeWeapon | null;
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
 * A destroyed enemy's Stardust plus, at its archetype's chance, a random upgrade
 * weapon. A weapon Ada already owns becomes the owned-weapon Stardust instead.
 */
export function rollEnemyDrop(
  catalog: EconomyCatalog,
  owned: readonly UpgradeWeapon[],
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  const drop: Drop = { stardust: catalog.enemyStardust[archetype], weapon: null };
  if (next() < catalog.weaponDropChance[archetype]) {
    const weapon = UPGRADE_WEAPONS[Math.floor(next() * UPGRADE_WEAPONS.length)] ?? "missiles";
    if (owned.includes(weapon)) {
      drop.stardust += catalog.ownedWeaponStardust;
    } else {
      drop.weapon = weapon;
    }
  }
  return drop;
}

export function rollAsteroidStardust(catalog: EconomyCatalog, next: () => number): number {
  const [low, high] = catalog.asteroidStardust;
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
