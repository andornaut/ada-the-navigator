import { COURIER } from "../../data/activities.ts";
import { ANDROMEDA_PLACES } from "../../data/andromeda.ts";
import { ECONOMY } from "../../data/economy.ts";
import { HUNTING_PACKS } from "../../data/galaxyFeatures.ts";
import type { GameContent } from "../../data/types.ts";
import { type ActivityTerms, stepCourier } from "../activities.ts";
import { ensureDestinationAt, placeHuntingPack } from "../flight/index.ts";
import { packMemberId, worldDiscardNotable, worldPrunePackState } from "../geography.ts";
import {
  flightStationContext,
  retainedSettlementsNear,
  worldStationsNear,
} from "../stations/index.ts";
import type { FlightState, HeldActivity, Vec } from "../types.ts";
import {
  flightWorldContext,
  type WorldContext,
  worldDelta,
  worldDistance,
  wrapPoint,
} from "../world/index.ts";

const PATROL = "courier:patrol";
const PATROL_SIZE = HUNTING_PACKS.count[0];

function midpoint(world: WorldContext, start: Vec, target: Vec): Vec {
  const offset = worldDelta(world, start, target);
  const point = { x: start.x + offset.x / 2, y: start.y + offset.y / 2 };
  return world.worldSide === undefined ? point : wrapPoint(world.worldSide, point);
}

/** Both approaches use the same bounded, deterministic route and patrol. */
export function courierTerms(
  content: GameContent,
  flight: FlightState,
  start: Vec,
  reward: number,
): ActivityTerms | null {
  const world = flightWorldContext(flight);
  const [min, max] = COURIER.distance;
  const clearance = content.tuning.exclusionRadius + HUNTING_PACKS.spread;
  const settlements = retainedSettlementsNear(world, ECONOMY, max, start);
  const destinations = [...flight.objects, ...Object.values(flight.world.notables)].filter(
    (object) => object?.kind === "destination",
  );
  const distance = (target: Vec) => worldDistance(world, start, target);
  const candidates = settlements
    .filter((target) => distance(target) >= min)
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  const target = candidates.find((site) => {
    const patrol = midpoint(world, start, site);
    return (
      !worldStationsNear(flightStationContext(flight), ECONOMY, 5, clearance, patrol).length &&
      !settlements.some((place) => worldDistance(world, place, patrol) <= clearance) &&
      !destinations.some((object) => object && worldDistance(world, object, patrol) <= clearance)
    );
  });
  return target ? { reward, start: { x: start.x, y: start.y }, target } : null;
}

/** Find an optional stop for Pip when his story position has no suitable outpost. */
export function courierRendezvous(
  content: GameContent,
  flight: FlightState,
  pip: Vec,
  reward: number,
): Vec {
  if (courierTerms(content, flight, pip, reward)) {
    return pip;
  }
  const world = flightWorldContext(flight);
  const [min, max] = COURIER.distance;
  const preferredDistance = (min + max) / 2;
  const distance = (site: Vec) => worldDistance(world, pip, site);
  const outposts = retainedSettlementsNear(world, ECONOMY, max * 2, pip)
    .filter((site) => distance(site) > max)
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  const stationContext = flightStationContext(flight);
  const clearance = content.tuning.exclusionRadius;
  for (const site of outposts) {
    const offset = worldDelta(world, pip, site);
    const fraction = 1 - preferredDistance / distance(site);
    const raw = { x: pip.x + offset.x * fraction, y: pip.y + offset.y * fraction };
    const point = world.worldSide === undefined ? raw : wrapPoint(world.worldSide, raw);
    if (
      !worldStationsNear(stationContext, ECONOMY, 5, clearance, point).length &&
      !retainedSettlementsNear(world, ECONOMY, clearance, point).length &&
      !flight.objects.some(
        (object) =>
          object.kind === "destination" && worldDistance(world, object, point) <= clearance,
      ) &&
      courierTerms(content, flight, point, reward)
    ) {
      return point;
    }
  }
  return pip;
}

/** The route marker follows the scouting phase and never reveals a drone's live position. */
export function courierScoutTarget(world: WorldContext, held: HeldActivity) {
  if (!held.courier?.scout || !held.start || !held.target) {
    return null;
  }
  return held.courier.scout === "return"
    ? { ...held.start, id: "courier:return", label: "pip" }
    : { ...midpoint(world, held.start, held.target), id: PATROL, label: "courierPatrolArea" };
}

/** Moves the existing Pip actor, including across paging or a resumed flight. */
export function positionCourier(content: GameContent, flight: FlightState, position: Vec): void {
  const id = ANDROMEDA_PLACES.pip;
  const pip = flight.objects.find((object) => object.id === id);
  if (pip) {
    Object.assign(pip, position);
    return;
  }
  const retained = flight.world.notables[id];
  if (retained && (retained.x !== position.x || retained.y !== position.y)) {
    worldDiscardNotable(flightWorldContext(flight), content, id, flight);
    flight.objects.push({ ...retained, ...position });
  }
}

export function clearCourierPatrol(content: GameContent, flight: FlightState): void {
  const world = flightWorldContext(flight);
  flight.objects = flight.objects.filter(({ enemy }) => enemy?.packId !== PATROL);
  for (let index = 0; index < PATROL_SIZE; index++) {
    worldDiscardNotable(world, content, packMemberId(PATROL, index), flight);
  }
  worldPrunePackState(world, flight);
}

/** Advance the optional escort after physics, using the actual simulated flight time. */
export function stepCourierRun(
  content: GameContent,
  flight: FlightState,
  held: HeldActivity,
  dt: number,
): { complete?: true; spotted?: true } {
  const { courier, start, target } = held;
  if (!courier || !start || !target || dt <= 0) {
    return {};
  }
  const world = flightWorldContext(flight);
  const patrol = midpoint(world, start, target);
  if (!courier.patrolSpawned) {
    placeHuntingPack(content, PATROL, patrol, PATROL_SIZE, flight);
    if (world.worldSide !== undefined) {
      for (const object of flight.objects) {
        if (object.enemy?.packId === PATROL) {
          Object.assign(object, wrapPoint(world.worldSide, object));
          object.enemy.home = wrapPoint(world.worldSide, object.enemy.home);
        }
      }
    }
    courier.patrolSpawned = true;
  }
  if (courier.scout) {
    const nearPip = worldDistance(world, flight.player, start) <= COURIER.follow;
    if (
      courier.scout !== "return" &&
      worldDistance(world, flight.player, patrol) <= COURIER.follow
    ) {
      courier.scout = "return";
      return { spotted: true };
    }
    if (courier.scout === "depart" && !nearPip) {
      courier.scout = "patrol";
    } else if (courier.scout !== "depart" && nearPip) {
      delete courier.scout;
    }
    if (courier.scout) {
      return {};
    }
  }
  // The assigned outpost uses the same seeded identity even when the route crosses a seam.
  if (
    !flight.world.notables[target.id] &&
    worldDistance(world, flight.player, target) <= content.tuning.chunkSize * 2
  ) {
    const outpost = ensureDestinationAt(content, target.id, target, flight);
    outpost.role = ANDROMEDA_PLACES.settlement;
  }
  const complete = stepCourier(
    { ...world, baseSpeed: content.tuning.physics.maxSpeed, dt, player: flight.player },
    held,
  );
  positionCourier(content, flight, courier.position);
  return complete ? { complete: true } : {};
}
