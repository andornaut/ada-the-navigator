import { liveEnemy } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import type { FlightState, SpaceObject } from "./types.ts";

export type RouteGuardEvidence =
  | { readonly guard: SpaceObject; readonly status: "admitted" }
  | { readonly status: "resolved" }
  | { readonly admissionRecorded: boolean; readonly status: "unknown" };

/** Admission records never establish a missing guard's disposition. This read has no side effects. */
export function routeGuardEvidence(flight: FlightState, siteId: string): RouteGuardEvidence {
  const guards = stationPopulationObjects(flight).filter(
    (object) => object.kind === "enemy" && object.routeId === siteId,
  );
  const live = guards.find((guard) => liveEnemy(guard) && !guard.enemy?.disabled);
  if (live) {
    return { guard: live, status: "admitted" };
  }
  const actorId = `route:${siteId}`;
  const removed =
    Object.hasOwn(flight.world.notables, actorId) && flight.world.notables[actorId] === null;
  if (guards.length > 0 || removed) {
    return { status: "resolved" };
  }
  return {
    admissionRecorded: flight.combat?.routeEncounters.includes(siteId) === true,
    status: "unknown",
  };
}
