import { CURRENTS } from "../../data/galaxyFeatures.ts";
import type { GameContent } from "../../data/types.ts";
import {
  placementRadius,
  type Silhouette,
  silhouetteWorldReach,
  worldSceneryBodyContact,
} from "../asteroids.ts";
import { pointOnCurrent, worldCurrentInCell, worldCurrentsNear } from "../currents.ts";
import { stepDebris } from "../enemyAi.ts";
import { exclusionZoneRadius } from "../exclusionZones.ts";
import { ACTIVE_CHUNK_RADIUS } from "../geography.ts";
import { MOVING_ROCK_PREFIX, ricochetRocks } from "../rockRicochet.ts";
import { SHIP_REACH, shipBody, shipNearSegment } from "../shipBody.ts";
import type { FlightEvent, FlightState, SpaceObject, Vec } from "../types.ts";
import {
  canonicalPosition,
  flightWorldContext,
  periodicWorldGrid,
  segmentDistance,
  type WorldContext,
  worldPoint,
} from "../world/index.ts";

interface DebrisMotion {
  readonly arrivalPoints: (flight: FlightState) => readonly Vec[];
  readonly bumpAda: (
    content: GameContent,
    flight: FlightState,
    events: FlightEvent[],
    object: SpaceObject,
  ) => void;
  readonly drawnOf: (flight: FlightState, object: SpaceObject) => Silhouette | null;
  readonly frameOf: (flight: FlightState, object: SpaceObject) => number;
}

interface DebrisRiverGeneration {
  readonly canonicalObject: (flight: FlightState, object: SpaceObject) => void;
  readonly hash: (seed: number, x: number, y: number) => number;
  readonly random: (seed: number) => () => number;
}

/**
 * A debris river's rocks for each current within the active region that carries one: evenly
 * spaced along the current, each at a seeded offset across it.
 */
export function ensureDebrisRivers(
  { canonicalObject, hash, random }: DebrisRiverGeneration,
  content: GameContent,
  point: Vec,
  flight: FlightState,
): void {
  if (!CURRENTS.galaxies.includes(flight.galaxy)) {
    return;
  }
  const grid = periodicWorldGrid(flightWorldContext(flight), content.tuning.chunkSize);
  const reach = (ACTIVE_CHUNK_RADIUS + 1) * grid.pitch;
  const ids = new Set(flight.objects.map((object) => object.id));
  for (const current of worldCurrentsNear(
    flightWorldContext(flight),
    flight.galaxy,
    reach,
    point,
  )) {
    if (!current.debris) {
      continue;
    }
    const count = Math.max(1, Math.round((current.length / 1000) * CURRENTS.debrisPerThousand));
    const next = random(hash(flight.seed ^ 0x51e7, current.points[0]!.x, current.points[0]!.y));
    for (let index = 0; index < count; index++) {
      const id = `river:${current.id}:${index}`;
      if (ids.has(id) || Object.hasOwn(flight.world.notables, id)) {
        continue;
      }
      const river = {
        arc: ((index + next() * 0.6) / count) * current.length,
        current: current.id,
      };
      const object: SpaceObject = {
        hp: content.tuning.flight.rockHp,
        id,
        kind: "debris",
        radius: content.tuning.flight.rockRadius,
        river,
        x: 0,
        y: 0,
      };
      placeRiverRock(flight, object);
      canonicalObject(flight, object);
      flight.objects.push(object);
      ids.add(id);
    }
  }
}

/**
 * A debris river rock's place: it follows its current's centre line at the peak flow speed,
 * entering at one end and leaving at the other, then re-entering at the start.
 */
function placeRiverRock(flight: FlightState, object: SpaceObject): void {
  const river = object.river!;
  const match = /^current:(-?\d+),(-?\d+)$/.exec(river.current);
  const current = match
    ? worldCurrentInCell(flightWorldContext(flight), flight.galaxy, {
        x: Number(match[1]),
        y: Number(match[2]),
      })
    : null;
  if (!current) {
    object.hp = 0;
    return;
  }
  const arc =
    (((river.arc + CURRENTS.peakFlow * flight.time) % current.length) + current.length) %
    current.length;
  const { point, tangent } = pointOnCurrent(current, arc);
  // Adding 0 turns -0 into 0, so a saved and restored rock compares equal.
  object.x = point.x + 0;
  object.y = point.y + 0;
  object.velocity = {
    x: tangent.x * CURRENTS.peakFlow + 0,
    y: tangent.y * CURRENTS.peakFlow + 0,
  };
}

/**
 * Whether traveling debris moving from `from` to `to` meets Ada's drawn ship: its drawn piece
 * outline against hers, sampled every 2 units along the move; its circle without debris art.
 */
