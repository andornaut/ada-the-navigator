import type { Point } from "../../data/enemyCatalog.ts";

export const magnitude = (point: Point): number => Math.hypot(point.x, point.y);

export const rotate = (vector: Point, angle: number): Point => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});

/** A seeded value in [0, 1) from an id such as a ship's or a pack's, fixed for its life. */
export function seeded(id: string, salt: number): number {
  let value = 2166136261 ^ salt;
  for (let index = 0; index < id.length; index++) {
    value = Math.imul(value ^ id.charCodeAt(index), 16777619);
  }
  return (value >>> 0) / 2 ** 32;
}
