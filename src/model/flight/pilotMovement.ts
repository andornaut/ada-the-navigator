import { ECONOMY } from "../../data/economy.ts";
import type { GameContent } from "../../data/types.ts";
import { reflectDirection } from "../asteroids.ts";
import { worldFlowAt } from "../currents.ts";
import { needleRims } from "../needleFlight.ts";
import { stepShipMotion, turnToward } from "../shipPhysics.ts";
import type { FlightEvent, FlightInput, FlightState, SpaceObject, Vec } from "../types.ts";
import { shipTuning } from "../upgrades.ts";
import { markVisited, visitedChunk } from "../visited.ts";
import {
  canonicalPosition,
  flightWorldContext,
  periodicWorldGrid,
  worldCellAt,
  worldCellKey,
  worldDistance,
} from "../world/index.ts";
import { movementSpeedFraction, towing } from "./handling.ts";
import { resolveScenery, type SceneryContactOf } from "./sceneryResolution.ts";

const length = (v: Vec) => Math.hypot(v.x, v.y);
/**
 * Smoothed requested movement direction per flight. It is transient so saves gain
 * no field; a restored or newly pressed stick starts from the velocity heading.
 */
const movementHeadings = new WeakMap<FlightState, Vec>();

export function reflectPilotHeading(flight: FlightState, normal: Vec): void {
  const heading = movementHeadings.get(flight);
  if (heading) {
    movementHeadings.set(flight, reflectDirection(normal, heading));
  }
}
export function clearPilotHeading(flight: FlightState): void {
  movementHeadings.delete(flight);
}

export function flightChunkKey(content: GameContent, flight: FlightState, point: Vec): string {
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  return worldCellKey(grid, worldCellAt(grid, point));
}

/** An undo that returns position to where it is now. */
function returnTo(position: Vec): () => void {
  const { x, y } = position;
  return () => {
    position.x = x;
    position.y = y;
  };
}

interface PilotScenery {
  readonly contactOf: (flight: FlightState) => SceneryContactOf;
  readonly onContact: (
    content: GameContent,
    events: FlightEvent[],
    flight: FlightState,
  ) => (normal: Vec, surface: Vec, object: SpaceObject) => void;
  readonly resolution: Parameters<typeof resolveScenery>[0];
}

export type FreshTravel = (distance: number, seconds: number, point: Vec) => void;

export function movePilot(
  scenery: PilotScenery,
  content: GameContent,
  dt: number,
  input: FlightInput,
  events: FlightEvent[],
  flight: FlightState,
  freshTravel?: FreshTravel,
): Vec {
  const magnitude = Math.min(1, length(input.move));
  const physics = towing(flight, shipTuning(ECONOMY, content, flight.levels).physics);
  const top = physics.maxSpeed;
  const speedFraction =
    input.throttle === undefined
      ? movementSpeedFraction(content.tuning, magnitude)
      : Math.min(1, Math.max(0, input.throttle));
  const motion = stepShipMotion(
    physics,
    dt,
    { maxSpeed: top },
    {
      direction: input.move,
      speed: speedFraction * top,
    },
    { heading: movementHeadings.get(flight) ?? null, velocity: flight.velocity },
  );
  if (motion.heading) {
    movementHeadings.set(flight, motion.heading);
  } else {
    movementHeadings.delete(flight);
  }
  flight.velocity = motion.velocity;
  const start = { ...flight.player };
  const contactOf = scenery.contactOf(flight);
  const onContact = scenery.onContact(content, events, flight);
  // Drifting scenery can reach a resting ship, so contacts resolve before any travel.
  resolveScenery(
    scenery.resolution,
    flight,
    contactOf,
    onContact,
    flight.player,
    undefined,
    needleRims(flight),
  );
  // A current's flow adds drift outside Ada's physics and speed cap.
  const drift = worldFlowAt(flightWorldContext(flight), flight.galaxy, flight.player);
  const travel = { x: flight.velocity.x + drift.x, y: flight.velocity.y + drift.y };
  const steps = Math.max(1, Math.ceil((length(travel) * dt) / 4));
  for (let i = 0; i < steps; i++) {
    const before = { ...flight.player };
    const key = flightChunkKey(content, flight, before);
    flight.player.x += (travel.x * dt) / steps;
    flight.player.y += (travel.y * dt) / steps;
    resolveScenery(
      scenery.resolution,
      flight,
      contactOf,
      onContact,
      flight.player,
      () => {
        flight.player.x = before.x;
        flight.player.y = before.y;
      },
      needleRims(flight),
    );
    canonicalPosition(flight, flight.player);
    const afterKey = flightChunkKey(content, flight, flight.player);
    if (flight.freshChunk === key) {
      const distance = worldDistance(flightWorldContext(flight), before, flight.player);
      const previous = flight.freshDistance;
      flight.freshDistance += distance;
      if (freshTravel && magnitude > 0 && speedFraction > 0 && flight.freshDistance > previous) {
        freshTravel(flight.freshDistance - previous, dt / steps, flight.player);
      }
    }
    if (afterKey !== key) {
      flight.freshChunk = visitedChunk(flight.visited, afterKey) ? null : afterKey;
      markVisited(flight.visited, afterKey);
    }
  }
  if (
    input.turn === undefined &&
    length(input.aim) <= 0.01 &&
    worldDistance(flightWorldContext(flight), start, flight.player) > 0.001 &&
    length(flight.velocity)
  ) {
    const turnedFrom = flight.facing;
    const settled = returnTo(flight.player);
    flight.facing = turnToward(dt, physics.aimTurnSeconds, flight.velocity, flight.facing);
    // A new heading draws a new outline, which may reach scenery; one wedged in it keeps the old.
    resolveScenery(
      scenery.resolution,
      flight,
      contactOf,
      onContact,
      flight.player,
      () => {
        settled();
        flight.facing = turnedFrom;
      },
      needleRims(flight),
    );
  }
  return start;
}
