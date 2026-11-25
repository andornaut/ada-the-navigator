import type { GameContent } from "../data/types.ts";
import { exclusionZoneRadius } from "./exclusionZones.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";

export type StationGuardSite =
  | { readonly status: "removed" | "unresolved" }
  | {
      readonly status: "present";
      readonly id: string;
      readonly center: Vec;
      /** Site protection only; callers add actual hull reach and clearance once. */
      readonly clearanceRadius: number;
      /** A copy of saved home, without geometry validation or relocation. */
      readonly homeCandidate: Vec | null;
    };

/** Exact route identity resolves site authority without loading or discovering anything. */
export function stationGuardSite(
  context: {
    readonly content: GameContent;
    readonly flight: Pick<FlightState, "objects" | "world">;
  },
  guard: Pick<SpaceObject, "routeId" | "enemy">,
): StationGuardSite {
  const id = guard.routeId;
  if (!id) {
    return { status: "unresolved" };
  }
  const { content, flight } = context;
  let site = flight.objects.find((object) => object.id === id);
  if (!site) {
    if (!Object.hasOwn(flight.world.notables, id)) {
      return { status: "unresolved" };
    }
    const retained = flight.world.notables[id];
    if (retained === null) {
      return { status: "removed" };
    }
    if (!retained || retained.id !== id) {
      return { status: "unresolved" };
    }
    site = retained;
  }
  const clearanceRadius = exclusionZoneRadius(content, site);
  if (clearanceRadius === null) {
    return { status: "unresolved" };
  }
  return {
    center: { x: site.x, y: site.y },
    clearanceRadius,
    homeCandidate: guard.enemy ? { x: guard.enemy.home.x, y: guard.enemy.home.y } : null,
    id,
    status: "present",
  };
}
