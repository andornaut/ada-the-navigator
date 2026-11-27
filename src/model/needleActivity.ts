import { ROUTE_POSITION } from "../data/galaxies.ts";
import { NEEDLE } from "../data/needle.ts";
import type { GameContent } from "../data/types.ts";
import { partsReach, toScreen, worldParts } from "./convex.ts";
import { dropRandom } from "./drops.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { questGuardPlacementContext, spawnChapterEnemy } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { inNeedleChannel, needleCourses } from "./needle.ts";
import { stationFormationClear } from "./stationPlacement.ts";
import type { FlightState, SpaceObject } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export const NEEDLE_ACTIVITY_TARGET = "needle:activity:course";
const PATROL_SHIPS = ["swarm", "fighter", "interceptor"] as const;
const patrolPrefix = (id: number) => `needle:activity:patrol:${id}:`;

/** Admit the patrol for each stretch as Ada approaches the generated neighbourhood. */
export function ensureNeedleActivityPatrols(content: GameContent, flight: FlightState): void {
  const layout = needleCourses(flight);
  if (flight.galaxy !== 4 || !flight.needle || !layout) {
    return;
  }
  const patrol = (flight.needle.activityPatrol ??= { id: flight.nextId++, tried: [] });
  if (patrol.tried.length === NEEDLE.activityPatrolGates.length) {
    return;
  }
  const { activity, eye, practice } = layout;
  const world = flightWorldContext(flight);
  const bodyOf = (object: SpaceObject) => {
    const body = enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], object.enemy!);
    if (body) {
      return body;
    }
    // A craft with no authored polygon uses a collision circle. Enclose it for admission.
    const r = object.radius;
    return [
      [
        toScreen({ x: -r, y: -r }),
        toScreen({ x: r, y: -r }),
        toScreen({ x: r, y: r }),
        toScreen({ x: -r, y: r }),
      ],
    ];
  };
  const placement = { ...questGuardPlacementContext(content, flight), bodyOf };
  for (const index of NEEDLE.activityPatrolGates) {
    const gate = activity.gates[index]!;
    if (
      patrol.tried.includes(index) ||
      worldDistance(world, flight.player, gate.point) > content.tuning.chunkSize
    ) {
      continue;
    }
    const next = dropRandom(flight.seed, `needle:activity:patrol:${index}`);
    const archetype = PATROL_SHIPS[Math.floor(next() * PATROL_SHIPS.length)]!;
    const side = next() < 0.5 ? -1 : 1;
    const id = patrolPrefix(patrol.id) + index;
    // Check beyond the drifting eyelid rows as well as the inner shoulder.
    for (const lateral of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
      const gap = (NEEDLE.gate.rim.outer + activity.width / 2) * lateral;
      const admitted = [side, -side].some((direction) => {
        const candidate = {
          x: gate.point.x - gate.tangent.y * gap * direction,
          y: gate.point.y + gate.tangent.x * gap * direction,
        };
        const point =
          world.worldSide === undefined ? candidate : wrapPoint(world.worldSide, candidate);
        return (
          spawnChapterEnemy(content, archetype, id, point, flight, {
            admit: (actor) => {
              const body = bodyOf(actor);
              const radius = Math.max(actor.radius, partsReach(worldParts(body)));
              return (
                [practice, eye, activity].every(
                  (course) =>
                    !inNeedleChannel(
                      { radius },
                      course,
                      worldPoint(world, course.path[0]!, actor),
                    ) &&
                    course.gates.every(
                      ({ point }) =>
                        worldDistance(world, point, actor) > NEEDLE.gate.rim.outer + radius,
                    ),
                ) && stationFormationClear(placement, [actor])
              );
            },
            home: point,
          }) !== null
        );
      });
      if (admitted) {
        break;
      }
    }
    patrol.tried.push(index);
  }
}

/** Drop and completion retire only this run's live patrols, without awarding a defeat. */
export function retireNeedleActivityPatrols(content: GameContent, flight: FlightState): void {
  const needle = flight.needle;
  const patrol = needle?.activityPatrol;
  if (!patrol) {
    return;
  }
  const prefix = patrolPrefix(patrol.id);
  const world = flightWorldContext(flight);
  for (const object of stationPopulationObjects(flight)) {
    if (object.id.startsWith(prefix) && object.kind === "enemy") {
      worldRecordObjectRemoval(world, content, object, flight);
    }
  }
  flight.objects = flight.objects.filter(
    (object) => !object.id.startsWith(prefix) || object.kind !== "enemy",
  );
  delete needle.activityPatrol;
}
