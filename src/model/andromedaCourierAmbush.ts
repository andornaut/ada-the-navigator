import { ECONOMY } from "../data/economy.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { classSpacingRadius, spacingRadius } from "../data/enemySpacing.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import type { Vec } from "../data/types.ts";
import {
  type CourierAmbushAttempt,
  type CourierAmbushPair,
  type CourierAmbushPlan,
  type CourierAmbushState,
  FIRST_RELEASE,
  LAST_PURSUIT,
  type LegIdentity,
  PATH_HALF_WIDTH,
} from "./andromedaState.ts";
import { ASTEROID_SHAPES, placementRadius, silhouetteWorldReach } from "./asteroids.ts";
import { closestOnSegment } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { rollEnemyWeaponLevel } from "./enemyEquipment.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { hostileStationContext } from "./hostileStations/placement.ts";
import { settlementById } from "./legacySettlements.ts";
import { SPAWN_GAP, worldFitsEncounter, worldSpawnerStage } from "./spawner.ts";
import type { ExclusionZone } from "./spawnPlanner.ts";
import { stationFormationClear, type StationPlacementContext } from "./stationPlacement.ts";
import { flightStationContext, worldStationById } from "./stations.ts";
import type { FlightState, GalaxyProgress, SpaceObject } from "./types.ts";
import {
  flightEncounterSeed,
  flightWorldContext,
  periodicWorldGrid,
  worldCellKey,
  worldCellsNear,
  type WorldContext,
  worldDelta,
  worldDistance,
  worldPoint,
  wrapPoint,
} from "./world/index.ts";

const WARNING_OFFSET = 525;
const WARNING_HALF_WIDTH = 180;
const EXIT_OFFSET = 450;
const PAIR_FORWARD = 60;
const PAIR_SIDE = 260;
const MEMBER_SPACING = 110;
const SECOND_RELEASE = 4.2;
let maxSceneryReach: number | undefined;

interface CourierAmbushPlacement extends WorldContext {
  /** Authored hull clearance can require a larger gap than the baseline member spacing. */
  readonly memberSpacing?: number;
}

/** Author geometry from the retained chapter leg before admitting any actor. */
export function planCourierAmbush(
  context: CourierAmbushPlacement,
  leg: { readonly station: Vec; readonly settlement: Vec },
): CourierAmbushPlan | null {
  const { settlement, station } = leg;
  const delta = worldDelta(context, station, settlement);
  const length = Math.hypot(delta.x, delta.y);
  const spacing = context.memberSpacing ?? MEMBER_SPACING;
  if (!Number.isFinite(length) || length / 2 < WARNING_OFFSET || !Number.isFinite(spacing)) {
    return null;
  }
  const forward = { x: delta.x / length, y: delta.y / length };
  const at = (along: number, lateral = 0): Vec => {
    const distance = length / 2 + along;
    const point = {
      x: station.x + forward.x * distance - forward.y * lateral,
      y: station.y + forward.y * distance + forward.x * lateral,
    };
    return context.worldSide === undefined ? point : wrapPoint(context.worldSide, point);
  };
  const halfGap = Math.max(MEMBER_SPACING, spacing) / 2;
  const pair = (lateral: number): CourierAmbushPair => ({
    centre: at(PAIR_FORWARD, lateral),
    members: [at(PAIR_FORWARD - halfGap, lateral), at(PAIR_FORWARD + halfGap, lateral)],
  });
  const warning = at(-WARNING_OFFSET);
  return {
    escape: { from: warning, halfWidth: PATH_HALF_WIDTH, to: at(EXIT_OFFSET) },
    forward,
    pairs: [pair(PAIR_SIDE), pair(-PAIR_SIDE)],
    warning,
  };
}

interface CourierAmbushStep extends WorldContext {
  readonly previous: Vec;
  readonly player: Vec;
  /** Only live flight supplies elapsed time. */
  readonly seconds: number;
}

function crossed(
  context: CourierAmbushStep,
  forward: Vec,
  centre: Vec,
  halfWidth: number,
): boolean {
  const start = worldDelta(context, centre, context.previous);
  const movement = worldDelta(context, context.previous, context.player);
  const before = start.x * forward.x + start.y * forward.y;
  const advance = movement.x * forward.x + movement.y * forward.y;
  if (before >= 0 || before + advance < 0) {
    return false;
  }
  const at = -before / advance;
  const x = start.x + at * movement.x;
  const y = start.y + at * movement.y;
  return Math.abs(y * forward.x - x * forward.y) <= halfWidth;
}

