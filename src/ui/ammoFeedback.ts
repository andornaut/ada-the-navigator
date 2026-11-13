import type { Weapon } from "../data/types.ts";

/** A brief refill label by the corresponding weapon, measured in unpaused play time. */
export const AMMO_FEEDBACK_MS = 1200;

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

  advance(ms: number, running: boolean): ReadonlyMap<Weapon, AmmoFeedback> {
    const frames = new Map<Weapon, AmmoFeedback>();
    for (const [weapon, entry] of this.entries) {
      entry.elapsed += running ? Math.max(0, ms) : 0;
      if (entry.elapsed >= AMMO_FEEDBACK_MS) {
        this.entries.delete(weapon);
      } else {
        frames.set(weapon, {
          added: entry.added,
          opacity: Math.min(1, (AMMO_FEEDBACK_MS - entry.elapsed) / 300),
        });
      }
    }
    return frames;
  }
}
