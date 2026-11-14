import {
  type EncounterEntry,
  type EnemyArchetype,
  enemyCatalog,
  escortTuning,
} from "../data/enemyCatalog.ts";
import {
  FIGHTER_GROUP_TARGET,
  type SpawnerPolicy,
  type SpawnerStage,
  spawnerStageAtDistance,
  SWARM_GROUP_MINIMUM,
} from "../data/spawnerCatalog.ts";
import type { SpaceObject, Vec } from "./types.ts";
import type { WorldCellContext } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

export interface EncounterPlan {
  archetype: EnemyArchetype;
  count: number;
  escorts?: EncounterEntry["escorts"];
}

const distance = (context: WorldCellContext, a: Vec, b: Vec): number =>
  context.worldSide === undefined
    ? Math.hypot(a.x - b.x, a.y - b.y)
    : wrappedDistance(context.worldSide, a, b);

/** Encounter-local shortest distance to the galactic center, including periodic aliases. */
export function worldSpawnerStage(
  context: WorldCellContext,
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

/** Includes every hull and escort station when checking safe areas and overlapping groups. */
export function groupReach(policy: SpawnerPolicy, shipRadius: number, plan: EncounterPlan): number {
  const hull = enemyCatalog[plan.archetype].sizeRatio * shipRadius;
  const line = (Math.max(0, plan.count - 1) * policy.memberSpacing) / 2 + hull;
  const escort = plan.escorts
    ? hull + escortTuning.stationGap + enemyCatalog[plan.escorts.archetype].sizeRatio * shipRadius
    : 0;
  return Math.max(line, escort);
}

/**
 * Whole-group admission: any live neighbour whose hull can share a local-radius neighbourhood
 * with the proposed footprint counts, including guards, old packs and pursuing ships.
 * This conservative spawn budget does not bound subsequent movement or remove existing ships.
 */
export function worldFitsEncounter(
  context: WorldCellContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  shipRadius: number,
  objects: readonly SpaceObject[],
  centre: Vec,
  plan: EncounterPlan,
): boolean {
  const reach = groupReach(policy, shipRadius, plan);
  const nearby = liveOccupants(objects).filter(
    (object) => distance(context, object, centre) <= policy.localRadius * 2 + reach + object.radius,
  );
  const count = plan.count + (plan.escorts?.count ?? 0);
  const types = new Set(nearby.map((object) => object.enemy?.archetype ?? "fighter"));
  types.add(plan.archetype);
  if (plan.escorts?.count) {
    types.add(plan.escorts.archetype);
  }
  const capitals =
    nearby.filter((object) => object.enemy?.archetype === "capital").length +
    (plan.archetype === "capital" ? plan.count : 0) +
    (plan.escorts?.archetype === "capital" ? plan.escorts.count : 0);
  return (
    nearby.length + count <= stage.localCap &&
    types.size <= stage.maxNearbyArchetypes &&
    capitals <= policy.maxNearbyCapitals
  );
}

/**
 * Fighters and swarms take their largest fitting group, respecting the swarm minimum.
 * Other groups and every escort
 * remain atomic. Samples only positive entries with an admissible plan. Encounter-cell
 * frequency is independent; occupancy limits cannot select an excluded or unaffordable type.
 */
export function worldSelectEncounter(
  context: WorldCellContext,
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  shipRadius: number,
  objects: readonly SpaceObject[],
  centre: Vec,
  countRoll: number,
  archetypeRoll: number,
): EncounterPlan | null {
  const choices = stage.roster.flatMap((entry) => {
    if (entry.weight <= 0) {
      return [];
    }
    const plans: EncounterPlan[] = [];
    const flexibleFighters = entry.archetype === "fighter" && entry.escorts === undefined;
    const flexibleSwarm = entry.archetype === "swarm" && entry.escorts === undefined;
    const minimum = flexibleFighters ? 1 : flexibleSwarm ? SWARM_GROUP_MINIMUM : entry.groupSize[0];
    const maximum = flexibleFighters
      ? Math.min(FIGHTER_GROUP_TARGET, entry.groupSize[1])
      : entry.groupSize[1];
    for (let count = minimum; count <= maximum; count++) {
      const plan = {
        archetype: entry.archetype,
        count,
        ...(entry.escorts ? { escorts: entry.escorts } : {}),
      };
      if (worldFitsEncounter(context, policy, stage, shipRadius, objects, centre, plan)) {
        plans.push(plan);
      }
    }
    return plans.length
      ? [
          {
            plans: flexibleFighters || flexibleSwarm ? plans.slice(-1) : plans,
            weight: entry.weight,
          },
        ]
      : [];
  });
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (!total) {
    return null;
  }
  let threshold = archetypeRoll * total;
  let chosen = choices.at(-1)!;
  for (const choice of choices) {
    if (threshold < choice.weight) {
      chosen = choice;
      break;
    }
    threshold -= choice.weight;
  }
  return chosen.plans[
    Math.min(chosen.plans.length - 1, Math.floor(countRoll * chosen.plans.length))
  ]!;
}

/**
 * Reserves new sight engagements against current live combatants. Required guards and already
 * engaged ships keep their normal AI even when they converge above this admission budget.
 */
export function worldEngagementAdmissions(
  context: WorldCellContext,
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
  context: WorldCellContext,
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
  context: WorldCellContext,
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
    const neighbours = reserved.filter(
      (other) =>
        distance(context, other, object) <= policy.localRadius * 2 + other.radius + object.radius,
    );
    const types = new Set(neighbours.map((other) => other.enemy?.archetype ?? "fighter"));
    types.add(object.enemy?.archetype ?? "fighter");
    const capitals =
      neighbours.filter((other) => other.enemy?.archetype === "capital").length +
      (object.enemy?.archetype === "capital" ? 1 : 0);
    if (
      neighbours.length < stage.localCap &&
      types.size <= stage.maxNearbyArchetypes &&
      capitals <= policy.maxNearbyCapitals
    ) {
      admitted.add(object.id);
      reserved.push(object);
    }
  }
  return admitted;
}

export function fitsEncounter(
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  shipRadius: number,
  objects: readonly SpaceObject[],
  centre: Vec,
  plan: EncounterPlan,
): boolean {
  return worldFitsEncounter({}, policy, stage, shipRadius, objects, centre, plan);
}
export function selectEncounter(
  policy: SpawnerPolicy,
  stage: SpawnerStage,
  shipRadius: number,
  objects: readonly SpaceObject[],
  centre: Vec,
  countRoll: number,
  archetypeRoll: number,
): EncounterPlan | null {
  return worldSelectEncounter(
    {},
    policy,
    stage,
    shipRadius,
    objects,
    centre,
    countRoll,
    archetypeRoll,
  );
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
