import { LANCE_TELL } from "../data/enemyCatalog.ts";
import { HEAVY_SIGNATURES } from "../data/enemySignatures.ts";
import { toScreen } from "./convex.ts";
import type { Vec } from "./types.ts";
import { type WorldContext, worldDelta } from "./world/index.ts";

export type HammerTutorialPhase = "ready" | "telling" | "complete";

/** Saved only while an authored tell is pending. Owner and mount come from the encounter. */
export interface PendingAuthoredLance {
  readonly age: number;
  readonly damage: number;
  readonly direction: Readonly<Vec>;
  readonly muzzle: Readonly<Vec>;
  readonly offset: Readonly<Vec>;
  readonly volley: number;
}

export type HammerTutorialState =
  | { readonly phase: "ready" | "complete" }
  | { readonly phase: "telling"; readonly tell: PendingAuthoredLance };

export type HammerTutorialEvent =
  | { readonly kind: "started"; readonly tell: PendingAuthoredLance }
  | { readonly kind: "updated"; readonly tell: PendingAuthoredLance }
  | { readonly kind: "cancelled" | "fired" | "unavailable" };

export function advanceHammerTutorial(
  state: HammerTutorialState,
  event: HammerTutorialEvent,
): { readonly cue: boolean; readonly state: HammerTutorialState } {
  if (state.phase === "ready" && event.kind === "started") {
    return { cue: true, state: { phase: "telling", tell: event.tell } };
  }
  if (state.phase === "telling" && event.kind === "updated") {
    return { cue: false, state: { phase: "telling", tell: event.tell } };
  }
  if (
    (state.phase !== "complete" && event.kind === "unavailable") ||
    (state.phase === "telling" && (event.kind === "cancelled" || event.kind === "fired"))
  ) {
    return { cue: false, state: { phase: "complete" } };
  }
  return { cue: false, state };
}

interface HammerTutorial {
  readonly lanceAvailable: boolean;
  readonly phase: HammerTutorialPhase;
}

/** Apply only to Hammer's first eligible tell, on top of the ordinary mount checks. */
export function hammerAllowsMount(tutorial: HammerTutorial, hardpointId: string | null): boolean {
  const { lanceAvailable, phase } = tutorial;
  return (
    !lanceAvailable ||
    phase === "complete" ||
    (phase === "ready" && hardpointId === HEAVY_SIGNATURES.capital.lance.mount)
  );
}

export type MantaEscortIndex = 0 | 1;

type MantaEscortPhase =
  | { readonly escort: MantaEscortIndex; readonly kind: "approach" | "pass" }
  | { readonly escort: null; readonly kind: "reposition" };

const MANTA_BEATS = [
  { escort: 0, kind: "approach", seconds: 1 },
  { escort: 0, kind: "pass", seconds: 2 },
  { escort: null, kind: "reposition", seconds: 1.5 },
  { escort: 1, kind: "approach", seconds: 1 },
  { escort: 1, kind: "pass", seconds: 2 },
  { escort: null, kind: "reposition", seconds: 2 },
] as const satisfies readonly (MantaEscortPhase & { readonly seconds: number })[];
export const MANTA_FIRST_APPROACH_SECONDS = MANTA_BEATS[0].seconds;
const MANTA_PERIOD = MANTA_BEATS.reduce((total, beat) => total + beat.seconds, 0);

/** Indices identify the originally placed escorts, even when one no longer survives. */
export function mantaEscortPhase(elapsed: number): MantaEscortPhase {
  let time = elapsed % MANTA_PERIOD;
  for (const beat of MANTA_BEATS) {
    if (time < beat.seconds) {
      return beat;
    }
    time -= beat.seconds;
  }
  return MANTA_BEATS[0];
}

/** World offsets from the capital in a fixed approach frame. The admission caller checks the path. */
export interface MantaEscortCourse {
  readonly entry: Readonly<Vec>;
  readonly exit: Readonly<Vec>;
  readonly station: Readonly<Vec>;
}

export interface MantaEscortState {
  readonly courses: readonly [MantaEscortCourse, MantaEscortCourse];
  readonly elapsed: number;
}

/** Prefer the current's direction when reversing the assigned path is clear. */
export function mantaEscortCourse(
  context: { readonly current: Vec; readonly reverseIsClear: boolean },
  course: MantaEscortCourse,
): MantaEscortCourse {
  const { current, reverseIsClear } = context;
  const along =
    (course.exit.x - course.entry.x) * current.x + (course.exit.y - course.entry.y) * current.y;
  return reverseIsClear && along < 0
    ? { ...course, entry: course.exit, exit: course.entry }
    : course;
}

/** The authored target is fed through normal steering, collision and current drift. */
export function mantaEscortCommand(
  state: MantaEscortState,
  { escort, leader }: { readonly escort: MantaEscortIndex; readonly leader: Vec },
): { readonly kind: MantaEscortPhase["kind"]; readonly target: Vec } {
  const phase = mantaEscortPhase(state.elapsed);
  const kind = phase.escort === escort ? phase.kind : "reposition";
  const course = state.courses[escort];
  const offset =
    kind === "approach" ? course.entry : kind === "pass" ? course.exit : course.station;
  return { kind, target: { x: leader.x + offset.x, y: leader.y + offset.y } };
}

/** Called on the due fire opportunity, including its offset into the simulation slice. */
export function mantaEscortMayFire(elapsed: number, escort: MantaEscortIndex): boolean {
  const phase = mantaEscortPhase(elapsed);
  return phase.kind === "pass" && phase.escort === escort;
}

