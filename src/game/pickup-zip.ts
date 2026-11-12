import type { Vec } from "../model/types.ts";

// A collected pickup's zip into the ship (gameplay/rules.md forgiving contacts): drawn only, as
// collection, credit and the notice happen at contact. It accelerates from where the pickup was
// toward Ada's current position and shrinks as it goes; reduced motion skips it.

/** The share of its size a zipping pickup keeps as it reaches the ship. */
export const ZIP_END_SCALE = 0.4;

/** A zip `elapsed` seconds into `duration`: its world point and its scale, or null once done. */
export function zipAt(
  duration: number,
  elapsed: number,
  from: Vec,
  to: Vec,
): { readonly at: Vec; readonly scale: number } | null {
  if (!(duration > 0) || elapsed >= duration) {
    return null;
  }
  const t = Math.max(0, elapsed / duration);
  // Ease-in: it leaves gently and lands fast, pulled in.
  const eased = t * t;
  return {
    at: { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased },
    scale: 1 - (1 - ZIP_END_SCALE) * eased,
  };
}
