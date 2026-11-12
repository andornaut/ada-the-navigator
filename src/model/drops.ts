import type { AsteroidSize } from "../data/asteroid-catalog.ts";
import type { EconomyCatalog, UpgradeWeapon } from "../data/economy.ts";
import { type EnemyArchetype, enemyStardust, HEAVIES } from "../data/enemy-catalog.ts";
import { byPosition } from "../data/galaxies.ts";
import type { SectorId } from "../data/types.ts";
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
 * A destroyed enemy's drop: a small craft's Stardust plus, at its archetype's chance in the
 * galaxy, a random upgrade weapon; a destroyed heavy's twice its Stardust and no weapon.
 * Collecting a weapon Ada already owns gives a pack of its ammunition instead.
 */
export function rollEnemyDrop(
  catalog: EconomyCatalog,
  sector: SectorId,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  if (HEAVIES.includes(archetype)) {
    return { stardust: enemyStardust(sector, archetype) * 2, weapon: null };
  }
  const drop: Drop = { stardust: enemyStardust(sector, archetype), weapon: null };
  if (next() < byPosition(catalog.weaponDropChance, sector)[archetype]) {
    drop.weapon = UPGRADE_WEAPONS[Math.floor(next() * UPGRADE_WEAPONS.length)] ?? "rapidMissile";
  }
  return drop;
}

/**
 * A salvaged heavy's drop: its Stardust, half what destroying it gives, and a random upgrade
 * weapon at twice its archetype's chance in the galaxy.
 */
export function rollSalvageDrop(
  catalog: EconomyCatalog,
  sector: SectorId,
  archetype: EnemyArchetype,
  next: () => number,
): Drop {
  const drop: Drop = { stardust: enemyStardust(sector, archetype), weapon: null };
  if (next() < byPosition(catalog.weaponDropChance, sector)[archetype] * 2) {
    drop.weapon = UPGRADE_WEAPONS[Math.floor(next() * UPGRADE_WEAPONS.length)] ?? "rapidMissile";
  }
  return drop;
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
