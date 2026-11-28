import { enemyActorAvailable } from "../../data/enemyActors.ts";
import {
  hasHostileStationSites,
  HOSTILE_STATION_PLACEMENT,
} from "../../data/hostileStationPlacement.ts";
import { HOSTILE_STATION_POLICY } from "../../data/hostileStationPolicy.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { GALAXY_SIDE } from "../../data/world.ts";
import { enemyStardust } from "../drops.ts";
import { escortPackId } from "../geography.ts";
import type {
  EconomyState,
  FlightState,
  GalaxyProgress,
  HostileStationEncounterState,
  HostileStationSiteState,
  SpaceObject,
  Vec,
} from "../types.ts";
import { wrappedDistance, wrapPoint } from "../world/index.ts";
import { hostileStationPack } from "./population.ts";

export interface HostileStationSite {
  readonly id: string;
  readonly point: Vec;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isHostileStationSiteId(value: unknown): value is string {
  return typeof value === "string" && /^hostile-station:[A-Za-z0-9_,:-]+$/.test(value);
}

/** The canonical geographic identity also identifies the body in its containing encounter flight. */
export function hostileStationEncounterIds(
  siteId: string,
): Pick<HostileStationEncounterState, "bodyId" | "defenderIds"> {
  if (!isHostileStationSiteId(siteId)) {
    throw new RangeError("Invalid hostile site identity");
  }
  const bodyId = siteId;
  return { bodyId, defenderIds: [`${bodyId}:defender:0`, `${bodyId}:defender:1`] };
}

function validPoint(value: unknown): value is Vec {
  if (
    !record(value) ||
    Object.keys(value).length !== 2 ||
    typeof value.x !== "number" ||
    !Number.isFinite(value.x) ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.y) ||
    Math.abs(value.x) > Number.MAX_SAFE_INTEGER / 2 ||
    Math.abs(value.y) > Number.MAX_SAFE_INTEGER / 2
  ) {
    return false;
  }
  const point = value as unknown as Vec;
  const canonical = wrapPoint(GALAXY_SIDE, point);
  const radius = wrappedDistance(GALAXY_SIDE, { x: 0, y: 0 }, point);
  return (
    canonical.x === point.x &&
    canonical.y === point.y &&
    radius >= HOSTILE_STATION_PLACEMENT.minimumCenterDistance &&
    radius <= HOSTILE_STATION_PLACEMENT.maximumCenterDistance
  );
}

export function validHostileStationSites(galaxy: GalaxyNumber, value: unknown): boolean {
  return (
    value === undefined ||
    (record(value) &&
      Object.entries(value).every(
        ([id, site]) =>
          hasHostileStationSites(galaxy) &&
          enemyActorAvailable(galaxy, "hostileStation") &&
          isHostileStationSiteId(id) &&
          record(site) &&
          Object.keys(site).length === 2 &&
          typeof site.identified === "boolean" &&
          validPoint(site.point),
      ))
  );
}

export function rememberHostileStationSite(
  progress: GalaxyProgress,
  galaxy: GalaxyNumber,
  site: HostileStationSite,
): HostileStationSiteState {
  if (progress.geography?.seed === undefined || progress.geography.seed === null) {
    throw new RangeError("Hostile station geography is not initialized");
  }
  const existing = progress.hostileSites?.[site.id];
  if (existing) {
    return existing;
  }
  if (!validHostileStationSites(galaxy, { [site.id]: { identified: false, point: site.point } })) {
    throw new RangeError("Invalid hostile station site");
  }
  const stored = { identified: false, point: { x: site.point.x, y: site.point.y } };
  (progress.hostileSites ??= {})[site.id] = stored;
  return stored;
}

function actorFor(flight: FlightState, id: string): SpaceObject | null | undefined {
  return flight.objects.find((actor) => actor.id === id) ?? flight.world.notables[id];
}

function bodyRole(actor: SpaceObject): boolean {
  return (
    actor.kind === "enemy" &&
    actor.enemy?.archetype === "hostileStation" &&
    actor.routeId === undefined &&
    actor.persistent === true
  );
}

function defenderRole(actor: SpaceObject, bodyId: string): boolean {
  return (
    actor.kind === "enemy" &&
    actor.enemy?.archetype === "swarm" &&
    actor.enemy.packId === escortPackId(hostileStationPack(bodyId)) &&
    actor.routeId === undefined &&
    actor.persistent === true
  );
}

export function validHostileStationEncounters(
  progress: GalaxyProgress,
  flight: FlightState,
): boolean {
  const value: unknown = flight.hostileStations;
  if (value === undefined) {
    return true;
  }
  if (!record(value)) {
    return false;
  }
  const ids = new Set<string>();
  return Object.entries(value).every(([siteId, encounter]) => {
    if (
      !hasHostileStationSites(flight.galaxy) ||
      !progress.hostileSites?.[siteId] ||
      !isHostileStationSiteId(siteId) ||
      !record(encounter) ||
      Object.keys(encounter).length !== 3 ||
      typeof encounter.rewarded !== "boolean" ||
      !Array.isArray(encounter.defenderIds) ||
      encounter.defenderIds.length !== HOSTILE_STATION_POLICY.defenders
    ) {
      return false;
    }
    const expected = hostileStationEncounterIds(siteId);
    if (
      encounter.bodyId !== expected.bodyId ||
      !encounter.defenderIds.every((id, index) => id === expected.defenderIds[index])
    ) {
      return false;
    }
    for (const id of [expected.bodyId, ...expected.defenderIds]) {
      if (ids.has(id)) {
        return false;
      }
      ids.add(id);
      const actor = actorFor(flight, id);
      if (
        actor &&
        (id === expected.bodyId ? !bodyRole(actor) : !defenderRole(actor, expected.bodyId))
      ) {
        return false;
      }
    }
    const body = actorFor(flight, expected.bodyId);
    return !body || body.enemy?.packId === hostileStationPack(expected.bodyId);
  });
}

