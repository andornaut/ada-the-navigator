import { ECONOMY } from "../../data/economy.ts";
import { CURRENTS } from "../../data/galaxyFeatures.ts";
import { LANDMARK_TUNING } from "../../data/jobs.ts";
import { CARTWHEEL_STORY_SHIPS } from "../../data/storyShips.ts";
import type { GameContent } from "../../data/types.ts";
import { worldInCurrent } from "../currents.ts";
import { flightWorldContext } from "../flightTopology.ts";
import { landmarkSites } from "../landmarks.ts";
import { readRequiredPlan } from "../requiredEncounterPlans.ts";
import { readRequiredRolePlan } from "../requiredRolePlans.ts";
import { direction } from "../shipPhysics.ts";
import { flightStationContext, worldStationsNear } from "../stations.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { worldDistance } from "../worldContacts.ts";

interface DestinationPlacementContext {
  readonly activateRequiredRoute: (content: GameContent, id: string, flight: FlightState) => void;
  readonly canonicalObject: (flight: FlightState, object: SpaceObject) => void;
  readonly clearDestinationLayout: (
    content: GameContent,
    flight: FlightState,
    object: SpaceObject,
  ) => void;
  readonly generate: (
    content: GameContent,
    point: Vec,
    cartwheelHubKnown: false,
    flight: FlightState,
  ) => void;
  readonly planningRequiredWorld: Pick<WeakSet<FlightState>, "has">;
  readonly relocateRouteGuards: (content: GameContent, flight: FlightState) => void;
  readonly requiredDestinationSpan: (
    content: GameContent,
    id: string,
    baseSpan: number,
    flight: FlightState,
  ) => number;
}

const length = (v: Vec) => Math.hypot(v.x, v.y);

export function ensureDestination(
  context: DestinationPlacementContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing) {
    return existing;
  }
  const rolePlan = readRequiredRolePlan(flight, id);
  if (rolePlan) {
    return rolePlan.site;
  }
  const pending = readRequiredPlan(flight, id);
  if (pending && !context.planningRequiredWorld.has(flight)) {
    context.activateRequiredRoute(content, id, flight);
    return (
      flight.objects.find((object) => object.kind === "destination" && object.id === id) ??
      pending.site
    );
  }
  const held = heldDestination(context, content, id, flight);
  if (held) {
    return held;
  }
  const heading = direction(
    length(flight.velocity)
      ? flight.velocity
      : length(flight.facing)
        ? flight.facing
        : { x: 0, y: -1 },
  );
  const baseSpan = content.tuning.chunkSize * 2;
  const span = context.requiredDestinationSpan(content, id, baseSpan, flight);
  const index = flight.objects.filter((o) => o.kind === "destination").length;
  const spacing = content.tuning.storySpacing;
  const offset = Math.ceil(index / 2) * (index % 2 ? 1 : -1) * spacing;
  const target = {
    x: flight.player.x + heading.x * span - heading.y * offset,
    y: flight.player.y + heading.y * span + heading.x * offset,
  };
  while (destinationCrowded(content, flight, target)) {
    target.x -= heading.y * spacing;
    target.y += heading.x * spacing;
  }
  // A nearby clear point keeps the destination in its original region.
  for (const point of destinationCandidates(target)) {
    if (destinationClear(content, flight, point)) {
      return ensureDestinationAt(context, content, id, point, flight);
    }
  }
  return ensureDestinationAt(context, content, id, target, flight);
}

/** Story sites and their formations share the same bounded, ordered placement search. */
export function* destinationCandidates(target: Vec): Iterable<Vec> {
  yield target;
  const step = CURRENTS.width[1] / 2;
  for (let ring = 1; ring <= 8; ring++) {
    for (let spoke = 0; spoke < 16; spoke++) {
      const angle = (spoke * Math.PI) / 8;
      yield {
        x: target.x + Math.cos(angle) * ring * step,
        y: target.y + Math.sin(angle) * ring * step,
      };
    }
  }
}

function destinationCrowded(content: GameContent, flight: FlightState, point: Vec): boolean {
  const world = flightWorldContext(flight);
  return (
    flight.objects.some(
      (object) =>
        object.kind === "destination" &&
        worldDistance(world, object, point) < content.tuning.storySpacing,
    ) ||
    worldStationsNear(
      flightStationContext(flight),
      ECONOMY,
      flight.galaxy,
      ECONOMY.station.destinationClearance,
      point,
    ).length > 0 ||
    landmarkSites(flight.galaxy).some(
      (site) => worldDistance(world, site, point) < LANDMARK_TUNING.placeClearance,
    )
  );
}

export function destinationClear(content: GameContent, flight: FlightState, point: Vec): boolean {
  return (
    !worldInCurrent(flightWorldContext(flight), flight.galaxy, CURRENTS.clearance, point) &&
    !destinationCrowded(content, flight, point)
  );
}

/** A seeded chapter site uses the same destination creation and protected-area clearance as exploration. */
export function ensureDestinationAt(
  context: DestinationPlacementContext,
  content: GameContent,
  id: string,
  point: Vec,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find(
    (object) => object.kind === "destination" && object.id === id,
  );
  if (existing) {
    return existing;
  }
  context.generate(content, point, false, flight);
  const object: SpaceObject = { ...point, hp: 1, id, kind: "destination", radius: 30, role: id };
  context.canonicalObject(flight, object);
  flight.objects.push(object);
  // A destination's exclusion zone holds no layout object or drift path from earlier chunks.
  context.clearDestinationLayout(content, flight, object);
  context.relocateRouteGuards(content, flight);
  return object;
}

/**
 * Cartwheel's miner and visitors destinations stand at their holding points beside the hub
 * (gameplay/rules.md), placing the hub first; null for any other destination.
 */
function heldDestination(
  context: DestinationPlacementContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject | null {
  const offset =
    flight.galaxy === CARTWHEEL_STORY_SHIPS.galaxy &&
    Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id)
      ? CARTWHEEL_STORY_SHIPS.destinations[id as keyof typeof CARTWHEEL_STORY_SHIPS.destinations]
      : undefined;
  if (!offset) {
    return null;
  }
  const hub = ensureDestination(context, content, CARTWHEEL_STORY_SHIPS.station, flight);
  const target = { x: hub.x + offset.x, y: hub.y + offset.y };
  context.generate(content, target, false, flight);
  const object: SpaceObject = { ...target, hp: 1, id, kind: "destination", radius: 30, role: id };
  context.canonicalObject(flight, object);
  flight.objects.push(object);
  context.clearDestinationLayout(content, flight, object);
  return object;
}

/** Whether a destination is held beside the hub, so it neither moves ahead nor has a guard. */
export function isHeld(id: string, flight: FlightState): boolean {
  return (
    flight.galaxy === CARTWHEEL_STORY_SHIPS.galaxy &&
    Object.hasOwn(CARTWHEEL_STORY_SHIPS.destinations, id)
  );
}

/** Reposition an undiscovered encounter only while its old location is outside the generated near field. */
export function placeDestinationAhead(
  context: DestinationPlacementContext,
  content: GameContent,
  id: string,
  flight: FlightState,
): SpaceObject {
  const existing = flight.objects.find((o) => o.id === id && o.kind === "destination");
  if (existing && isHeld(id, flight)) {
    return existing;
  }
  if (
    !existing ||
    worldDistance(flightWorldContext(flight), existing, flight.player) >
      content.tuning.chunkSize * 2.5
  ) {
    flight.objects = flight.objects.filter((o) => o !== existing);
    return ensureDestination(context, content, id, flight);
  }
  return existing;
}
