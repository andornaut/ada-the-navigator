import { spacingRadius } from "../data/enemySpacing.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { protectedRadius } from "./protectedPlaces.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { worldDistance } from "./worldContacts.ts";

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

/** Independent authored sites and actors reserve their footprints without route metadata. */
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
    // An enemy's footprint is a circle of its design's spacing radius; an actor that is not an
    // enemy has no footprint to clear.
    occupants.actors.every(
      (actor) =>
        actor.kind === "enemy" &&
        actor.enemy !== undefined &&
        worldDistance(context, actor, footprint.center) >
          spacingRadius(ROUTE_POSITION[context.galaxy], actor.enemy) + footprint.radius,
    )
  );
}

/** Optional generation respects protected sites and the footprints of required hulls. */
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
