import type { GameContent } from "../data/types.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import { liveEnemy } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { questGuardFormationAt } from "./questGuardPlacement.ts";
import { requiredPlanActors } from "./requiredEncounterPlans.ts";
import type { RequiredWorldReservation } from "./requiredWorldReservations.ts";
import type { FlightState } from "./types.ts";

/** Required home footprints survive activation; these proxies never replace actual population state. */
export function requiredRouteGeometry(
  content: GameContent,
  flight: FlightState,
): readonly RequiredWorldReservation[] {
  const actual = stationPopulationObjects(flight);
  const byId = new Map(actual.map((actor) => [actor.id, actor]));
  const geometry = new Map<string, RequiredWorldReservation>();
  for (const plan of Object.values(flight.requiredPlans ?? {})) {
    const { site } = plan;
    for (const guard of requiredPlanActors(plan)) {
      if (!Object.hasOwn(flight.world.notables, guard.id) && !byId.has(guard.id)) {
        geometry.set(guard.id, { guard, site });
      }
    }
  }
  for (const guard of actual) {
    if (!guard.routeId || !guard.enemy || !liveEnemy(guard)) {
      continue;
    }
    const site = byId.get(guard.routeId);
    if (!site || site.hp <= 0 || exclusionZoneRadius(content, site) === null) {
      continue;
    }
    const formation = questGuardFormationAt({ flight }, guard, guard.enemy.home);
    for (const member of formation) {
      geometry.set(member.id, { guard: member, site });
    }
  }
  return [...geometry.values()];
}
