import { type EnemyArchetype, enemyCatalog, type EnemyDefinition } from "./enemyCatalog.ts";
import { HOSTILE_STATION_SIGNATURE } from "./enemySignatures.ts";
import { ROUTE_POSITION } from "./galaxies.ts";
import type { GalaxyNumber } from "./types.ts";

/** Actor identity includes stations without adding an unapproved economy archetype. */
export type EnemyActorKind = EnemyArchetype | "hostileStation";

export function isEnemyActorKind(value: unknown): value is EnemyActorKind {
  return (
    typeof value === "string" && (value === "hostileStation" || Object.hasOwn(enemyCatalog, value))
  );
}

/** Station placement is supplied by its caller; this only checks the approved weapon tier. */
export function enemyActorAvailable(galaxy: GalaxyNumber, kind: EnemyActorKind): boolean {
  return (
    kind !== "hostileStation" ||
    HOSTILE_STATION_SIGNATURE.tiers.some(({ position }) => position === ROUTE_POSITION[galaxy])
  );
}

/** Existing unscaled ship definitions, distinct from station actor profiles and economy policy. */
export function shipCatalogEntry(kind: EnemyActorKind): EnemyDefinition | undefined {
  return kind === "hostileStation" ? undefined : enemyCatalog[kind];
}
