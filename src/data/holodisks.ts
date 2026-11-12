import type { EnemyArchetype } from "./enemy-catalog.ts";

/** Provisional holodisk values, to be tuned through playtesting. */
export const HOLODISKS: {
  /** Galaxy two's hub sells its holodisk for this many Stardust. */
  readonly hubPrice: number;
  /** Galaxy three's holodisk guard: a route-blocking leader with a pack around it. */
  readonly guard: {
    readonly leader: EnemyArchetype;
    readonly pack: EnemyArchetype;
    readonly packSize: number;
  };
} = {
  guard: { leader: "frigate", pack: "swarm", packSize: 4 },
  hubPrice: 500,
};
