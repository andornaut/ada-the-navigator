import { CONTENT } from "../data/content.ts";
import type { GameContent } from "../data/types.ts";
import { beginArrivalGrace } from "../model/flight.ts";
import type { FlightState } from "../model/types.ts";

const withGrace = (seconds: number): GameContent => ({
  ...CONTENT,
  tuning: { ...CONTENT.tuning, flight: { ...CONTENT.tuning.flight, arrivalGrace: seconds } },
});
const ENDED = withGrace(0);
const LASTING = withGrace(1e6);

/** Test support: ends Ada's arrival grace as if it had run out, so enemy fire and hazards land. */
export function endArrivalGrace(flight: FlightState): void {
  beginArrivalGrace(ENDED, flight);
}

/** Test support: keeps Ada protected for the rest of a test, so enemies near her hold fire. */
export function protectAda(flight: FlightState): void {
  beginArrivalGrace(LASTING, flight);
}
