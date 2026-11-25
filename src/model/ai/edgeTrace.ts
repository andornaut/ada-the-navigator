import type { Point } from "../../data/enemyCatalog.ts";
import type { EnemyKeepMoving } from "../../data/enemyNavigation.ts";
import { closestOnSegment, inside, type Parts } from "../convex.ts";
import { direction } from "../shipPhysics.ts";
import { type WorldContext, worldDistance } from "../worldContacts.ts";
import { seeded } from "./course.ts";

/** A miner's saved tracing: the rock it traces, its arrival there, its picks and their count. */
export interface MinerState {
  /**
   * The ship age it arrived at the traced rock's edge, from which its dwell runs; while it
   * travels to the rock, or patrols home with none, the current age.
   */
  arrived: number;
  /** Picks so far, which seed each dwell. */
  count: number;
  /** Its most recent picks, newest last, which the next pick skips. */
  picks: string[];
  /** The traced rock's id, or null while it patrols home with none. */
  rock: string | null;
}

/** A rock the miner may pick next, as the runtime qualifies it. */
export interface MinerRock {
  readonly id: string;
  readonly position: Point;
}

/** The traced rock's drawn outline as the miner's centre sees it. */
export interface TracedEdge {
  /** The miner's distance from the rock's centre, the radius it curves around. */
  readonly around: number;
  /** Centre distance to the nearest outline point. */
  readonly distance: number;
  /** Unit direction from that point out to the miner's centre. */
  readonly normal: Point;
}

/** How long a miner works its `count`th pick: seeded from its id within `dwellSeconds`. */
export function minerDwell(
  keep: Pick<EnemyKeepMoving, "dwellSeconds">,
  id: string,
  count: number,
): number {
  const [low, high] = keep.dwellSeconds;
  return low + seeded(`${id}:${count}`, 31) * (high - low);
}

/**
 * Whether a miner picks a rock now: it has never picked, its traced rock is gone or moving
 * (`traced` false), or its dwell has run out.
 */
export function minerNeedsPick(
  keep: Pick<EnemyKeepMoving, "dwellSeconds">,
  traced: boolean,
  miner: { readonly age: number; readonly id: string; readonly miner?: MinerState | undefined },
): boolean {
  const state = miner.miner;
  return (
    !state ||
    (state.rock !== null && !traced) ||
    miner.age - state.arrived >= minerDwell(keep, miner.id, state.count)
  );
}

/**
 * The miner's next pick: the qualifying rock nearest its position that is not among its recent
 * picks, or none, so it patrols home until its next dwell ends.
 */
export function pickMinerRock(
  context: WorldContext,
  keep: Pick<EnemyKeepMoving, "recentPicks">,
  candidates: readonly MinerRock[],
  miner: {
    readonly age: number;
    readonly miner?: MinerState | undefined;
    readonly position: Point;
  },
): MinerState {
  const previous = miner.miner ?? { arrived: miner.age, count: 0, picks: [], rock: null };
  let best: MinerRock | undefined;
  let nearest = Infinity;
  for (const rock of candidates) {
    if (previous.picks.includes(rock.id)) {
      continue;
    }
    const distance = worldDistance(context, miner.position, rock.position);
    if (distance < nearest || (distance === nearest && best && rock.id < best.id)) {
      best = rock;
      nearest = distance;
    }
  }
  return {
    arrived: miner.age,
    count: previous.count + 1,
    picks: best ? [...previous.picks, best.id].slice(-keep.recentPicks) : [...previous.picks],
    rock: best?.id ?? null,
  };
}

/** The nearest point of a rock's drawn `outline`, centred at `centre`, to `position`. */
export function outlineEdge(outline: Parts, centre: Point, position: Point): TracedEdge {
  const local = { x: position.x - centre.x, y: position.y - centre.y };
  let distance = Infinity;
  let normal = direction(local);
  for (const part of outline) {
    for (let index = 0; index < part.length; index++) {
      const nearest = closestOnSegment(local, part[index]!, part[(index + 1) % part.length]!);
      const gap = Math.hypot(local.x - nearest.x, local.y - nearest.y);
      if (gap < distance) {
        distance = gap;
        normal = direction({ x: local.x - nearest.x, y: local.y - nearest.y });
      }
    }
  }
  const around = magnitudeOf(local);
  if (outline.some((part) => inside(part, local))) {
    // Inside the outline the way out is the nearest edge, so the normal points across it.
    return { around, distance: 0, normal: { x: 0 - normal.x, y: 0 - normal.y } };
  }
  return { around, distance, normal: magnitudeOf(normal) ? normal : direction(local) };
}

const magnitudeOf = (point: Point): number => Math.hypot(point.x, point.y);

/** How far ahead along the edge, in edge offsets, a tracing miner aims to rejoin it. */
const EDGE_LOOKAHEAD = 3;

/**
 * A unit course along a traced edge `offset` out from the outline, circling on `side`: it aims at
 * the point on the edge EDGE_LOOKAHEAD offsets ahead, so from afar it closes almost straight in
 * and near the edge it turns smoothly onto it, inward beyond it and outward inside it.
 */
export function edgeCourse(offset: number, side: -1 | 1, edge: TracedEdge): Point {
  const toward = { x: 0 - edge.normal.x, y: 0 - edge.normal.y };
  const along = { x: -edge.normal.y * side, y: edge.normal.x * side };
  const ahead = offset * EDGE_LOOKAHEAD;
  const error = edge.distance - offset;
  return direction({
    x: along.x * ahead + toward.x * error,
    y: along.y * ahead + toward.y * error,
  });
}

/**
 * The edge course turned inward by the angle a hull lags while it curves around the rock at
 * `pace` world units per second, its velocity answering with `responseSeconds`.
 */
export function leadCourse(
  pace: number,
  responseSeconds: number,
  edge: TracedEdge,
  course: Point,
): Point {
  const lag = Math.atan((pace * responseSeconds) / Math.max(1, edge.around));
  const turn = Math.tan(Math.min(lag, Math.PI / 3));
  return direction({ x: course.x - edge.normal.x * turn, y: course.y - edge.normal.y * turn });
}
