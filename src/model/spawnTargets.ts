import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import { ASTEROID_FIELDS } from "../data/chunkCatalog.ts";
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
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { RESOURCE_ROCKS } from "../data/resourceRocks.ts";
import {
  FIGHTER_GROUP_TARGET,
  HOSTILE_LOCAL_ALLOWANCE,
  SPAWNER_POLICIES,
  SWARM_GROUP_MINIMUM,
} from "../data/spawnerCatalog.ts";
import {
  type EnemyGroupTargets,
  MOVING_ROCKS_PER_ENCOUNTER_RATE,
  SLOT_ROCKS_PER_AREA,
  SPAWN_AREA_CHUNKS,
  SPAWN_BLEND_WIDTH,
  SPAWN_TARGETS,
} from "../data/spawnTargets.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ASTEROID_SHAPES, placementRadius } from "./asteroids.ts";
import { BALLISTIC_REQUEST, originalEncounterRate } from "./ballisticAsteroids.ts";
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
/** Flight's encounter director leaves one encounter lattice cell in four vacant. */
const ENCOUNTER_OCCUPANCY = 0.75;
/** Region site kind that Cartwheel's claim jumpers gather beside. */
export const ORE_FIELD_SITE = "ore-field";
/**
 * Seconds of a moving rock's straight path checked against launch, arrival and protected areas,
 * which absorb moving rocks that reach them.
 */
export const MOVING_PATH_SECONDS = 30;

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
export function encounterLatticeSpacing(galaxy: GalaxyNumber): number {
  return (
    Math.max(3, Math.ceil(enemyEncounterTuning.quietDistance / tuning.chunkSize)) /
    Math.sqrt(encounterRate(galaxy))
  );
}

/**
 * One band's enemy targets: the table's group densities, with group shapes from the spawner
 * stage's roster. Flexible fighters and swarms draw their largest size in empty space and shrink
 * to their minimum to fit the local budget; other entries draw uniformly over their sizes that fit
 * empty space and stay whole. Cartwheel's fighters gather beside ore fields at the jumper share.
 */
