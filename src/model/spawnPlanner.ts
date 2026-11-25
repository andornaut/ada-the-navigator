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

/** What an exclusion zone keeps out: static rocks, rocks chosen to move, or enemy ships. */
export type SpawnCategory = "enemy" | "moving" | "rock";

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
  /** Speed range in world units per second; headings are uniform. */
  readonly speed: readonly [number, number];
}

/** Escorts stationed on a ring around each leader of an enemy group. */
export interface EscortTarget {
  readonly kind: string;
  readonly perLeader: number;
  readonly radius: number;
  /** Distance from the leader's centre to each escort's. */
  readonly ring: number;
}

/** Enemy groups of one kind, as a mean member count per chunk (escorts excluded). */
export interface EnemyTarget {
  readonly density: number;
  readonly escorts?: EscortTarget;
  /** Inclusive member count range of one group. */
  readonly groupSize: readonly [number, number];
  readonly kind: string;
  readonly radius: number;
  /** Distance between neighbouring members on the group's line. */
  readonly spacing: number;
}

/** Targets for chunks whose centres lie at least `from` from the galactic centre. */
export interface SpawnBand {
  readonly enemies: readonly EnemyTarget[];
  readonly from: number;
  readonly moving: readonly MovingTarget[];
  readonly rocks: readonly RockTarget[];
}

export interface SpawnRules {
  /** Ascending by `from`; the first starts at 0. */
  readonly bands: readonly SpawnBand[];
  readonly chunkSize: number;
  /**
   * Half width of the open lanes along every chunk's edges and midlines: a static rock keeps its
   * radius plus this from each, so it sits inside one quadrant. Absent, rocks use the whole chunk.
   */
  readonly corridor?: number;
  /** Free space required between any two placed footprints. */
  readonly gap: number;
  /** World units later tries of a group member may move from its formation slot. */
  readonly jitter: number;
  /** World units later tries of a group's first member may move from its seeded anchor. */
  readonly search: number;
  /** Candidate positions per spawn before it is dropped. */
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

/** A rectangle of chunks from `cell` and the exclusion zones that apply in it. */
export interface SpawnRegion {
  readonly cell: Vec;
  readonly columns: number;
  readonly exclusions: readonly ExclusionZone[];
  readonly rows: number;
}

export interface SpawnMotion {
  readonly grouped: boolean;
  readonly kind: string;
  readonly velocity: Vec;
}

export interface SpawnPlacement extends Vec {
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

export interface KindReport {
  readonly delivered: number;
  readonly dropped: number;
  /** Dropped spawns by the rule that rejected their last try. */
  readonly drops: Readonly<Record<string, number>>;
  /** Rejected tries by rule, including tries of spawns later accepted. */
  readonly rejections: Readonly<Record<string, number>>;
  readonly requested: number;
}

export interface SpawnReport {
  readonly kinds: Readonly<Record<string, KindReport>>;
}

export interface SpawnPlan {
  readonly placements: readonly SpawnPlacement[];
  readonly report: SpawnReport;
}

/** Report rule names the planner itself applies; exclusion zones add their own. */
export const SPAWN_RULE = {
  corridor: "corridor",
  leaderDropped: "leader-dropped",
  noSourceRock: "no-source-rock",
  overlap: "overlap",
} as const;

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
          if (Math.hypot(other.x - at.x, other.y - at.y) < other.radius + at.radius + gap) {
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
    }
  >();

  private of(kind: string) {
    let entry = this.kinds.get(kind);
    if (!entry) {
      entry = { delivered: 0, drops: {}, rejections: {}, requested: 0 };
      this.kinds.set(kind, entry);
    }
    return entry;
  }

