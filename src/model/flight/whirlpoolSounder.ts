import { WHIRLPOOL_CAPITAL_BOSS } from "../../data/capitalBosses.ts";
import { FRIGATE_ESCORT_COUNT } from "../../data/enemyCatalog.ts";
import { HOLODISKS } from "../../data/holodisks.ts";
import type { GameContent } from "../../data/types.ts";
import { flightEncounterSeed, flightWorldContext } from "../flightTopology.ts";
import { createFrigateEscorts, requiredFrigateEscortId } from "../frigateEscorts.ts";
import {
  escortPackId,
  worldPrunePackState,
  worldRecordObjectRemoval,
  worldSyncFlightRegion,
} from "../geography.ts";
import { stationPopulationObjects } from "../hostileStations.ts";
import { rememberRequiredSite } from "../requiredEncounterPlans.ts";
import { readRequiredRolePlan } from "../requiredRolePlans.ts";
import type {
  FlightState,
  GalaxyProgress,
  RequiredRoleEncounterPlan,
  SpaceObject,
  Vec,
} from "../types.ts";
import { worldDelta, worldDistance } from "../worldContacts.ts";
import { wreckId } from "./destruction.ts";
import { guardPack } from "./routeGuards.ts";

type SounderFormationContext = Parameters<typeof guardPack>[0] & {
  readonly actorFootprint: (flight: FlightState, actor: SpaceObject) => number;
  readonly flightStart: Vec;
  readonly placeWhirlpoolFormation: (
    content: GameContent,
    projection: FlightState,
    site: SpaceObject,
    actors: readonly SpaceObject[],
    fixed: boolean,
  ) => Pick<RequiredRoleEncounterPlan, "actors" | "site"> | null;
  readonly spawnEnemy: (
    content: GameContent,
    flight: FlightState,
    archetype: "capital",
    id: string,
    point: Vec,
  ) => SpaceObject;
};

const whirlpoolProtectedDisks = new WeakMap<FlightState, readonly SpaceObject[]>();

export function protectedWhirlpoolDiskSites(flight: FlightState): readonly SpaceObject[] {
  return whirlpoolProtectedDisks.get(flight) ?? [];
}

/** Keep the site reserved while the family waypoint exists without a physical pickup. */
export function reserveWhirlpoolDiskSite(flight: FlightState, at: Vec): void {
  if (!whirlpoolProtectedDisks.has(flight)) {
    whirlpoolProtectedDisks.set(flight, [
      { ...at, hp: 1, id: "holodisk", kind: "destination", radius: 30, role: "holodisk" },
    ]);
  }
}

export function planSounderFormation(
  context: SounderFormationContext,
  content: GameContent,
  projection: FlightState,
  site: SpaceObject,
  fixed: boolean,
): RequiredRoleEncounterPlan | null {
  const { actorFootprint, flightStart, placeWhirlpoolFormation, spawnEnemy } = context;
  const world = flightWorldContext(projection);
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  const heading = worldDelta(world, site, flightStart);
  const bearing = Math.atan2(heading.y, heading.x);
  for (let slot = 0; slot < 8; slot++) {
    const angle = bearing + (slot * Math.PI) / 4;
    const leader = spawnEnemy(content, projection, "capital", id, site);
    const offset = content.tuning.exclusionRadius + actorFootprint(projection, leader) + 240;
    leader.x += Math.cos(angle) * offset;
    leader.y += Math.sin(angle) * offset;
    leader.enemy!.home = { x: leader.x, y: leader.y };
    leader.enemy!.position = { x: leader.x, y: leader.y };
    leader.routeId = site.id;
    leader.persistent = true;
    const escorts = createFrigateEscorts(
      {
        encounterSeed: flightEncounterSeed(projection),
        galaxy: projection.galaxy,
        id: (index) => requiredFrigateEscortId(id, index),
        packId: escortPackId(id),
        persistent: true,
        shipRadius: content.tuning.flight.shipRadius,
      },
      leader,
    );
    const draft: FlightState = {
      ...projection,
      combat: { initialPackSizes: {}, routeEncounters: [] },
      objects: [],
    };
    // Use the existing swarm with enough space for the larger hull and its two escorts.
    const spread = Math.max(...escorts.map((escort) => worldDistance(world, leader, escort))) + 90;
    guardPack(context, content, leader, draft, swarmPack, spread);
    const placed = placeWhirlpoolFormation(
      content,
      projection,
      site,
      [leader, ...escorts, ...draft.objects],
      fixed,
    );
    if (placed) {
      return { ...placed, role: "whirlpool-sounder" };
    }
  }
  return null;
}

/** Removes the superseded guard only, including dormant actors, without a combat reward. */
export function retireLegacyWhirlpoolDiskGuard(
  content: GameContent,
  progress: GalaxyProgress,
  flight: FlightState,
): void {
  const plan = readRequiredRolePlan(flight, "holodisk");
  if (plan?.role === "whirlpool-holodisk") {
    delete flight.requiredPlans!.holodisk;
  }
  const disk = flight.objects.find((object) => object.id === "holodisk");
  if (disk && !progress.requiredSites?.holodisk) {
    rememberRequiredSite(progress, "holodisk", disk);
  }
  const legacyId = "route:holodisk";
  const legacy = (object: SpaceObject) =>
    object.id === legacyId ||
    object.id === wreckId(legacyId) ||
    object.enemy?.escortOf === legacyId ||
    object.enemy?.packId === "route:holodisk:pack";
  const world = flightWorldContext(flight);
  for (const object of stationPopulationObjects(flight)) {
    if (legacy(object)) {
      worldRecordObjectRemoval(world, content, object, flight);
    }
  }
  if (disk || flight.objects.some(legacy)) {
    flight.objects = flight.objects.filter((object) => object !== disk && !legacy(object));
  }
  const state = flight.combat;
  if (state) {
    state.routeEncounters = state.routeEncounters.filter((id) => id !== "holodisk");
    worldPrunePackState(world, flight);
  }
}

export function whirlpoolSounderActor(object: SpaceObject): boolean {
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  return object.id === id || object.enemy?.escortOf === id || object.enemy?.packId === swarmPack;
}

export function restoreWhirlpoolSounder(
  combat: Parameters<typeof guardPack>[0]["combat"],
  content: GameContent,
  actors: readonly SpaceObject[],
  flight: FlightState,
): void {
  flight.objects.push(...actors);
  const state = combat(flight);
  if (!state.routeEncounters.includes("holodisk")) {
    state.routeEncounters.push("holodisk");
  }
  Object.assign(state.initialPackSizes, {
    [escortPackId(WHIRLPOOL_CAPITAL_BOSS.id)]: FRIGATE_ESCORT_COUNT,
    [WHIRLPOOL_CAPITAL_BOSS.swarmPack]: HOLODISKS.guard.packSize,
  });
  worldSyncFlightRegion(flightWorldContext(flight), content, flight);
  worldPrunePackState(flightWorldContext(flight), flight);
}
