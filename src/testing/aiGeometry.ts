import { scenerySilhouette } from "../model/asteroids.ts";
import { closestOnSegment, worldParts } from "../model/convex.ts";
import { enemyHull } from "../model/enemyBody.ts";
import type { SpaceObject, Vec } from "../model/types.ts";

/** Independent vertex-to-edge distance on the actual authored outlines, in world units. */
export function actualGap(rock: SpaceObject, position: Vec, facing: Vec): number {
  const hull = worldParts(enemyHull({ archetype: "frigate", facing })!);
  const outline = worldParts(scenerySilhouette(rock)!.frames[0]!);
  const own = hull.map((part) => part.map((p) => ({ x: p.x + position.x, y: p.y + position.y })));
  const other = outline.map((part) => part.map((p) => ({ x: p.x + rock.x, y: p.y + rock.y })));
  let gap = Infinity;
  for (const [a, b] of [
    [own, other],
    [other, own],
  ] as const) {
    for (const part of a) {
      for (const point of part) {
        for (const edge of b) {
          for (let index = 0; index < edge.length; index++) {
            const nearest = closestOnSegment(point, edge[index]!, edge[(index + 1) % edge.length]!);
            gap = Math.min(gap, Math.hypot(nearest.x - point.x, nearest.y - point.y));
          }
        }
      }
    }
  }
  return gap;
}
