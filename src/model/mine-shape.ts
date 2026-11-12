import weapons from "../../public/art/enemy-weapons.json" with { type: "json" };
import { type Parts, toScreen } from "./convex.ts";
import type { Vec } from "./types.ts";

// A mine's drawn silhouette (art/weapons.md "Mine"): Art's convex parts in logical px about the
// mine's projected centre at spin 0, screen axes with y down, turned with the drawing.

/** Art's mine parts at spin 0: a 32-sided body polygon and 8 spike triangles; they overlap. */
export const MINE_PARTS: Parts = weapons.mine.collision.map((part) =>
  part.map(([x, y]) => ({ x: x!, y: y! })),
);

/** The farthest point of the silhouette from the mine's centre, at any spin. */
export const MINE_REACH = Math.max(
  ...MINE_PARTS.flatMap((part) => part.map(({ x, y }) => Math.hypot(x, y))),
);

/** The mine's spin in degrees per second; reduced motion holds it at 0. */
export const MINE_SPIN = weapons.mine.spin.degPerSecond;

/** The spin angle `th` in degrees for a mine `age` seconds after its drop. */
export function mineSpin(reducedMotion: boolean, age: number): number {
  return reducedMotion ? 0 : MINE_SPIN * age;
}

/** The parts turned by `spin` degrees, clockwise on screen as the drawing turns. */
export function mineParts(spin: number): Parts {
  const angle = (spin * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return MINE_PARTS.map((part) =>
    part.map(({ x, y }) => ({ x: x * cos - y * sin, y: x * sin + y * cos })),
  );
}

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
 * Whether a mine at world point `mine`, spun to `spin`, touches a drawn body whose convex screen
 * parts are offsets from world point `position`: the projection is linear, so the outlines meet
 * on the screen exactly when they meet on the world plane.
 */
export function mineTouches(spin: number, mine: Vec, body: Parts, position: Vec): boolean {
  const offset = toScreen({ x: position.x - mine.x, y: position.y - mine.y });
  const reach = Math.max(0, ...body.flatMap((part) => part.map(({ x, y }) => Math.hypot(x, y))));
  if (Math.hypot(offset.x, offset.y) > MINE_REACH + reach) {
    return false;
  }
  const placed = body.map((part) => part.map(({ x, y }) => ({ x: x + offset.x, y: y + offset.y })));
  const parts = mineParts(spin);
  return parts.some((part) => placed.some((piece) => convexOverlap(part, piece)));
}
