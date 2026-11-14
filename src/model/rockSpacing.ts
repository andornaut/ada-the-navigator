import { scenerySilhouette, type Silhouette } from "./asteroids.ts";
import { grown, hull, type Parts, partsReach, toScreen, unionContact } from "./convex.ts";
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

interface PreparedEdge {
  readonly dx: number;
  readonly dy: number;
  readonly x: number;
  readonly y: number;
}
interface ExpandedEnvelope {
  readonly maximum: Vec;
  readonly minimum: Vec;
  readonly parts: readonly (readonly PreparedEdge[])[];
}
const EXPANDED_ENVELOPES = new WeakMap<Envelope, WeakMap<Envelope, ExpandedEnvelope>>();

/** Prepares the same edge cross products once per immutable, ordered envelope pair. */
function envelopesContain(first: Envelope, second: Envelope, point: Vec): boolean {
  let byBody = EXPANDED_ENVELOPES.get(first);
  if (!byBody) {
    byBody = new WeakMap();
    EXPANDED_ENVELOPES.set(first, byBody);
  }
  let expanded = byBody.get(second);
  if (!expanded) {
    const outlines = grown(first.parts, second.parts);
    const points = outlines.flat();
    const extent = Math.max(1, ...points.flatMap(({ x, y }) => [Math.abs(x), Math.abs(y)]));
    // Include arithmetic rounding at the box edge; the exact cross products still decide contact.
    const padding = 8 * Number.EPSILON * extent;
    const unbounded = outlines.some((part) => part.length < 3);
    expanded = {
      maximum: {
        x: unbounded ? Infinity : Math.max(...points.map(({ x }) => x)) + padding,
        y: unbounded ? Infinity : Math.max(...points.map(({ y }) => y)) + padding,
      },
      minimum: {
        x: unbounded ? -Infinity : Math.min(...points.map(({ x }) => x)) - padding,
        y: unbounded ? -Infinity : Math.min(...points.map(({ y }) => y)) - padding,
      },
      parts: outlines.map((part) =>
        part.map((origin, index) => {
          const next = part[(index + 1) % part.length]!;
          return { dx: next.x - origin.x, dy: next.y - origin.y, x: origin.x, y: origin.y };
        }),
      ),
    };
    byBody.set(second, expanded);
  }
  if (
    point.x < expanded.minimum.x ||
    point.x > expanded.maximum.x ||
    point.y < expanded.minimum.y ||
    point.y > expanded.maximum.y
  ) {
    return false;
  }
  for (const part of expanded.parts) {
    let sign = 0;
    let outside = false;
    for (const edge of part) {
      const cross = edge.dx * (point.y - edge.y) - edge.dy * (point.x - edge.x);
      if (cross === 0) {
        continue;
      }
      const direction = Math.sign(cross);
      if (sign && direction !== sign) {
        outside = true;
        break;
      }
      sign = direction;
    }
    if (!outside) {
      return true;
    }
  }
  return false;
}

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
  const reach = first.reach + driftA + second.reach + driftB;
  if (
    Math.abs(offset.x) >= reach ||
    Math.abs(offset.y) >= reach ||
    Math.hypot(offset.x, offset.y) >= reach
  ) {
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
  return envelopesContain(first, second, offset);
}
