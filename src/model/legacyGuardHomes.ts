import { liveEnemy } from "./geography.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { flightWorldContext, type WorldContext } from "./world/index.ts";

/** Canonical placement supplies site authority and geometry; recovery supplies no fallback. */
export interface LegacyGuardHomePorts {
  readonly resolveSite: (
    flight: Pick<FlightState, "objects" | "world">,
    siteId: string,
  ) => SpaceObject | null | undefined;
  readonly validHome: (
    context: WorldContext,
    site: SpaceObject,
    guard: SpaceObject,
    home: Vec,
  ) => boolean;
  readonly recoveryHome: (
    context: WorldContext,
    site: SpaceObject,
    guard: SpaceObject,
  ) => Vec | null;
}

export interface LegacyGuardHomeUpdate {
  readonly guardId: string;
  readonly home: Vec;
}

/** Plans home-only repairs for existing guards, without changing any saved actor or ledger. */
export function legacyGuardHomeUpdates(
  ports: LegacyGuardHomePorts,
  flight: FlightState,
): readonly LegacyGuardHomeUpdate[] {
  const context = flightWorldContext(flight);
  const guards = new Map(flight.objects.map((object) => [object.id, object]));
  for (const object of Object.values(flight.world.notables)) {
    if (object && !guards.has(object.id)) {
      guards.set(object.id, object);
    }
  }
  const updates: LegacyGuardHomeUpdate[] = [];
  for (const guard of guards.values()) {
    if (
      !guard.routeId ||
      !guard.enemy ||
      guard.enemy.archetype !== "frigate" ||
      guard.enemy.disabled ||
      !liveEnemy(guard)
    ) {
      continue;
    }
    const site = ports.resolveSite({ objects: flight.objects, world: flight.world }, guard.routeId);
    if (
      !site ||
      site.hp <= 0 ||
      site.id !== guard.routeId ||
      (site.kind !== "destination" && site.kind !== "station")
    ) {
      continue;
    }
    if (ports.validHome(context, site, guard, guard.enemy.home)) {
      continue;
    }
    const home = ports.recoveryHome(context, site, guard);
    if (
      !home ||
      !Number.isFinite(home.x) ||
      !Number.isFinite(home.y) ||
      !ports.validHome(context, site, guard, home)
    ) {
      continue;
    }
    updates.push({ guardId: guard.id, home: { x: home.x, y: home.y } });
  }
  return updates;
}
