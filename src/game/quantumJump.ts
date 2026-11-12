import type { Vec } from "../model/types.ts";

// Art's quantum jump effect (art/quantum-jump.md): the data, its step timeline, the warp ship's
// poses and the shared canvas fit.

export interface JumpIris {
  readonly radius?: number;
  /** Radius as a share of the view's half-diagonal. */
  readonly reach?: number;
}

/** A step's warp ship: a pose at a scale, the sprite's share of its turn, and its whitening. */
export interface WarpShip {
  readonly pose: string;
  readonly scale: number;
  readonly turn?: number;
  readonly white?: number;
}

/** One held step of a phase: what it draws, unchanged for its ms; nothing tweens between steps. */
export interface JumpStep {
  readonly glow?: string;
  readonly iris?: JumpIris;
  readonly ms: number;
  readonly ship?: WarpShip;
  readonly star?: boolean;
  readonly streak?: number;
  readonly tunnel?: string;
}

/** A phase of the timeline and its steps, which fill its ms. */
export interface JumpFrame {
  readonly bright?: boolean;
  readonly destination?: boolean;
  readonly ms: number;
  readonly name: string;
  readonly startMs: number;
  readonly steps: readonly JumpStep[];
}

export interface WarpPose {
  readonly id: string;
  /** Each paint scheme's SVG path. */
  readonly paths: Readonly<Record<string, string>>;
}

/** The warp ship: the arrival heading, the pose frame and its display scale, and the poses. */
export interface Warp {
  readonly displayScale: number;
  readonly frame: number;
  readonly heading: number;
  readonly poses: readonly WarpPose[];
  readonly tunnel: string;
}

export type ReducedStep =
  | { readonly fromMs: number; readonly toMs: number; readonly show: ReducedScene }
  | {
      readonly crossFade: readonly [ReducedScene, ReducedScene];
      readonly fromMs: number;
      readonly toMs: number;
    };
export type ReducedScene = "source" | "still" | "destination";
export interface QuantumJump {
  readonly durationMs: number;
  readonly emergency: {
    readonly charge: { readonly glow: string; readonly wash: { colour: string; alpha: number } };
    readonly still: string;
  };
  readonly frames: readonly JumpFrame[];
  readonly iris: {
    readonly line: { readonly at: number; readonly colour: string; readonly width: number };
    readonly rim: { readonly colour: string; readonly from: number; readonly to: number };
  };
  readonly reducedMotion: {
    readonly durationMs: number;
    /** The ship holds still until holdToMs, then cross-fades into the destination's by crossFadeToMs. */
    readonly ship: { readonly crossFadeToMs: number; readonly holdToMs: number };
    readonly steps: readonly ReducedStep[];
    readonly still: string;
  };
  readonly streak: { readonly colour: string; readonly length: number; readonly width: number };
  readonly warp: Warp;
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const colour = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const name = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const share = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1;
const SCENES: readonly ReducedScene[] = ["source", "still", "destination"];

// Undefined when absent, null when malformed.
function readIris(value: unknown): JumpIris | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const iris = fields(value);
  if (!iris || (finite(iris.radius) ? iris.reach !== undefined : !finite(iris.reach))) {
    return null;
  }
  return finite(iris.radius) ? { radius: iris.radius } : { reach: iris.reach as number };
}

function readShip(value: unknown): WarpShip | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  const ship = fields(value);
  if (
    !ship ||
    !name(ship.pose) ||
    !finite(ship.scale) ||
    ship.scale <= 0 ||
    (ship.turn !== undefined && !share(ship.turn)) ||
    (ship.white !== undefined && !share(ship.white))
  ) {
    return null;
  }
  return {
    pose: ship.pose,
    scale: ship.scale,
    ...(finite(ship.turn) ? { turn: ship.turn } : {}),
    ...(finite(ship.white) ? { white: ship.white } : {}),
  };
}

