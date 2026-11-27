import type { AsteroidSize } from "./asteroidCatalog.ts";
import type { EnemyArchetype } from "./enemyCatalog.ts";
import type { GalaxyNumber } from "./types.ts";

/** Ambient enemy group targets per region; frigate groups include escorts. */
export type EnemyGroupTargets = Readonly<
  Record<
    Extract<EnemyArchetype, "fighter" | "frigate" | "interceptor" | "retaliator" | "swarm">,
    number
  >
>;

/** One region's feature rock and enemy group targets. */
export interface RegionSpawnTargets {
  readonly enemies: EnemyGroupTargets;
  readonly features: number;
}

/** Chunks in the 3x3-chunk area every target counts over. */
export const SPAWN_AREA_CHUNKS = 9;
/** Ordinary slot-rock requests per open area, flat within each galaxy and indexed by galaxy ID. */
export const SLOT_ROCKS_PER_AREA: Readonly<Record<GalaxyNumber, number>> = {
  1: 60,
  2: 76,
  3: 64,
  4: 68,
  5: 72,
  6: 80,
};
/**
 * Moving rocks (gameplay/rules.md "Space encounters and feedback"): the share of chosen rocks
 * that lead a cluster, how many placed rocks each leader pulls (equal weight, inclusive) and the
 * farthest a pulled rock's centre lies from the leader's; the seconds of straight path checked
 * against exclusion zones and arrival clearances; and the speed range in world units per second,
 * whose top supplies the per-size caps at launch and after a ricochet.
 */
export const MOVING_ROCKS = {
  cluster: { radius: 300, share: 0.5, size: [1, 3] },
  pathSeconds: 30,
  speed: [25, 125],
} as const;
/** Share of placed ordinary rocks requested as movers, by runtime galaxy ID. */
export const MOVING_ROCK_SHARES: Readonly<Record<GalaxyNumber, number>> = {
  1: 0.25,
  2: 0.37,
  3: 0.28,
  4: 0.31,
  5: 0.34,
  6: 0.4,
};
/** Shares of the upper ambient speed bound, by asteroid size. */
export const ASTEROID_SPEED_SHARE: Readonly<Record<AsteroidSize, number>> = {
  huge: 0.25,
  large: 0.5,
  medium: 0.75,
  small: 1,
};
/**
 * Each galaxy's enemy density factor: the share of encounter lattice cells that hold a group is
 * 0.75 times it (gameplay/ships.md "Ambient admission"). It scales enemy densities only; the
 * encounter rate, lattice pitch and minimum group distance do not change with it.
 */
export const ENEMY_DENSITY_FACTORS: Readonly<Record<GalaxyNumber, number>> = {
  1: 0.61,
  2: 0.54,
  3: 0.5,
  4: 0.5,
  5: 0.52,
  6: 0.77,
};
/** Share of encounter lattice cells that hold a group at a density factor of 1. */
export const LATTICE_OCCUPANCY = 0.75;
/** Composition blends linearly across this width centred on each region boundary. */
export const SPAWN_BLEND_WIDTH = 2000;

const region = (
  features: number,
  [swarm, fighter, interceptor, retaliator, frigate]: readonly [
    number,
    number,
    number,
    number,
    number,
  ],
): RegionSpawnTargets => ({
  enemies: { fighter, frigate, interceptor, retaliator, swarm },
  features,
});

/**
 * Mean counts per open 3x3-chunk area by galaxy and region (inner, middle, outer), from
 * gameplay/rules.md "Spawn targets". Enemy columns count groups.
 */
export const SPAWN_TARGETS: Readonly<
  Record<GalaxyNumber, readonly [RegionSpawnTargets, RegionSpawnTargets, RegionSpawnTargets]>
> = {
  // Sunflower
  1: [
    region(2.25, [0.244, 0.2, 0, 0, 0]),
    region(2.4, [0.2, 0.178, 0, 0.067, 0]),
    region(2.25, [0.178, 0.155, 0.044, 0.067, 0]),
  ],
  // Cartwheel
  2: [
    region(2.1, [0.131, 0.209, 0.063, 0.052, 0.073]),
    region(2.1, [0.131, 0.209, 0.063, 0.052, 0.073]),
    region(1.95, [0.131, 0.209, 0.063, 0.052, 0.073]),
  ],
  // Whirlpool
  3: [
    region(1.95, [0.105, 0.126, 0.063, 0.042, 0.063]),
    region(1.8, [0.105, 0.126, 0.063, 0.042, 0.063]),
    region(1.65, [0.105, 0.126, 0.063, 0.042, 0.063]),
  ],
  // Needle
  4: [
    region(1.95, [0.084, 0.105, 0.105, 0.033, 0.075]),
    region(2.1, [0.084, 0.105, 0.105, 0.033, 0.075]),
    region(2.1, [0.084, 0.105, 0.105, 0.033, 0.075]),
  ],
  // Andromeda
  5: [
    region(2.1, [0.092, 0.137, 0.069, 0.046, 0.107]),
    region(2.25, [0.092, 0.137, 0.069, 0.046, 0.107]),
    region(2.1, [0.092, 0.137, 0.069, 0.046, 0.107]),
  ],
  // Phantom
  6: [
    region(2.1, [0.129, 0.179, 0.107, 0.05, 0.268]),
    region(2.1, [0.129, 0.179, 0.107, 0.05, 0.268]),
    region(1.95, [0.129, 0.179, 0.107, 0.05, 0.268]),
  ],
};
