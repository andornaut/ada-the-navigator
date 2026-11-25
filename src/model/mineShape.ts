import weapons from "../../public/art/enemy-weapons.json" with { type: "json" };
import { type Parts, toScreen } from "./convex.ts";
import type { Vec } from "./types.ts";

// A mine's drawn silhouette (art/weapons.md "Mine"): Art's convex parts in logical px about the
// mine's projected centre, screen axes with y down. They cover the union of the mine's spin
// frames, so they hold still while the frames turn.

/** Art's mine parts: the ball, belt, collar and lamp and the studs at every spin step; they overlap. */
export const MINE_PARTS: Parts = weapons.mine.collision.map((part) =>
  part.map(([x, y]) => ({ x: x!, y: y! })),
);

/** The farthest point of the silhouette from the mine's centre. */
export const MINE_REACH = Math.max(
  ...MINE_PARTS.flatMap((part) => part.map(({ x, y }) => Math.hypot(x, y))),
);

/** Whether two convex polygons overlap, by the separating axis test; touching edges count. */
export function convexOverlap(a: readonly Vec[], b: readonly Vec[]): boolean {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index++) {
      const from = polygon[index]!;
      const to = polygon[(index + 1) % polygon.length]!;
      const axis = { x: from.y - to.y, y: to.x - from.x };
      const project = (points: readonly Vec[]) => {
        let min = Infinity;
        let max = -Infinity;
        for (const point of points) {
          const value = point.x * axis.x + point.y * axis.y;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
        return { max, min };
      };
      const first = project(a);
      const second = project(b);
      if (first.max < second.min || second.max < first.min) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Whether a mine at world point `mine` touches a drawn body whose convex screen parts are offsets
 * from world point `position`: the projection is linear, so the outlines meet on the screen
 * exactly when they meet on the world plane.
 */
export function mineTouches(mine: Vec, body: Parts, position: Vec): boolean {
  const offset = toScreen({ x: position.x - mine.x, y: position.y - mine.y });
  const reach = Math.max(0, ...body.flatMap((part) => part.map(({ x, y }) => Math.hypot(x, y))));
  if (Math.hypot(offset.x, offset.y) > MINE_REACH + reach) {
    return false;
  }
  const placed = body.map((part) => part.map(({ x, y }) => ({ x: x + offset.x, y: y + offset.y })));
  return MINE_PARTS.some((part) => placed.some((piece) => convexOverlap(part, piece)));
}
