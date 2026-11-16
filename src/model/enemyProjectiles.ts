import type { WeaponDefinition } from "../data/weaponCatalog.ts";
import type { FireIntent } from "./enemyAi.ts";
import { projectileReach } from "./playerProjectiles.ts";
import { playerWeaponCoverage, type PlayerWeaponCoverageContext } from "./playerWeaponCoverage.ts";
import type { Vec } from "./types.ts";

export interface EnemyProjectileContext {
  readonly baseLifetime: number;
  readonly coverage: PlayerWeaponCoverageContext;
  readonly definition: WeaponDefinition | null;
  readonly inheritedVelocity: Readonly<Vec>;
}

type EnemyRay = Readonly<Pick<FireIntent, "aim" | "origin">>;

/** A shared hitscan weapon uses the same muzzle-relative rounded coverage as Ada. */
export function enemyBeamReach(coverage: PlayerWeaponCoverageContext, fire: EnemyRay): number {
  return playerWeaponCoverage(coverage, { direction: fire.aim, origin: fire.origin });
}

/** Captures a traveling shot's world velocity and weapon-relative reach once per launch. */
export function planEnemyProjectile(
  context: EnemyProjectileContext,
  fire: EnemyRay & Readonly<Pick<FireIntent, "speed">>,
) {
  const { baseLifetime, coverage, definition, inheritedVelocity } = context;
  const reach = definition
    ? projectileReach(
        definition.projectileKind === "bolt"
          ? {
              ...definition,
              rangeWorld: playerWeaponCoverage(coverage, {
                direction: fire.aim,
                origin: fire.origin,
              }),
            }
          : definition,
        fire.speed,
        baseLifetime,
      )
    : { life: baseLifetime };
  return {
    ...(definition?.blastRadius === null || definition === null
      ? {}
      : { blast: definition.blastRadius }),
    ...reach,
    velocity: {
      x: fire.aim.x * fire.speed + (definition ? inheritedVelocity.x : 0),
      y: fire.aim.y * fire.speed + (definition ? inheritedVelocity.y : 0),
    },
  };
}