/** Advance one live step. The warning starts at zero, without charging time before the crossing. */
export function stepCourierAmbush(
  context: CourierAmbushStep,
  plan: CourierAmbushPlan,
  state: CourierAmbushState,
): CourierAmbushState {
  if (
    state.phase === "ended" ||
    (state.phase === "armed" && !crossed(context, plan.forward, plan.warning, WARNING_HALF_WIDTH))
  ) {
    return state;
  }
  const elapsed = state.phase === "warned" ? state.elapsed + context.seconds : 0;
  if (elapsed >= LAST_PURSUIT || crossed(context, plan.forward, plan.escape.to, PATH_HALF_WIDTH)) {
    return { phase: "ended" };
  }
  return { elapsed, phase: "warned" };
}

/** Releases the pairs in placement order, and permits neither pair to pursue after the exit. */
export function releasedCourierPairs(state: CourierAmbushState): 0 | 1 | 2 {
  if (state.phase !== "warned" || state.elapsed < FIRST_RELEASE) {
    return 0;
  }
  return state.elapsed < SECOND_RELEASE ? 1 : 2;
}

export const COURIER_AMBUSH_ID = "andromeda:courier-ambush";
const STAGE = 4;
const GALAXY = 5;
const FIGHTERS = [
  [`${COURIER_AMBUSH_ID}:fighter:0`, `${COURIER_AMBUSH_ID}:fighter:1`],
  [`${COURIER_AMBUSH_ID}:fighter:2`, `${COURIER_AMBUSH_ID}:fighter:3`],
] as const;
const PACKS = [`${COURIER_AMBUSH_ID}:pair:0`, `${COURIER_AMBUSH_ID}:pair:1`] as const;

export interface CourierAmbushLeg {
  readonly station: Vec & { readonly id: string };
  readonly settlement: Vec & { readonly id: string };
}

/** Read the actual chapter sites, including dormant positions, without selecting another route. */
export function courierAmbushLeg(
  flight: FlightState,
  progress: Pick<GalaxyProgress, "andromeda" | "stage">,
): CourierAmbushLeg | undefined {
  if (flight.galaxy !== GALAXY || progress.stage !== STAGE) {
    return undefined;
  }
  const { settlement, station } = progress.andromeda ?? {};
  if (!station || !settlement) {
    return undefined;
  }
  const from =
    flight.objects.find((object) => object.id === station && object.kind === "station") ??
    flight.world.notables[station] ??
    worldStationById(flightStationContext(flight), ECONOMY, GALAXY, station);
  const to =
    flight.objects.find((object) => object.id === settlement && object.kind === "destination") ??
    flight.world.notables[settlement] ??
    settlementById(ECONOMY, settlement);
  return from && to ? { settlement: to, station: from } : undefined;
}

interface CourierAmbushAdmission extends StationPlacementContext {
  /** The stage-4 story targets have already been resolved from the retained IDs. */
  readonly stage: number;
  /** Check both pairs and the escape against planned geometry beyond represented objects. */
  readonly plannedClear: (plan: CourierAmbushPlan) => boolean;
}

export type CourierAmbushAllocation =
  | {
      readonly attempt: LegIdentity & { readonly state: { readonly phase: "skipped" } };
      readonly actors: readonly [];
    }
  | {
      readonly attempt: LegIdentity & {
        readonly plan: CourierAmbushPlan;
        readonly state: { readonly phase: "armed" };
      };
      readonly actors: readonly [SpaceObject, SpaceObject, SpaceObject, SpaceObject];
      /** Two AI pairs paid for by the same four-fighter population admission. */
      readonly packs: readonly [(typeof PACKS)[0], (typeof PACKS)[1]];
    };

function makePair(
  { content, flight }: StationPlacementContext,
  members: CourierAmbushPair["members"],
  pair: 0 | 1,
): [SpaceObject, SpaceObject] {
  const make = (index: 0 | 1): SpaceObject => {
    const point = members[index];
    const id = FIGHTERS[pair][index];
    const weaponLevel = rollEnemyWeaponLevel(
      { encounterSeed: flightEncounterSeed(flight), galaxy: GALAXY },
      id,
    );
    const definition = enemyActorDefinition(GALAXY, "fighter", id, weaponLevel);
    return {
      ...point,
      enemy: createEnemy(
        definition,
        { archetype: "fighter", id, packId: PACKS[pair], phase: 0, weaponLevel },
        point,
      ),
      hp: definition.hp,
      id,
      kind: "enemy",
      persistent: true,
      radius: content.tuning.flight.shipRadius * definition.sizeRatio,
    };
  };
  return [make(0), make(1)];
}

