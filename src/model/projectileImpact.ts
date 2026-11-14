import type { Contact } from "./convex.ts";
import type { Vec } from "./types.ts";

/** First collision within an already detected movement segment, using its existing predicate. */
export function impactEntry(touches: (point: Vec) => boolean, from: Vec, to: Vec): Vec {
  if (touches(from)) {
    return { ...from };
  }
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step++) {
    const t = (low + high) / 2;
    if (touches({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })) {
      high = t;
    } else {
      low = t;
    }
  }
  return { x: from.x + (to.x - from.x) * high, y: from.y + (to.y - from.y) * high };
}

/** Resolve the surface from the collision normal/depth, including screen-space scenery radii. */
export function impactSurface(
  context: { readonly contact: Contact; readonly projected: boolean; readonly radius: number },
  point: Vec,
): Vec {
  const { contact, projected, radius } = context;
  const { normal } = contact;
  const worldRadius = projected
    ? radius * Math.hypot((normal.x - normal.y) / 2, normal.x + normal.y)
    : radius;
  const offset = contact.depth - worldRadius;
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}
