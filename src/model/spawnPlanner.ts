import {
  chanceRound,
  type Random,
  randomInt,
  randomStream,
  shuffled,
  weightedPick,
} from "@andornaut/game-kit/runtime/random";

import type { Vec } from "./types.ts";
import { periodicWorldGrid, worldCellKey, type WorldGrid } from "./worldCells.ts";
import { nearestImage, wrappedDelta } from "./worldGeometry.ts";

/**
 * What an exclusion zone keeps out: static rocks, rocks chosen to move, enemy ships, or the
 * straight paths moving rocks travel.
 */
export type SpawnCategory = "enemy" | "moving" | "path" | "rock";

/** A rock variant and its footprint radius, drawn by weight. */
export interface SpawnShape {
  readonly id: string;
  readonly radius: number;
  readonly weight: number;
}

/** Static rocks of one kind, as a mean count per chunk. */
export interface RockTarget {
  readonly density: number;
  readonly kind: string;
  readonly shapes: readonly SpawnShape[];
}

/** Moving rocks per chunk, chosen from that chunk's placed rocks of the `from` kinds. */
export interface MovingTarget {
  readonly density: number;
  readonly from: readonly string[];
  /** Share of a chunk's moving rocks, rounded up, that share one velocity when there are two or more. */
  readonly groupShare: number;
  readonly kind: string;
  /**
   * Seconds of straight travel checked against zones that apply to paths; a velocity whose path
   * touches one is redrawn, up to the rules' tries. Absent, paths are not checked.
   */
  readonly path?: number;
  /** Speed range in world units per second; headings are uniform. */
  readonly speed: readonly [number, number];
}

/** Escorts stationed on a ring around each leader of an enemy group. */
export interface EscortTarget {
  /** The escorts' archetype, for the local admission limits. */
  readonly archetype: string;
  readonly kind: string;
  readonly perLeader: number;
  readonly radius: number;
  /**
   * Distance from the leader's centre to each escort's, widened so each escort keeps the gap from
   * its leader and its neighbours on the ring.
   */
  readonly ring: number;
}

/** Some groups gather beside the nearest region site of a named kind, such as an ore field. */
export interface GatherTarget {
  /** Distance from the site's centre to the group's anchor, at a seeded angle. */
  readonly distance: number;
  /** Farthest a site may lie from the group's seeded anchor. */
  readonly reach: number;
  /** Chance that a group with a site in reach gathers there. */
  readonly share: number;
  readonly site: string;
}

/** Enemy groups of one archetype, as a mean group count per chunk. */
export interface EnemyTarget {
  readonly density: number;
  readonly escorts?: EscortTarget;
  readonly gather?: GatherTarget;
  /** Inclusive member count range of one group. */
  readonly groupSize: readonly [number, number];
  /** The archetype, which also names the target. */
  readonly kind: string;
  /**
   * A member's footprint radius by the chunk key its group is planned in and its index on the
   * line, at most `radius`. Absent, every member takes `radius`.
   */
  readonly memberRadius?: (chunk: string, member: number) => number;
  /** The largest member footprint radius, which bounds every group's reach. */
  readonly radius: number;
  /** Distance between neighbouring members on the group's line, widened to two hulls plus the gap. */
  readonly spacing: number;
  /**
   * Smallest member count a group may shrink to so it fits the local admission budget. Absent, a
   * group keeps its drawn size.
   */
  readonly smallest?: number;
}

/** A band's local admission budget and distinct archetype limit, switched at its `from`. */
export interface BandAdmission {
  readonly archetypes: number;
  readonly cap: number;
}

/** Targets for chunks whose centres lie at least `from` from the galactic centre. */
export interface SpawnBand {
  readonly admission?: BandAdmission;
  readonly enemies: readonly EnemyTarget[];
  readonly from: number;
  readonly moving: readonly MovingTarget[];
  readonly rocks: readonly RockTarget[];
}

/** A planning pass: whole enemy groups, static rocks, or moving rocks chosen from placed rocks. */
export type SpawnPass = "enemies" | "moving" | "rocks";

/** Square lattice cells, the chance a cell holds a group and the least anchor distance. */
export interface EnemyLattice {
  readonly cell: number;
  readonly occupancy: number;
  readonly spacing: number;
}

/**
 * Admission for a whole enemy group, counted over its own members and escorts alone: they must
 * fit the band's budget and archetype limit and hold at most `maxCapitals` capitals, and a
 * capital in the group adds `allowance` to the budget. Groups elsewhere never count.
 */
export interface SpawnAdmission {
  readonly allowance: number;
  readonly capital: string;
  readonly maxCapitals: number;
}

