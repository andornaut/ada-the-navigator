import { LANCE_TELL, PHASER_AIM_SECONDS } from "../data/enemyCatalog.ts";
import type { Vec } from "../data/types.ts";
import { BEAM } from "../data/weaponCatalog.ts";

/**
 * An enemy Phaser or charged lance shot and its tell: a Phaser's aim line is fixed where it
 * started; a lance's line follows its ship and tracks Ada, then holds still. The beam fires
 * along the line. Only the lance can stop early. A Phaser keeps its impact separate.
 * Pending ordinary attacks resume from the flight queue. Authored tells restore from actor state.
 */
export interface EnemyBeam {
  /** Seconds since the tell appeared. */
  age: number;
  damage: number;
  direction: Vec;
  /**
   * A fired Phaser's visible beam this step: from its ship's current muzzle along the weapon's
   * current aim at the length it fired with. `muzzle` and `end` keep the fire-time line.
   * Null before it fires, and always for a lance.
   */
  drawn: { from: Vec; to: Vec } | null;
  end: Vec;
  fired: boolean;
  hardpointId: string | null;
  impact?: Vec;
  kind: "lance" | "phaser";
  muzzle: Vec;
  /** The muzzle's offset from its ship, which a lance's line follows while it tracks. */
  offset: Vec;
  ownerId: string;
  range: number;
  /** Whether an obstacle, or Ada on firing, stopped the line short of its range. */
  stopped: boolean;
  /** The named encounter owns this pending tell across Continue. */
  authored?: true;
  /** The volley that picked the drawn barrel it fired from. */
  volley: number;
}
/** When each beam fires after its tell begins, and how long its beam then shows. */
export const BEAM_TIMING = {
  // art/weapons.md "Charged lance": the beam shows for 300 ms.
  lance: {
    fires: LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds,
    shows: Math.max(0.3, BEAM.sparkSeconds),
  },
  phaser: { fires: PHASER_AIM_SECONDS, shows: Math.max(BEAM.flashSeconds, BEAM.sparkSeconds) },
} as const;
