import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import {
  ASTEROID_LOOT,
  ASTEROID_RESOURCE_FLOOR,
  CRYSTAL_MINIMUM_ORE,
} from "../data/asteroidLoot.ts";
import { type AsteroidLoot, rollAsteroidLoot } from "./asteroidLoot.ts";
import { asteroidSize } from "./asteroids.ts";
import { dropRandom } from "./drops.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import type { SpaceObject } from "./types.ts";

export const rockDropId = (id: string): string =>
  id.startsWith(MOVING_ROCK_PREFIX) ? id.slice(MOVING_ROCK_PREFIX.length) : id;

export function rockLoot(size: AsteroidSize, crystal: boolean, next: () => number): AsteroidLoot {
  let { ore, stardust } = rollAsteroidLoot(ASTEROID_LOOT, size, next);
  if (crystal) {
    ore = Math.max(CRYSTAL_MINIMUM_ORE, ore);
    const { minimum, weights } = ASTEROID_LOOT.totals[size];
    const cap = minimum + weights.length - 1;
    stardust = Math.min(stardust, cap - ore);
  }
  for (let deficit = ASTEROID_RESOURCE_FLOOR[size] - ore - stardust; deficit > 0; deficit--) {
    if (next() < ASTEROID_LOOT.oreChance) {
      ore++;
    } else {
      stardust++;
    }
  }
  return { ore, stardust };
}

/** The rock's seeded ore content before any ammo replacement. */
export function seededRockOre(seed: number, object: SpaceObject): number {
  return rockLoot(
    asteroidSize(object),
    object.crystals !== undefined,
    dropRandom(seed, rockDropId(object.id)),
  ).ore;
}
