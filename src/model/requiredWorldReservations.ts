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

export interface RequiredWorldOccupants {
  readonly sites: readonly SpaceObject[];
  readonly actors: readonly SpaceObject[];
}

/** Independent authored sites and actors reserve their real geometry without route metadata. */
export function requiredWorldOccupantsPlacementClear(
  context: RequiredWorldContext,
  occupants: RequiredWorldOccupants,
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
  return (
    occupants.sites.every((site) => {
      const protection = protectedRadius(context.content, site);
      return (
        protection === null ||
        worldDistance(context, site, footprint.center) > protection + footprint.radius
      );
    }) &&
    occupants.actors.every((actor) => {
      const body =
        actor.kind === "enemy" &&
        actor.enemy &&
        enemyPhysicalBody(ROUTE_POSITION[context.galaxy], actor.enemy);
      return (
        body !== false &&
        body !== undefined &&
        body !== null &&
        outlineContact(
          body,
          actor,
          worldPoint(context, actor, footprint.center),
          footprint.radius,
        ) === null
      );
    })
  );
}

/** Optional generation respects protected sites and the actual assembled required hulls. */
export function requiredWorldPlacementClear(
  context: RequiredWorldContext,
  reservations: readonly RequiredWorldReservation[],
  footprint: OptionalWorldFootprint,
): boolean {
  return (
    reservations.every(({ site }) => protectedRadius(context.content, site) !== null) &&
    requiredWorldOccupantsPlacementClear(
      context,
      {
        actors: reservations.map(({ guard }) => guard),
        sites: reservations.map(({ site }) => site),
      },
      footprint,
    )
  );
}

/** Count pending required hulls before optional admission, preserving actual actor ownership. */
export function requiredWorldOccupantsPopulation(
  flight: FlightState,
  actors: readonly SpaceObject[],
): readonly SpaceObject[] {
  const actual = stationPopulationObjects(flight);
  const ids = new Set(actual.map(({ id }) => id));
  return [
    ...actual,
    ...actors.flatMap((actor) => {
      if (ids.has(actor.id) || Object.hasOwn(flight.world.notables, actor.id)) {
        return [];
      }
      ids.add(actor.id);
      return [actor];
    }),
  ];
}

/** Paired route reservations share the independent-actor ownership and population rule. */
export function requiredWorldPopulation(
  flight: FlightState,
  reservations: readonly RequiredWorldReservation[],
): readonly SpaceObject[] {
  return requiredWorldOccupantsPopulation(
    flight,
    reservations.map(({ guard }) => guard),
  );
}
