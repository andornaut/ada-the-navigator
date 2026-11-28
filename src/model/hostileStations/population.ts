import type { FlightState, SpaceObject } from "../types.ts";

/** Stable role packs let paging preserve survivors without treating defenders as route guards. */
export function hostileStationPack(id: string): string {
  return `hostile-station:${id}`;
}

/** Loaded state wins over the same identity's dormant representation. Null is never a position. */
export function stationPopulationObjects(flight: FlightState): readonly SpaceObject[] {
  return [
    ...new Map([
      ...Object.values(flight.world.notables).flatMap((object) =>
        object === null ? [] : [[object.id, object] as const],
      ),
      ...flight.objects.map((object) => [object.id, object] as const),
    ]).values(),
  ];
}
