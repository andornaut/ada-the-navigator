import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  encounterRate,
  enemyCatalog,
  enemyEncounterTuning,
  escortTuning,
  FRIGATE_ESCORT_COUNT,
} from "../data/enemyCatalog.ts";
import { byPosition } from "../data/galaxies.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { RESOURCE_ROCKS } from "../data/resourceRocks.ts";
import {
  FIGHTER_GROUP_TARGET,
  SPAWNER_POLICIES,
  SWARM_GROUP_MINIMUM,
} from "../data/spawnerCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ASTEROID_SHAPES, placementRadius } from "./asteroids.ts";
import { BALLISTIC_REQUEST, ballisticEncounterSpacing } from "./ballisticAsteroids.ts";
import { worldCurrentsNear } from "./currents.ts";
import { landmarkSites } from "./landmarks.ts";
import { ORE_FIELD_CLEAR_RADIUS, worldOreFieldsNear } from "./oreFields.ts";
import { worldFitsEncounter } from "./spawner.ts";
import type {
  EnemyTarget,
  ExclusionZone,
  SpawnBand,
  SpawnRules,
  SpawnShape,
} from "./spawnPlanner.ts";
import { worldStationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";
import type { WorldCellContext } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

const MOVING_KIND = "moving-rock";

const tuning = CONTENT.tuning;
const flight = tuning.flight;

/** Shapes of the weighted sizes, each size's weight split evenly over its variants. */
function sized(sizes: Readonly<Partial<Record<AsteroidSize, number>>>): SpawnShape[] {
  const shapes = [...ASTEROID_SHAPES.values()];
  return shapes.flatMap((shape) => {
    const weight = sizes[shape.size] ?? 0;
    const variants = shapes.filter((other) => other.size === shape.size).length;
    return weight > 0
      ? [
          {
            id: shape.id,
            radius: placementRadius({ asteroid: shape.id, kind: "rock", radius: shape.radius }),
            weight: weight / variants,
          },
        ]
      : [];
  });
}

/** Chunks between encounter lattice cells, as flight's encounter director spaces them. */
export function interimEncounterSpacing(galaxy: GalaxyNumber): number {
  return (
    Math.max(3, Math.ceil(enemyEncounterTuning.quietDistance / tuning.chunkSize)) /
    Math.sqrt(encounterRate(galaxy))
  );
}

/** Encounter groups per chunk: three in four lattice cells, one lattice cell per spacing squared. */
function encounterGroupsPerChunk(galaxy: GalaxyNumber): number {
  return 0.75 / interimEncounterSpacing(galaxy) ** 2;
}

/**
 * One band's enemy targets: each roster entry's share of the encounter groups, with the member
 * counts the current selector admits in empty space (flexible fighters and swarms at their
 * largest fitting size, other entries uniform over their fitting sizes).
 */
function enemyTargets(galaxy: GalaxyNumber, stageIndex: number): EnemyTarget[] {
  const policy = SPAWNER_POLICIES[galaxy];
  const stage = policy.stages[stageIndex]!;
  const choices = stage.roster.flatMap((entry) => {
    if (entry.weight <= 0) {
      return [];
    }
    const flexible =
      (entry.archetype === "fighter" || entry.archetype === "swarm") && !entry.escorts;
    const least =
      entry.archetype === "fighter" && flexible
        ? 1
        : entry.archetype === "swarm" && flexible
          ? SWARM_GROUP_MINIMUM
          : entry.groupSize[0];
    const most =
      entry.archetype === "fighter" && flexible
        ? Math.min(FIGHTER_GROUP_TARGET, entry.groupSize[1])
        : entry.groupSize[1];
    const counts: number[] = [];
    for (let count = least; count <= most; count++) {
      const escorts =
        entry.archetype === "frigate"
          ? { archetype: "fighter" as const, count: count * FRIGATE_ESCORT_COUNT }
          : entry.escorts;
      const plan = { archetype: entry.archetype, count, ...(escorts ? { escorts } : {}) };
      if (worldFitsEncounter({}, policy, stage, flight.shipRadius, [], { x: 0, y: 0 }, plan)) {
        counts.push(count);
      }
    }
    const fitting = flexible ? counts.slice(-1) : counts;
    return fitting.length ? [{ counts: fitting, entry }] : [];
  });
  const total = choices.reduce((sum, choice) => sum + choice.entry.weight, 0);
  const groups = encounterGroupsPerChunk(galaxy);
  return choices.map(({ counts, entry }) => {
    const hull = enemyCatalog[entry.archetype].sizeRatio * flight.shipRadius;
    const escorts =
      entry.archetype === "frigate"
        ? { archetype: "fighter" as const, perLeader: FRIGATE_ESCORT_COUNT }
        : entry.escorts
          ? { archetype: entry.escorts.archetype, perLeader: entry.escorts.count }
          : undefined;
    const least = counts[0]!;
    const most = counts.at(-1)!;
    return {
      density: ((groups * entry.weight) / total) * ((least + most) / 2),
      ...(escorts
        ? {
            escorts: {
              kind: `${entry.archetype}-escort`,
              perLeader: escorts.perLeader,
              radius: enemyCatalog[escorts.archetype].sizeRatio * flight.shipRadius,
              ring: hull + escortTuning.stationGap,
            },
          }
        : {}),
      groupSize: [least, most] as const,
      kind: entry.archetype,
      radius: hull,
      spacing: policy.memberSpacing,
    };
  });
}

/**
 * Interim mapping from the current approved placement values to planner targets, until Gameplay
 * states densities per kind and area. Nothing here changes those values:
 * - Slot rocks and resources: `objectsPerChunk` slots split by `spawnWeights` (enemy and pickup
 *   slots stay empty), plus the `asteroidDensity` share of every ordinary placement, features
 *   included, added as slot rocks and resources in their weight ratio.
 * - Feature rocks: the field's feature chance averaged over the chunk catalog's template weights.
 * - Moving rocks: the ballistic encounter lattice's mean movers per chunk, chosen from placed
 *   slot and feature rocks, with its group share and speeds.
 * - Enemies: the encounter lattice's groups per chunk, split by spawner stage roster weights.
 * - Lanes: the chunk templates' corridor half width (ship radius plus clearance).
 * Planner choices with no approved value yet: a gap of Ada's diameter between footprints, 24
 * tries per spawn, a group anchor search of half a chunk and member tries within the spawner's
 * member spacing.
 */
export function interimSpawnRules(galaxy: GalaxyNumber, worldSide?: number): SpawnRules {
  const field = byPosition(ASTEROID_FIELDS, galaxy);
  const templates = byPosition(CHUNK_CATALOG, galaxy);
  const templateWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  const featureDensity = templates.reduce(
    (sum, template) => sum + (template.weight / templateWeight) * field.featureChance[template.id],
    0,
  );
  const weights = flight.spawnWeights;
  const slotTotal = weights.enemy + weights.pickup + weights.resource + weights.rock;
  const slotRock = (flight.objectsPerChunk * weights.rock) / slotTotal;
  const slotResource = (flight.objectsPerChunk * weights.resource) / slotTotal;
  const extra = (flight.asteroidDensity - 1) * (slotRock + slotResource + featureDensity);
  const rockShare = weights.rock / (weights.rock + weights.resource);
  const large = 1 / RESOURCE_ROCKS.largeEvery;
  const rocks = [
    { density: featureDensity, kind: "rock-feature", shapes: sized(field.featureSizes) },
    { density: slotRock + extra * rockShare, kind: "rock", shapes: sized(field.slotSizes) },
    {
      density: slotResource + extra * (1 - rockShare),
      kind: "resource",
      shapes: sized({ large, medium: 1 - large }),
    },
  ];
  const [fewest, most] = BALLISTIC_REQUEST.count;
  const spacing = ballisticEncounterSpacing(tuning.chunkSize, galaxy);
  const moving = [
    {
      density: (BALLISTIC_REQUEST.occupancy * ((fewest + most) / 2)) / spacing ** 2,
      from: ["rock-feature", "rock"],
      groupShare: BALLISTIC_REQUEST.groupShare,
      kind: MOVING_KIND,
      speed: BALLISTIC_REQUEST.speed,
    },
  ];
  const bands: SpawnBand[] = SPAWNER_POLICIES[galaxy].stages.map((stage, index) => ({
    enemies: enemyTargets(galaxy, index),
    from: stage.centerDistance,
    moving,
    rocks,
  }));
  return {
    bands,
    chunkSize: tuning.chunkSize,
    corridor: flight.shipRadius + flight.shipRadius,
    gap: 2 * flight.shipRadius,
    jitter: SPAWNER_POLICIES[galaxy].memberSpacing,
    search: tuning.chunkSize / 2,
    tries: 24,
    ...(worldSide === undefined ? {} : { worldSide }),
  };
}

const disc = (rule: string, applies: ExclusionZone["applies"], at: Vec, radius: number) => ({
  applies,
  rule,
  shape: { kind: "disc" as const, radius, x: at.x, y: at.y },
});

/**
 * The seeded world's exclusion zones within `radius` of a point, as `generate` applies them:
 * station protected areas, quantum and launch arrivals (a safe radius for rocks, the calm radius
 * for enemies), landmark charting ranges, currents and ore fields. Flight-state zones (the
 * player, story destinations, required routes and the Needle channel) are the caller's.
 */
export function worldSpawnExclusions(
  context: WorldCellContext,
  galaxy: GalaxyNumber,
  arrivals: readonly Vec[],
  radius: number,
  point: Vec,
): ExclusionZone[] {
  const near = (at: Vec, reach: number) =>
    (context.worldSide === undefined
      ? Math.hypot(at.x - point.x, at.y - point.y)
      : wrappedDistance(context.worldSide, at, point)) <=
    radius + reach;
  const stationSafe = ECONOMY.station.safeRadius;
  return [
    ...worldStationsNear(context, ECONOMY, galaxy, radius + stationSafe, point).map((station) =>
      disc("protected", ["rock", "moving", "enemy"], station, stationSafe),
    ),
    ...arrivals.flatMap((arrival) => [
      ...(near(arrival, tuning.safeRadius)
        ? [disc("arrival-safe", ["rock", "moving"], arrival, tuning.safeRadius)]
        : []),
      ...(near(arrival, flight.arrivalCalm)
        ? [disc("arrival-calm", ["enemy"], arrival, flight.arrivalCalm)]
        : []),
    ]),
    ...landmarkSites(galaxy)
      .filter((site) => near(site, LANDMARK_TUNING.chart))
      .map((site) => disc("landmark", ["rock"], site, LANDMARK_TUNING.chart)),
    ...worldCurrentsNear(context, galaxy, radius, point).map((current) => ({
      applies: ["rock", "moving"] as const,
      rule: "current",
      shape: { halfWidth: current.width / 2, kind: "path" as const, points: current.points },
    })),
    ...worldOreFieldsNear(context, galaxy, radius + ORE_FIELD_CLEAR_RADIUS, point).map((field) =>
      disc("ore-field", ["rock", "moving"], field, ORE_FIELD_CLEAR_RADIUS),
    ),
  ];
}
