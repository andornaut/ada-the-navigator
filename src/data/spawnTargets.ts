import type { EnemyArchetype } from "./enemyCatalog.ts";
import type { GalaxyNumber } from "./types.ts";

/** Ambient enemy group targets per region; `frigate` and `capital` groups include escorts. */
export type EnemyGroupTargets = Readonly<
  Record<
    Extract<
      EnemyArchetype,
      "capital" | "fighter" | "frigate" | "interceptor" | "retaliator" | "swarm"
    >,
    number
  >
>;

/** One region's feature, moving rock and enemy group targets. */
export interface RegionSpawnTargets {
  readonly enemies: EnemyGroupTargets;
  readonly features: number;
  readonly moving: number;
}

/** Chunks in the 3x3-chunk area every target counts over. */
export const SPAWN_AREA_CHUNKS = 9;
/** Slot rocks per area in every galaxy and region. */
export const SLOT_ROCKS_PER_AREA = 29.84;
/**
 * Moving rocks (gameplay/rules.md "Space encounters and feedback"): the share of chosen rocks
 * that lead a cluster, how many placed rocks each leader pulls (equal weight, inclusive) and the
 * farthest a pulled rock's centre lies from the leader's; the seconds of straight path checked
 * against exclusion zones and arrival clearances; and the speed range in world units per second,
 * whose top is also the fastest a rock leaves a ricochet.
 */
export const MOVING_ROCKS = {
  cluster: { radius: 300, share: 0.5, size: [1, 3] },
  pathSeconds: 30,
  speed: [10, 100],
} as const;
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
  moving: number,
  [swarm, fighter, interceptor, retaliator, frigate, capital]: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
  ],
): RegionSpawnTargets => ({
  enemies: { capital, fighter, frigate, interceptor, retaliator, swarm },
  features,
  moving,
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
    region(1.5, 4.3, [0.244, 0.2, 0, 0, 0, 0]),
    region(1.6, 4.3, [0.2, 0.178, 0, 0.067, 0, 0]),
    region(1.5, 4.3, [0.178, 0.155, 0.044, 0.067, 0, 0]),
  ],
  // Cartwheel
  2: [
    region(1.4, 4.68, [0.131, 0.209, 0.063, 0.052, 0.073, 0.022]),
    region(1.4, 4.68, [0.131, 0.209, 0.063, 0.052, 0.073, 0.022]),
    region(1.3, 4.68, [0.131, 0.209, 0.063, 0.052, 0.073, 0.022]),
  ],
  // Whirlpool
  3: [
    region(1.3, 5.04, [0.105, 0.126, 0.063, 0.042, 0.063, 0]),
    region(1.2, 5.04, [0.105, 0.126, 0.063, 0.042, 0.063, 0]),
    region(1.1, 5.04, [0.105, 0.126, 0.063, 0.042, 0.063, 0]),
  ],
  // Needle
  4: [
    region(1.3, 4.98, [0.084, 0.105, 0.105, 0.033, 0.075, 0.035]),
    region(1.4, 4.98, [0.084, 0.105, 0.105, 0.033, 0.075, 0.035]),
    region(1.4, 4.98, [0.084, 0.105, 0.105, 0.033, 0.075, 0.035]),
  ],
  // Andromeda
  5: [
    region(1.4, 4.82, [0.092, 0.137, 0.069, 0.046, 0.107, 0.042]),
    region(1.5, 4.82, [0.092, 0.137, 0.069, 0.046, 0.107, 0.042]),
    region(1.4, 4.82, [0.092, 0.137, 0.069, 0.046, 0.107, 0.042]),
  ],
  // Phantom
  6: [
    region(1.4, 7.32, [0.129, 0.179, 0.107, 0.05, 0.268, 0.107]),
    region(1.4, 7.32, [0.129, 0.179, 0.107, 0.05, 0.268, 0.107]),
    region(1.3, 7.32, [0.129, 0.179, 0.107, 0.05, 0.268, 0.107]),
  ],
};
