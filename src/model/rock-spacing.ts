import { scenerySilhouette, type Silhouette } from "./asteroids.ts";
import { grown, hull, inside, type Parts, partsReach, toScreen, unionContact } from "./convex.ts";
import type { Vec } from "./types.ts";

// Rock-to-rock spacing on the screen (gameplay/rules.md: placement keeps drawn objects from
// overlapping on screen). Two drawn rocks overlap where their outlines meet on the screen: a still
// rock's drawn frame, or the convex hull of every frame of a spinning one; a drifting rock anywhere
// on its loop, as a disc of its outline's reach plus the loop.

/** What spacing reads of a placement: where it sits, its drawn rock and its drift loop. */
export interface Spaced extends Vec {
  readonly asteroid?: string;
  readonly kind: "pickup" | "resource" | "rock";
  readonly orbit?: { readonly radius: number };
}

interface Envelope {
  readonly parts: Parts;
  readonly reach: number;
}
const ENVELOPES = new WeakMap<Silhouette, Envelope>();

/**
 * A placement's drawn envelope, everything its rock can draw in screen px from its pivot, and
 * that envelope's reach; null for one drawn as no rock.
 */
export function drawnRock(placement: Spaced): Envelope | null {
  if (placement.kind === "pickup") {
    return null;
  }
  const drawn = scenerySilhouette(placement);
  if (!drawn) {
    return null;
  }
  let envelope = ENVELOPES.get(drawn);
  if (!envelope) {
    const parts = drawn.frames.length === 1 ? drawn.frames[0]! : [hull(drawn.frames.flat(2))];
    envelope = { parts, reach: partsReach(parts) };
    ENVELOPES.set(drawn, envelope);
  }
  return envelope;
}

/** Screen px a drift loop of world radius r can move a rock from its loop's centre. */
export const loopReach = (radius: number): number => radius * Math.SQRT2;

/** Whether two placements' drawn rocks can overlap on the screen, a drifting one anywhere on its loop. */
export function rocksOverlap(a: Spaced, b: Spaced): boolean {
  const first = drawnRock(a);
  const second = drawnRock(b);
  if (!first || !second) {
    return false;
  }
  const offset = toScreen({ x: b.x - a.x, y: b.y - a.y });
  const driftA = loopReach(a.orbit?.radius ?? 0);
  const driftB = loopReach(b.orbit?.radius ?? 0);
  if (Math.hypot(offset.x, offset.y) >= first.reach + driftA + second.reach + driftB) {
    return false;
  }
  if (driftA && driftB) {
    return true;
  }
  if (driftA || driftB) {
    // The drifting rock as a disc of its outline's reach plus its loop.
    const [still, moving, centre, drift] = driftA
      ? [second, first, { x: -offset.x, y: -offset.y }, driftA]
      : [first, second, offset, driftB];
    return unionContact(still.parts, centre, moving.reach + drift) !== null;
  }
  // b at `offset` overlaps a when the offset lies in a grown by b.
  return grown(first.parts, second.parts).some((part) => inside(part, offset));
}
