import type { FlightState, Vec } from "./types.ts";

/** Active and retained destination coordinates share one source for procedural exclusions. */
export function flightDestinationSites(
  flight: Pick<FlightState, "objects" | "world">,
): readonly Vec[] {
  return [
    ...flight.objects.filter((object) => object.kind === "destination"),
    ...Object.values(flight.world.notables).filter(
      (object): object is NonNullable<typeof object> => object?.kind === "destination",
    ),
  ];
}
