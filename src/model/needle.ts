import { CONTENT } from "../data/content.ts";
import { NEEDLE } from "../data/needle.ts";
import { NEEDLE_LEARNING } from "../data/needleCopy.ts";
import { closestOnSegment, type Contact, partContact, toScreen } from "./convex.ts";
import { dropRandom } from "./drops.ts";
import type { Vec } from "./types.ts";
export type NeedleApproach = "show" | "feedback" | "independent";
export interface NeedleProgress {
  practiceLit: number;
  eyeLit: number;
  /** Absent until Ada makes the required practice choice through Loom's Talk. */
  approach?: NeedleApproach;
}
export function unfinishedNeedleCourse(
  progress: Readonly<NeedleProgress> | undefined,
): "practice" | "eye" | undefined {
  if (!progress?.approach) {
    return undefined;
  }
  if (progress.practiceLit < NEEDLE.practiceGates) {
    return "practice";
  }
  return progress.eyeLit < NEEDLE.eyeGates ? "eye" : undefined;
}
/** Strict finite save validation; a completed Eye requires the practice course. */
export function readNeedleProgress(value: unknown): NeedleProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const p = value as Record<string, unknown>;
  const count = (n: unknown, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  if (
    !count(p.practiceLit, NEEDLE.practiceGates) ||
    !count(p.eyeLit, NEEDLE.eyeGates) ||
    (p.eyeLit > 0 && p.practiceLit !== NEEDLE.practiceGates) ||
    (p.approach !== undefined &&
      !["show", "feedback", "independent"].includes(String(p.approach))) ||
    (p.practiceLit > 0 && p.approach === undefined)
  ) {
    return null;
  }
  return {
    ...(p.approach === undefined ? {} : { approach: p.approach as NeedleApproach }),
    eyeLit: p.eyeLit,
    practiceLit: p.practiceLit,
  };
}
export interface NeedleGate {
  readonly point: Vec;
  /** Unit travel direction through the plane, in world coordinates. */
  readonly tangent: Vec;
}
export interface NeedleCourse {
  readonly kind: "practice" | "eye" | "activity";
  readonly path: readonly Vec[];
  readonly gates: readonly NeedleGate[];
  readonly width: number;
  readonly holodisk: Vec;
  readonly pack: Vec;
}
const point = (xy: readonly number[]): Vec => ({ x: xy[0]!, y: xy[1]! });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
const normal = (v: Vec): Vec => ({ x: -v.y, y: v.x });
const unit = (v: Vec): Vec => {
  const length = Math.hypot(v.x, v.y);
  return { x: v.x / length, y: v.y / length };
};
const scale = (v: Vec, factor: number): Vec => ({ x: v.x * factor, y: v.y * factor });

