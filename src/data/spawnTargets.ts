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
    region(1.5, 3.64, [0.4, 0.327, 0, 0, 0, 0]),
    region(1.6, 3.64, [0.327, 0.291, 0, 0.109, 0, 0]),
    region(1.5, 3.64, [0.291, 0.255, 0.073, 0.109, 0, 0]),
  ],
  // Cartwheel
  2: [
    region(1.4, 5.09, [0.242, 0.387, 0.116, 0.097, 0.136, 0.041]),
    region(1.4, 5.09, [0.242, 0.387, 0.116, 0.097, 0.136, 0.041]),
    region(1.3, 5.09, [0.242, 0.387, 0.116, 0.097, 0.136, 0.041]),
  ],
  // Whirlpool
  3: [
    region(1.3, 4.0, [0.211, 0.253, 0.126, 0.084, 0.126, 0]),
    region(1.2, 4.0, [0.211, 0.253, 0.126, 0.084, 0.126, 0]),
    region(1.1, 4.0, [0.211, 0.253, 0.126, 0.084, 0.126, 0]),
  ],
  // Needle
  4: [
    region(1.3, 4.37, [0.167, 0.209, 0.209, 0.067, 0.151, 0.07]),
    region(1.4, 4.37, [0.167, 0.209, 0.209, 0.067, 0.151, 0.07]),
    region(1.4, 4.37, [0.167, 0.209, 0.209, 0.067, 0.151, 0.07]),
  ],
  // Andromeda
  5: [
    region(1.4, 4.73, [0.176, 0.264, 0.132, 0.088, 0.206, 0.08]),
    region(1.5, 4.73, [0.176, 0.264, 0.132, 0.088, 0.206, 0.08]),
    region(1.4, 4.73, [0.176, 0.264, 0.132, 0.088, 0.206, 0.08]),
  ],
  // Phantom
  6: [
    region(1.4, 5.46, [0.167, 0.232, 0.139, 0.065, 0.348, 0.139]),
    region(1.4, 5.46, [0.167, 0.232, 0.139, 0.065, 0.348, 0.139]),
    region(1.3, 5.46, [0.167, 0.232, 0.139, 0.065, 0.348, 0.139]),
  ],
};
