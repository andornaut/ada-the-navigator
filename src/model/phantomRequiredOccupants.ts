import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { liveEnemy } from "./geography.ts";
import { readPendingPhantomEncounter } from "./phantomRequiredPlans.ts";
import { requiredWorldOccupantsPopulation } from "./requiredWorldReservations.ts";
import type { FlightState, SpaceObject } from "./types.ts";

/** Current authored membership and its installed followers share one full-state geometry view. */
export function phantomRequiredActors(flight: FlightState): readonly SpaceObject[] {
  const state = flight.galaxy === 6 ? flight.phantom : undefined;
  if (!state) {
    return [];
  }
  const pending = readPendingPhantomEncounter(flight)?.actors ?? [];
  const ids = new Set([
    ...(state.phase === "salvaged" ? [PHANTOM_FLAGSHIP] : []),
    ...state.enemyIds,
    ...Object.values(state.blockades).flat(),
    ...pending.map(({ id }) => id),
  ]);
  return requiredWorldOccupantsPopulation(flight, pending).filter(
    (actor) =>
      (liveEnemy(actor) ||
        (state.phase === "salvaged" && actor.id === PHANTOM_FLAGSHIP && actor.hp > 0)) &&
      (ids.has(actor.id) ||
        (actor.enemy?.escortOf !== null && ids.has(actor.enemy?.escortOf ?? ""))),
  );
}
