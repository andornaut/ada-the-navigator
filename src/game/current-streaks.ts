import { type Current, pointOnCurrent } from "../model/currents.ts";
import type { Vec } from "../model/types.ts";

// Art's Whirlpool current streaks (art/whirlpool.md "Current streaks"): chevrons on the world
// plane, drawn at runtime from currents.json.

/** A pair [a, b] reads as a + b f for the flow fraction f. */
type Linear = readonly [number, number];

export interface StreakSpec {
  readonly alpha: Linear;
  readonly chevron: { readonly arm: Linear; readonly back: number; readonly tip: number };
  readonly color: string;
  readonly lanes: {
    readonly jitter: number;
    readonly jitterStep: number;
    readonly min: number;
    readonly spacing: number;
  };
  readonly minFlow: number;
  readonly reducedMotion: { readonly time: number };
  readonly rows: {
    readonly phase: number;
    readonly phaseStep: number;
    readonly spacing: number;
    readonly stagger: number;
  };
  readonly stroke: Linear;
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const linear = (value: unknown): value is Linear =>
  Array.isArray(value) && value.length === 2 && value.every(finite);
const all = (entry: Fields | undefined, keys: readonly string[]): entry is Fields =>
  entry !== undefined && keys.every((key) => finite(entry[key]));

/** Art's streak spec (`currents.json`, version 1), or undefined to draw no streaks. */
export function readStreakSpec(value: unknown): StreakSpec | undefined {
  const root = fields(value);
  const streaks = fields(root?.streaks);
  const lanes = fields(streaks?.lanes);
  const rows = fields(streaks?.rows);
  const chevron = fields(streaks?.chevron);
  const reduced = fields(streaks?.reducedMotion);
  if (
    root?.version !== 1 ||
    !streaks ||
    typeof streaks.color !== "string" ||
    !finite(streaks.minFlow) ||
    !linear(streaks.stroke) ||
    !linear(streaks.alpha) ||
    !all(lanes, ["spacing", "min", "jitter", "jitterStep"]) ||
    !((lanes.spacing as number) > 0) ||
    !all(rows, ["spacing", "stagger", "phase", "phaseStep"]) ||
    !((rows.spacing as number) > 0) ||
    !chevron ||
    !linear(chevron.arm) ||
    !finite(chevron.tip) ||
    !finite(chevron.back) ||
    !all(reduced, ["time"])
  ) {
    return undefined;
  }
  return {
    alpha: streaks.alpha,
    chevron: { arm: chevron.arm, back: chevron.back, tip: chevron.tip },
    color: streaks.color,
    lanes: {
      jitter: lanes.jitter as number,
      jitterStep: lanes.jitterStep as number,
      min: lanes.min as number,
      spacing: lanes.spacing as number,
    },
    minFlow: streaks.minFlow,
    reducedMotion: { time: reduced.time as number },
    rows: {
      phase: rows.phase as number,
      phaseStep: rows.phaseStep as number,
      spacing: rows.spacing as number,
      stagger: rows.stagger as number,
    },
    stroke: streaks.stroke,
  };
}

const frac = (value: number): number => value - Math.floor(value);
const at = (pair: Linear, f: number): number => pair[0] + pair[1] * f;

/** Lanes across a current of width `w`: max(min, round(w / spacing)). */
export function laneCount(spec: StreakSpec, width: number): number {
  return Math.max(spec.lanes.min, Math.round(width / spec.lanes.spacing));
}

/** Lane `j`'s offset across the current, positive to the left of the flow. */
export function laneOffset(spec: StreakSpec, width: number, lane: number): number {
  const n = laneCount(spec, width);
  const step = width / n;
  const jitter = spec.lanes.jitter * step * (2 * frac(spec.lanes.jitterStep * lane) - 1);
  return -width / 2 + (lane + 0.5) * step + jitter;
}

/** Lane `j`'s first mark along the path. */
export function rowOffset(spec: StreakSpec, lane: number): number {
  const { phase, phaseStep, spacing, stagger } = spec.rows;
  return spacing * (stagger * (lane % 2) + phase * frac(phaseStep * lane));
}

/** A lane's scroll speed: the peak flow times 1 - (2d / w)^2. */
export function laneSpeed(peak: number, width: number, offset: number): number {
  return peak * (1 - ((2 * offset) / width) ** 2);
}

/** A chevron's reach, stroke width and alpha at flow fraction `f`. */
export function chevronStyle(
  spec: StreakSpec,
  f: number,
): { alpha: number; reach: number; width: number } {
  return { alpha: at(spec.alpha, f), reach: at(spec.chevron.arm, f), width: at(spec.stroke, f) };
}

/** A chevron's extent from its centre: its farthest point, a back corner or the tip. */
export function markRadius(spec: StreakSpec, reach: number): number {
  return reach * Math.max(Math.hypot(spec.chevron.back, 1), spec.chevron.tip);
}

export interface StreakMark {
  readonly alpha: number;
  /** Back, tip, back: world points of the two-segment polyline, pointing downstream. */
  readonly points: readonly [Vec, Vec, Vec];
  readonly width: number;
}

/**
 * Every mark of a current at `seconds` (reduced motion holds Art's time): lane `j`'s marks sit
 * at arc o + (v t mod spacing) + spacing k within the path, each drawn only where the flow
 * fraction from `flow` exceeds `minFlow`. `near` culls marks by their arc position's point.
 */
export function streakMarks(
  spec: StreakSpec,
  current: Pick<Current, "length" | "points" | "stations" | "width">,
  peak: number,
  flow: (arc: number, offset: number) => number,
  seconds: number,
  reducedMotion: boolean,
  near: (point: Vec) => boolean = () => true,
): StreakMark[] {
  const time = reducedMotion ? spec.reducedMotion.time : seconds;
  const spacing = spec.rows.spacing;
  const place = (arc: number, offset: number): Vec => {
    const { point, tangent } = pointOnCurrent(current as Current, arc);
    return { x: point.x - tangent.y * offset, y: point.y + tangent.x * offset };
  };
  // A chevron keeps one frame: its centre's tangent, so a bend never bends its arms.
  const chevron = (arc: number, offset: number, reach: number): [Vec, Vec, Vec] => {
    const { tangent } = pointOnCurrent(current as Current, arc);
    const centre = place(arc, offset);
    const local = (along: number, across: number): Vec => ({
      x: centre.x + tangent.x * along - tangent.y * across,
      y: centre.y + tangent.y * along + tangent.x * across,
    });
    const back = -spec.chevron.back * reach;
    return [local(back, -reach), local(spec.chevron.tip * reach, 0), local(back, reach)];
  };
  const marks: StreakMark[] = [];
  // Inside a bend tighter than a lane's offset its marks would fold onto each other: a mark
  // whose disc meets a kept mark's is left out (markRadius; a grid of the largest diameter).
  const cell = 2 * markRadius(spec, chevronStyle(spec, 1).reach);
  const kept = new Map<string, { centre: Vec; radius: number }[]>();
  const clear = (centre: Vec, radius: number): boolean => {
    const cx = Math.floor(centre.x / cell);
    const cy = Math.floor(centre.y / cell);
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (const other of kept.get(`${x},${y}`) ?? []) {
          const apart = Math.hypot(other.centre.x - centre.x, other.centre.y - centre.y);
          if (apart < other.radius + radius) {
            return false;
          }
        }
      }
    }
    const key = `${cx},${cy}`;
    kept.set(key, [...(kept.get(key) ?? []), { centre, radius }]);
    return true;
  };
  for (let lane = 0; lane < laneCount(spec, current.width); lane++) {
    const offset = laneOffset(spec, current.width, lane);
    const speed = laneSpeed(peak, current.width, offset);
    const first = rowOffset(spec, lane) + ((((speed * time) % spacing) + spacing) % spacing);
    for (let arc = first - spacing; arc <= current.length; arc += spacing) {
      if (arc < 0) {
        continue;
      }
      const f = flow(arc, offset);
      const centre = place(arc, offset);
      if (f <= spec.minFlow || !near(centre)) {
        continue;
      }
      const { alpha, reach, width } = chevronStyle(spec, f);
      if (!clear(centre, markRadius(spec, reach))) {
        continue;
      }
      marks.push({
        alpha,
        points: chevron(arc, offset, reach),
        width,
      });
    }
  }
  return marks;
}
