// The game-owned refusal timing and colour, drawn by the published DOM cue stylesheet.
import { type RefusalCue, refuse as playRefusal } from "@andornaut/game-kit/web/ui/dom/refusalCue";

export const REFUSAL = { color: "#e4574e", durationMs: 320, shakePx: 3, stepMs: 80 } as const;

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
