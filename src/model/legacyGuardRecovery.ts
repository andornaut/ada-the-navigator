import { flightWorldContext } from "./flightTopology.ts";
import { liveEnemy, retainQuestGuardRecovery } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { legacyGuardHomeUpdates } from "./legacyGuardHomes.ts";
import { questGuardHomePorts } from "./questGuardPlacement.ts";
import type { StationPlacementContext } from "./stationPlacement.ts";

/** Repair existing homes and activate only their surviving authoritative formation members. */
export function recoverLegacyQuestGuards(context: StationPlacementContext): {
  readonly activeIds: ReadonlySet<string>;
  readonly repairedIds: readonly string[];
} {
  const { content, flight } = context;
  const world = flightWorldContext(flight);
  const ports = questGuardHomePorts(context);
  const before = new Map(
    stationPopulationObjects(flight).map((actor) => [
      actor.id,
      {
        actor,
        home: actor.enemy ? { ...actor.enemy.home } : null,
        routeId: actor.routeId,
        state: actor.enemy,
      },
    ]),
  );
  const updates = legacyGuardHomeUpdates(ports, flight);
  const repairedIds: string[] = [];
  for (const update of updates) {
    const snapshot = before.get(update.guardId);
    const current = stationPopulationObjects(flight).find((actor) => actor.id === update.guardId);
    if (
      !snapshot ||
      !current?.enemy ||
      current !== snapshot.actor ||
      current.enemy !== snapshot.state ||
      !snapshot.home ||
      current.enemy.home.x !== snapshot.home.x ||
      current.enemy.home.y !== snapshot.home.y ||
      current.enemy.disabled ||
      !liveEnemy(current) ||
      !current.routeId ||
      current.routeId !== snapshot.routeId
    ) {
      continue;
    }
    const site = ports.resolveSite(flight, current.routeId);
    if (
      !site ||
      ports.validHome(world, site, current, current.enemy.home) ||
      !ports.validHome(world, site, current, update.home)
    ) {
      continue;
    }
    current.enemy.home = { ...update.home };
    repairedIds.push(current.id);
  }
  const valid = new Set(
    stationPopulationObjects(flight).flatMap((guard) => {
      if (
        !guard.enemy ||
        guard.enemy.archetype !== "frigate" ||
        guard.enemy.disabled ||
        !liveEnemy(guard) ||
        !guard.routeId
      ) {
        return [];
      }
      const site = ports.resolveSite(flight, guard.routeId);
      return site && ports.validHome(world, site, guard, guard.enemy.home) ? [guard.id] : [];
    }),
  );
  return { activeIds: retainQuestGuardRecovery(world, content, valid, flight), repairedIds };
}
