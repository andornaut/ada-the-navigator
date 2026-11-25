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

/** One region's lowered rock targets and its enemy group targets. */
export interface RegionSpawnTargets {
  readonly enemies: EnemyGroupTargets;
  readonly features: number;
  readonly resources: number;
}

/** Chunks in the 3x3-chunk area every target counts over. */
export const SPAWN_AREA_CHUNKS = 9;
/** Slot rocks per area in every galaxy and region. */
export const SLOT_ROCKS_PER_AREA = 29.84;
/** Moving rocks per area for each unit of a galaxy's original encounter rate. */
export const MOVING_ROCKS_PER_ENCOUNTER_RATE = 2.109;
/** Composition blends linearly across this width centred on each region boundary. */
export const SPAWN_BLEND_WIDTH = 2000;

const region = (
  resources: number,
  features: number,
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
  resources,
});

/**
 * Mean counts per 3x3-chunk area by galaxy and region (inner, middle, outer), from
 * gameplay/rules.md "Spawn targets". Enemy columns count groups.
 */
export const SPAWN_TARGETS: Readonly<
  Record<GalaxyNumber, readonly [RegionSpawnTargets, RegionSpawnTargets, RegionSpawnTargets]>
> = {
  // Sunflower
  1: [
    region(7.2, 1.5, [0.363, 0.306, 0, 0, 0, 0]),
    region(7.0, 1.6, [0.244, 0.288, 0, 0.15, 0, 0]),
    region(7.3, 1.5, [0.356, 0.231, 0.1, 0.05, 0, 0]),
  ],
  // Cartwheel
  2: [
    region(6.9, 1.4, [0.238, 0.419, 0.125, 0.119, 0.131, 0.05]),
    region(6.6, 1.4, [0.275, 0.356, 0.081, 0.1, 0.175, 0.044]),
    region(7.0, 1.3, [0.225, 0.369, 0.119, 0.113, 0.125, 0.038]),
  ],
  // Whirlpool
  3: [
    region(5.5, 1.3, [0.181, 0.231, 0.094, 0.131, 0.113, 0]),
    region(5.8, 1.2, [0.231, 0.175, 0.144, 0.081, 0.169, 0]),
    region(5.5, 1.1, [0.231, 0.275, 0.138, 0.063, 0.138, 0]),
  ],
  // Needle
  4: [
    region(7.5, 1.3, [0.206, 0.238, 0.194, 0.075, 0.138, 0.063]),
    region(7.6, 1.4, [0.163, 0.244, 0.188, 0.075, 0.169, 0.069]),
    region(7.6, 1.4, [0.144, 0.238, 0.213, 0.069, 0.131, 0.1]),
  ],
  // Andromeda
  5: [
    region(7.2, 1.4, [0.138, 0.313, 0.1, 0.106, 0.181, 0.069]),
    region(7.3, 1.5, [0.15, 0.244, 0.138, 0.056, 0.213, 0.088]),
    region(7.3, 1.4, [0.169, 0.275, 0.094, 0.094, 0.256, 0.094]),
  ],
  // Phantom
  6: [
    region(7.2, 1.4, [0.156, 0.219, 0.194, 0.094, 0.356, 0.119]),
    region(7.2, 1.4, [0.156, 0.238, 0.131, 0.075, 0.35, 0.144]),
    region(7.3, 1.3, [0.15, 0.231, 0.131, 0.069, 0.4, 0.106]),
  ],
};
