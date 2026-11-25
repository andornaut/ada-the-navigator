import { CONTENT } from "../data/content.ts";
import type { EnemyActorKind } from "../data/enemyActors.ts";
import { type EncounterEntry, type EnemyArchetype, escortTuning } from "../data/enemyCatalog.ts";
import { classSpacingRadius } from "../data/enemySpacing.ts";
import type { RoutePosition } from "../data/galaxies.ts";
import {
  HOSTILE_LOCAL_ALLOWANCE,
  type SpawnerPolicy,
  type SpawnerStage,
  spawnerStageAtDistance,
} from "../data/spawnerCatalog.ts";
import type { SpaceObject, Vec } from "./types.ts";
import type { WorldCellContext } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

/** Station hostility is authoritative caller context, never inferred from a friendly station. */
export interface SpawnerContext extends WorldCellContext {
  readonly hostileStationIds?: ReadonlySet<string>;
}

export interface EncounterPlan {
  archetype: EnemyArchetype;
  count: number;
  escorts?: EncounterEntry["escorts"];
}

const distance = (context: SpawnerContext, a: Vec, b: Vec): number =>
  context.worldSide === undefined
    ? Math.hypot(a.x - b.x, a.y - b.y)
    : wrappedDistance(context.worldSide, a, b);

/** Encounter-local shortest distance to the galactic center, including periodic aliases. */
export function worldSpawnerStage(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  point: Vec,
): SpawnerStage {
  return spawnerStageAtDistance(policy, distance(context, { x: 0, y: 0 }, point));
}

/** Disabled hulls still occupy space. Salvaged ships no longer contribute hostile pressure. */
export function liveOccupants(objects: readonly SpaceObject[]): SpaceObject[] {
  return objects.filter(
    (object) => object.kind === "enemy" && object.hp > 0 && !object.enemy?.salvaged,
  );
}

/** Symmetric member positions keep the group's full extent centred on its encounter cell. */
export function memberPosition(spacing: number, count: number, centre: Vec, index: number): Vec {
  return { x: centre.x + (index - (count - 1) / 2) * spacing, y: centre.y };
}

/** Free space required between any two placed spawn footprints: Ada's diameter. */
export const SPAWN_GAP = 2 * CONTENT.tuning.flight.shipRadius;

/**
 * Includes every hull and escort station when checking exclusion zones and overlapping groups, by
 * each class's largest spacing radius at the route position. Neighbouring members sit their
 * member spacing apart, or two footprints plus the spawn gap where that is wider.
 */
export function groupReach(
  policy: SpawnerPolicy,
  position: RoutePosition,
  plan: EncounterPlan,
): number {
  const hull = classSpacingRadius(position, plan.archetype);
  const half =
    (Math.max(0, plan.count - 1) * Math.max(policy.memberSpacing, 2 * hull + SPAWN_GAP)) / 2;
  const line = half + hull;
  const escort = plan.escorts
    ? Math.hypot(plan.archetype === "frigate" ? half : 0, hull + escortTuning.stationGap) +
      classSpacingRadius(position, plan.escorts.archetype)
    : 0;
  return Math.max(line, escort);
}

function neighbours(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  reach: number,
  centre: Vec,
  objects: readonly SpaceObject[],
): SpaceObject[] {
  return objects.filter(
    (object) => distance(context, object, centre) <= policy.localRadius * 2 + reach + object.radius,
  );
}

/** Uses the same footprint neighbourhood for spawning and first sight admission. */
export function worldLocalCap(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  reach: number,
  centre: Vec,
  includesHostileAnchor: boolean,
  objects: readonly SpaceObject[],
): number {
  const qualifies =
    includesHostileAnchor ||
    neighbours(context, policy, reach, centre, objects).some(
      (object) =>
        object.hp > 0 &&
        ((object.kind === "enemy" &&
          object.enemy?.archetype === "capital" &&
          !object.enemy.salvaged) ||
          ((object.kind === "station" ||
            (object.kind === "enemy" && object.enemy?.archetype === "hostileStation")) &&
            context.hostileStationIds?.has(object.id) === true)),
    );
  return stage.localCap + (qualifies ? HOSTILE_LOCAL_ALLOWANCE : 0);
}

/**
 * Whole-group admission: any live neighbour whose hull can share a local-radius neighbourhood
 * with the proposed footprint counts, including guards, old packs and pursuing ships.
 * This conservative spawn budget does not bound subsequent movement or remove existing ships.
 */
