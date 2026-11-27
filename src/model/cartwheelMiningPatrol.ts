import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { MOVING_ROCKS } from "../data/spawnTargets.ts";
import { closestOnSegment } from "./convex.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { ORE_FIELD_CLEAR_RADIUS, type OreField } from "./oreFields.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { SPAWN_GAP } from "./spawner.ts";
import type { FlightState, SpaceObject, Vec } from "./types.ts";
import { type WorldContext, worldDelta, worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export const CARTWHEEL_MINING_PATROL = {
  bypassWidth: 220,
  warningRange: 800,
  warningSeconds: 2.5,
} as const;

const MAX_FIELDS = 8;
const MAX_FIGHTERS = 4;
const APPROACHES = 8;
const BYPASS_TURN = Math.PI / 8;
const MIN_BYPASS_DISTANCE = 950;
const MIN_MEMBER_SPACING = 110;

/** A current footprint. For a moving rock, end is its projected normal path endpoint. */
export interface CartwheelMiningRockPath {
  readonly end?: Vec;
  readonly id: string;
  readonly radius: number;
  readonly start: Vec;
  /** Predicted scenery cannot provide cover. Only ambient spawns can honour a reserved bypass. */
  readonly unspawned?: "ambient" | "fixed";
}

export type CartwheelMiningField = Readonly<Pick<OreField, "guard" | "id" | "x" | "y">>;
type Segment = readonly [Vec, Vec];

export interface CartwheelMiningFighter {
  readonly pursuitRadius: number;
  readonly radius: number;
  /** The actor's full reachable fire envelope from a position, including inherited motion. */
  readonly weaponReach: number;
}

/** One pending ordinary fighter pack, with the existing pack id and member order. */
export interface CartwheelMiningAllocation {
  readonly anchor: Vec;
  readonly fighters: readonly CartwheelMiningFighter[];
  readonly id: string;
}

export interface CartwheelMiningPatrolPlan {
  readonly allocationId: string;
  readonly anchor: Vec;
  readonly approach: Segment;
  readonly bypass: Segment;
  readonly coverIds: readonly string[];
  readonly fieldId: string;
  /** Each actor's placement and pursuit home, in the allocation's member order. */
  readonly homes: readonly Vec[];
}

/** One already-allocated patrol, with its warning recorded in active flight time. */
export interface CartwheelMiningPatrol {
  readonly actors: readonly string[];
  readonly plan: CartwheelMiningPatrolPlan;
  warnedAt?: number;
}

export function cartwheelPatrolAdmits(
  flight: Pick<FlightState, "cartwheelMiningPatrol" | "time">,
  actor: Pick<SpaceObject, "id">,
): boolean {
  const patrol = flight.cartwheelMiningPatrol;
  return (
    !patrol?.actors.includes(actor.id) ||
    (patrol.warnedAt !== undefined &&
      flight.time >= patrol.warnedAt + CARTWHEEL_MINING_PATROL.warningSeconds)
  );
}

/** Returns true once, when flight enters the patrol's warning radius. */
export function warnCartwheelPatrol(flight: FlightState): boolean {
  const patrol = flight.cartwheelMiningPatrol;
  if (
    !patrol ||
    patrol.warnedAt !== undefined ||
    worldDistance(flightWorldContext(flight), flight.player, patrol.plan.anchor) >
      CARTWHEEL_MINING_PATROL.warningRange ||
    !flight.objects.some((actor) => actor.hp > 0 && patrol.actors.includes(actor.id))
  ) {
    return false;
  }
  patrol.warnedAt = flight.time;
  return true;
}

/** Read the represented rocks and the planner's normal straight moving-rock horizon. */
export function cartwheelPatrolRockPaths(
  radiusOf: (object: SpaceObject) => number,
  field: Vec,
  reach: number,
  flight: Pick<FlightState, "objects" | "topology">,
): CartwheelMiningRockPath[] {
  const world = flightWorldContext(flight);
  const result: CartwheelMiningRockPath[] = [];
  for (const object of flight.objects) {
    const moving = object.kind === "debris" && object.id.startsWith(MOVING_ROCK_PREFIX);
    if (object.hp <= 0 || (!moving && object.kind !== "rock")) {
      continue;
    }
    const radius = radiusOf(object) + (object.orbit?.radius ?? 0);
    const start = object.orbit ?? object;
    const velocity = moving ? object.velocity : undefined;
    const distance = velocity ? Math.hypot(velocity.x, velocity.y) * MOVING_ROCKS.pathSeconds : 0;
    if (worldDistance(world, start, field) > reach + radius + distance) {
      continue;
    }
    const end =
      distance && velocity
        ? {
            x: start.x + velocity.x * MOVING_ROCKS.pathSeconds,
            y: start.y + velocity.y * MOVING_ROCKS.pathSeconds,
          }
        : undefined;
    result.push({ id: object.id, radius, start, ...(end ? { end } : {}) });
  }
  return result;
}

export interface CartwheelMiningPatrolContext extends WorldContext {
  /** Check ordinary population admission, actor footprints and required-route/site clearance. */
  readonly admits: (plan: CartwheelMiningPatrolPlan) => boolean;
  /** Omit a spent, active or unavailable allocation. The planner does not allocate actors. */
  readonly allocation?: CartwheelMiningAllocation;
  /** Existing eligible seeded fields in the caller's preference order. */
  readonly fieldIsClear: (field: CartwheelMiningField) => boolean;
  readonly fields: readonly CartwheelMiningField[];
  readonly hubKnown: boolean;
  /** All existing rock footprints whose normal projected paths can reach the sampled disc. */
  readonly rocksNear: (
    field: CartwheelMiningField,
    radius: number,
  ) => readonly CartwheelMiningRockPath[];
}

type Rejection = "guarded" | "required-site" | "cover" | "occupied" | "bypass" | "admission";
export type CartwheelMiningPatrolResult =
  | { readonly plan: CartwheelMiningPatrolPlan; readonly status: "planned" }
  | { readonly status: "hub-unknown" | "no-allocation" }
  | {
      readonly rejected: readonly { readonly fieldId: string; readonly reason: Rejection }[];
      readonly status: "no-placement";
    };

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const times = (a: Vec, scale: number): Vec => ({ x: a.x * scale, y: a.y * scale });
const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
const fromSegment = (p: Vec, path: Segment): number => distance(p, closestOnSegment(p, ...path));

function pathsWithin(a: Segment, b: Segment, radius: number): boolean {
  const [start, end] = a;
  const [from, to] = b;
  if (
    Math.max(start.x, end.x) + radius < Math.min(from.x, to.x) ||
    Math.max(from.x, to.x) + radius < Math.min(start.x, end.x) ||
    Math.max(start.y, end.y) + radius < Math.min(from.y, to.y) ||
    Math.max(from.y, to.y) + radius < Math.min(start.y, end.y)
  ) {
    return false;
  }
  const side = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (side(...a, b[0]) * side(...a, b[1]) < 0 && side(...b, a[0]) * side(...b, a[1]) < 0) {
    return true;
  }
  return (
    a.some((point) => fromSegment(point, b) < radius) ||
    b.some((point) => fromSegment(point, a) < radius)
  );
}

function* bypassCandidates(
  bearing: number,
  homes: readonly Vec[],
  threats: readonly number[],
  fieldRadius: number,
  halfWidth: number,
): Iterable<Segment> {
  for (const turn of [0, BYPASS_TURN / 2, -BYPASS_TURN / 2, BYPASS_TURN, -BYPASS_TURN]) {
    const normal = { x: Math.cos(bearing + turn), y: Math.sin(bearing + turn) };
    const span = times({ x: -normal.y, y: normal.x }, fieldRadius);
    const first = Math.max(
      MIN_BYPASS_DISTANCE + halfWidth,
      ...homes.map(
        (home, member) =>
          threats[member]! + halfWidth + SPAWN_GAP - (home.x * normal.x + home.y * normal.y),
      ),
    );
    for (const extra of [0, fieldRadius, 2 * fieldRadius, 3 * fieldRadius, 4 * fieldRadius]) {
      const centre = times(normal, -(first + extra));
      for (const along of [0, -1, 1]) {
        yield [add(centre, times(span, along - 1)), add(centre, times(span, along + 1))];
      }
    }
  }
}

/** Choose one patrol without modifying flight, the allocation or any scenery. */
export function planCartwheelMiningPatrol(
  context: CartwheelMiningPatrolContext,
): CartwheelMiningPatrolResult {
  if (!context.hubKnown) {
    return { status: "hub-unknown" };
  }
  const allocation = context.allocation;
  if (!allocation || allocation.fighters.length < 1 || allocation.fighters.length > MAX_FIGHTERS) {
    return { status: "no-allocation" };
  }
  const fighters = allocation.fighters;
  const maxRadius = Math.max(...fighters.map(({ radius }) => radius));
  const spacing = Math.max(MIN_MEMBER_SPACING, 2 * maxRadius + SPAWN_GAP);
  const threats = fighters.map(
    ({ pursuitRadius, radius, weaponReach }) => pursuitRadius + radius + weaponReach,
  );
  const halfWidth = CARTWHEEL_MINING_PATROL.bypassWidth / 2;
  const reach = ORE_FIELD_CLEAR_RADIUS + CARTWHEEL_MINING_PATROL.warningRange;
  const fieldRadius = ORE_FIELDS.diameter / 2;
  const flank = ((fighters.length - 1) * spacing) / 2;
  const homeProjection =
    ORE_FIELD_CLEAR_RADIUS * Math.cos(BYPASS_TURN) - flank * Math.sin(BYPASS_TURN);
  const maxBypass = Math.max(
    MIN_BYPASS_DISTANCE + halfWidth,
    Math.max(...threats) + halfWidth + SPAWN_GAP - homeProjection,
  );
  const sampleRadius = Math.max(
    reach,
    Math.hypot(ORE_FIELD_CLEAR_RADIUS + 2 * MIN_MEMBER_SPACING + spacing / 2, flank) +
      maxRadius +
      SPAWN_GAP,
    Math.hypot(maxBypass + 4 * fieldRadius, 2 * fieldRadius) + halfWidth,
  );
  const rejected: { fieldId: string; reason: Rejection }[] = [];
  if (context.worldSide !== undefined && sampleRadius >= context.worldSide / 2) {
    return { rejected, status: "no-placement" };
  }
  for (const field of context.fields.slice(0, MAX_FIELDS)) {
    if (field.guard !== null) {
      rejected.push({ fieldId: field.id, reason: "guarded" });
      continue;
    }
    if (!context.fieldIsClear(field)) {
      rejected.push({ fieldId: field.id, reason: "required-site" });
      continue;
    }
    const rocks = context
      .rocksNear(field, sampleRadius)
      .map(({ end, id, radius, start, unspawned }) => {
        const from = worldDelta(context, field, start);
        const to = end ? add(from, worldDelta(context, start, end)) : from;
        const path: Segment = [from, to];
        return { id, path, radius, unspawned };
      });
    const towardPack = worldDelta(context, field, allocation.anchor);
    const bearing = Math.atan2(towardPack.y, towardPack.x);
    const reasons = new Set<Rejection>();
    const world = (point: Vec) => {
      const at = add(field, point);
      return context.worldSide === undefined ? at : wrapPoint(context.worldSide, at);
    };
    // Try the allocation's bearing first, then the fixed compass bearings.
    const bearings = Array.from(
      { length: APPROACHES },
      (_, index) => (index * 2 * Math.PI) / APPROACHES,
    );
    for (const angle of [...bearings.map((turn) => bearing + turn), ...bearings]) {
      const axis = { x: Math.cos(angle), y: Math.sin(angle) };
      const across = { x: -axis.y, y: axis.x };
      const anchor = times(axis, ORE_FIELD_CLEAR_RADIUS);
      const approach: Segment = [anchor, times(axis, reach)];
      const coverIds = [
        ...new Set(
          rocks
            .filter(
              ({ path, radius, unspawned }) =>
                !unspawned && distance(...path) > 0 && pathsWithin(approach, path, radius),
            )
            .map(({ id }) => id),
        ),
      ].sort();
      if (coverIds.length < 2) {
        reasons.add("cover");
        continue;
      }
      // Keep the same approach while trying every clear staggered formation.
      const formations = [0, MIN_MEMBER_SPACING, 2 * MIN_MEMBER_SPACING]
        .map((offset) => {
          const centre = add(anchor, times(axis, offset));
          return {
            centre,
            homes: fighters.map((_, member) =>
              add(
                add(centre, times(across, (member - (fighters.length - 1) / 2) * spacing)),
                times(axis, ((member % 2) * spacing) / 2),
              ),
            ),
          };
        })
        .filter(
          ({ homes }) =>
            !homes.some((home, member) =>
              rocks.some(
                ({ path, radius }) =>
                  distance(home, path[0]) < radius + fighters[member]!.radius + SPAWN_GAP,
              ),
            ),
        );
      if (formations.length === 0) {
        reasons.add("occupied");
        continue;
      }
      for (const { centre, homes } of formations) {
        for (const bypass of bypassCandidates(angle, homes, threats, fieldRadius, halfWidth)) {
          if (
            homes.some(
              (home, member) => fromSegment(home, bypass) < threats[member]! + halfWidth,
            ) ||
            rocks.some(
              ({ path, radius, unspawned }) =>
                unspawned !== "ambient" && pathsWithin(bypass, path, halfWidth + radius),
            )
          ) {
            reasons.add("bypass");
            continue;
          }
          const plan: CartwheelMiningPatrolPlan = {
            allocationId: allocation.id,
            anchor: world(centre),
            approach: [world(approach[0]), world(approach[1])],
            bypass: [world(bypass[0]), world(bypass[1])],
            coverIds,
            fieldId: field.id,
            homes: homes.map(world),
          };
          if (context.admits(plan)) {
            return { plan, status: "planned" };
          }
          reasons.add("admission");
        }
      }
    }
    for (const reason of reasons) {
      rejected.push({ fieldId: field.id, reason });
    }
  }
  return { rejected, status: "no-placement" };
}
