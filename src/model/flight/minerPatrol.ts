import { ENEMY_AVOIDANCE, ENEMY_KEEP_MOVING } from "../../data/enemyNavigation.ts";
import type { GameContent } from "../../data/types.ts";
import { type EnemyContext, minerNeedsPick, outlineEdge, type TracedEdge } from "../ai/index.ts";
import { placementRadius } from "../asteroids.ts";
import { worldParts } from "../convex.ts";
import { exclusionZoneRadius } from "../exclusionZones.ts";
import { needleChannelContains } from "../needle/contact.ts";
import type { retaliatorAsteroidQuery } from "../retaliatorAsteroids.ts";
import { INDUSTRIAL_HOME_RADIUS } from "../retaliatorNavigation.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";
import { flightWorldContext, worldDelta, worldDistance, worldPoint } from "../world/index.ts";
import { sceneryBlocksFlightSegment, type SceneryResolution } from "./sceneryResolution.ts";

/** Whether a ship is at rest: no orbit and no velocity. */
const atRest = (object: SpaceObject): boolean =>
  !object.orbit && !(object.velocity && (object.velocity.x || object.velocity.y));

/** The loop samples a miner checks for exclusion zones and the Needle channel. */
const MINER_LOOP_SAMPLES = 16;

/**
 * A Mining Freighter's runtime facts (gameplay/ships.md "Miners"): its traced rock's edge while
 * that rock is live and at rest, and, when it picks, the rocks that qualify. A rock qualifies when
 * it is live and at rest, its traced loop `offset` beyond its reach lies within the industrial
 * leash of home and clear of exclusion zones and the Needle channel, and the straight
 * course to the loop clears other scenery at the passage berth.
 */
export function minerInput(
  sceneryResolution: SceneryResolution,
  content: GameContent,
  flight: FlightState,
  asteroids: () => ReturnType<typeof retaliatorAsteroidQuery>,
  offset: number,
  object: SpaceObject,
): NonNullable<EnemyContext["miner"]> {
  const state = object.enemy!;
  const world = flightWorldContext(flight);
  const traced = state.miner?.rock
    ? flight.objects.find(
        (other) =>
          other.id === state.miner!.rock && other.kind === "rock" && other.hp > 0 && atRest(other),
      )
    : undefined;
  let edge: TracedEdge | undefined;
  if (traced) {
    const centre = worldPoint(world, object, traced);
    const drawn = sceneryResolution.drawnOf(flight, traced);
    const frames = drawn?.frames.length ?? 0;
    const outline =
      drawn?.frames[((sceneryResolution.frameOf(flight, traced) % frames) + frames) % frames];
    if (outline) {
      edge = outlineEdge(worldParts(outline), centre, object);
    } else {
      const away = worldDelta(world, centre, object);
      const distance = Math.hypot(away.x, away.y);
      edge = {
        around: distance,
        distance: Math.max(0, distance - placementRadius(traced)),
        normal: distance ? { x: away.x / distance, y: away.y / distance } : { x: 0, y: -1 },
      };
    }
  }
  if (!minerNeedsPick(ENEMY_KEEP_MOVING, edge !== undefined, state)) {
    return edge ? { edge } : {};
  }
  let zones: { other: SpaceObject; radius: number }[] | undefined;
  let nextObject = 0;
  const blocked = (point: Vec): boolean => {
    if (
      needleChannelContains({ radius: object.radius }, flight, point) ||
      zones?.some(
        ({ other, radius }) => worldDistance(world, point, other) <= radius + object.radius,
      )
    ) {
      return true;
    }
    // Reuse the zones already seen, then resume at the first object not yet needed.
    while (nextObject < flight.objects.length) {
      const other = flight.objects[nextObject++]!;
      const radius = exclusionZoneRadius(content, other);
      if (radius !== null) {
        (zones ??= []).push({ other, radius });
        if (worldDistance(world, point, other) <= radius + object.radius) {
          return true;
        }
      }
    }
    return false;
  };
  const candidates = asteroids()(INDUSTRIAL_HOME_RADIUS, state.home).filter((rock) => {
    const actual = flight.objects.find((other) => other.id === rock.id);
    const loop = rock.physicalReach + offset;
    if (
      !actual ||
      !atRest(actual) ||
      worldDistance(world, state.home, rock.position) + loop > INDUSTRIAL_HOME_RADIUS
    ) {
      return false;
    }
    const centre = worldPoint(world, object, rock.position);
    for (let index = 0; index < MINER_LOOP_SAMPLES; index++) {
      const angle = (index / MINER_LOOP_SAMPLES) * Math.PI * 2;
      if (blocked({ x: centre.x + Math.cos(angle) * loop, y: centre.y + Math.sin(angle) * loop })) {
        return false;
      }
    }
    const away = worldDelta(world, centre, object);
    const distance = Math.hypot(away.x, away.y) || 1;
    const entry = {
      x: centre.x + (away.x / distance) * loop,
      y: centre.y + (away.y / distance) * loop,
    };
    return !sceneryBlocksFlightSegment(sceneryResolution, world, flight, {
      clearance: ENEMY_AVOIDANCE.passageClearance + object.radius,
      excludedId: rock.id,
      from: object,
      to: entry,
    });
  });
  return {
    candidates: candidates.map((rock) => ({ id: rock.id, position: rock.position })),
    ...(edge ? { edge } : {}),
  };
}
