import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GameContent } from "../data/types.ts";
import { type Silhouette, worldSceneryBodyContact } from "./asteroids.ts";
import { outlineContact, outlinesContact, type Parts, partsReach, worldParts } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { protectedRadius } from "./protectedPlaces.ts";
import { shipBody } from "./shipBody.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";

export interface StationPlacementContext {
  readonly checkPlayer?: boolean;
  readonly bodyOf?: (object: SpaceObject) => Parts | null;
  readonly overlapOf?: (obstacle: Parts, origin: Vec, body: Parts, position: Vec) => boolean;
  readonly ignoreIds?: ReadonlySet<string>;
  readonly arrivals: readonly Vec[];
  readonly content: GameContent;
  readonly drawnOf: (object: SpaceObject) => Silhouette | null;
  readonly flight: FlightState;
  readonly frameOf: (object: SpaceObject) => number;
}

/** Admission uses assembled geometry; it does not enlarge any actor's physical collider. */
export function stationFormationClear(
  context: StationPlacementContext,
  actors: readonly SpaceObject[],
): boolean {
  const { content, flight } = context;
  const world = flightWorldContext(flight);
  const bodyOf =
    context.bodyOf ??
    ((object: SpaceObject) =>
      object.enemy ? enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], object.enemy) : null);
  const overlaps =
    context.overlapOf ??
    ((obstacle: Parts, origin: Vec, body: Parts, position: Vec) =>
      Boolean(outlinesContact(obstacle, origin, body, position)));
  const objects = stationPopulationObjects(flight).filter(
    (object) => object.hp > 0 && !context.ignoreIds?.has(object.id),
  );
  for (const [index, actor] of actors.entries()) {
    const body = bodyOf(actor);
    if (!body) {
      return false;
    }
    const reach = partsReach(worldParts(body));
    if (
      context.arrivals.some(
        (point) => worldDistance(world, point, actor) < content.tuning.flight.arrivalCalm + reach,
      ) ||
      (context.checkPlayer !== false &&
        overlaps(
          shipBody(flight.facing),
          flight.player,
          body,
          worldPoint(world, flight.player, actor),
        ))
    ) {
      return false;
    }
    for (const other of [...objects, ...actors.slice(index + 1)]) {
      const point = worldPoint(world, actor, other);
      const protection = protectedRadius(content, other);
      if (protection !== null && worldDistance(world, actor, other) <= protection + reach) {
        return false;
      }
      if (other.kind === "enemy" && other.enemy) {
        const obstacle = bodyOf(other);
        if (!obstacle || overlaps(obstacle, point, body, actor)) {
          return false;
        }
      } else if (["rock", "resource", "debris"].includes(other.kind)) {
        if (
          worldSceneryBodyContact(
            world,
            other,
            actor,
            body,
            context.frameOf(other),
            0,
            context.drawnOf(other),
          )
        ) {
          return false;
        }
      } else if (outlineContact(body, actor, point, other.radius)) {
        return false;
      }
    }
  }
  return true;
}
