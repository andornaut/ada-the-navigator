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
 * kit's DOM cue cannot reach. It reads the CUE the kit's cue plays, with the kit's beats: the tint
 * shows on every even step (0 to 80 and 160 to 240 ms) and the control shakes 3 px right and back
 * on each step, half a step each way, four times. Reduced motion holds the tint for the whole cue
 * with no shake. Null outside the cue; a repeat refusal restarts it, as the kit's does.
 */
export function refusalPose(reducedMotion: boolean, elapsed: number): RefusalPose | null {
  if (!(elapsed >= 0) || elapsed >= CUE.steps * CUE.stepMs) {
    return null;
  }
  if (reducedMotion) {
    return { shake: 0, tinted: true };
  }
  const half = CUE.stepMs / 2;
  const phase = elapsed % CUE.stepMs;
  return {
    shake: (CUE.shake * (phase < half ? phase : CUE.stepMs - phase)) / half,
    tinted: Math.floor(elapsed / CUE.stepMs) % 2 === 0,
  };
}
