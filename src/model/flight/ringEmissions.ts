import type { FlightState, Vec } from "../types.ts";

/** A ring burst's emission at its hull, view-only and never saved. */
export interface RingEmission {
  age: number;
  at: Vec;
  origins: readonly Vec[];
  spawnRadius: number;
}
const ringEmissions = new WeakMap<FlightState, RingEmission[]>();
/** How long a ring burst's emission shows (art/weapons.md "Ring burst"). */
const RING_EMISSION_SECONDS = 0.18;

/** The flight's ring burst emissions still showing. */
export function activeRingEmissions(flight: FlightState): readonly RingEmission[] {
  return ringEmissions.get(flight) ?? [];
}

export function recordRingEmission(
  delay: number,
  at: Vec,
  origins: readonly Vec[],
  spawnRadius: number,
  flight: FlightState,
): void {
  const emissions = ringEmissions.get(flight) ?? [];
  emissions.push({
    age: -delay,
    at: { ...at },
    origins,
    spawnRadius,
  });
  ringEmissions.set(flight, emissions);
}

/** Ages each ring burst emission until it has shown. */
export function stepRingEmissions(dt: number, flight: FlightState): void {
  const emissions = ringEmissions.get(flight);
  if (emissions) {
    emissions.forEach((emission) => (emission.age += dt));
    ringEmissions.set(
      flight,
      emissions.filter((emission) => emission.age < RING_EMISSION_SECONDS),
    );
  }
}
