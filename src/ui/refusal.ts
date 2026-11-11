// The shared refusal cue for an action that cannot act (art/controls.md "Refusal cue"): for 320ms
// the label or glyph alternates red every 80ms while the face shakes 3 logical px. With reduced
// motion the label holds red for the 320ms and nothing moves. The Paused card, the shop, the
// weapon buttons and the story panel share it.

import { units } from "./layout/css.ts";

export const REFUSAL = { color: "#e4574e", durationMs: 320, shakePx: 3, stepMs: 80 } as const;

export interface RefusalFrame {
  // Milliseconds from the press.
  readonly at: number;
  // The face's sideways offset in logical px.
  readonly offset: number;
  readonly red: boolean;
}

// The cue's frames, ending with the rest frame at durationMs.
export function refusalFrames(reducedMotion: boolean): readonly RefusalFrame[] {
  const rest = { at: REFUSAL.durationMs, offset: 0, red: false };
  if (reducedMotion) {
    return [{ at: 0, offset: 0, red: true }, rest];
  }
  const steps = REFUSAL.durationMs / REFUSAL.stepMs;
  return [
    ...Array.from({ length: steps }, (_, index) => ({
      at: index * REFUSAL.stepMs,
      offset: (index % 2 === 0 ? -1 : 1) * REFUSAL.shakePx,
      red: index % 2 === 0,
    })),
    rest,
  ];
}

interface CueTarget {
  readonly style: Pick<CSSStyleDeclaration, "removeProperty" | "setProperty">;
}

const running = new WeakMap<CueTarget, () => void>();

// Plays the cue on element, restarting it if one is already playing there.
export function refuse(element: CueTarget, reducedMotion: boolean): void {
  running.get(element)?.();
  const timers = refusalFrames(reducedMotion).map((frame) =>
    setTimeout(() => {
      if (frame.red) {
        element.style.setProperty("color", REFUSAL.color);
      } else {
        element.style.removeProperty("color");
      }
      if (frame.offset) {
        element.style.setProperty("transform", `translateX(${units(frame.offset)})`);
      } else {
        element.style.removeProperty("transform");
      }
      if (frame.at === REFUSAL.durationMs) {
        running.delete(element);
      }
    }, frame.at),
  );
  running.set(element, () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    element.style.removeProperty("color");
    element.style.removeProperty("transform");
  });
}
