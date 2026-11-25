import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import { ASTEROID_FIELDS } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import {
  encounterRate,
  enemyEncounterTuning,
  escortTuning,
  FRIGATE_ESCORT_COUNT,
} from "../data/enemyCatalog.ts";
import { classSpacingRadius, spacingRadius } from "../data/enemySpacing.ts";
import { byPosition, ROUTE_POSITION } from "../data/galaxies.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import { PROCEDURAL_POIS } from "../data/proceduralPois.ts";
import {
  FIGHTER_GROUP_TARGET,
  HOSTILE_LOCAL_ALLOWANCE,
  SPAWNER_POLICIES,
  SWARM_GROUP_MINIMUM,
} from "../data/spawnerCatalog.ts";
import {
  ENEMY_DENSITY_FACTORS,
  type EnemyGroupTargets,
  LATTICE_OCCUPANCY,
  MOVING_ROCKS,
  SLOT_ROCKS_PER_AREA,
  SPAWN_AREA_CHUNKS,
  SPAWN_BLEND_WIDTH,
  SPAWN_TARGETS,
} from "../data/spawnTargets.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ASTEROID_SHAPES, placementRadius } from "./asteroids.ts";
import { worldCurrentsNear } from "./currents.ts";
import { ambientPackId, packMemberId } from "./geography.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import { landmarkSites } from "./landmarks.ts";
import { ORE_FIELD_CLEAR_RADIUS, worldOreFieldsNear } from "./oreFields.ts";
import { proceduralPoisNear } from "./proceduralPois.ts";
import { SPAWN_GAP, worldFitsEncounter } from "./spawner.ts";
import {
  enemyGroupReach,
  type EnemyTarget,
  type ExclusionZone,
  type SpawnBand,
  type SpawnRegion,
  type SpawnRules,
  type SpawnShape,
} from "./spawnPlanner.ts";
import { worldStationsNear } from "./stations.ts";
import type { Vec } from "./types.ts";
import type { WorldCellContext } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

const MOVING_KIND = "moving-rock";
/**
 * Planner search effort by pass: candidate positions per slot or feature rock, velocities per
 * chosen moving rock and anchors per enemy group, each before the spawn is dropped.
 */
const PLACEMENT_TRIES = { enemies: 24, moving: 24, rocks: 48 } as const;
/** Region site kind that Cartwheel's claim jumpers gather beside. */
export const ORE_FIELD_SITE = "ore-field";

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
 * Footprints, member spacing and escort rings follow each design's spacing radius.
 */
function enemyTargets(
  galaxy: GalaxyNumber,
  stageIndex: number,
  densities: EnemyGroupTargets,
): EnemyTarget[] {
  const policy = SPAWNER_POLICIES[galaxy];
  const stage = policy.stages[stageIndex]!;
  const position = ROUTE_POSITION[galaxy];
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
      if (worldFitsEncounter({}, policy, stage, position, [], { x: 0, y: 0 }, plan)) {
        counts.push(count);
      }
    }
    if (!counts.length) {
      return [];
    }
    const hull = classSpacingRadius(position, entry.archetype);
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
              radius: spacingRadius(position, { archetype: escorts.archetype }),
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
      // Each member's ship id, and so its hull, follows from its pack's chunk and its index.
      memberRadius: (chunk, member) =>
        spacingRadius(position, {
          archetype: entry.archetype,
          id: packMemberId(ambientPackId(chunk), member),
        }),
      radius: hull,
      ...(flexible ? { smallest: least } : {}),
      spacing: policy.memberSpacing,
      tries: PLACEMENT_TRIES.enemies,
    };
    return [target];
  });
}

/**
 * The spawn target catalog as planner rules (gameplay/rules.md "Spawn targets"): enemy groups
 * first, then feature and slot rocks, all ordinary asteroids, then moving rocks chosen from them.
 * Slot rocks follow their rule in every region; Large-only features, moving rocks and enemy groups
 * follow the table. Enemy groups sit on the encounter lattice, one seeded anchor per occupied
 * cell (at the galaxy's cell occupancy) with the kind drawn by the table's densities, and keep the
 * quiet distance over the root of the encounter rate apart. Salvage sites, among the world's
 * exclusion zones, come first. Densities count per open area and blend across the region
 * boundaries; budgets and archetype limits switch at the boundaries.
 */
