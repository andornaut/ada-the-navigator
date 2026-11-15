import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import type { EconomyCatalog } from "../data/economy.ts";
import { fromScreen } from "./convex.ts";
import type { Vec } from "./types.ts";

export interface PickupObstacle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
type StardustSpacing = Pick<EconomyCatalog, "stardustPickupGap" | "stardustPickupRadius"> & {
  readonly obstacles?: readonly PickupObstacle[];
};

/** Four pickups at three quarters of the ordinary projected diamond spacing. */
export function stardustDiamond(context: StardustSpacing, point: Vec): Vec[] {
  const step =
    (Math.ceil(Math.SQRT2 * (context.stardustPickupRadius + GALAXIES_FILE.lightField.keyline)) +
      context.stardustPickupGap) *
    0.75;
  return [
    { x: 0, y: -step },
    { x: step, y: 0 },
    { x: 0, y: step },
    { x: -step, y: 0 },
  ].map((offset) => {
    const world = fromScreen(offset);
    return { x: point.x + world.x, y: point.y + world.y };
  });
}

/** Preserve random drop candidates while separating full-glint bounds in projected logical px. */
export function stardustDropOffsets(context: StardustSpacing, candidates: readonly Vec[]): Vec[] {
  const radius = Math.SQRT2 * (context.stardustPickupRadius + GALAXIES_FILE.lightField.keyline);
  const placed: Vec[] = [];
  for (const candidate of candidates) {
    const point = { ...candidate };
    const blockers = [
      ...(context.obstacles ?? []),
      ...placed.map((previous) => ({ ...previous, radius })),
    ].sort((a, b) => a.x - b.x);
    for (const previous of blockers) {
      const minimum = previous.radius + radius + context.stardustPickupGap;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < minimum) {
        point.x = Math.ceil(previous.x + minimum);
      }
    }
    placed.push(point);
  }
  return placed;
}
