import { HOLODISKS } from "../../data/holodisks.ts";
import type { GameContent } from "../../data/types.ts";
import { liveEnemy, retainedRouteBlocked } from "../geography.ts";
import { routeGuardEvidence } from "../routeGuardEvidence.ts";
import type { FlightState, SpaceObject, Vec } from "../types.ts";

interface RouteGuardPackContext {
  combat: (flight: FlightState) => NonNullable<FlightState["combat"]>;
  spawnEnemy: (
    content: GameContent,
    flight: FlightState,
    archetype: typeof HOLODISKS.guard.pack,
    id: string,
    point: Vec,
    packId: string,
    phase: number,
  ) => SpaceObject;
}

export type RouteGuardPlanResult = ReturnType<typeof routeGuardEvidence>;

/** Only actual actor or tombstone evidence establishes a required guard's outcome. */
export function routeGuardPlanResult(flight: FlightState, id: string): RouteGuardPlanResult {
  return routeGuardEvidence(flight, id);
}

/** A guard blocks its route until it is disabled or destroyed (gameplay/rules.md). */
export function routeBlocked(id: string, flight: FlightState): boolean {
  // A guard loaded or dormant alike: a disabled one has stopped counting, as when retained.
  return (
    retainedRouteBlocked(id, flight) ||
    flight.objects.some(
      (object) => object.routeId === id && liveEnemy(object) && !object.enemy?.disabled,
    )
  );
}

/**
 * The holodisk leader's pack. Its members persist so the fight cannot reroll, but only the
 * leader blocks the route, so a fleeing member never strands the holodisk.
 */
export function guardPack(
  { combat, spawnEnemy }: RouteGuardPackContext,
  content: GameContent,
  leader: Vec,
  flight: FlightState,
  packId = "route:holodisk:pack",
  spread = 90,
): void {
  const { pack, packSize } = HOLODISKS.guard;
  for (let i = 0; i < packSize; i++) {
    const angle = (i * Math.PI * 2) / packSize;
    const member = spawnEnemy(
      content,
      flight,
      pack,
      `${packId}:${i}`,
      { x: leader.x + Math.cos(angle) * spread, y: leader.y + Math.sin(angle) * spread },
      packId,
      angle,
    );
    member.persistent = true;
    flight.objects.push(member);
  }
  combat(flight).initialPackSizes[packId] = packSize;
}
