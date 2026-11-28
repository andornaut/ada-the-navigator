import { ECONOMY } from "../data/economy.ts";
import type { GameContent } from "../data/types.ts";
import { rollHeavyDefeatUpgrade } from "./drops.ts";
import { claimHostileStationEncounterReward } from "./hostileStationPersistence.ts";
import type { FlightEvent, FlightState, SpaceObject } from "./types.ts";

/** Claims while the authoritative body is owned, before cleanup or depletion leaves flight. */
export function queueHostileStationReward(
  flight: FlightState,
  events: FlightEvent[],
  body: SpaceObject,
  content: GameContent,
): void {
  if (body.enemy?.archetype !== "hostileStation") {
    return;
  }
  const amount = claimHostileStationEncounterReward(flight, body);
  if (amount <= 0) {
    return;
  }
  if (rollHeavyDefeatUpgrade(ECONOMY, { id: body.id, seed: flight.seed }, "hostileStation")) {
    flight.objects.push({
      hp: 1,
      id: `drop:${flight.nextId++}`,
      kind: "pickup",
      radius: content.tuning.flight.pickupRadius,
      role: "drop",
      upgrade: true,
      x: body.x,
      y: body.y,
    });
    return;
  }
  const depleted = events.findIndex((event) => event.type === "depleted");
  events.splice(depleted < 0 ? events.length : depleted, 0, { amount, type: "stardust" });
}