function debrisTouchesAda(
  scenery: Pick<DebrisMotion, "drawnOf" | "frameOf">,
  world: WorldContext,
  flight: FlightState,
  from: Vec,
  to: Vec,
  object: SpaceObject,
): boolean {
  const end = worldPoint(world, from, to);
  const player = worldPoint(world, from, flight.player);
  const drawn = scenery.drawnOf(flight, object);
  if (!drawn) {
    return shipNearSegment(flight.facing, player, from, end, object.radius);
  }
  if (segmentDistance(player, from, end) > silhouetteWorldReach(drawn) + SHIP_REACH) {
    return false;
  }
  const frame = scenery.frameOf(flight, object);
  const body = shipBody(flight.facing);
  const steps = Math.max(1, Math.ceil(Math.hypot(from.x - end.x, from.y - end.y) / 2));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const at = { ...object, x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t };
    if (worldSceneryBodyContact(world, at, flight.player, body, frame, 0, drawn)) {
      return true;
    }
  }
  return false;
}

/**
 * Ballistic debris keeps constant velocity, struck static rocks settle and other asteroids hold
 * their centres; then moving rocks ricochet off the asteroids they touch.
 */
export function moveDebris(
  motion: DebrisMotion,
  content: GameContent,
  dt: number,
  events: FlightEvent[],
  flight: FlightState,
): void {
  const world = flightWorldContext(flight);
  let exclusionZones: { area: Vec; radius: number }[] | undefined;
  let arrivalDisks: typeof exclusionZones;
  for (const object of flight.objects) {
    if (object.river) {
      // River debris follows its current and bumps Ada on contact like other traveling debris.
      const from = { x: object.x, y: object.y };
      placeRiverRock(flight, object);
      if (debrisTouchesAda(motion, world, flight, from, object, object)) {
        motion.bumpAda(content, flight, events, object);
      }
      continue;
    }
    if (object.orbit && object.kind === "rock") {
      // Legacy circular paths settle at their current centre without changing HP or drops.
      delete object.orbit;
      delete object.velocity;
      continue;
    }
    const settling = object.kind === "rock" && object.settle !== undefined;
    if (!object.velocity || (object.kind !== "debris" && !settling)) {
      continue;
    }
    const next = settling
      ? settleRock(dt, object)
      : stepDebris(dt, { id: object.id, position: object, velocity: object.velocity });
    // Existing protected objects absorb all moving debris; moving rocks, struck static rocks
    // among them, also end at arrival disks.
    if (!exclusionZones) {
      exclusionZones = [];
      for (const area of flight.objects) {
        const radius = exclusionZoneRadius(content, area);
        if (radius !== null) {
          exclusionZones.push({ area, radius });
        }
      }
    }
    const reach = placementRadius(object);
    const crosses = ({ area, radius }: { area: Vec; radius: number }): boolean =>
      segmentDistance(worldPoint(world, object, area), object, next.position) < radius + reach;
    if (
      exclusionZones.some(crosses) ||
      ((settling || object.id.startsWith(MOVING_ROCK_PREFIX)) &&
        (arrivalDisks ??= motion.arrivalPoints(flight).map((area) => ({
          area,
          radius: content.tuning.exclusionRadius,
        }))).some(crosses))
    ) {
      object.hp = 0;
      continue;
    }
    // A bump, though the debris may pass through her between frames (rules.md: 1 a bump).
    if (debrisTouchesAda(motion, world, flight, object, next.position, object)) {
      motion.bumpAda(content, flight, events, object);
    }
    object.x = next.position.x;
    object.y = next.position.y;
    canonicalPosition(flight, object);
  }
  ricochetRocks(
    { chunkSize: content.tuning.chunkSize, frameOf: (rock) => motion.frameOf(flight, rock), world },
    content.tuning.flight.rockRicochet,
    flight.objects,
  );
}

/**
 * A struck static rock's move over `dt`: its speed falls evenly to rest at the end of its
 * settle time, where it stays as a static rock again.
 */
function settleRock(dt: number, object: SpaceObject): { position: Vec } {
  const velocity = object.velocity!;
  const left = object.settle!;
  const step = Math.min(dt, left);
  const after = (left - step) / left;
  // The mean of the speeds at the start and the end of the step, which fall linearly.
  const mean = (1 + after) / 2;
  const position = {
    x: object.x + velocity.x * mean * step,
    y: object.y + velocity.y * mean * step,
  };
  if (left - step <= 1e-9) {
    delete object.velocity;
    delete object.settle;
  } else {
    object.velocity = { x: velocity.x * after, y: velocity.y * after };
    object.settle = left - step;
  }
  return { position };
}