function clearOfEscape(
  world: WorldContext,
  escape: CourierAmbushPlan["escape"],
  object: SpaceObject,
): boolean {
  if (object.hp <= 0 || object.kind === "pickup") {
    return true;
  }
  const end = worldPoint(world, escape.from, escape.to);
  const midpoint = { x: (escape.from.x + end.x) / 2, y: (escape.from.y + end.y) / 2 };
  const point = worldPoint(world, midpoint, object);
  const nearest = closestOnSegment(point, escape.from, end);
  const radius = object.enemy
    ? spacingRadius(ROUTE_POSITION[GALAXY], object.enemy)
    : placementRadius(object);
  return Math.hypot(point.x - nearest.x, point.y - nearest.y) >= escape.halfWidth + radius;
}

/** Plan both pairs and their escape without mutating flight. Commit the resulting batch and attempt together. */
export function admitCourierAmbush(
  context: CourierAmbushAdmission,
  leg: CourierAmbushLeg | undefined,
  retained: CourierAmbushAttempt | undefined,
): CourierAmbushAllocation | null {
  const { flight } = context;
  if (retained || flight.galaxy !== GALAXY || context.stage !== STAGE || !leg) {
    return null;
  }
  const identity = { settlement: leg.settlement.id, station: leg.station.id };
  const skipped = { actors: [], attempt: { ...identity, state: { phase: "skipped" } } } as const;
  const world = hostileStationContext(flight);
  const position = ROUTE_POSITION[GALAXY];
  const hullRadius = classSpacingRadius(position, "fighter");
  const population = stationPopulationObjects(flight);
  const policy = SPAWNER_POLICIES[GALAXY];
  const plan = planCourierAmbush({ ...world, memberSpacing: 2 * hullRadius + SPAWN_GAP }, leg);
  if (
    !plan ||
    FIGHTERS.flat().some(
      (id) =>
        Object.hasOwn(flight.world.notables, id) || population.some((object) => object.id === id),
    )
  ) {
    return skipped;
  }
  const { midpoint, reach } = courierFootprint(world, plan);
  const actors = [
    ...makePair(context, plan.pairs[0].members, 0),
    ...makePair(context, plan.pairs[1].members, 1),
  ] as const;
  if (
    !worldFitsEncounter(
      world,
      policy,
      worldSpawnerStage(world, policy, midpoint),
      position,
      population,
      midpoint,
      { archetype: "fighter", count: actors.length },
      reach,
    ) ||
    !stationFormationClear(context, actors) ||
    ![...population, ...actors].every((object) => clearOfEscape(world, plan.escape, object)) ||
    !context.plannedClear(plan)
  ) {
    return skipped;
  }
  return { actors, attempt: { ...identity, plan, state: { phase: "armed" } }, packs: PACKS };
}

function courierFootprint(world: WorldContext, plan: CourierAmbushPlan) {
  const midpoint = {
    x: plan.warning.x + WARNING_OFFSET * plan.forward.x,
    y: plan.warning.y + WARNING_OFFSET * plan.forward.y,
  };
  const members = plan.pairs.flatMap((pair) => pair.members);
  const hull = classSpacingRadius(ROUTE_POSITION[GALAXY], "fighter");
  const reach = Math.max(...members.map((member) => worldDistance(world, midpoint, member))) + hull;
  return { hull, members, midpoint, reach };
}

interface CourierSpawnReservation {
  readonly centre: Vec;
  readonly enemyReach: number;
  readonly sceneryReach: number;
  readonly enemy: ExclusionZone;
  readonly scenery: readonly ExclusionZone[];
}
const spawnReservations = new WeakMap<FlightState, CourierSpawnReservation>();

/** All exclusions apply only to future seeded placement, never to represented objects. */
export function setCourierSpawnReservation(
  flight: FlightState,
  plan: CourierAmbushPlan | undefined,
): void {
  if (!plan) {
    spawnReservations.delete(flight);
    return;
  }
  const world = flightWorldContext(flight);
  const { hull, members, midpoint, reach } = courierFootprint(world, plan);
  const { from, halfWidth, to } = plan.escape;
  const enemyReach = 2 * SPAWNER_POLICIES[GALAXY].localRadius + reach;
  const sceneryReach = Math.max(
    worldDistance(world, midpoint, from) + halfWidth,
    worldDistance(world, midpoint, to) + halfWidth,
    reach + SPAWN_GAP,
  );
  const applies = ["rock", "moving", "path"] as const;
  const scenery: ExclusionZone[] = [
    {
      applies,
      rule: "courier-escape",
      shape: { halfWidth, kind: "path", points: [from, worldPoint(world, from, to)] },
    },
    ...members.map((member) => ({
      applies,
      rule: "courier-formation",
      shape: { ...member, kind: "disc" as const, radius: hull + SPAWN_GAP },
    })),
  ];
  spawnReservations.set(flight, {
    centre: midpoint,
    enemy: {
      applies: ["enemy"],
      rule: "courier-allocation",
      shape: { ...midpoint, kind: "disc", radius: enemyReach },
    },
    enemyReach,
    scenery,
    sceneryReach,
  });
}