export const CROSSBOW_WARNING = 1;
const CROSSBOW_FIRE_END = CROSSBOW_WARNING + 3;
const CROSSBOW_SIDE_SECONDS = CROSSBOW_FIRE_END + 1;
const CROSSBOW_LANE_HALF_ANGLE = (20 * Math.PI) / 180;
const CROSSBOW_OUTER_ANGLE = (110 * Math.PI) / 180;

export interface CrossbowPattern {
  /** World-space bearing from Crossbow's home toward the Eye exit. */
  readonly bearing: number;
  readonly laneHalfAngle: number;
  readonly phase: "warning" | "active" | "switch";
  /** Seconds remaining before the current sector stops accepting fire. */
  readonly fireRemaining: number;
  /** Ordered angle bounds relative to the bearing, shared with the warning view. */
  readonly sector: readonly [min: number, max: number];
}

export function crossbowPattern(
  world: WorldContext,
  { elapsed, exit, home }: { readonly elapsed: number; readonly exit: Vec; readonly home: Vec },
): CrossbowPattern {
  const time = elapsed % (2 * CROSSBOW_SIDE_SECONDS);
  const first = time < CROSSBOW_SIDE_SECONDS;
  const withinSide = time % CROSSBOW_SIDE_SECONDS;
  const towardExit = worldDelta(world, home, exit);
  return {
    bearing: Math.atan2(towardExit.y, towardExit.x),
    fireRemaining:
      withinSide >= CROSSBOW_WARNING && withinSide < CROSSBOW_FIRE_END
        ? CROSSBOW_FIRE_END - withinSide
        : 0,
    laneHalfAngle: CROSSBOW_LANE_HALF_ANGLE,
    phase:
      withinSide < CROSSBOW_WARNING
        ? "warning"
        : withinSide < CROSSBOW_FIRE_END
          ? "active"
          : "switch",
    sector: first
      ? [CROSSBOW_LANE_HALF_ANGLE, CROSSBOW_OUTER_ANGLE]
      : [-CROSSBOW_OUTER_ANGLE, -CROSSBOW_LANE_HALF_ANGLE],
  };
}

export interface CrossbowTimingState {
  readonly elapsed: number;
  readonly pendingLance?: PendingAuthoredLance;
}

/** The same world-space vertex and angles are passed to the warning renderer. */
export interface CrossbowSector extends CrossbowPattern {
  readonly vertex: Readonly<Vec>;
}

export function crossbowSector(
  world: WorldContext,
  state: CrossbowTimingState,
  frame: { readonly exit: Vec; readonly home: Vec; readonly vertex: Vec },
): CrossbowSector {
  return {
    ...crossbowPattern(world, { elapsed: state.elapsed, exit: frame.exit, home: frame.home }),
    vertex: frame.vertex,
  };
}

export interface CrossbowAttackPath {
  readonly from: Readonly<Vec>;
  /** Actual world displacement to the end of the attack, without wrapping its length. */
  readonly travel: Readonly<Vec>;
  /** The collision half-width or shot radius in rendered coordinates. */
  readonly screenRadius: number;
}

function cross(first: Readonly<Vec>, second: Readonly<Vec>): number {
  return first.x * second.y - first.y * second.x;
}

/** A projected convex sector contains a swept disc iff both ends clear both boundary lines. */
export function crossbowContainsAttack(
  world: WorldContext,
  sector: CrossbowSector,
  path: CrossbowAttackPath,
): boolean {
  const start = toScreen(worldDelta(world, sector.vertex, path.from));
  const travel = toScreen(path.travel);
  const end = { x: start.x + travel.x, y: start.y + travel.y };
  const bounds = sector.sector.map((angle) => {
    const heading = sector.bearing + angle;
    return toScreen({ x: Math.cos(heading), y: Math.sin(heading) });
  });
  const lower = bounds[0]!;
  const upper = bounds[1]!;
  const lowerPad = path.screenRadius * Math.hypot(lower.x, lower.y);
  const upperPad = path.screenRadius * Math.hypot(upper.x, upper.y);
  return [start, end].every(
    (point) => cross(lower, point) > lowerPad && cross(point, upper) > upperPad,
  );
}

/** Reject the whole opportunity if any pellet or the tell fails the same sector constraint. */
export function crossbowAllowsAttack(
  world: WorldContext,
  sector: CrossbowSector,
  { fireBy, paths }: { readonly fireBy: number; readonly paths: readonly CrossbowAttackPath[] },
): boolean {
  return (
    sector.phase === "active" &&
    fireBy >= 0 &&
    fireBy < sector.fireRemaining &&
    paths.length > 0 &&
    paths.every((path) => crossbowContainsAttack(world, sector, path))
  );
}

export interface AuthoredLanceStatus {
  readonly age: number;
  /** Null covers an absent or paged-out owner; hp is the live hull, before this shot fires. */
  readonly owner: {
    readonly disabled: boolean;
    readonly hp: number;
    readonly mountHp: number | null;
    readonly salvaged: boolean;
  } | null;
}

type AuthoredLanceAction = "cancel" | "track" | "lock" | "fire";

/**
 * Read after advancing beam age. Run again with the actual tracked line before showing or firing
 * Crossbow's tell. Omit the sector result for an ordinary Hammer tracking or lock update.
 */
export function authoredLanceAction(
  { age, owner }: AuthoredLanceStatus,
  sectorAllowsLine = true,
): AuthoredLanceAction {
  if (
    !owner ||
    owner.hp <= 0 ||
    owner.disabled ||
    owner.salvaged ||
    owner.mountHp === null ||
    owner.mountHp <= 0 ||
    !sectorAllowsLine
  ) {
    return "cancel";
  }
  if (age < LANCE_TELL.trackSeconds) {
    return "track";
  }
  return age < LANCE_TELL.trackSeconds + LANCE_TELL.lockSeconds ? "lock" : "fire";
}
