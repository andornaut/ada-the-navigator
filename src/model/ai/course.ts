import type { Point } from "../../data/enemyCatalog.ts";

export const magnitude = (point: Point): number => Math.hypot(point.x, point.y);

export const rotate = (vector: Point, angle: number): Point => ({
  x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
  y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
});
