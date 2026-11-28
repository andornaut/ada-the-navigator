import { enemyActorAvailable, type EnemyActorKind } from "../../data/enemyActors.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { HOSTILE_STATION_POLICY } from "../../data/hostileStationPolicy.ts";
import { SPAWNER_POLICIES } from "../../data/spawnerCatalog.ts";
import type { GameContent } from "../../data/types.ts";
import { partsReach, worldParts } from "../convex.ts";
import { enemyPhysicalBody } from "../enemyBody.ts";
import { escortPackId, liveEnemy } from "../geography.ts";
import {
  type SpawnerContext,
  worldFitsHostileStation,
  worldSpawnerStage,
} from "../spawn/encounters/index.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldDistance } from "../world/index.ts";
import { hostileStationPack, stationPopulationObjects } from "./population.ts";

export interface PlannedActor {
  readonly id: string;
  readonly point: Vec;
}

/** A caller-supplied site and explicit swarm plan, with no distribution or reward defaults. */
export interface PlannedHostileStation extends PlannedActor {
  readonly defenders: readonly PlannedActor[];
}

export interface StationMaterializationContext {
  readonly content: GameContent;
  readonly flight: FlightState;
  readonly population?: readonly SpaceObject[];
  readonly create: (kind: EnemyActorKind, actor: PlannedActor, packId: string) => SpaceObject;
  readonly canPlace: (actors: readonly SpaceObject[]) => boolean;
}

export type StationMaterialization =
  | {
      readonly status: "created" | "existing";
      readonly station: SpaceObject;
      readonly defenders: readonly SpaceObject[];
    }
  | { readonly status: "removed" | "unresolved" | "rejected" };

/** Both spawning and engagement consume the same authoritative hostile station identities. */
export function hostileStationContext(flight: FlightState): SpawnerContext {
  return {
    ...flightWorldContext(flight),
    hostileStationIds: new Set(
      stationPopulationObjects(flight)
        .filter((object) => object.enemy?.archetype === "hostileStation" && liveEnemy(object))
        .map(({ id }) => id),
    ),
  };
}

function validActor(actor: PlannedActor): boolean {
  return actor.id.length > 0 && Number.isFinite(actor.point.x) && Number.isFinite(actor.point.y);
}

/** Materializes once, after population and complete geometry admission, without reward effects. */
export function materializeHostileStation(
  context: StationMaterializationContext,
  plan: PlannedHostileStation,
): StationMaterialization {
  const { flight } = context;
  if (!enemyActorAvailable(flight.galaxy, "hostileStation") || !validActor(plan)) {
    return { status: "rejected" };
  }
  const packId = hostileStationPack(plan.id);
  const defenderPack = escortPackId(packId);
  const represented = context.population ?? stationPopulationObjects(flight);
  if (Object.hasOwn(flight.world.notables, plan.id) && flight.world.notables[plan.id] === null) {
    return { status: "removed" };
  }
  const station = represented.find(({ id }) => id === plan.id);
  if (station) {
    return station.enemy?.archetype === "hostileStation" && station.hp > 0
      ? {
          defenders: represented.filter((actor) => actor.enemy?.packId === defenderPack),
          station,
          status: "existing",
        }
      : { status: "rejected" };
  }
  if (Object.hasOwn(flight.world.notables, plan.id)) {
    return { status: "removed" };
  }
  if (Object.hasOwn(flight.combat?.initialPackSizes ?? {}, packId)) {
    return { status: "unresolved" };
  }
  const ids = [plan.id, ...plan.defenders.map(({ id }) => id)];
  const policy = SPAWNER_POLICIES[flight.galaxy];
  const world = flightWorldContext(flight);
  const stage = worldSpawnerStage(world, policy, plan.point);
  const swarm = stage.roster.find(({ archetype }) => archetype === "swarm");
  if (
    new Set(ids).size !== ids.length ||
    plan.defenders.length !== HOSTILE_STATION_POLICY.defenders ||
    !swarm ||
    plan.defenders.length > swarm.groupSize[1] ||
    plan.defenders.some(
      (actor) =>
        !validActor(actor) ||
        represented.some(({ id }) => id === actor.id) ||
        Object.hasOwn(flight.world.notables, actor.id),
    )
  ) {
    return { status: "rejected" };
  }
  const body = context.create("hostileStation", plan, packId);
  const defenders = plan.defenders.map((actor) => context.create("swarm", actor, defenderPack));
  const actors = [body, ...defenders];
  actors.forEach((actor) => {
    actor.persistent = true;
  });
  const reach = Math.max(
    ...actors.map((actor) => {
      const hull = actor.enemy && enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], actor.enemy);
      return (
        worldDistance(world, plan.point, actor) +
        (hull ? partsReach(worldParts(hull)) : actor.radius)
      );
    }),
  );
  const population = hostileStationContext({ ...flight, objects: [...represented] });
  const stationIds = new Set(population.hostileStationIds);
  stationIds.add(plan.id);
  if (
    !worldFitsHostileStation(
      { ...population, hostileStationIds: stationIds },
      policy,
      stage,
      represented,
      plan.point,
      { defenders: defenders.length, id: plan.id, reach },
    ) ||
    !context.canPlace(actors)
  ) {
    return { status: "rejected" };
  }
  flight.objects.push(...actors);
  const combat = (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
  combat.initialPackSizes[packId] = 1;
  combat.initialPackSizes[defenderPack] = defenders.length;
  return { defenders, station: body, status: "created" };
}