function readStep(value: unknown): JumpStep | undefined {
  const step = fields(value);
  if (!step || !finite(step.ms) || step.ms <= 0) {
    return undefined;
  }
  const iris = readIris(step.iris);
  const ship = readShip(step.ship);
  if (
    iris === null ||
    ship === null ||
    (step.glow !== undefined && !name(step.glow)) ||
    (step.tunnel !== undefined && !name(step.tunnel)) ||
    (step.streak !== undefined && !finite(step.streak))
  ) {
    return undefined;
  }
  return {
    ...(name(step.glow) ? { glow: step.glow } : {}),
    ...(iris ? { iris } : {}),
    ms: step.ms,
    ...(ship ? { ship } : {}),
    ...(step.star === true ? { star: true } : {}),
    ...(finite(step.streak) ? { streak: step.streak } : {}),
    ...(name(step.tunnel) ? { tunnel: step.tunnel } : {}),
  };
}

// A phase whose steps fill its ms exactly; the per-phase fields Art keeps for the older renderer
// are not read.
function readFrame(value: unknown): JumpFrame | undefined {
  const frame = fields(value);
  if (
    !frame ||
    !name(frame.name) ||
    !finite(frame.startMs) ||
    !finite(frame.ms) ||
    frame.ms <= 0 ||
    !Array.isArray(frame.steps)
  ) {
    return undefined;
  }
  const steps = (frame.steps as unknown[]).map(readStep);
  if (!steps.length || steps.some((step) => !step)) {
    return undefined;
  }
  const total = (steps as JumpStep[]).reduce((sum, step) => sum + step.ms, 0);
  if (Math.abs(total - frame.ms) > 1e-6) {
    return undefined;
  }
  return {
    ...(frame.bright === true ? { bright: true } : {}),
    ...(frame.destination === true ? { destination: true } : {}),
    ms: frame.ms,
    name: frame.name,
    startMs: frame.startMs,
    steps: steps as JumpStep[],
  };
}

// The warp: every pose names a path for the same paint schemes.
function readWarp(value: unknown): Warp | undefined {
  const warp = fields(value);
  if (
    !warp ||
    !finite(warp.heading) ||
    !finite(warp.frame) ||
    !finite(warp.displayScale) ||
    !name(warp.tunnel) ||
    !Array.isArray(warp.poses) ||
    warp.poses.length === 0
  ) {
    return undefined;
  }
  const poses: WarpPose[] = [];
  let schemes: string | undefined;
  for (const entry of warp.poses as unknown[]) {
    const pose = fields(entry);
    const paths = fields(pose?.paths);
    if (!pose || !name(pose.id) || !paths || !Object.values(paths).every(name)) {
      return undefined;
    }
    const keys = Object.keys(paths).sort().join(",");
    if (!keys || (schemes !== undefined && keys !== schemes)) {
      return undefined;
    }
    schemes = keys;
    poses.push({ id: pose.id, paths: paths as Record<string, string> });
  }
  return {
    displayScale: warp.displayScale,
    frame: warp.frame,
    heading: warp.heading,
    poses,
    tunnel: warp.tunnel,
  };
}

function readReducedStep(value: unknown): ReducedStep | undefined {
  const step = fields(value);
  if (!step || !finite(step.fromMs) || !finite(step.toMs) || step.toMs <= step.fromMs) {
    return undefined;
  }
  if (SCENES.includes(step.show as ReducedScene)) {
    return { fromMs: step.fromMs, show: step.show as ReducedScene, toMs: step.toMs };
  }
  const fade = step.crossFade;
  return Array.isArray(fade) &&
    fade.length === 2 &&
    fade.every((scene) => SCENES.includes(scene as ReducedScene))
    ? {
        crossFade: [fade[0] as ReducedScene, fade[1] as ReducedScene],
        fromMs: step.fromMs,
        toMs: step.toMs,
      }
    : undefined;
}

