import { claimHostileStationEncounterReward } from "./hostileStationPersistence.ts";
import type { FlightEvent, FlightState, SpaceObject } from "./types.ts";

/** Claims while the authoritative body is owned, before cleanup or depletion leaves flight. */
export function queueHostileStationReward(
  flight: FlightState,
  events: FlightEvent[],
  body: SpaceObject,
): void {
  if (body.enemy?.archetype !== "hostileStation") {
    return;
  }
  const amount = claimHostileStationEncounterReward(flight, body);
  if (amount <= 0) {
    return;
  }
  const depleted = events.findIndex((event) => event.type === "depleted");
  events.splice(depleted < 0 ? events.length : depleted, 0, { amount, type: "stardust" });
}
