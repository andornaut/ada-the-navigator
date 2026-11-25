// The game-owned refusal timing and colour, drawn by the published DOM cue stylesheet.
import {
  type RefusalCue,
  refuse as playRefusal,
} from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import { COLOURS } from "./layout/colours.ts";

export const REFUSAL = {
  color: COLOURS.refusalRed,
  durationMs: 320,
  shakePx: 3,
  stepMs: 80,
} as const;

const CUE: RefusalCue = {
  shake: REFUSAL.shakePx,
  shakeShape: "alternate",
  stepMs: REFUSAL.stepMs,
  steps: REFUSAL.durationMs / REFUSAL.stepMs,
};

// The kit owns scheduling, restart and cleanup; callers may cancel when disposing a control.
export function refuse(element: HTMLElement, reducedMotion: boolean): () => void {
  element.style.setProperty("--ui-unit", "var(--ada-unit)");
  element.style.setProperty("--ui-refusal-colour", REFUSAL.color);
  return playRefusal(CUE, reducedMotion, element);
}

/** A canvas control's refusal pose: whether it shows the refusal tint, and its shake in px. */
export interface RefusalPose {
  readonly shake: number;
  readonly tinted: boolean;
}

/**
 * The refusal cue's pose `elapsed` ms after it starts, for a control drawn on the canvas, which the
 * kit's DOM cue cannot reach (art/controls.md "Refusal cue"): the tint shows on the beats from 80
 * to 160 and 240 to 320 ms, and the control shakes 3 px right and back four times, 40 ms each way.
 * Reduced motion holds the tint for the whole cue with no shake. Null outside the cue.
 */
export function refusalPose(reducedMotion: boolean, elapsed: number): RefusalPose | null {
  if (!(elapsed >= 0) || elapsed >= REFUSAL.durationMs) {
    return null;
  }
  if (reducedMotion) {
    return { shake: 0, tinted: true };
  }
  const half = REFUSAL.stepMs / 2;
  const phase = elapsed % REFUSAL.stepMs;
  return {
    shake: (REFUSAL.shakePx * (phase < half ? phase : REFUSAL.stepMs - phase)) / half,
    tinted: Math.floor(elapsed / REFUSAL.stepMs) % 2 === 1,
  };
}

/** When a refusal at `now` starts its cue: a repeat while one still plays keeps that cue's start. */
export function refusalStart(now: number, started: number | undefined): number {
  return started !== undefined && now - started >= 0 && now - started < REFUSAL.durationMs
    ? started
    : now;
}