/** Validate Art's quantum-jump.json version 1; anything malformed disables the effect. */
export function readQuantumJump(value: unknown): QuantumJump | undefined {
  const root = fields(value);
  const iris = fields(root?.iris);
  const rim = fields(iris?.rim);
  const line = fields(iris?.line);
  const streak = fields(root?.streak);
  const emergency = fields(root?.emergency);
  const charge = fields(emergency?.charge);
  const wash = fields(charge?.wash);
  const reduced = fields(root?.reducedMotion);
  const reducedShip = fields(reduced?.ship);
  const warp = readWarp(root?.warp);
  if (
    !root ||
    root.version !== 1 ||
    !finite(root.durationMs) ||
    !Array.isArray(root.frames) ||
    !warp ||
    !rim ||
    !colour(rim.colour) ||
    !finite(rim.from) ||
    !finite(rim.to) ||
    !line ||
    !colour(line.colour) ||
    !finite(line.at) ||
    !finite(line.width) ||
    !streak ||
    !colour(streak.colour) ||
    !finite(streak.length) ||
    !finite(streak.width) ||
    !charge ||
    !name(charge.glow) ||
    !wash ||
    !colour(wash.colour) ||
    !finite(wash.alpha) ||
    !name(emergency?.still) ||
    !reduced ||
    !finite(reduced.durationMs) ||
    !name(reduced.still) ||
    !Array.isArray(reduced.steps) ||
    !reducedShip ||
    !finite(reducedShip.holdToMs) ||
    !finite(reducedShip.crossFadeToMs) ||
    reducedShip.crossFadeToMs < reducedShip.holdToMs
  ) {
    return undefined;
  }
  const frames = (root.frames as unknown[]).map(readFrame);
  const steps = (reduced.steps as unknown[]).map(readReducedStep);
  if (
    !frames.length ||
    frames.some((frame) => !frame) ||
    !steps.length ||
    steps.some((step) => !step)
  ) {
    return undefined;
  }
  return {
    durationMs: root.durationMs,
    emergency: {
      charge: { glow: charge.glow, wash: { alpha: wash.alpha, colour: wash.colour } },
      still: emergency!.still as string,
    },
    frames: frames as JumpFrame[],
    iris: {
      line: { at: line.at, colour: line.colour, width: line.width },
      rim: { colour: rim.colour, from: rim.from, to: rim.to },
    },
    reducedMotion: {
      durationMs: reduced.durationMs,
      ship: { crossFadeToMs: reducedShip.crossFadeToMs, holdToMs: reducedShip.holdToMs },
      steps: steps as ReducedStep[],
      still: reduced.still,
    },
    streak: { colour: streak.colour, length: streak.length, width: streak.width },
    warp,
  };
}

/** The phase and step showing at `ms`, or null once the jump is over. Steps hold. */
export function jumpStepAt(
  jump: QuantumJump,
  ms: number,
): { readonly frame: JumpFrame; readonly step: JumpStep } | null {
  if (ms >= jump.durationMs || !jump.frames.length) {
    return null;
  }
  const frame = jump.frames.findLast((entry) => entry.startMs <= ms) ?? jump.frames[0]!;
  let start = frame.startMs;
  for (const step of frame.steps) {
    start += step.ms;
    if (ms < start) {
      return { frame, step };
    }
  }
  return { frame, step: frame.steps.at(-1)! };
}

/** The emergency jump tints only the charge phase: its glow, and a red wash. */
export function emergencyGlow(
  jump: QuantumJump,
  frame: JumpFrame,
  step: JumpStep,
): string | undefined {
  return frame.name === "charge" ? jump.emergency.charge.glow : step.glow;
}

/**
 * When the game may switch to the destination: the first moment the source is fully covered,
 * the bright `jump` phase or, under reduced motion, the held still.
 */
export function switchMs(jump: QuantumJump, reducedMotion: boolean): number {
  if (reducedMotion) {
    const held = jump.reducedMotion.steps.find((step) => "show" in step && step.show === "still");
    return held?.fromMs ?? jump.reducedMotion.durationMs / 2;
  }
  return (
    jump.frames.find((frame) => frame.bright)?.startMs ??
    jump.frames.find((frame) => frame.destination)?.startMs ??
    jump.durationMs / 2
  );
}