/** Add two trailing rings, then carry the authored exit through the same widened interval. */
function longCourse(offset: Vec, kind: "eye" | "activity"): NeedleCourse {
  const authored = NEEDLE.eye.gates;
  const last = authored.at(-1)!;
  const lastPoint = point(last.point);
  const delta = subtract(lastPoint, point(authored.at(-2)!.point));
  const tangent = unit(point(last.tangent));
  const interval = scale(tangent, Math.hypot(delta.x, delta.y));
  const extension = [add(lastPoint, interval), add(lastPoint, scale(interval, 2))];
  const shift = scale(interval, 2);
  const at = (p: Vec) => add(offset, scale(p, NEEDLE.longSpacing));
  const path = NEEDLE.eye.path;
  const end = point(path.at(-1)!);
  const beyondExit = (p: readonly number[]) => add(at(add(end, shift)), subtract(point(p), end));
  const along = (index: number) => (index * NEEDLE.eye.length) / (path.length - 1);
  return {
    gates: [
      ...authored.map((gate) => ({
        point: at(point(gate.point)),
        tangent: unit(point(gate.tangent)),
      })),
      ...extension.map((point) => ({ point: at(point), tangent })),
    ],
    holodisk: beyondExit(NEEDLE.eye.holodisk),
    kind,
    pack: beyondExit(NEEDLE.eye.pack),
    path: [
      ...path.filter((_, index) => along(index) < last.along).map((p) => at(point(p))),
      at(lastPoint),
      ...extension.map(at),
      ...path.filter((_, index) => along(index) > last.along).map((p) => at(add(point(p), shift))),
    ],
    width: NEEDLE.eye.width,
  };
}
/** Translation preserves Art's authored bends, gate angles and reachable exit layout. */
export function createNeedleCourse(
  context: {
    readonly anchor: Vec;
    readonly seed?: number;
  },
  kind: NeedleCourse["kind"],
): NeedleCourse {
  const practice = kind === "practice";
  const next = dropRandom(context.seed ?? 0, "needle:activity");
  const translation =
    kind === "activity"
      ? {
          x: NEEDLE.activityOffset.x + next() * NEEDLE.activityJitter,
          y: NEEDLE.activityOffset.y + next() * NEEDLE.activityJitter,
        }
      : practice
        ? NEEDLE.practiceOffset
        : NEEDLE.eyeOffset;
  const offset = add(context.anchor, translation);
  if (kind !== "practice") {
    const course = longCourse(offset, kind);
    const arrival = CONTENT.tuning.flight.arrivalCalm;
    const shoulder = NEEDLE.gate.rim.outer;
    // Keep the race on the original side of Loom while leaving room outside the launch exclusion.
    return kind === "activity" &&
      inNeedleChannel({ radius: arrival + shoulder }, course, { x: 0, y: 0 })
      ? longCourse({ x: offset.x, y: arrival + course.width / 2 + shoulder }, kind)
      : course;
  }
  const path = NEEDLE.eye.path
    .filter((_, i) => (i / (NEEDLE.eye.path.length - 1)) * NEEDLE.eye.length <= NEEDLE.practiceEnd)
    .map((p) => add(offset, point(p)));
  return {
    gates: NEEDLE.eye.gates.slice(0, NEEDLE.practiceGates).map((g) => ({
      point: add(offset, point(g.point)),
      tangent: unit(point(g.tangent)),
    })),
    holodisk: add(offset, point(NEEDLE.eye.holodisk)),
    kind,
    pack: add(offset, point(NEEDLE.eye.pack)),
    path,
    width: NEEDLE.practiceWidth,
  };
}
/**
 * The renderer chooses only authored gate frames: the one whose axis, as the game projects it
 * (`gameAxis`), lies closest to the gate's projected direction.
 */