  request(kind: string, count = 1): void {
    this.of(kind).requested += count;
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
    ![rules.gap, rules.jitter, rules.search, rules.corridor ?? 0].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
    !rules.bands.length ||
    rules.bands[0]!.from !== 0 ||
    rules.bands.some((band, index) => index > 0 && band.from <= rules.bands[index - 1]!.from)
  ) {
    throw new RangeError("Invalid spawn rules or region");
  }
}

function distanceTo(rules: SpawnRules, a: Vec, b: Vec): Vec {
  return rules.worldSide === undefined
    ? { x: b.x - a.x, y: b.y - a.y }
    : wrappedDelta(rules.worldSide, a, b);
}

/** Distance from a point to a zone's edge, negative inside. */
function zoneGap(rules: SpawnRules, shape: ExclusionShape, point: Vec): number {
  if (shape.kind === "disc") {
    const delta = distanceTo(rules, shape, point);
    return Math.hypot(delta.x, delta.y) - shape.radius;
  }
  const first = shape.points[0];
  if (!first) {
    return Infinity;
  }
  const at =
    rules.worldSide === undefined ? point : nearestImage(rules.worldSide, first, point).point;
  let nearest = Infinity;
  for (let index = 1; index < shape.points.length; index++) {
    const a = shape.points[index - 1]!;
    const b = shape.points[index]!;
    const along = { x: b.x - a.x, y: b.y - a.y };
    const length = along.x * along.x + along.y * along.y;
    const t =
      length > 0
        ? Math.max(0, Math.min(1, ((at.x - a.x) * along.x + (at.y - a.y) * along.y) / length))
        : 0;
    nearest = Math.min(nearest, Math.hypot(at.x - a.x - t * along.x, at.y - a.y - t * along.y));
  }
  return nearest - shape.halfWidth;
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

function bandAt(rules: SpawnRules, centre: Vec): SpawnBand {
  const delta = distanceTo(rules, { x: 0, y: 0 }, centre);
  const distance = Math.hypot(delta.x, delta.y);
  return rules.bands.findLast((band) => distance >= band.from) ?? rules.bands[0]!;
}

function chunks(rules: SpawnRules, grid: WorldGrid, region: SpawnRegion): Chunk[] {
  const list: Chunk[] = [];
  for (let column = 0; column < region.columns; column++) {
    for (let row = 0; row < region.rows; row++) {
      const cell = { x: region.cell.x + column, y: region.cell.y + row };
      const origin = { x: cell.x * grid.pitch + grid.phase, y: cell.y * grid.pitch + grid.phase };
      const centre = { x: origin.x + grid.pitch / 2, y: origin.y + grid.pitch / 2 };
      list.push({ band: bandAt(rules, centre), key: worldCellKey(grid, cell), origin });
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
 * Plans one region's asteroids and enemies from a seed: static rocks, then moving rocks chosen
 * from them, then enemy group members, all sharing one spatial index. A spawn is accepted only
 * where its footprint plus `gap` is clear of every placed footprint and it touches no applicable
 * exclusion zone, within `tries` candidates; otherwise it is dropped and reported. Every count
 * and position comes from named streams per kind and chunk, so a kind's requests never shift
 * with another kind's draws. Stations and points of interest are not inputs and never block.
 */
export function planRegion(rules: SpawnRules, seed: number, region: SpawnRegion): SpawnPlan {
  validate(rules, region);
  const grid = periodicWorldGrid(rules, rules.chunkSize);
  const size = grid.pitch;
  const area = chunks(rules, grid, region);
  const index = new SpatialIndex(Math.max(64, size / 4));
  const tally = new Tally();
  const placements: SpawnPlacement[] = [];
  const stream = (kind: string, chunk: Chunk, part: string) =>
    randomStream(seed, `spawn:${kind}:${chunk.key}:${part}`);
  // The first applicable rule a candidate breaks, or undefined when it is accepted.
  const blocked = (category: SpawnCategory, at: Footprint): string | undefined =>
    excludedBy(rules, region, category, at) ??
    (index.clear(rules.gap, at) ? undefined : SPAWN_RULE.overlap);

  for (const kind of kindsOf(rules, (band) => band.rocks)) {
    for (const chunk of area) {
      const target = chunk.band.rocks.find((rock) => rock.kind === kind);
      if (!target || !target.shapes.length) {
        continue;
      }
      const count = chanceRound(stream(kind, chunk, "count"), target.density);
      const next = stream(kind, chunk, "place");
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

  for (const kind of kindsOf(rules, (band) => band.moving)) {
    for (const chunk of area) {
      const target = chunk.band.moving.find((moving) => moving.kind === kind);
      if (!target) {
        continue;
      }
      const count = chanceRound(stream(kind, chunk, "count"), target.density);
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
      const order = shuffled(stream(kind, chunk, "choose"), eligible);
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
      const shared = velocity(stream(kind, chunk, "group-motion"), target.speed);
      for (const [rocks, isGroup] of [
        [group, true],
        [solos, false],
      ] as const) {
        for (const rock of rocks) {
          const motion = isGroup
            ? { ...shared }
            : velocity(randomStream(seed, `spawn:${kind}:${rock.id}:solo-motion`), target.speed);
          placements[placements.indexOf(rock)] = {
            ...rock,
            moving: { grouped: isGroup, kind, velocity: motion },
          };
          tally.deliver(kind);
        }
      }
      const missing = count - group.length - solos.length;
      if (missing > 0) {
        tally.drop(kind, SPAWN_RULE.noSourceRock, missing);
      }
    }
  }

  for (const kind of kindsOf(rules, (band) => band.enemies)) {
    for (const chunk of area) {
      const target = chunk.band.enemies.find((enemy) => enemy.kind === kind);
      if (!target) {
        continue;
      }
      const [least, most] = target.groupSize;
      const groups = chanceRound(
        stream(kind, chunk, "count"),
        target.density / ((least + most) / 2),
      );
      const next = stream(kind, chunk, "place");
      for (let number = 0; number < groups; number++) {
        const group = `${kind}:${chunk.key}:${number}`;
        const members = randomInt(next, least, most + 1);
        const seeded = { x: chunk.origin.x + next() * size, y: chunk.origin.y + next() * size };
        const slot = (member: number) => (member - (members - 1) / 2) * target.spacing;
        let anchor: Vec | undefined;
        const leaders: (SpawnPlacement | undefined)[] = [];
        tally.request(kind, members);
        for (let member = 0; member < members; member++) {
          const from = anchor ?? seeded;
          const placed = placeEnemy(
            rules,
            next,
            { radius: target.radius, x: from.x + slot(member), y: from.y },
            anchor ? rules.jitter : rules.search,
            (at) => blocked("enemy", at),
          );
          placed.rejected.forEach((rule) => tally.reject(kind, rule));
          if (!placed.at) {
            tally.drop(kind, placed.rejected.at(-1)!);
            leaders.push(undefined);
            continue;
          }
          anchor ??= { x: placed.at.x - slot(member), y: placed.at.y };
          const placement: SpawnPlacement = {
            category: "enemy",
            chunk: chunk.key,
            group,
            id: `${group}:${member}`,
            kind,
            radius: target.radius,
            ...placed.at,
          };
          index.add(placement);
          placements.push(placement);
          leaders.push(placement);
          tally.deliver(kind);
        }
        const escort = target.escorts;
        if (!escort) {
          continue;
        }
        for (const [member, leader] of leaders.entries()) {
          tally.request(escort.kind, escort.perLeader);
          if (!leader) {
            tally.drop(escort.kind, SPAWN_RULE.leaderDropped, escort.perLeader);
            continue;
          }
          const phase = next() * 2 * Math.PI;
          for (let station = 0; station < escort.perLeader; station++) {
            const angle = phase + (2 * Math.PI * station) / escort.perLeader;
            const placed = placeEnemy(
              rules,
              next,
              {
                radius: escort.radius,
                x: leader.x + Math.cos(angle) * escort.ring,
                y: leader.y + Math.sin(angle) * escort.ring,
              },
              rules.jitter,
              (at) => blocked("enemy", at),
            );
            placed.rejected.forEach((rule) => tally.reject(escort.kind, rule));
            if (!placed.at) {
              tally.drop(escort.kind, placed.rejected.at(-1)!);
              continue;
            }
            const placement: SpawnPlacement = {
              category: "enemy",
              chunk: chunk.key,
              group,
              id: `${group}:${member}:escort:${station}`,
              kind: escort.kind,
              leader: leader.id,
              radius: escort.radius,
              ...placed.at,
            };
            index.add(placement);
            placements.push(placement);
            tally.deliver(escort.kind);
          }
        }
      }
    }
  }
  return { placements, report: tally.report() };
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

/** An enemy's position: its slot first, then seeded points up to `reach` from it. */
function placeEnemy(
  rules: SpawnRules,
  next: Random,
  slot: Footprint,
  reach: number,
  blocked: (at: Footprint) => string | undefined,
): { at?: Vec; rejected: string[] } {
  const rejected: string[] = [];
  for (let attempt = 0; attempt < rules.tries; attempt++) {
    const at =
      attempt === 0
        ? { x: slot.x, y: slot.y }
        : disc(next, slot, (reach * attempt) / Math.max(1, rules.tries - 1));
    const rule = blocked({ ...at, radius: slot.radius });
    if (!rule) {
      return { at, rejected };
    }
    rejected.push(rule);
  }
  return { rejected };
}