export interface SpawnRules {
  /** Applies where both this and the chunk's band admission are present. */
  readonly admission?: SpawnAdmission;
  /** Ascending by `from`; the first starts at 0. */
  readonly bands: readonly SpawnBand[];
  /**
   * Width of the band centred on each band boundary across which target densities blend
   * linearly; other band values switch at the boundary. Absent, densities switch too.
   */
  readonly blend?: number;
  readonly chunkSize: number;
  /**
   * Half width of the open lanes along every chunk's edges and midlines: a static rock keeps its
   * radius plus this from each, so it sits inside one quadrant. Absent, rocks use the whole chunk.
   */
  readonly corridor?: number;
  /** Free space required between any two placed footprints. */
  readonly gap: number;
  /**
   * Every pass once, in planning order; earlier passes claim space first. Moving rocks follow
   * static rocks, since they are chosen from them.
   */
  readonly order: readonly SpawnPass[];
  /** World units an enemy group's later anchor tries may move from its seeded anchor. */
  readonly search: number;
  /**
   * Whether densities count per open area: each chunk's requests for a kind shrink by the share
   * of the chunk that zones applying to the kind cover.
   */
  readonly openArea?: boolean;
  /**
   * Enemy groups on a square lattice of `cell` world units: each cell rolls once, seeded by its
   * index, for a vacancy (occupied at `occupancy`), its group's kind (weighted by the band's
   * densities) and an anchor offset. Anchors stay `spacing / 2` inside their cell, so any two
   * keep `spacing` apart, and a blocked group retries only inside its own cell. Absent, each
   * kind rolls its group count per chunk at its density, with anchors anywhere in the chunk.
   */
  readonly lattice?: EnemyLattice;
  /** Candidate positions per rock, or anchors per enemy group, before it is dropped. */
  readonly tries: number;
  readonly worldSide?: number;
}

/** A disc, or a band of `halfWidth` either side of a polyline. */
export type ExclusionShape =
  | { readonly kind: "disc"; readonly radius: number; readonly x: number; readonly y: number }
  | { readonly halfWidth: number; readonly kind: "path"; readonly points: readonly Vec[] };

/** No footprint of an applicable category may touch the zone. */
export interface ExclusionZone {
  readonly applies: readonly SpawnCategory[];
  readonly rule: string;
  readonly shape: ExclusionShape;
}

/** A rectangle of chunks from `cell`, the exclusion zones that apply in it and named sites. */
export interface SpawnRegion {
  readonly cell: Vec;
  readonly columns: number;
  readonly exclusions: readonly ExclusionZone[];
  readonly rows: number;
  /**
   * The chunks the report counts; the others are planned so that counted spawns meet their
   * neighbours as they would in flight. Absent, every chunk counts.
   */
  readonly report?: {
    readonly cell: Vec;
    readonly columns: number;
    /** The passes planned in the other chunks. Absent, every pass. */
    readonly neighbours?: readonly SpawnPass[];
    readonly rows: number;
  };
  /** Points enemy groups may gather beside, by site kind. */
  readonly sites?: Readonly<Record<string, readonly Vec[]>>;
}

export interface SpawnMotion {
  readonly grouped: boolean;
  readonly kind: string;
  readonly velocity: Vec;
}

export interface SpawnPlacement extends Vec {
  /** An enemy's archetype. */
  readonly archetype?: string;
  readonly category: "enemy" | "rock";
  readonly chunk: string;
  /** The enemy group a member or escort belongs to. */
  readonly group?: string;
  readonly id: string;
  readonly kind: string;
  /** The member an escort is stationed on. */
  readonly leader?: string;
  readonly moving?: SpawnMotion;
  readonly radius: number;
  readonly shape?: string;
}

/** Rocks count one per rock; enemies count one per whole group, members and escorts included. */
export type SpawnUnit = "groups" | "rocks";

export interface KindReport {
  readonly delivered: number;
  readonly dropped: number;
  /** Dropped units by the rule that rejected their last try. */
  readonly drops: Readonly<Record<string, number>>;
  /** Rejected tries by rule, including tries of units later accepted. */
  readonly rejections: Readonly<Record<string, number>>;
  readonly requested: number;
  readonly unit: SpawnUnit;
}

export interface SpawnReport {
  readonly kinds: Readonly<Record<string, KindReport>>;
}

export interface SpawnPlan {
  readonly placements: readonly SpawnPlacement[];
  readonly report: SpawnReport;
}

/**
 * Seeds for the two kinds of draw: rocks and moving rocks follow the world's geography seed,
 * enemy groups the encounter identity.
 */
export interface SpawnSeeds {
  readonly encounter: number;
  readonly world: number;
}

/** Report rule names the planner itself applies; exclusion zones add their own. */
export const SPAWN_RULE = {
  admission: "admission",
  corridor: "corridor",
  noSourceRock: "no-source-rock",
  overlap: "overlap",
} as const;

/** Spacings computed to exactly two radii plus the gap still clear it in floating point. */
const EPSILON = 1e-9;

interface Footprint extends Vec {
  readonly radius: number;
}