export function needleGateOrientation(gate: NeedleGate): number {
  const direction = unit(toScreen(gate.tangent));
  return NEEDLE.gate.orientations.reduce(
    (best, candidate) => {
      const alignment = Math.abs(dot(direction, unit(point(candidate.gameAxis))));
      return alignment > best.alignment ? { alignment, index: candidate.index } : best;
    },
    { alignment: -1, index: 0 },
  ).index;
}
export function needleSlow(context: {
  readonly velocity: Vec;
  readonly topSpeed: number;
}): boolean {
  return needleGateReadiness(context) === "green";
}
export function needleGateReadiness({
  topSpeed,
  velocity,
}: {
  readonly velocity: Vec;
  readonly topSpeed: number;
}): "red" | "yellow" | "green" {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!(topSpeed > 0) || !Number.isFinite(speed) || speed >= NEEDLE.fastFraction * topSpeed) {
    return "red";
  }
  return speed < NEEDLE.speedFraction * topSpeed ? "green" : "yellow";
}
export interface NeedlePass {
  readonly lit: number;
  readonly passed: readonly number[];
  readonly missed: boolean;
}
/** Swept centre-plane crossings, in route order. Lighting never uses an endpoint proximity. */
export function stepNeedleCourse(
  context: {
    readonly from: Vec;
    readonly to: Vec;
    readonly velocity: Vec;
    readonly topSpeed: number;
  },
  course: NeedleCourse,
  lit: number,
): NeedlePass {
  let count = lit;
  const passed: number[] = [];
  let missed = false;
  let previousCrossing = -1;
  for (let index = lit; index < course.gates.length; index++) {
    const gate = course.gates[index]!;
    const before = dot(subtract(context.from, gate.point), gate.tangent);
    const after = dot(subtract(context.to, gate.point), gate.tangent);
    // A centre landing on the plane counts once. A slow retry may cross from either side.
    if (!((before < 0 && after >= 0) || (before > 0 && after <= 0))) {
      break;
    }
    const t = -before / (after - before);
    if (t < previousCrossing) {
      break;
    }
    const crossing = {
      x: context.from.x + (context.to.x - context.from.x) * t,
      y: context.from.y + (context.to.y - context.from.y) * t,
    };
    const boundaryTolerance =
      Number.EPSILON *
      32 *
      Math.max(
        1,
        Math.abs(gate.point.x),
        Math.abs(gate.point.y),
        Math.abs(crossing.x),
        Math.abs(crossing.y),
      );
    if (
      Math.abs(dot(subtract(crossing, gate.point), normal(gate.tangent))) >=
      NEEDLE.gate.opening / 2 - boundaryTolerance
    ) {
      break;
    }
    if (!needleSlow(context)) {
      missed = true;
      break;
    }
    passed.push(index);
    count++;
    previousCrossing = t;
  }
  return { lit: count, missed, passed };
}
/** Corridor query for central generation, enemy movement and shots. Include each body's radius. */
export function inNeedleChannel(
  context: {
    readonly radius?: number;
  },
  course: NeedleCourse,
  position: Vec,
): boolean {
  return course.path.slice(1).some((b, i) => {
    const nearest = closestOnSegment(position, course.path[i]!, b);
    return (
      Math.hypot(position.x - nearest.x, position.y - nearest.y) <=
      course.width / 2 + (context.radius ?? 0)
    );
  });
}
/** Gate rim rectangles are the authored world-plane collision footprint, not a solid hoop. */
export function needleRimParts(gate: NeedleGate): readonly (readonly Vec[])[] {
  const lateral = normal(gate.tangent);
  return [-1, 1].map((sign) => {
    const inner = sign * NEEDLE.gate.rim.inner;
    const outer = sign * NEEDLE.gate.rim.outer;
    return [
      [-1, inner],
      [1, inner],
      [1, outer],
      [-1, outer],
    ].map(([side, across]) => ({
      x: gate.point.x + (gate.tangent.x * side! * NEEDLE.gate.rim.depth) / 2 + lateral.x * across!,
      y: gate.point.y + (gate.tangent.y * side! * NEEDLE.gate.rim.depth) / 2 + lateral.y * across!,
    }));
  });
}
/** Central flight applies the normal recoil path with damage disabled for these contacts only. */
export function needleRimContacts(
  context: {
    readonly position: Vec;
    readonly radius: number;
  },
  course: NeedleCourse,
): readonly (Contact & {
  readonly damage: 0;
})[] {
  return course.gates.flatMap((gate) =>
    needleRimParts(gate).flatMap((part) => {
      const contact = partContact(part, context.position, context.radius);
      return contact ? [{ ...contact, damage: 0 as const }] : [];
    }),
  );
}
/** Feedback is an event response, never a timer or an unsolicited independent-mode message. */
export function needleLearningFeedback(
  progress: NeedleProgress,
  attempt: NeedlePass,
): string | null {
  if (attempt.missed) {
    return NEEDLE_LEARNING.tooFast;
  }
  return progress.approach === "feedback" && attempt.passed.length ? NEEDLE_LEARNING.success : null;
}
export interface NeedleDebrisDescriptor extends Vec {
  readonly id: string;
  readonly piece: string;
  readonly velocity: Vec;
  readonly radius: number;
  readonly tumbleDegreesPerSecond: number;
  readonly tumblePhase: number;
}
/**
 * Bounded descriptors use the published belt geometry and normal debris movement. Each eyelid
 * row carries its own piece, and piece `index` in row `row` starts on tumble frame
 * `(index * frame.index + row * frame.row) mod frames` (art/needle.md "Ordered Eye").
 */
