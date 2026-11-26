import { HUD_TICK_TIMING } from "../data/noticeTiming.ts";
import type { Weapon } from "../data/types.ts";

export interface AmmoFeedback {
  readonly added: number;
  readonly opacity: number;
}

/** Grant-time amounts only: snapshots and nominal pack sizes never enter this presenter. */
export class AmmoFeedbackQueue {
  private readonly entries = new Map<Weapon, { added: number; elapsed: number }>();

  clear(): void {
    this.entries.clear();
  }

  push(weapon: Weapon, added: number): void {
    if (weapon === "laser" || !Number.isSafeInteger(added) || added <= 0) {
      return;
    }
    const current = this.entries.get(weapon);
    this.entries.set(weapon, { added: (current?.added ?? 0) + added, elapsed: 0 });
  }

  advance(ms: number, running: boolean, reducedMotion = false): ReadonlyMap<Weapon, AmmoFeedback> {
    const { fadeMs, holdMs } = HUD_TICK_TIMING[reducedMotion ? "reduced" : "normal"];
    const duration = holdMs + fadeMs;
    const frames = new Map<Weapon, AmmoFeedback>();
    for (const [weapon, entry] of this.entries) {
      entry.elapsed += running ? Math.max(0, ms) : 0;
      if (entry.elapsed >= duration) {
        this.entries.delete(weapon);
      } else {
        frames.set(weapon, {
          added: entry.added,
          opacity: Math.min(1, (duration - entry.elapsed) / fadeMs),
        });
      }
    }
    return frames;
  }
}