export function worldFitsEncounter(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  position: RoutePosition,
  objects: readonly SpaceObject[],
  centre: Vec,
  plan: EncounterPlan,
  actualReach = 0,
): boolean {
  return fitsPopulation(context, policy, stage, objects, centre, {
    archetypes: [plan.archetype, ...(plan.escorts?.count ? [plan.escorts.archetype] : [])],
    capitals:
      (plan.archetype === "capital" ? plan.count : 0) +
      (plan.escorts?.archetype === "capital" ? plan.escorts.count : 0),
    count: plan.count + (plan.escorts?.count ?? 0),
    includesHostileAnchor: plan.archetype === "capital",
    reach: Math.max(groupReach(policy, position, plan), actualReach),
  });
}

interface PopulationFootprint {
  readonly archetypes: readonly EnemyActorKind[];
  readonly capitals: number;
  readonly count: number;
  readonly includesHostileAnchor: boolean;
  readonly reach: number;
}

function fitsPopulation(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  objects: readonly SpaceObject[],
  centre: Vec,
  footprint: PopulationFootprint,
): boolean {
  const nearby = neighbours(context, policy, footprint.reach, centre, liveOccupants(objects));
  const types = new Set<EnemyActorKind>(
    nearby.map((object) => object.enemy?.archetype ?? "fighter"),
  );
  footprint.archetypes.forEach((kind) => types.add(kind));
  const capitals =
    nearby.filter((object) => object.enemy?.archetype === "capital").length + footprint.capitals;
  return (
    nearby.length + footprint.count <=
      worldLocalCap(
        context,
        policy,
        stage,
        footprint.reach,
        centre,
        footprint.includesHostileAnchor,
        objects,
      ) &&
    types.size <= stage.maxNearbyArchetypes &&
    capitals <= policy.maxNearbyCapitals
  );
}

/** Explicit station plans use the same local population accounting as other formations. */
export function worldFitsHostileStation(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  objects: readonly SpaceObject[],
  centre: Vec,
  plan: { readonly id: string; readonly defenders: number; readonly reach: number },
): boolean {
  if (context.hostileStationIds?.has(plan.id) !== true) {
    return false;
  }
  return fitsPopulation(context, policy, stage, objects, centre, {
    archetypes: ["hostileStation", ...(plan.defenders > 0 ? ["swarm" as const] : [])],
    capitals: 0,
    count: 1 + plan.defenders,
    includesHostileAnchor: true,
    reach: plan.reach,
  });
}

/**
 * Reserves new sight engagements against current live combatants. Required guards and already
 * engaged ships keep their normal AI even when they converge above this admission budget.
 */
export function worldEngagementAdmissions(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  objects: readonly SpaceObject[],
  eligible: ReadonlySet<string>,
  player: Vec,
): Set<string> {
  return admittedAt(context, policy, () => stage, objects, eligible, player);
}

/** Geographic admission changes only new sight engagements, never existing enemy state. */
export function worldRegionalEngagementAdmissions(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  objects: readonly SpaceObject[],
  eligible: ReadonlySet<string>,
  player: Vec,
): Set<string> {
  return admittedAt(
    context,
    policy,
    (point) => worldSpawnerStage(context, policy, point),
    objects,
    eligible,
    player,
  );
}

function admittedAt(
  context: SpawnerContext,
  policy: SpawnerPolicy,
  stageAt: (point: Vec) => SpawnerStage,
  objects: readonly SpaceObject[],
  eligible: ReadonlySet<string>,
  player: Vec,
): Set<string> {
  const live = liveOccupants(objects);
  const reserved = live.filter(
    (object) => object.routeId !== undefined || object.persistent || object.enemy?.engaged,
  );
  const admitted = new Set(reserved.map((object) => object.id));
  const candidates = live
    .filter((object) => !admitted.has(object.id) && eligible.has(object.id))
    .sort(
      (a, b) =>
        distance(context, a, player) - distance(context, b, player) || a.id.localeCompare(b.id),
    );
  for (const object of candidates) {
    const stage = stageAt(object);
    const nearby = neighbours(context, policy, object.radius, object, reserved);
    const types = new Set(nearby.map((other) => other.enemy?.archetype ?? "fighter"));
    types.add(object.enemy?.archetype ?? "fighter");
    const capitals =
      nearby.filter((other) => other.enemy?.archetype === "capital").length +
      (object.enemy?.archetype === "capital" ? 1 : 0);
    if (
      nearby.length <
        worldLocalCap(
          context,
          policy,
          stage,
          object.radius,
          object,
          object.enemy?.archetype === "capital",
          objects,
        ) &&
      types.size <= stage.maxNearbyArchetypes &&
      capitals <= policy.maxNearbyCapitals
    ) {
      admitted.add(object.id);
      reserved.push(object);
    }
  }
  return admitted;
}

export function engagementAdmissions(
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  objects: readonly SpaceObject[],
  eligible: ReadonlySet<string>,
  player: Vec,
): Set<string> {
  return worldEngagementAdmissions({}, policy, stage, objects, eligible, player);
}