export function courierSpawnExclusions(
  flight: FlightState,
  radius: number,
  point: Vec,
): readonly ExclusionZone[] {
  const reservation = spawnReservations.get(flight);
  if (!reservation) {
    return [];
  }
  const distance = worldDistance(flightWorldContext(flight), reservation.centre, point);
  if (distance > radius + reservation.enemyReach) {
    return [];
  }
  return distance <= radius + reservation.sceneryReach
    ? [reservation.enemy, ...reservation.scenery]
    : [reservation.enemy];
}

/** Only offer the ambush where the live seeded terrain has already been represented. */
export function courierAmbushTerrainCovered(
  { content, flight }: Pick<StationPlacementContext, "content" | "flight">,
  plan: CourierAmbushPlan,
): boolean {
  const world = flightWorldContext(flight);
  const { from, halfWidth, to } = plan.escape;
  const end = worldPoint(world, from, to);
  const middle = { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 };
  const members = plan.pairs.flatMap((pair) => pair.members);
  const extent = (point: Vec) => {
    const { x, y } = worldDelta(world, middle, point);
    return Math.max(Math.abs(x), Math.abs(y));
  };
  const hull = classSpacingRadius(ROUTE_POSITION[GALAXY], "fighter");
  maxSceneryReach ??= Math.max(
    ...Array.from(ASTEROID_SHAPES.values(), ({ silhouette }) => silhouetteWorldReach(silhouette)),
  );
  const reach =
    Math.max(extent(from) + halfWidth, ...members.map((point) => extent(point) + hull)) +
    maxSceneryReach;
  const grid = periodicWorldGrid(world, content.tuning.chunkSize);
  const generated = new Set(flight.chunks);
  return Array.from(worldCellsNear(grid, reach, middle)).every((cell) =>
    generated.has(worldCellKey(grid, cell)),
  );
}

/** Unlike a missing active object, a dormant fighter or tombstone still belongs to this flight. */
export function courierAmbushRepresented(flight: FlightState): boolean {
  return FIGHTERS.flat().some(
    (id) =>
      Object.hasOwn(flight.world.notables, id) || flight.objects.some((object) => object.id === id),
  );
}

/** Consume only active-flight steps, or end immediately once Pip's delivery leg advances. */
/** The warning can still be presented before either fighter pair is released. */
export function courierAmbushWarningActive(attempt: CourierAmbushAttempt | undefined): boolean {
  return attempt?.state.phase === "warned" && attempt.state.elapsed < FIRST_RELEASE;
}

export function advanceCourierAmbush(
  context: CourierAmbushStep,
  stage: number,
  attempt: CourierAmbushAttempt,
): { readonly attempt: CourierAmbushAttempt; readonly warning: boolean } {
  if (!("plan" in attempt) || attempt.state.phase === "ended") {
    return { attempt, warning: false };
  }
  const state =
    stage === STAGE
      ? stepCourierAmbush(context, attempt.plan, attempt.state)
      : { phase: "ended" as const };
  return {
    attempt: state === attempt.state ? attempt : { ...attempt, state },
    warning: stage === STAGE && attempt.state.phase === "armed" && state.phase !== "armed",
  };
}

/** Holding and ended actors cannot start an attack or pursue. Other enemy IDs remain unhandled. */
export function courierAmbushActor(
  attempt: CourierAmbushAttempt | undefined,
  id: string,
): "held" | "released" | "ended" | undefined {
  if (!attempt || !("plan" in attempt)) {
    return undefined;
  }
  const pair = FIGHTERS.findIndex((members) => members.some((member) => member === id));
  if (pair < 0) {
    return undefined;
  }
  if (attempt.state.phase === "ended") {
    return "ended";
  }
  return pair < releasedCourierPairs(attempt.state) ? "released" : "held";
}

/** The same planned geometry drives the warning artwork and escape marker. */
export function courierAmbushMarkers(attempt: CourierAmbushAttempt | undefined):
  | (Pick<CourierAmbushPlan, "escape" | "forward" | "warning"> & {
      readonly approaches: readonly [Vec, Vec];
    })
  | null {
  if (attempt?.state.phase !== "warned" || !("plan" in attempt)) {
    return null;
  }
  const { escape, forward, pairs, warning } = attempt.plan;
  return { approaches: [pairs[0].centre, pairs[1].centre], escape, forward, warning };
}