export function spawnRules(galaxy: GalaxyNumber, worldSide?: number): SpawnRules {
  const field = byPosition(ASTEROID_FIELDS, galaxy);
  const policy = SPAWNER_POLICIES[galaxy];
  const bands: SpawnBand[] = policy.stages.map((stage, index) => {
    const targets = SPAWN_TARGETS[galaxy][index]!;
    return {
      admission: { archetypes: stage.maxNearbyArchetypes, cap: stage.localCap },
      enemies: enemyTargets(galaxy, index, targets.enemies),
      from: stage.centerDistance,
      moving: [
        {
          cluster: MOVING_ROCKS.cluster,
          density: targets.moving / SPAWN_AREA_CHUNKS,
          from: ["rock-feature", "rock"],
          kind: MOVING_KIND,
          path: MOVING_ROCKS.pathSeconds,
          speed: MOVING_ROCKS.speed,
          tries: PLACEMENT_TRIES.moving,
        },
      ],
      rocks: [
        {
          density: targets.features / SPAWN_AREA_CHUNKS,
          kind: "rock-feature",
          shapes: sized({ large: 1 }),
          tries: PLACEMENT_TRIES.rocks,
        },
        {
          density: SLOT_ROCKS_PER_AREA / SPAWN_AREA_CHUNKS,
          kind: "rock",
          shapes: sized(field.slotSizes),
          tries: PLACEMENT_TRIES.rocks,
        },
      ],
    };
  });
  return {
    admission: {
      allowance: HOSTILE_LOCAL_ALLOWANCE,
      capital: "capital",
      maxCapitals: policy.maxNearbyCapitals,
    },
    bands,
    blend: SPAWN_BLEND_WIDTH,
    chunkSize: tuning.chunkSize,
    corridor: flight.shipRadius + flight.shipRadius,
    gap: SPAWN_GAP,
    lattice: {
      cell: encounterLatticeSpacing(galaxy) * tuning.chunkSize,
      occupancy: LATTICE_OCCUPANCY * ENEMY_DENSITY_FACTORS[galaxy],
      spacing: enemyEncounterTuning.quietDistance / Math.sqrt(encounterRate(galaxy)),
    },
    openArea: true,
    order: ["enemies", "rocks", "moving"],
    search: tuning.chunkSize / 2,
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
 * station exclusion zones, quantum and launch arrivals (an arrival clearance for rocks, the calm radius
 * for enemies), landmark charting ranges, currents, ore fields, salvage sites and hostile station
 * sites. A salvage site's disabled frigate and a hostile station keep rocks the spawn gap from
 * their footprint and enemy groups out of their local admission neighbourhood, so their sites
 * are planned before them. Exclusion zones and arrival clearances also bound moving rocks'
 * paths, since they absorb moving rocks. Flight-state zones (the player, story destinations,
 * required routes and the Needle channel) are the caller's.
 */
export function worldSpawnExclusions(
  context: WorldCellContext,
  galaxy: GalaxyNumber,
  seed: number,
  arrivals: readonly Vec[],
  radius: number,
  point: Vec,
): ExclusionZone[] {
  const position = ROUTE_POSITION[galaxy];
  const local = 2 * SPAWNER_POLICIES[galaxy].localRadius;
  // A salvage site's disabled frigate: its footprint is its galaxy's frigate design.
  const wreck = spacingRadius(position, { archetype: "frigate" });
  const neighbourhood = local + wreck;
  const station = spacingRadius(position, { archetype: "hostileStation" });
  const stationReach = radius + local + station;
  const near = (at: Vec, reach: number) =>
    (context.worldSide === undefined
      ? Math.hypot(at.x - point.x, at.y - point.y)
      : wrappedDistance(context.worldSide, at, point)) <=
    radius + reach;
  const stationZone = ECONOMY.station.exclusionRadius;
  return [
    ...worldStationsNear(context, ECONOMY, galaxy, radius + stationZone, point).map((station) =>
      disc("exclusion", ["rock", "moving", "path", "enemy"], station, stationZone),
    ),
    ...arrivals.flatMap((arrival) => [
      ...(near(arrival, tuning.exclusionRadius)
        ? [disc("arrival-clearance", ["rock", "moving", "path"], arrival, tuning.exclusionRadius)]
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
    ...proceduralPoisNear(
      { ...context, opportunityEligibility: { jobTemplates: [] } },
      galaxy,
      seed,
      Math.min(PROCEDURAL_POIS.maxQueryRadius, radius + neighbourhood),
      point,
    )
      .filter((site) => site.opportunity.kind === "salvage")
      .flatMap((site) => [
        // Rocks keep the spawn gap from the wreck's footprint.
        disc("salvage", ["rock", "moving"], site, wreck + SPAWN_GAP),
        disc("salvage", ["enemy"], site, neighbourhood),
      ]),
    ...hostileStationSites(
      { ...context, galaxy, geographySeed: seed },
      {
        height: 2 * stationReach,
        width: 2 * stationReach,
        x: point.x - stationReach,
        y: point.y - stationReach,
      },
    )
      .filter((site) => near(site, local + station))
      .flatMap((site) => [
        // Rocks keep the spawn gap from the station's footprint.
        disc("hostile-station", ["rock", "moving"], site, station + SPAWN_GAP),
        disc("hostile-station", ["enemy"], site, local + station),
      ]),
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

/**
 * Chunks around a planned chunk whose enemy groups are planned with it, uncounted: every group
 * whose footprint plus the gap can reach the chunk anchors within them.
 */
export function spawnMargin(rules: SpawnRules): number {
  return Math.ceil((enemyGroupReach(rules) + rules.gap) / rules.chunkSize);
}

/**
 * One chunk's planning region: the chunk itself, with the enemy groups of the margin around it
 * planned first, so its rocks leave their space. Rocks and moving rocks are planned in the
 * chunk alone; lanes keep every static rock inside its chunk, so no rock meets a neighbour's.
 * The region is a function of the chunk, its zones and sites, so a chunk plans the same
 * content whichever neighbour loads it.
 */
export function chunkSpawnRegion(
  rules: SpawnRules,
  exclusions: readonly ExclusionZone[],
  sites: Readonly<Record<string, readonly Vec[]>>,
  cell: Vec,
): SpawnRegion {
  const margin = spawnMargin(rules);
  return {
    cell: { x: cell.x - margin, y: cell.y - margin },
    columns: 2 * margin + 1,
    exclusions,
    report: { cell, columns: 1, neighbours: ["enemies"], rows: 1 },
    rows: 2 * margin + 1,
    sites,
  };
}

/**
 * World units from a chunk's centre that its planning region, every group in it and every
 * moving rock's checked path reach, so a chunk's zones include every one a path can meet.
 */
export function chunkSpawnReach(rules: SpawnRules): number {
  const rock = Math.max(
    0,
    ...rules.bands.flatMap((band) =>
      band.rocks.flatMap((target) => target.shapes.map((shape) => shape.radius)),
    ),
  );
  const path = Math.max(
    0,
    ...rules.bands.flatMap((band) =>
      band.moving.map((target) => (target.path ?? 0) * target.speed[1]),
    ),
  );
  return Math.max(
    (spawnMargin(rules) + 0.5) * rules.chunkSize * Math.SQRT2 + enemyGroupReach(rules),
    (rules.chunkSize * Math.SQRT2) / 2 + path + rock,
  );
}

/** The farthest any gathering group looks for a site from its seeded anchor. */
export function spawnGatherReach(rules: SpawnRules): number {
  return Math.max(
    0,
    ...rules.bands.flatMap((band) => band.enemies.map((target) => target.gather?.reach ?? 0)),
  );
}
