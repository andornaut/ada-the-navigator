import type { Vec } from "../model/types.ts";

// Art's quantum jump effect (art/quantum-jump.md): the data, its timeline and the shared canvas fit.

export interface JumpIris {
  readonly radius?: number;
  /** Radius as a share of the view's half-diagonal. */
  readonly reach?: number;
}
export interface JumpFrame {
  readonly bright?: boolean;
  readonly destination?: boolean;
  readonly field?: string;
  readonly glow?: string;
  readonly iris?: JumpIris;
  readonly ms: number;
  readonly name: string;
  readonly star?: boolean;
  readonly startMs: number;
  readonly streak?: number;
  readonly white?: number;
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
    readonly steps: readonly ReducedStep[];
    readonly still: string;
  };
  readonly streak: { readonly colour: string; readonly length: number; readonly width: number };
}

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const colour = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const name = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const SCENES: readonly ReducedScene[] = ["source", "still", "destination"];

function readFrame(value: unknown): JumpFrame | undefined {
  const frame = fields(value);
  if (!frame || !name(frame.name) || !finite(frame.startMs) || !finite(frame.ms) || frame.ms <= 0) {
    return undefined;
  }
  const iris = frame.iris === undefined ? undefined : fields(frame.iris);
  if (
    (frame.iris !== undefined &&
      (!iris || (finite(iris.radius) ? iris.reach !== undefined : !finite(iris.reach)))) ||
    (frame.field !== undefined && !name(frame.field)) ||
    (frame.glow !== undefined && !name(frame.glow)) ||
    (frame.white !== undefined && !finite(frame.white)) ||
    (frame.streak !== undefined && !finite(frame.streak))
  ) {
    return undefined;
  }
  return {
    ...(frame.bright === true ? { bright: true } : {}),
    ...(frame.destination === true ? { destination: true } : {}),
    ...(frame.field ? { field: frame.field as string } : {}),
    ...(frame.glow ? { glow: frame.glow as string } : {}),
    ...(iris
      ? { iris: finite(iris.radius) ? { radius: iris.radius } : { reach: iris.reach as number } }
      : {}),
    ms: frame.ms,
    name: frame.name,
    ...(frame.star === true ? { star: true } : {}),
    startMs: frame.startMs,
    ...(finite(frame.streak) ? { streak: frame.streak } : {}),
    ...(finite(frame.white) ? { white: frame.white } : {}),
  };
}

function readStep(value: unknown): ReducedStep | undefined {
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
  if (
    !root ||
    root.version !== 1 ||
    !finite(root.durationMs) ||
    !Array.isArray(root.frames) ||
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
    !Array.isArray(reduced.steps)
  ) {
    return undefined;
  }
  const frames = (root.frames as unknown[]).map(readFrame);
  const steps = (reduced.steps as unknown[]).map(readStep);
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
      steps: steps as ReducedStep[],
      still: reduced.still,
    },
    streak: { colour: streak.colour, length: streak.length, width: streak.width },
  };
}

/** The frame showing at `ms`, or null once the jump is over. Frames hold; nothing tweens. */
export function jumpFrameAt(jump: QuantumJump, ms: number): JumpFrame | null {
  if (ms >= jump.durationMs) {
    return null;
  }
  return jump.frames.findLast((frame) => frame.startMs <= ms) ?? jump.frames[0] ?? null;
}

/** The emergency jump tints only the charge frame: its glow and a red wash. */
export function emergencyGlow(jump: QuantumJump, frame: JumpFrame): string | undefined {
  return frame.name === "charge" ? jump.emergency.charge.glow : frame.glow;
}

/**
 * When the game may switch to the destination: the first moment the source is fully covered,
 * the bright `jump` frame or, under reduced motion, the held still.
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

/** Iris radius in logical px for a view of `view` logical px. */
export function irisRadius(view: { width: number; height: number }, iris: JumpIris): number {
  return iris.radius ?? ((iris.reach ?? 1) * Math.hypot(view.width, view.height)) / 2;
}

/**
 * The cockpit's canopy focus in view logical px, where a jump from the cockpit centres: 150 of
 * the 390 design px down its 779 by 360 logical framing (13 design px per 12 logical px), which
 * grows with the cockpit's canvas scale.
 */
export function cockpitFocus(view: { width: number; height: number }): Vec {
  const fit = canvasFit({ height: 540, width: 960 }, view);
  return { x: view.width / 2, y: view.height / 2 + (150 * (12 / 13) - 180) * fit.scale };
}

/**
 * The storybook background rule shared by the field and the cockpit: a canvas of `canvas`
 * logical px, centred on the view at scale `max(1, viewWidth / w, viewHeight / h)`. Returns its
 * top-left in view logical px and the scale.
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
