import type { GameContent } from "../../data/types.ts";
import { HUB_STATION } from "../stations/index.ts";
import type { FlightState } from "../types.ts";
import { flightWorldContext, worldDistance } from "../world/index.ts";
import { beginArrivalGrace } from "./lifecycle.ts";
import { clearPilotHeading } from "./pilotMovement.ts";

/**
 * Docks at a station within Talk range (gameplay/economy.md): Ada stops where she is. Returns
 * false unless that station is in this flight and in range.
 */
export function dockFlight(content: GameContent, id: string, flight: FlightState): boolean {
  const station = flight.objects.find(
    (object) =>
      object.id === id &&
      (object.kind === "station" || (object.kind === "destination" && id === HUB_STATION)),
  );
  if (
    !station ||
    worldDistance(flightWorldContext(flight), station, flight.player) > content.tuning.talkRange
  ) {
    return false;
  }
  flight.velocity = { x: 0, y: 0 };
  clearPilotHeading(flight);
  return true;
}

/**
 * Undocking leaves Ada at rest where she docked, so Use offers Dock again at once, and starts her
 * arrival grace.
 */
export function undockFlight(content: GameContent, flight: FlightState): void {
  flight.velocity = { x: 0, y: 0 };
  clearPilotHeading(flight);
  beginArrivalGrace(content, flight);
}