/** Placed footprints bucketed by square cells, for gap checks against nearby entries only. */
class SpatialIndex {
  private readonly buckets = new Map<string, Footprint[]>();
  private largest = 0;
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  add(entry: Footprint): void {
    const key = `${Math.floor(entry.x / this.size)},${Math.floor(entry.y / this.size)}`;
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      this.buckets.set(key, [entry]);
    }
    this.largest = Math.max(this.largest, entry.radius);
  }

  clear(gap: number, at: Footprint): boolean {
    const reach = at.radius + gap + this.largest;
    const [x0, x1] = [
      Math.floor((at.x - reach) / this.size),
      Math.floor((at.x + reach) / this.size),
    ];
    const [y0, y1] = [
      Math.floor((at.y - reach) / this.size),
      Math.floor((at.y + reach) / this.size),
    ];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (const other of this.buckets.get(`${x},${y}`) ?? []) {
          if (
            Math.hypot(other.x - at.x, other.y - at.y) <
            other.radius + at.radius + gap - EPSILON
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

class Tally {
  private readonly kinds = new Map<
    string,
    {
      delivered: number;
      drops: Record<string, number>;
      rejections: Record<string, number>;
      requested: number;
      unit: SpawnUnit;
    }
  >();

  private of(kind: string) {
    let entry = this.kinds.get(kind);
    if (!entry) {
      entry = { delivered: 0, drops: {}, rejections: {}, requested: 0, unit: "rocks" };
      this.kinds.set(kind, entry);
    }
    return entry;
  }

  request(kind: string, count: number, unit: SpawnUnit = "rocks"): void {
    const entry = this.of(kind);
    entry.requested += count;
    entry.unit = unit;
  }

  deliver(kind: string): void {
    this.of(kind).delivered++;
  }

  reject(kind: string, rule: string): void {
    const { rejections } = this.of(kind);
    rejections[rule] = (rejections[rule] ?? 0) + 1;
  }

  drop(kind: string, rule: string, count = 1): void {
    const { drops } = this.of(kind);
    drops[rule] = (drops[rule] ?? 0) + count;
  }

  report(): SpawnReport {
    return {
      kinds: Object.fromEntries(
        [...this.kinds].map(([kind, entry]) => [
          kind,
          {
            ...entry,
            dropped: Object.values(entry.drops).reduce((sum, count) => sum + count, 0),
          },
        ]),
      ),
    };
  }
}

interface Chunk {
  readonly band: SpawnBand;
  /** The chunk's cell before any wrap, which places it in the region. */
  readonly cell: Vec;
  /** Whether the report counts this chunk's spawns. */
  readonly counted: boolean;
  readonly key: string;
  readonly origin: Vec;
}

function validate(rules: SpawnRules, region: SpawnRegion): void {
  const counts = [rules.tries, region.columns, region.rows, region.cell.x, region.cell.y];
  if (
    !counts.every(Number.isSafeInteger) ||
    rules.tries < 1 ||
    region.columns < 0 ||
    region.rows < 0 ||
    ![rules.gap, rules.search, rules.corridor ?? 0, rules.blend ?? 0].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    (rules.lattice !== undefined &&
      !(
        rules.lattice.cell > 0 &&
        rules.lattice.spacing >= 0 &&
        rules.lattice.spacing <= rules.lattice.cell &&
        rules.lattice.occupancy >= 0 &&
        rules.lattice.occupancy <= 1
      )) ||
    !rules.bands.length ||
    rules.bands[0]!.from !== 0 ||
    rules.bands.some((band, index) => index > 0 && band.from <= rules.bands[index - 1]!.from) ||
    rules.order.length !== 3 ||
    !(["enemies", "moving", "rocks"] as const).every((pass) => rules.order.includes(pass)) ||
    rules.order.indexOf("moving") < rules.order.indexOf("rocks")
  ) {
    throw new RangeError("Invalid spawn rules or region");
  }
}

function distanceTo(rules: SpawnRules, a: Vec, b: Vec): Vec {
  return rules.worldSide === undefined
    ? { x: b.x - a.x, y: b.y - a.y }
    : wrappedDelta(rules.worldSide, a, b);
}

/** Distance from a point to a segment. */
function pointSegment(point: Vec, a: Vec, b: Vec): number {
  const along = { x: b.x - a.x, y: b.y - a.y };
  const length = along.x * along.x + along.y * along.y;
  const t =
    length > 0
      ? Math.max(0, Math.min(1, ((point.x - a.x) * along.x + (point.y - a.y) * along.y) / length))
      : 0;
  return Math.hypot(point.x - a.x - t * along.x, point.y - a.y - t * along.y);
}

/** Distance between two segments: zero where they cross, else the nearest endpoint distance. */
function segmentDistance(a: Vec, b: Vec, c: Vec, d: Vec): number {
  const side = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) {
    return 0;
  }
  return Math.min(
    pointSegment(a, c, d),
    pointSegment(b, c, d),
    pointSegment(c, a, b),
    pointSegment(d, a, b),
  );
}

/** Distance from the segment `from` to `to` (a point when absent) to a zone's edge, negative inside. */
function zoneGap(rules: SpawnRules, shape: ExclusionShape, from: Vec, to: Vec = from): number {
  const along = { x: to.x - from.x, y: to.y - from.y };
  if (shape.kind === "disc") {
    const delta = distanceTo(rules, shape, from);
    const start = { x: shape.x + delta.x, y: shape.y + delta.y };
    return (
      pointSegment(shape, start, { x: start.x + along.x, y: start.y + along.y }) - shape.radius
    );
  }
  const first = shape.points[0];
  if (!first) {
    return Infinity;
  }
  const start =
    rules.worldSide === undefined ? from : nearestImage(rules.worldSide, first, from).point;
  const finish = { x: start.x + along.x, y: start.y + along.y };
  let nearest = Infinity;
  for (let index = 1; index < shape.points.length; index++) {
    nearest = Math.min(
      nearest,
      segmentDistance(start, finish, shape.points[index - 1]!, shape.points[index]!),
    );
  }
  return nearest - shape.halfWidth;
}

/** Sample points per chunk side when measuring the share of a chunk that zones cover. */
const OPEN_SAMPLES = 8;

/**
 * The share of a chunk outside every zone that applies to a category, sampled on an even grid of
 * point centres; zones that cannot reach the chunk are skipped.
 */
function openShare(
  rules: SpawnRules,
  region: SpawnRegion,
  category: SpawnCategory,
  size: number,
  origin: Vec,
): number {
  const centre = { x: origin.x + size / 2, y: origin.y + size / 2 };
  const zones = region.exclusions.filter(
    (zone) =>
      zone.applies.includes(category) &&
      zoneGap(rules, zone.shape, centre) < (size / 2) * Math.SQRT2,
  );
  if (!zones.length) {
    return 1;
  }
  let open = 0;
  for (let column = 0; column < OPEN_SAMPLES; column++) {
    for (let row = 0; row < OPEN_SAMPLES; row++) {
      const point = {
        x: origin.x + ((column + 0.5) * size) / OPEN_SAMPLES,
        y: origin.y + ((row + 0.5) * size) / OPEN_SAMPLES,
      };
      if (zones.every((zone) => zoneGap(rules, zone.shape, point) >= 0)) {
        open++;
      }
    }
  }
  return open / OPEN_SAMPLES ** 2;
}

/** The rule of the first applicable zone the footprint touches. */
function excludedBy(
  rules: SpawnRules,
  region: SpawnRegion,
  category: SpawnCategory,
  at: Footprint,
): string | undefined {
  return region.exclusions.find(
    (zone) => zone.applies.includes(category) && zoneGap(rules, zone.shape, at) < at.radius,
  )?.rule;
}

/**
 * Each kind's density mixed linearly from `lower` to `upper`; the kind's other values come from
 * the active band, or from whichever band lists it.
 */
function blendTargets<T extends { readonly density: number; readonly kind: string }>(
  lower: readonly T[],
  upper: readonly T[],
  active: readonly T[],
  mix: number,
): T[] {
  const kinds = [...new Set([...lower, ...upper].map((target) => target.kind))];
  return kinds.flatMap((kind) => {
    const from = lower.find((target) => target.kind === kind);
    const to = upper.find((target) => target.kind === kind);
    const density = (from?.density ?? 0) * (1 - mix) + (to?.density ?? 0) * mix;
    const entry = active.find((target) => target.kind === kind) ?? from ?? to!;
    return density > 0 ? [{ ...entry, density }] : [];
  });
}

/** The band at a point, with densities blended within half the blend width of a boundary. */
export function spawnBandAt(rules: SpawnRules, centre: Vec): SpawnBand {
  const delta = distanceTo(rules, { x: 0, y: 0 }, centre);
  const distance = Math.hypot(delta.x, delta.y);
  const active = rules.bands.findLast((band) => distance >= band.from) ?? rules.bands[0]!;
  const half = (rules.blend ?? 0) / 2;
  if (!(half > 0)) {
    return active;
  }
  for (let index = 1; index < rules.bands.length; index++) {
    const lower = rules.bands[index - 1]!;
    const upper = rules.bands[index]!;
    if (distance <= upper.from - half || distance >= upper.from + half) {
      continue;
    }
    const mix = (distance - (upper.from - half)) / (2 * half);
    return {
      ...active,
      enemies: blendTargets(lower.enemies, upper.enemies, active.enemies, mix),
      moving: blendTargets(lower.moving, upper.moving, active.moving, mix),
      rocks: blendTargets(lower.rocks, upper.rocks, active.rocks, mix),
    };
  }
  return active;
}

function chunks(rules: SpawnRules, grid: WorldGrid, region: SpawnRegion): Chunk[] {
  const list: Chunk[] = [];
  for (let column = 0; column < region.columns; column++) {
    for (let row = 0; row < region.rows; row++) {
      const cell = { x: region.cell.x + column, y: region.cell.y + row };
      const origin = { x: cell.x * grid.pitch + grid.phase, y: cell.y * grid.pitch + grid.phase };
      const centre = { x: origin.x + grid.pitch / 2, y: origin.y + grid.pitch / 2 };
      const report = region.report;
      const counted =
        !report ||
        (cell.x >= report.cell.x &&
          cell.x < report.cell.x + report.columns &&
          cell.y >= report.cell.y &&
          cell.y < report.cell.y + report.rows);
      list.push({
        band: spawnBandAt(rules, centre),
        cell,
        counted,
        key: worldCellKey(grid, cell),
        origin,
      });
    }
  }
  return list;
}

/** Kind names in first-seen band order, so every chunk plans each kind in the same pass. */
function kindsOf<T extends { readonly kind: string }>(
  rules: SpawnRules,
  list: (band: SpawnBand) => readonly T[],
): string[] {
  return [...new Set(rules.bands.flatMap((band) => list(band).map((target) => target.kind)))];
}

function disc(next: Random, centre: Vec, radius: number): Vec {
  const angle = next() * 2 * Math.PI;
  const distance = radius * Math.sqrt(next());
  return { x: centre.x + Math.cos(angle) * distance, y: centre.y + Math.sin(angle) * distance };
}

function velocity(next: Random, speed: readonly [number, number]): Vec {
  const heading = next() * 2 * Math.PI;
  const magnitude = speed[0] + next() * (speed[1] - speed[0]);
  return { x: Math.cos(heading) * magnitude, y: Math.sin(heading) * magnitude };
}

/**
 * Plans one region's asteroids and enemies from a seed, pass by pass in `rules.order`: whole
 * enemy groups, static rocks, and moving rocks chosen from the placed static rocks, all sharing
 * one spatial index. A rock, or every member and
 * escort of a group, is accepted only where each footprint plus `gap` is clear of every placed
 * footprint and of the others in its group and touches no applicable exclusion zone, within
 * `tries` positions or group anchors; otherwise it is dropped whole and reported. Every count
 * and position comes from named streams per kind and chunk, so a kind's requests never shift
 * with another kind's draws. Rock and moving-rock streams use the world seed and enemy streams
 * the encounter seed. Stations and points of interest are not inputs and never block.
 */
export function planRegion(rules: SpawnRules, seeds: SpawnSeeds, region: SpawnRegion): SpawnPlan {
  validate(rules, region);
  const grid = periodicWorldGrid(rules, rules.chunkSize);
  const size = grid.pitch;
  const area = chunks(rules, grid, region);
  const index = new SpatialIndex(Math.max(64, size / 4));
  const reported = new Tally();
  // Spawns in chunks the report leaves out are planned but not counted.
  const ignored = new Tally();
  const shares = new Map<string, number>();
  // The share of a chunk outside the zones that apply to a category, which scales its requests.
  const open = (chunk: Chunk, category: SpawnCategory): number => {
    if (!rules.openArea) {
      return 1;
    }
    const key = `${chunk.key}:${category}`;
    let share = shares.get(key);
    if (share === undefined) {
      share = openShare(rules, region, category, size, chunk.origin);
      shares.set(key, share);
    }
    return share;
  };
  const placements: SpawnPlacement[] = [];
  const stream = (seed: number, kind: string, chunk: Chunk, part: string) =>
    randomStream(seed, `spawn:${kind}:${chunk.key}:${part}`);
  // The first applicable rule a candidate breaks, or undefined when it is accepted.
  const blocked = (category: SpawnCategory, at: Footprint): string | undefined =>
    excludedBy(rules, region, category, at) ??
    (index.clear(rules.gap, at) ? undefined : SPAWN_RULE.overlap);

  const rocks = (area: readonly Chunk[]) => {
    for (const kind of kindsOf(rules, (band) => band.rocks)) {
      for (const chunk of area) {
        const tally = chunk.counted ? reported : ignored;
        const target = chunk.band.rocks.find((rock) => rock.kind === kind);
        if (!target || !target.shapes.length) {
          continue;
        }
        const count = chanceRound(
          stream(seeds.world, kind, chunk, "count"),
          target.density * open(chunk, "rock"),
        );
        const next = stream(seeds.world, kind, chunk, "place");
        tally.request(kind, count);
        for (let spawn = 0; spawn < count; spawn++) {
          const shape = weightedPick(
            next,
            target.shapes,
            target.shapes.map((option) => option.weight),
          );
          const placed = placeRock(rules, size, chunk, next, shape.radius, (at) =>
            blocked("rock", at),
          );
          if (typeof placed === "string") {
            tally.drop(kind, placed);
            continue;
          }
          placed.rejected.forEach((rule) => tally.reject(kind, rule));
          if (!placed.at) {
            tally.drop(kind, placed.rejected.at(-1)!);
            continue;
          }
          const placement: SpawnPlacement = {
            category: "rock",
            chunk: chunk.key,
            id: `${kind}:${chunk.key}:${spawn}`,
            kind,
            radius: shape.radius,
            shape: shape.id,
            ...placed.at,
          };
          index.add(placement);
          placements.push(placement);
          tally.deliver(kind);
        }
      }
    }
  };
  const moving = (area: readonly Chunk[]) => {
    for (const kind of kindsOf(rules, (band) => band.moving)) {
      for (const chunk of area) {
        const tally = chunk.counted ? reported : ignored;
        const target = chunk.band.moving.find((moving) => moving.kind === kind);
        if (!target) {
          continue;
        }
        const count = chanceRound(
          stream(seeds.world, kind, chunk, "count"),
          target.density * open(chunk, "moving"),
        );
        tally.request(kind, count);
        if (!count) {
          continue;
        }
        const eligible = placements.filter((placement) => {
          if (
            placement.chunk !== chunk.key ||
            placement.moving ||
            !target.from.includes(placement.kind)
          ) {
            return false;
          }
          const rule = excludedBy(rules, region, "moving", placement);
          if (rule) {
            tally.reject(kind, rule);
          }
          return !rule;
        });
        const order = shuffled(stream(seeds.world, kind, chunk, "choose"), eligible);
        const anchor = order[0];
        const grouped = count > 1 ? Math.ceil(count * target.groupShare) : 0;
        const group = anchor
          ? [...order]
              .sort(
                (a, b) =>
                  Math.hypot(a.x - anchor.x, a.y - anchor.y) -
                  Math.hypot(b.x - anchor.x, b.y - anchor.y),
              )
              .slice(0, grouped)
          : [];
        const solos = order.filter((rock) => !group.includes(rock)).slice(0, count - group.length);
        // A velocity is kept when every rock it moves keeps its path clear; otherwise it is
        // redrawn, and after the tries those rocks stay still and are dropped as movers.
        const move = (rocks: readonly SpawnPlacement[], next: Random, isGroup: boolean) => {
          if (!rocks.length) {
            return;
          }
          let rule: string | undefined;
          for (let attempt = 0; attempt < rules.tries; attempt++) {
            const motion = velocity(next, target.speed);
            rule = target.path
              ? rocks
                  .map((rock) => pathBlocked(rules, region, rock, motion, target.path!))
                  .find((found) => found !== undefined)
              : undefined;
            if (!rule) {
              for (const rock of rocks) {
                placements[placements.indexOf(rock)] = {
                  ...rock,
                  moving: { grouped: isGroup, kind, velocity: { ...motion } },
                };
                tally.deliver(kind);
              }
              return;
            }
            tally.reject(kind, rule);
          }
          tally.drop(kind, rule!, rocks.length);
        };
        move(group, stream(seeds.world, kind, chunk, "group-motion"), true);
        for (const rock of solos) {
          move([rock], randomStream(seeds.world, `spawn:${kind}:${rock.id}:solo-motion`), false);
        }
        const missing = count - group.length - solos.length;
        if (missing > 0) {
          tally.drop(kind, SPAWN_RULE.noSourceRock, missing);
        }
      }
    }
  };
  // Places a whole group at the first anchor that admits and fits it, or drops it.
  const placeGroup = (
    tally: Tally,
    chunk: Chunk,
    target: EnemyTarget,
    group: string,
    next: Random,
    anchorAt: (attempt: number) => Vec,
  ) => {
    const kind = target.kind;
    const members = randomInt(next, target.groupSize[0], target.groupSize[1] + 1);
    const rejected: string[] = [];
    let formation: SpawnPlacement[] | undefined;
    for (let attempt = 0; attempt < rules.tries && !formation; attempt++) {
      const anchor = anchorAt(attempt);
      const phase = next();
      // The drawn size, or the largest smaller size down to `smallest` the budget admits.
      let rule: string | undefined = SPAWN_RULE.admission;
      for (let count = members; count >= (target.smallest ?? members); count--) {
        const candidate = groupFormation(rules.gap, chunk, group, target, count, anchor, phase);
        if (!admitted(rules, chunk.band, candidate)) {
          continue;
        }
        rule = formationBlocked(rules, candidate, (at) => blocked("enemy", at));
        if (!rule) {
          formation = candidate;
        }
        break;
      }
      if (rule) {
        rejected.push(rule);
      }
    }
    rejected.forEach((rule) => tally.reject(kind, rule));
    if (!formation) {
      tally.drop(kind, rejected.at(-1)!);
      return;
    }
    for (const placement of formation) {
      index.add(placement);
      placements.push(placement);
    }
    tally.deliver(kind);
  };
  const enemiesByChunk = (area: readonly Chunk[]) => {
    for (const kind of kindsOf(rules, (band) => band.enemies)) {
      for (const chunk of area) {
        const tally = chunk.counted ? reported : ignored;
        const target = chunk.band.enemies.find((enemy) => enemy.kind === kind);
        if (!target) {
          continue;
        }
        const groups = chanceRound(
          stream(seeds.encounter, kind, chunk, "count"),
          target.density * open(chunk, "enemy"),
        );
        const next = stream(seeds.encounter, kind, chunk, "place");
        tally.request(kind, groups, "groups");
        for (let number = 0; number < groups; number++) {
          const group = `${kind}:${chunk.key}:${number}`;
          const seeded = gathered(rules, region, target, next, {
            x: chunk.origin.x + next() * size,
            y: chunk.origin.y + next() * size,
          });
          placeGroup(tally, chunk, target, group, next, (attempt) =>
            attempt === 0
              ? seeded
              : disc(next, seeded, (rules.search * attempt) / Math.max(1, rules.tries - 1)),
          );
        }
      }
    }
  };
  // Lattice cells in index order; each cell's draws come from its own stream, so a cell plans
  // the same group whichever region holds its anchor.
  const enemiesByLattice = (lattice: EnemyLattice, area: readonly Chunk[]) => {
    const byCell = new Map(area.map((chunk) => [`${chunk.cell.x},${chunk.cell.y}`, chunk]));
    const xs = area.map((chunk) => chunk.origin.x);
    const ys = area.map((chunk) => chunk.origin.y);
    const inset = lattice.spacing / 2;
    const span = lattice.cell - lattice.spacing;
    const cells = {
      x: [
        Math.floor(Math.min(...xs) / lattice.cell),
        Math.floor((Math.max(...xs) + size) / lattice.cell),
      ],
      y: [
        Math.floor(Math.min(...ys) / lattice.cell),
        Math.floor((Math.max(...ys) + size) / lattice.cell),
      ],
    };
    for (let i = cells.x[0]!; i <= cells.x[1]!; i++) {
      for (let j = cells.y[0]!; j <= cells.y[1]!; j++) {
        const next = randomStream(seeds.encounter, `spawn:lattice:${i},${j}`);
        const within = () => ({
          x: i * lattice.cell + inset + next() * span,
          y: j * lattice.cell + inset + next() * span,
        });
        const seeded = within();
        const occupied = next() < lattice.occupancy;
        const roll = next();
        const chunk = byCell.get(
          `${Math.floor((seeded.x - grid.phase) / size)},${Math.floor((seeded.y - grid.phase) / size)}`,
        );
        if (!chunk || !occupied) {
          continue;
        }
        const targets = chunk.band.enemies;
        const total = targets.reduce((sum, target) => sum + target.density, 0);
        if (!(total > 0)) {
          continue;
        }
        const target = weightedPick(
          () => roll,
          targets,
          targets.map((option) => option.density),
        );
        // Open-area requests leave out cells whose anchor lies in a zone that applies to enemies.
        if (rules.openArea && excludedBy(rules, region, "enemy", { ...seeded, radius: 0 })) {
          continue;
        }
        const tally = chunk.counted ? reported : ignored;
        tally.request(target.kind, 1, "groups");
        // A gathering group moves beside its site only where it stays inside its cell's bounds.
        const moved = gathered(rules, region, target, next, seeded);
        const inside = (at: Vec) =>
          at.x >= i * lattice.cell + inset &&
          at.x <= i * lattice.cell + inset + span &&
          at.y >= j * lattice.cell + inset &&
          at.y <= j * lattice.cell + inset + span;
        const first = inside(moved) ? moved : seeded;
        placeGroup(tally, chunk, target, `${target.kind}:lattice:${i},${j}`, next, (attempt) =>
          attempt === 0 ? first : within(),
        );
      }
    }
  };
  const enemies = (area: readonly Chunk[]) =>
    rules.lattice ? enemiesByLattice(rules.lattice, area) : enemiesByChunk(area);
  const passes: Readonly<Record<SpawnPass, (chunks: readonly Chunk[]) => void>> = {
    enemies,
    moving,
    rocks,
  };
  const neighbours = region.report?.neighbours;
  for (const pass of rules.order) {
    passes[pass](
      !neighbours || neighbours.includes(pass) ? area : area.filter((chunk) => chunk.counted),
    );
  }
  return { placements, report: reported.report() };
}

/**
 * A static rock's position: a uniform point in a seeded quadrant's lane-free box, or anywhere in
 * the chunk without lanes. Returns the corridor rule when the rock cannot fit a quadrant.
 */
function placeRock(
  rules: SpawnRules,
  size: number,
  chunk: Chunk,
  next: Random,
  radius: number,
  blocked: (at: Footprint) => string | undefined,
): { at?: Vec; rejected: string[] } | string {
  const lane = rules.corridor;
  const inset = lane === undefined ? 0 : radius + lane;
  const span = lane === undefined ? size : size / 2 - 2 * inset;
  if (span < 0) {
    return SPAWN_RULE.corridor;
  }
  const rejected: string[] = [];
  for (let attempt = 0; attempt < rules.tries; attempt++) {
    const quadrant = lane === undefined ? 0 : Math.floor(next() * 4);
    const at = {
      x: chunk.origin.x + (quadrant % 2) * (size / 2) + inset + next() * span,
      y: chunk.origin.y + Math.floor(quadrant / 2) * (size / 2) + inset + next() * span,
    };
    const rule = blocked({ ...at, radius });
    if (!rule) {
      return { at, rejected };
    }
    rejected.push(rule);
  }
  return { rejected };
}

/** Line spacing between neighbouring members: their spacing, or wider for hulls plus the gap. */
function lineSpacing(gap: number, target: EnemyTarget): number {
  return Math.max(target.spacing, 2 * target.radius + gap);
}

/**
 * Escort ring radius: the escort ring, or wider so each escort keeps the gap from its leader and
 * from its neighbours on the ring.
 */
function escortRing(gap: number, leader: number, escort: EscortTarget): number {
  const neighbours =
    escort.perLeader > 1
      ? (2 * escort.radius + gap) / (2 * Math.sin(Math.PI / escort.perLeader))
      : 0;
  return Math.max(escort.ring, leader + escort.radius + gap, neighbours);
}

/**
 * The farthest any group's member or escort footprint can reach from its anchor, over every
 * band's enemy targets at their largest size.
 */
export function enemyGroupReach(rules: SpawnRules): number {
  let reach = 0;
  for (const target of rules.bands.flatMap((band) => band.enemies)) {
    const line = ((target.groupSize[1] - 1) / 2) * lineSpacing(rules.gap, target);
    const escort = target.escorts;
    reach = Math.max(
      reach,
      line + target.radius,
      escort ? line + escortRing(rules.gap, target.radius, escort) + escort.radius : 0,
    );
  }
  return reach;
}

/**
 * A whole group at an anchor: members on a line centred on it, each pair of neighbours their
 * spacing or two footprints plus the gap apart, and each leader's escorts evenly on its
 * `escortRing` from `phase`.
 */
function groupFormation(
  gap: number,
  chunk: Chunk,
  group: string,
  target: EnemyTarget,
  members: number,
  anchor: Vec,
  phase: number,
): SpawnPlacement[] {
  const formation: SpawnPlacement[] = [];
  const radii = Array.from(
    { length: members },
    (_, member) => target.memberRadius?.(chunk.key, member) ?? target.radius,
  );
  const steps = radii
    .slice(1)
    .map((radius, index) => Math.max(target.spacing, radii[index]! + radius + gap));
  let offset = -steps.reduce((sum, step) => sum + step, 0) / 2;
  for (let member = 0; member < members; member++) {
    const radius = radii[member]!;
    const leader: SpawnPlacement = {
      archetype: target.kind,
      category: "enemy",
      chunk: chunk.key,
      group,
      id: `${group}:${member}`,
      kind: target.kind,
      radius,
      x: anchor.x + offset,
      y: anchor.y,
    };
    offset += steps[member] ?? 0;
    formation.push(leader);
    const escort = target.escorts;
    if (!escort) {
      continue;
    }
    const ring = escortRing(gap, radius, escort);
    const stations = escort.perLeader;
    for (let station = 0; station < stations; station++) {
      const angle = 2 * Math.PI * (phase + station / stations);
      formation.push({
        archetype: escort.archetype,
        category: "enemy",
        chunk: chunk.key,
        group,
        id: `${group}:${member}:escort:${station}`,
        kind: escort.kind,
        leader: leader.id,
        radius: escort.radius,
        x: leader.x + Math.cos(angle) * ring,
        y: leader.y + Math.sin(angle) * ring,
      });
    }
  }
  return formation;
}

/**
 * A group's anchor: beside the nearest site within reach, at the target's share, or as seeded.
 * A gathering target always draws its angle and share roll, so its streams keep one shape.
 */
function gathered(
  rules: SpawnRules,
  region: SpawnRegion,
  target: EnemyTarget,
  next: Random,
  seeded: Vec,
): Vec {
  const gather = target.gather;
  if (!gather) {
    return seeded;
  }
  const angle = next() * 2 * Math.PI;
  const roll = next();
  let nearest: Vec | undefined;
  for (const site of region.sites?.[gather.site] ?? []) {
    const delta = distanceTo(rules, seeded, site);
    const distance = Math.hypot(delta.x, delta.y);
    if (
      distance <= gather.reach &&
      (!nearest || distance < Math.hypot(nearest.x - seeded.x, nearest.y - seeded.y))
    ) {
      nearest = { x: seeded.x + delta.x, y: seeded.y + delta.y };
    }
  }
  return nearest && roll < gather.share
    ? {
        x: nearest.x + Math.cos(angle) * gather.distance,
        y: nearest.y + Math.sin(angle) * gather.distance,
      }
    : seeded;
}

/** Whether a group's own members and escorts fit the band's admission. */
function admitted(
  rules: SpawnRules,
  band: SpawnBand,
  formation: readonly SpawnPlacement[],
): boolean {
  const admission = rules.admission;
  const local = band.admission;
  if (!admission || !local) {
    return true;
  }
  const capitals = formation.filter((member) => member.archetype === admission.capital).length;
  const cap = local.cap + (capitals > 0 ? admission.allowance : 0);
  return (
    formation.length <= cap &&
    new Set(formation.map((member) => member.archetype)).size <= local.archetypes &&
    capitals <= admission.maxCapitals
  );
}

/** The rule of the first path zone a moving rock's footprint touches over `seconds` at `motion`. */
function pathBlocked(
  rules: SpawnRules,
  region: SpawnRegion,
  rock: SpawnPlacement,
  motion: Vec,
  seconds: number,
): string | undefined {
  const end = { x: rock.x + motion.x * seconds, y: rock.y + motion.y * seconds };
  return region.exclusions.find(
    (zone) => zone.applies.includes("path") && zoneGap(rules, zone.shape, rock, end) < rock.radius,
  )?.rule;
}

/** The first rule any member breaks, against placed footprints and the group's own members. */
function formationBlocked(
  rules: SpawnRules,
  formation: readonly SpawnPlacement[],
  blocked: (at: Footprint) => string | undefined,
): string | undefined {
  for (const [index, member] of formation.entries()) {
    const rule =
      blocked(member) ??
      (formation
        .slice(0, index)
        .some(
          (other) =>
            Math.hypot(other.x - member.x, other.y - member.y) <
            other.radius + member.radius + rules.gap - EPSILON,
        )
        ? SPAWN_RULE.overlap
        : undefined);
    if (rule) {
      return rule;
    }
  }
  return undefined;
}
