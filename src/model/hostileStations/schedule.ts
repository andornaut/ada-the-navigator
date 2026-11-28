import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { enemyActorAvailable } from "../../data/enemyActors.ts";
import { spacingRadius } from "../../data/enemySpacing.ts";
import { ROUTE_POSITION } from "../../data/galaxies.ts";
import { HOSTILE_STATION_POLICY } from "../../data/hostileStationPolicy.ts";
import { SPAWNER_POLICIES } from "../../data/spawnerCatalog.ts";
import { memberPosition } from "../spawn/encounters/index.ts";
import { wrapPoint } from "../world/index.ts";
import type { PlannedHostileStation, StationMaterialization } from "./placement.ts";
import {
  type HostileStationSite,
  hostileStationSites,
  type HostileStationSitesContext,
} from "./sites.ts";

export interface HostileStationIdentities {
  readonly bodyId: string;
  readonly defenderIds: readonly string[];
}

/**
 * Stable slots derive from the station's and its defenders' spacing radii and the existing
 * encounter member spacing.
 */
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
  const position = ROUTE_POSITION[context.galaxy];
  const body = spacingRadius(position, { archetype: "hostileStation", id: identities.bodyId });
  const defenders = identities.defenderIds.map((id) =>
    spacingRadius(position, { archetype: "swarm", id }),
  );
  const gap = body + Math.max(...defenders) + SPAWNER_POLICIES[context.galaxy].memberSpacing;
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
