import { grown, inside, type Parts, partsReach, worldParts } from "../../convex.ts";
import type { Vec } from "../../types.ts";

/** Zero-margin placement needs union membership, not a penetration depth or exit normal. */
export function placementOutlinesOverlap(
  obstacle: Parts,
  origin: Vec,
  body: Parts,
  position: Vec,
): boolean {
  const shape = worldParts(obstacle);
  const own = worldParts(body);
  const offset = { x: position.x - origin.x, y: position.y - origin.y };
  if (Math.hypot(offset.x, offset.y) >= partsReach(shape) + partsReach(own)) {
    return false;
  }
  return grown(shape, own).some((part) => inside(part, offset));
}