export function needleDebris(
  course: NeedleCourse,
  seed: number,
): readonly NeedleDebrisDescriptor[] {
  const next = dropRandom(seed, `needle:${course.kind}:debris`);
  const segments = course.path.slice(1).map((end, index) => ({
    end,
    length: Math.hypot(end.x - course.path[index]!.x, end.y - course.path[index]!.y),
    start: course.path[index]!,
  }));
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  const debris: NeedleDebrisDescriptor[] = [];
  let along = 0;
  let segmentIndex = 0;
  let segmentStart = 0;
  const frames = NEEDLE.channels.debris.tumble.frames;
  const emit = (
    at: Vec,
    tangent: Vec,
    id: string,
    order?: { readonly index: number; readonly row: number },
  ) => {
    const rate =
      NEEDLE.eye.debris.drift[0]! +
      next() * (NEEDLE.eye.debris.drift[1]! - NEEDLE.eye.debris.drift[0]!);
    const [slow, fast] = NEEDLE.channels.debris.tumble.degPerSecond;
    const random = () =>
      NEEDLE.channels.debris.pieces[Math.floor(next() * NEEDLE.channels.debris.pieces.length)]!.id;
    const piece = order ? NEEDLE.eye.debris.pieces[order.row]! : random();
    const tumbleDegreesPerSecond = slow! + next() * (fast! - slow!);
    const frame = order
      ? (order.index * NEEDLE.eye.debris.frame.index + order.row * NEEDLE.eye.debris.frame.row) %
        frames
      : undefined;
    debris.push({
      ...at,
      id,
      piece,
      radius: NEEDLE.debrisRadius,
      tumbleDegreesPerSecond,
      tumblePhase: frame === undefined ? next() * 360 : (frame * 360) / frames,
      velocity: { x: tangent.x * rate, y: tangent.y * rate },
    });
  };
  for (let index = 0; along <= length; index++, along += NEEDLE.eye.debris.spacing) {
    while (
      segmentIndex + 1 < segments.length &&
      segmentStart + segments[segmentIndex]!.length < along
    ) {
      segmentStart += segments[segmentIndex]!.length;
      segmentIndex++;
    }
    const segment = segments[segmentIndex]!;
    const tangent = unit(subtract(segment.end, segment.start));
    const fraction = (along - segmentStart) / segment.length;
    const center = {
      x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
      y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
    };
    for (const sign of [-1, 1]) {
      for (let row = 0; row < NEEDLE.eye.debris.rows; row++) {
        const across =
          sign *
          (NEEDLE.eye.eyelids.base +
            NEEDLE.eye.eyelids.swell * Math.sin((Math.PI * along) / length) +
            NEEDLE.eye.debris.gap +
            row * NEEDLE.eye.debris.rowStep +
            (next() - 0.5) * NEEDLE.eye.eyelids.spread);
        emit(
          { x: center.x - tangent.y * across, y: center.y + tangent.x * across },
          tangent,
          `needle:${course.kind}:debris:${index}:${sign}:${row}`,
          { index, row },
        );
      }
    }
    if (
      index % NEEDLE.insideDebrisEvery === NEEDLE.insideDebrisOffset &&
      course.gates.every(
        (gate) =>
          Math.hypot(gate.point.x - center.x, gate.point.y - center.y) > NEEDLE.gate.opening,
      )
    ) {
      emit(center, tangent, `needle:${course.kind}:debris:${index}:inside`);
    }
  }
  return debris;
}

interface NeedleCourseSource {
  readonly seed: number;
  readonly needle?: { readonly anchor: Vec };
}
const courses = new WeakMap<
  object,
  {
    practice: NeedleCourse;
    eye: NeedleCourse;
    activity: NeedleCourse;
  }
>();
/** Courses derive from one bounded saved anchor; geometry is not copied into every save. */
export function needleCourses(flight: NeedleCourseSource): {
  practice: NeedleCourse;
  eye: NeedleCourse;
  activity: NeedleCourse;
} | null {
  const state = flight.needle;
  if (!state) {
    return null;
  }
  let held = courses.get(state);
  if (!held) {
    held = {
      activity: createNeedleCourse({ anchor: state.anchor, seed: flight.seed }, "activity"),
      eye: createNeedleCourse({ anchor: state.anchor }, "eye"),
      practice: createNeedleCourse({ anchor: state.anchor }, "practice"),
    };
    courses.set(state, held);
  }
  return held;
}

const heldActivities = new WeakSet<NeedleCourseSource>();
/** The model derives this transient switch from its actual held activity before a flight step. */
export function setNeedleActivity(flight: NeedleCourseSource, active: boolean): void {
  if (active) {
    heldActivities.add(flight);
  } else {
    heldActivities.delete(flight);
  }
}
/** Physics and rendering share the exact same active courses without importing the chapter runtime. */
export function activeNeedleCourses(flight: NeedleCourseSource): readonly NeedleCourse[] {
  const layout = needleCourses(flight);
  return layout
    ? [layout.practice, layout.eye, ...(heldActivities.has(flight) ? [layout.activity] : [])]
    : [];
}
