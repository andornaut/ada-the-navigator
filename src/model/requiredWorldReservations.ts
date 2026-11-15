import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { outlineContact } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { protectedRadius } from "./protectedPlaces.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";

/** Transient outputs of the authoritative required-site planner, never discovery records. */
export interface RequiredWorldReservation {
  readonly guard: SpaceObject;
  readonly site: SpaceObject;
}

export interface RequiredWorldContext {
  readonly content: GameContent;
  readonly galaxy: GalaxyNumber;
  readonly worldSide?: number;
}

/** A candidate's complete swept footprint, including its drawn extent and any drift loop. */
export interface OptionalWorldFootprint {
  readonly center: Vec;
  readonly radius: number;
}

/** Optional generation respects protected sites and the actual assembled required hulls. */
export function requiredWorldPlacementClear(
  context: RequiredWorldContext,
  reservations: readonly RequiredWorldReservation[],
  footprint: OptionalWorldFootprint,
): boolean {
  if (
    !Number.isFinite(footprint.radius) ||
    footprint.radius < 0 ||
    !Number.isFinite(footprint.center.x) ||
    !Number.isFinite(footprint.center.y)
  ) {
    return false;
  }
  return reservations.every(({ guard, site }) => {
    const protection = protectedRadius(context.content, site);
    const body = guard.enemy && enemyPhysicalBody(ROUTE_POSITION[context.galaxy], guard.enemy);
    return (
      protection !== null &&
      body !== undefined &&
      body !== null &&
      worldDistance(context, site, footprint.center) > protection + footprint.radius &&
      outlineContact(
        body,
        guard,
        worldPoint(context, guard, footprint.center),
        footprint.radius,
      ) === null
    );
  });
}

/** Count pending required hulls before optional admission, preserving actual actor ownership. */
export function requiredWorldPopulation(
  flight: FlightState,
  reservations: readonly RequiredWorldReservation[],
): readonly SpaceObject[] {
  const actual = stationPopulationObjects(flight);
  const ids = new Set(actual.map(({ id }) => id));
  return [
    ...actual,
    ...reservations.flatMap(({ guard }) => {
      if (ids.has(guard.id) || Object.hasOwn(flight.world.notables, guard.id)) {
        return [];
      }
      ids.add(guard.id);
      return [guard];
    }),
  ];
}
