import { enemyOnly } from "../../data/enemyCatalog.ts";
import type { GameContent } from "../../data/types.ts";
import { BEAM, LANCE_HIT_RADIUS, weaponAt } from "../../data/weaponCatalog.ts";
import type { EnemyAttackOpportunity } from "../ai/index.ts";
import { crossbowAllowsAttack, crossbowSector } from "../earlyEncounterPatterns.ts";
import { EARLY_LANCE_SECONDS } from "../earlyEncounterRuntime.ts";
import { enemyBeamReach, planEnemyProjectile } from "../enemyProjectiles.ts";
import { needleCourses } from "../needle.ts";
import { fanHeading } from "../playerProjectiles.ts";
import type { PlayerWeaponCoverageContext } from "../playerWeaponCoverage.ts";
import { direction } from "../shipPhysics.ts";
import type { FlightState, SpaceObject } from "../types.ts";
import { flightWorldContext } from "../world/index.ts";
import { BEAM_TIMING, projectedLength } from "./enemyBeams.ts";
import { shotRadius } from "./projectileContact.ts";

export function crossbowFrame(flight: FlightState, actor: SpaceObject, elapsed: number) {
  const exit = needleCourses(flight)?.eye.path.at(-1);
  return exit && actor.enemy
    ? crossbowSector(
        flightWorldContext(flight),
        { elapsed },
        { exit, home: actor.enemy.home, vertex: { x: actor.x, y: actor.y } },
      )
    : undefined;
}

export function crossbowAttack(
  context: {
    readonly content: GameContent;
    readonly coverage: PlayerWeaponCoverageContext;
    readonly flight: FlightState;
  },
  actor: SpaceObject,
  opportunity: EnemyAttackOpportunity,
): boolean {
  const { content, coverage, flight } = context;
  const state = actor.enemy?.earlyEncounter;
  if (state?.kind !== "crossbow") {
    return false;
  }
  const { aim, delay, launchVelocity, origin, profile } = opportunity;
  const sector = crossbowFrame(flight, actor, state.elapsed + delay);
  if (!sector) {
    return false;
  }
  const world = flightWorldContext(flight);
  if (profile.weapon === "chargedLance") {
    const heading = direction(aim);
    const projection = projectedLength(heading);
    if (state.pendingLance || !projection) {
      return false;
    }
    const range = coverage.viewportWidth / projection;
    return crossbowAllowsAttack(world, sector, {
      fireBy: EARLY_LANCE_SECONDS,
      paths: [
        {
          from: origin,
          screenRadius: LANCE_HIT_RADIUS,
          travel: { x: heading.x * range, y: heading.y * range },
        },
      ],
    });
  }
  if (profile.weapon === "phaser") {
    const heading = direction(aim);
    const range = enemyBeamReach(coverage, { aim: heading, origin });
    return (
      range > 0 &&
      crossbowAllowsAttack(world, sector, {
        fireBy: BEAM_TIMING.phaser.fires,
        paths: [
          {
            from: origin,
            screenRadius: BEAM.halfWidth,
            travel: { x: heading.x * range, y: heading.y * range },
          },
        ],
      })
    );
  }
  const { projectile } = profile;
  if (projectile === "mine" || projectile === "beam" || enemyOnly(profile.weapon)) {
    return false;
  }
  const definition = weaponAt(profile.weapon, profile.level);
  const launchContext = {
    baseLifetime: content.tuning.flight.enemyProjectileLifetime,
    coverage,
    definition,
    inheritedVelocity: launchVelocity,
  };
  const paths = profile.angles.map((degrees) => {
    const launch = planEnemyProjectile(launchContext, {
      aim: fanHeading(aim, degrees),
      origin,
      speed: profile.projectileSpeed,
    });
    return {
      from: origin,
      screenRadius: Math.max(shotRadius({ projectile }), launch.blast ?? 0),
      travel: { x: launch.velocity.x * launch.life, y: launch.velocity.y * launch.life },
    };
  });
  return crossbowAllowsAttack(world, sector, {
    fireBy: Math.max(0, ...(profile.pelletDelays ?? [])),
    paths,
  });
}