function enemyTargets(
  galaxy: GalaxyNumber,
  stageIndex: number,
  densities: EnemyGroupTargets,
): EnemyTarget[] {
  const policy = SPAWNER_POLICIES[galaxy];
  const stage = policy.stages[stageIndex]!;
  return stage.roster.flatMap((entry) => {
    const density = densities[entry.archetype as keyof EnemyGroupTargets] ?? 0;
    if (entry.weight <= 0 || density <= 0) {
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
    if (!counts.length) {
      return [];
    }
    const hull = enemyCatalog[entry.archetype].sizeRatio * flight.shipRadius;
    const escorts =
      entry.archetype === "frigate"
        ? { archetype: "fighter" as const, perLeader: FRIGATE_ESCORT_COUNT }
        : entry.escorts
          ? { archetype: entry.escorts.archetype, perLeader: entry.escorts.count }
          : undefined;
    const gathers = ORE_FIELDS.galaxies.includes(galaxy) && entry.archetype === "fighter";
    const target: EnemyTarget = {
      density: density / SPAWN_AREA_CHUNKS,
      ...(escorts
        ? {
            escorts: {
              archetype: escorts.archetype,
              kind: `${entry.archetype}-escort`,
              perLeader: escorts.perLeader,
              radius: enemyCatalog[escorts.archetype].sizeRatio * flight.shipRadius,
              ring: hull + escortTuning.stationGap,
            },
          }
        : {}),
      ...(gathers
        ? {
            gather: {
              distance: ORE_FIELDS.diameter / 2,
              reach: (encounterLatticeSpacing(galaxy) * tuning.chunkSize) / 2,
              share: ORE_FIELDS.jumperShare,
              site: ORE_FIELD_SITE,
            },
          }
        : {}),
      groupSize: flexible ? [counts.at(-1)!, counts.at(-1)!] : [counts[0]!, counts.at(-1)!],
      kind: entry.archetype,
      radius: hull,
      ...(flexible ? { smallest: least } : {}),
      spacing: policy.memberSpacing,
    };
    return [target];
  });
}

/**
 * The spawn target catalog as planner rules (gameplay/rules.md "Spawn targets"): enemy groups
 * first, then feature, slot and resource rocks, then moving rocks chosen from placed feature and
 * slot rocks. Slot rocks and moving rocks follow their rules in every region (moving rocks scale
 * with the original encounter rate); resources, Large-only features and enemy groups follow the
 * table by region. Enemy groups sit on the encounter lattice, one seeded anchor per occupied
 * cell with the kind drawn by the table's densities, and keep the quiet distance over the root of
 * the encounter rate apart. Densities count per open area and blend across the region
 * boundaries; budgets and archetype limits switch at the boundaries.
 */
export function spawnRules(galaxy: GalaxyNumber, worldSide?: number): SpawnRules {
  const field = byPosition(ASTEROID_FIELDS, galaxy);
  const large = 1 / RESOURCE_ROCKS.largeEvery;
  const policy = SPAWNER_POLICIES[galaxy];
  const moving = [
    {
      density:
        (MOVING_ROCKS_PER_ENCOUNTER_RATE * originalEncounterRate(galaxy)) / SPAWN_AREA_CHUNKS,
      from: ["rock-feature", "rock"],
      groupShare: BALLISTIC_REQUEST.groupShare,
      kind: MOVING_KIND,
      path: MOVING_PATH_SECONDS,
      speed: BALLISTIC_REQUEST.speed,
    },
  ];
  const bands: SpawnBand[] = policy.stages.map((stage, index) => {
    const targets = SPAWN_TARGETS[galaxy][index]!;
    return {
      admission: { archetypes: stage.maxNearbyArchetypes, cap: stage.localCap },
      enemies: enemyTargets(galaxy, index, targets.enemies),
      from: stage.centerDistance,
      moving,
      rocks: [
        {
          density: targets.features / SPAWN_AREA_CHUNKS,
          kind: "rock-feature",
          shapes: sized({ large: 1 }),
        },
        {
          density: SLOT_ROCKS_PER_AREA / SPAWN_AREA_CHUNKS,
          kind: "rock",
          shapes: sized(field.slotSizes),
        },
        {
          density: targets.resources / SPAWN_AREA_CHUNKS,
          kind: "resource",
          shapes: sized({ large, medium: 1 - large }),
        },
      ],
    };
  });
  return {
    admission: {
      allowance: HOSTILE_LOCAL_ALLOWANCE,
      capital: "capital",
      localRadius: policy.localRadius,
      maxNearbyCapitals: policy.maxNearbyCapitals,
    },
    bands,
    blend: SPAWN_BLEND_WIDTH,
    chunkSize: tuning.chunkSize,
    corridor: flight.shipRadius + flight.shipRadius,
    gap: 2 * flight.shipRadius,
    lattice: {
      cell: encounterLatticeSpacing(galaxy) * tuning.chunkSize,
      occupancy: ENCOUNTER_OCCUPANCY,
      spacing: enemyEncounterTuning.quietDistance / Math.sqrt(encounterRate(galaxy)),
    },
    openArea: true,
    order: ["enemies", "rocks", "moving"],
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
 * for enemies), landmark charting ranges, currents and ore fields. Protected areas and arrival
 * safe radii also bound moving rocks' paths, since they absorb moving rocks. Flight-state zones
 * (the player, story destinations, required routes and the Needle channel) are the caller's.
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
      disc("protected", ["rock", "moving", "path", "enemy"], station, stationSafe),
    ),
    ...arrivals.flatMap((arrival) => [
      ...(near(arrival, tuning.safeRadius)
        ? [disc("arrival-safe", ["rock", "moving", "path"], arrival, tuning.safeRadius)]
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

/** The seeded world's ore field centres within `radius` of a point, as gathering sites. */
export function worldSpawnSites(
  context: WorldCellContext,
  galaxy: GalaxyNumber,
  radius: number,
  point: Vec,
): Readonly<Record<string, readonly Vec[]>> {
  return {
    [ORE_FIELD_SITE]: worldOreFieldsNear(context, galaxy, radius, point).map(({ x, y }) => ({
      x,
      y,
    })),
  };
}
