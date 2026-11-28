import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { StationGuardAnchor } from "./ai/index.ts";
import { partsReach, worldParts } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import { frigateEscortStation } from "./frigateEscorts.ts";
import { liveEnemy } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import type { LegacyGuardHomePorts } from "./legacyGuardHomes.ts";
import { stationFormationClear, type StationPlacementContext } from "./stations/formation/index.ts";
import { stationGuardSite } from "./stations/index.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { flightWorldContext, worldDelta, worldDistance } from "./world/index.ts";

/** A read-only projection of surviving actors onto their existing formation stations. */
export function questGuardFormationAt(
  context: Pick<StationPlacementContext, "flight">,
  guard: SpaceObject,
  home: Vec,
): readonly SpaceObject[] {
  const leader = { ...guard, ...home };
  return [
    leader,
    ...stationPopulationObjects(context.flight)
      .filter((actor) => actor.enemy?.escortOf === guard.id && liveEnemy(actor))
      .map((actor) => ({
        ...actor,
        ...frigateEscortStation(ROUTE_POSITION[context.flight.galaxy], leader, actor.enemy!.phase),
      })),
  ];
}

export function questGuardFormationReach(
  context: StationPlacementContext,
  actors: readonly SpaceObject[],
): number {
  const world = flightWorldContext(context.flight);
  return Math.max(
    ...actors.map((actor) => {
      const body =
        actor.enemy && enemyPhysicalBody(ROUTE_POSITION[context.flight.galaxy], actor.enemy);
      return body
        ? worldDistance(world, actors[0]!, actor) + partsReach(worldParts(body))
        : Infinity;
    }),
  );
}

/** Geometry ports never move, activate or recreate actors and never inspect Ada's position. */
export function questGuardHomePorts(context: StationPlacementContext): LegacyGuardHomePorts {
  const world = flightWorldContext(context.flight);
  const validHome: LegacyGuardHomePorts["validHome"] = (_world, site, guard, home) => {
    if (
      guard.routeId !== site.id ||
      guard.enemy?.archetype !== "frigate" ||
      !Number.isFinite(home.x) ||
      !Number.isFinite(home.y)
    ) {
      return false;
    }
    const authority = stationGuardSite(context, guard);
    if (authority.status !== "present" || worldDistance(world, authority.center, site) !== 0) {
      return false;
    }
    const protection = exclusionZoneRadius(context.content, site);
    if (protection === null || site.hp <= 0) {
      return false;
    }
    const actors = questGuardFormationAt(context, guard, home);
    const minimum = protection + questGuardFormationReach(context, actors);
    const distance = worldDistance(world, site, home);
    return (
      distance >= minimum &&
      distance <= minimum + ENEMY_AVOIDANCE.clearance &&
      stationFormationClear(
        { ...context, checkPlayer: false, ignoreIds: new Set(actors.map((actor) => actor.id)) },
        actors,
      )
    );
  };
  return {
    recoveryHome(_world, site, guard) {
      if (guard.routeId !== site.id || !guard.enemy) {
        return null;
      }
      const protection = exclusionZoneRadius(context.content, site);
      if (protection === null) {
        return null;
      }
      const radius =
        protection +
        questGuardFormationReach(context, questGuardFormationAt(context, guard, site)) +
        ENEMY_AVOIDANCE.clearance / 2;
      const directions = [
        worldDelta(world, site, guard.enemy.home),
        worldDelta(world, site, guard),
        guard.enemy.facing,
        ...Array.from({ length: ENEMY_AVOIDANCE.directions }, (_, index) => {
          const angle = (index * Math.PI * 2) / ENEMY_AVOIDANCE.directions;
          return { x: Math.cos(angle), y: Math.sin(angle) };
        }),
      ];
      for (const direction of directions) {
        const length = Math.hypot(direction.x, direction.y);
        if (!length) {
          continue;
        }
        const home = {
          x: site.x + (direction.x / length) * radius,
          y: site.y + (direction.y / length) * radius,
        };
        if (validHome(world, site, guard, home)) {
          return home;
        }
      }
      return null;
    },
    resolveSite(flight, id) {
      const authority = stationGuardSite({ content: context.content, flight }, { routeId: id });
      if (authority.status === "removed") {
        return null;
      }
      if (authority.status !== "present") {
        return undefined;
      }
      return stationPopulationObjects({ ...context.flight, ...flight }).find(
        (actor) => actor.id === id,
      );
    },
    validHome,
  };
}

/** Site protection and the actual moving hull occur once; patrol supplies avoidance clearance. */
export function questGuardAnchor(
  context: StationPlacementContext,
  guard: SpaceObject,
): StationGuardAnchor | null {
  const site = stationGuardSite(context, guard);
  if (site.status !== "present" || !guard.enemy) {
    return null;
  }
  const body = enemyPhysicalBody(ROUTE_POSITION[context.flight.galaxy], guard.enemy);
  return body
    ? { center: site.center, clearanceRadius: site.clearanceRadius + partsReach(worldParts(body)) }
    : null;
}