/** Reduced motion: each scene's opacity at `ms`; null once the cross-fade is over. */
export function reducedWeights(
  jump: QuantumJump,
  ms: number,
): Readonly<Record<ReducedScene, number>> | null {
  if (ms >= jump.reducedMotion.durationMs) {
    return null;
  }
  const weights = { destination: 0, source: 0, still: 0 };
  const step =
    jump.reducedMotion.steps.find((entry) => ms >= entry.fromMs && ms < entry.toMs) ??
    jump.reducedMotion.steps.at(-1)!;
  if ("show" in step) {
    weights[step.show] = 1;
  } else {
    const t = Math.min(1, Math.max(0, (ms - step.fromMs) / (step.toMs - step.fromMs)));
    weights[step.crossFade[0]] += 1 - t;
    weights[step.crossFade[1]] += t;
  }
  return weights;
}

/**
 * Reduced motion: the held ship's opacity at `ms`, the source's until holdToMs, then a linear
 * cross-fade into the destination's by crossFadeToMs.
 */
export function reducedShipWeights(
  jump: QuantumJump,
  ms: number,
): { readonly destination: number; readonly source: number } {
  const { crossFadeToMs, holdToMs } = jump.reducedMotion.ship;
  const t =
    ms <= holdToMs ? 0 : Math.min(1, (ms - holdToMs) / Math.max(1e-9, crossFadeToMs - holdToMs));
  return { destination: t, source: 1 - t };
}

/** Iris radius in logical px for a view of `view` logical px. */
export function irisRadius(view: { width: number; height: number }, iris: JumpIris): number {
  return iris.radius ?? ((iris.reach ?? 1) * Math.hypot(view.width, view.height)) / 2;
}

/**
 * The sprite pose's heading: the source heading turned `turn` of the shortest way round to the
 * arrival heading, on a whole frame of `headings`; without `turn`, the arrival heading.
 */
export function spriteHeading(
  source: number,
  arrival: number,
  turn: number | undefined,
  headings: number,
): number {
  if (turn === undefined) {
    return arrival;
  }
  const half = headings / 2;
  const delta = ((((arrival - source) % headings) + headings + half) % headings) - half;
  return ((Math.round(source + delta * turn) % headings) + headings) % headings;
}

/** A pose's drawn size in logical px at a step's scale: the in-game size (112) at scale 1. */
export function warpPoseSize(warp: Warp, scale: number): number {
  return scale * warp.frame * warp.displayScale;
}

/** The selected paint's pose SVGs by pose id, Classic's where the paint has none. */
export function posePaths(warp: Warp, scheme: string): ReadonlyMap<string, string> {
  return new Map(
    warp.poses.flatMap((pose) => {
      const path = pose.paths[scheme] ?? pose.paths.classic;
      return path ? [[pose.id, path] as const] : [];
    }),
  );
}

/**
 * The tunnel canvas's scale, so it covers a view of `view` from a jump centre `center`: at least
 * 1, and twice the farther edge's reach on each axis over the canvas.
 */
export function tunnelScale(
  canvas: { height: number; width: number },
  center: Vec,
  view: { height: number; width: number },
): number {
  return Math.max(
    1,
    (2 * Math.max(center.x, view.width - center.x)) / canvas.width,
    (2 * Math.max(center.y, view.height - center.y)) / canvas.height,
  );
}

/**
 * The storybook background rule the reduced-motion still follows: a canvas of `canvas` logical
 * px, centred on the view at scale `max(1, viewWidth / w, viewHeight / h)`. Returns its top-left
 * in view logical px and the scale.
 */
export function canvasFit(
  canvas: { width: number; height: number },
  view: { width: number; height: number },
): Vec & { scale: number } {
  const scale = Math.max(1, view.width / canvas.width, view.height / canvas.height);
  return {
    scale,
    x: (view.width - canvas.width * scale) / 2,
    y: (view.height - canvas.height * scale) / 2,
  };
}
