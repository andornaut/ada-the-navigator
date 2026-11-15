import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { enemyActorAvailable } from "../data/enemyActors.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { HOSTILE_STATION_POLICY } from "../data/hostileStationPolicy.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { partsReach, worldParts } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import type { PlannedHostileStation, StationMaterialization } from "./hostileStations.ts";
import {
  type HostileStationSite,
  hostileStationSites,
  type HostileStationSitesContext,
} from "./hostileStationSites.ts";
import { memberPosition } from "./spawner.ts";
import { wrapPoint } from "./worldGeometry.ts";

export interface HostileStationIdentities {
  readonly bodyId: string;
  readonly defenderIds: readonly string[];
}

function hullReach(
  galaxy: GalaxyNumber,
  kind: "hostileStation" | "swarm",
  id: string,
): number | null {
  // Geometry templates never sample equipment: actual construction owns the equipped roll.
  const definition = enemyActorDefinition(galaxy, kind, id);
  const template = createEnemy(
    definition,
    { archetype: kind, id, packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
  const body = enemyPhysicalBody(ROUTE_POSITION[galaxy], template);
  return body ? partsReach(worldParts(body)) : null;
}

/** Stable slots derive from real hull extents and the existing encounter member spacing. */
export function planHostileStationFormation(
  context: Pick<HostileStationSitesContext, "galaxy" | "worldSide">,
  identities: HostileStationIdentities,
  site: HostileStationSite,
): PlannedHostileStation | null {
  if (
    !enemyActorAvailable(context.galaxy, "hostileStation") ||
    identities.defenderIds.length !== HOSTILE_STATION_POLICY.defenders ||
    new Set([identities.bodyId, ...identities.defenderIds]).size !==
      identities.defenderIds.length + 1
  ) {
    return null;
  }
  const body = hullReach(context.galaxy, "hostileStation", identities.bodyId);
  const defenders = identities.defenderIds.map((id) => hullReach(context.galaxy, "swarm", id));
  if (body === null || defenders.some((reach) => reach === null)) {
    return null;
  }
  const gap =
    body + Math.max(...(defenders as number[])) + SPAWNER_POLICIES[context.galaxy].memberSpacing;
  return {
    defenders: identities.defenderIds.map((id, index) => {
      const point = memberPosition(gap * 2, identities.defenderIds.length, site, index);
      return {
        id,
        point: context.worldSide === undefined ? point : wrapPoint(context.worldSide, point),
      };
    }),
    id: identities.bodyId,
    point: { x: site.x, y: site.y },
  };
}

export interface HostileStationScheduleContext extends HostileStationSitesContext {
  readonly hasEncounter: (siteId: string) => boolean;
  readonly identities: (siteId: string) => HostileStationIdentities;
  readonly materialize: (plan: PlannedHostileStation) => StationMaterialization;
  readonly register: (siteId: string) => void;
  readonly remember: (site: HostileStationSite) => HostileStationSite;
}

/** A registered encounter is never retried, including missing bodies and defender casualties. */
export function scheduleHostileStations(
  context: HostileStationScheduleContext,
  region: Readonly<Rect>,
): void {
  for (const candidate of hostileStationSites(context, region)) {
    const site = context.remember(candidate);
    if (site.id !== candidate.id) {
      throw new RangeError("Hostile station site identity changed");
    }
    if (context.hasEncounter(site.id)) {
      continue;
    }
    const plan = planHostileStationFormation(context, context.identities(site.id), site);
    if (!plan) {
      continue;
    }
    const result = context.materialize(plan);
    if (result.status === "created") {
      context.register(site.id);
    }
  }
}
