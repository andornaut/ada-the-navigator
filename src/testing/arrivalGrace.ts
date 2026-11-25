import type { FlightState } from "../model/types.ts";

/** Test support: ends Ada's arrival grace as if it had run out, so enemy fire and hazards land. */
export function endArrivalGrace(flight: FlightState): void {
  delete flight.arrivalGraceUntil;
}

/** Test support: keeps Ada protected for the rest of a test, so enemies near her hold fire. */
export function protectAda(flight: FlightState): void {
  flight.arrivalGraceUntil = flight.time + 1e6;
}