/** Register only a successfully materialized whole formation; a prior entry never replenishes it. */
export function registerHostileStationEncounter(
  progress: GalaxyProgress,
  flight: FlightState,
  siteId: string,
): HostileStationEncounterState {
  const existing = flight.hostileStations?.[siteId];
  if (existing) {
    return existing;
  }
  if (!progress.hostileSites?.[siteId] || !hasHostileStationSites(flight.galaxy)) {
    throw new RangeError("Hostile station site unavailable");
  }
  const expected = hostileStationEncounterIds(siteId);
  const actors = [expected.bodyId, ...expected.defenderIds].map((id) => actorFor(flight, id));
  if (
    actors.some(
      (actor) =>
        !actor ||
        actor.hp <= 0 ||
        !actor.enemy ||
        actor.enemy.hp <= 0 ||
        actor.enemy.disabled ||
        actor.enemy.salvaged,
    ) ||
    !bodyRole(actors[0]!) ||
    actors[0]!.enemy!.packId !== hostileStationPack(expected.bodyId) ||
    actors.slice(1).some((actor) => !defenderRole(actor!, expected.bodyId))
  ) {
    throw new RangeError("Incomplete hostile station encounter");
  }
  const encounter = { ...expected, rewarded: false };
  (flight.hostileStations ??= {})[siteId] = encounter;
  return encounter;
}

export type HostileStationEncounterResolution =
  | { readonly state: "present"; readonly body: SpaceObject }
  | { readonly state: "removed" | "unresolved" };

/** Absence cannot establish death, and geographic knowledge never supplies encounter status. */
export function resolveHostileStationEncounter(
  flight: FlightState,
  siteId: string,
): HostileStationEncounterResolution {
  const encounter = flight.hostileStations?.[siteId];
  if (!encounter) {
    return { state: "unresolved" };
  }
  const body = actorFor(flight, encounter.bodyId);
  if (body === null || (body && (body.hp <= 0 || (body.enemy?.hp ?? 0) <= 0))) {
    return { state: "removed" };
  }
  return body && bodyRole(body) ? { body, state: "present" } : { state: "unresolved" };
}

/** Invoke only from the existing actual on-screen body identification acknowledgment. */
export function acknowledgeHostileStationIdentification(
  progress: GalaxyProgress,
  flight: FlightState,
  bodyId: string,
): boolean {
  const entry = Object.entries(flight.hostileStations ?? {}).find(
    ([, encounter]) => encounter.bodyId === bodyId,
  );
  const body = flight.objects.find((actor) => actor.id === bodyId);
  if (!entry || !body || !bodyRole(body) || body.hp <= 0 || (body.enemy?.hp ?? 0) <= 0) {
    return false;
  }
  const site = progress.hostileSites?.[entry[0]];
  if (!site) {
    return false;
  }
  site.identified = true;
  return true;
}

function rewardClaim(
  flight: FlightState,
  body: SpaceObject,
): {
  readonly amount: number;
  readonly encounter: HostileStationEncounterState;
} | null {
  const encounter = Object.values(flight.hostileStations ?? {}).find(
    (entry) => entry.bodyId === body.id,
  );
  return encounter &&
    !encounter.rewarded &&
    hasHostileStationSites(flight.galaxy) &&
    actorFor(flight, body.id) === body &&
    bodyRole(body) &&
    (body.hp <= 0 || body.enemy!.hp <= 0)
    ? { amount: enemyStardust({ id: body.id, seed: flight.seed }, "hostileStation"), encounter }
    : null;
}

/** Emit the returned amount through the existing Stardust event in the same model step. */
export function claimHostileStationEncounterReward(flight: FlightState, body: SpaceObject): number {
  const claim = rewardClaim(flight, body);
  if (!claim) {
    return 0;
  }
  claim.encounter.rewarded = true;
  return claim.amount;
}

/** A transition pays synchronously while its authoritative body still exists, before removal. */
export function awardHostileStationEncounterReward(
  economy: Pick<EconomyState, "stardust">,
  flight: FlightState,
  body: SpaceObject,
): number {
  const claim = rewardClaim(flight, body);
  if (!claim) {
    return 0;
  }
  const total = economy.stardust + claim.amount;
  if (!Number.isSafeInteger(total) || economy.stardust < 0) {
    throw new RangeError("Invalid station reward total");
  }
  claim.encounter.rewarded = true;
  economy.stardust = total;
  return claim.amount;
}

export function identifiedHostileStationSites(
  progress: GalaxyProgress,
): readonly HostileStationSite[] {
  return Object.entries(progress.hostileSites ?? {}).flatMap(([id, site]) =>
    site.identified ? [{ id, point: { ...site.point } }] : [],
  );
}
