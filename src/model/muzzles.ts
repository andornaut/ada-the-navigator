import type { Point } from "../data/enemy-catalog.ts";
import { ENEMY_DISPLAY_SCALE, type MuzzleLayout } from "../data/enemy-muzzles.ts";

/** Art's sixteen hull headings and turret aim frames. */
export const DRAWN_DIRECTIONS = 16;

/** The drawn frame for a world direction: index `i` faces world angle `i * 22.5` degrees. */
export function drawnIndex(direction: Point): number {
  const index = Math.round(
    Math.atan2(direction.y, direction.x) / ((2 * Math.PI) / DRAWN_DIRECTIONS),
  );
  return ((index % DRAWN_DIRECTIONS) + DRAWN_DIRECTIONS) % DRAWN_DIRECTIONS;
}

/** A display px offset on screen to world units under the view's 2:1 projection. */
function screenToWorld(screen: Point): Point {
  return { x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 };
}

/**
 * World offset from the hull centre to a turret's drawn barrel tip: the pivot of the hull's
 * drawn heading plus the muzzle of the top's drawn aim frame, cycling through the top's barrels
 * by `volley`. Undefined when the art defines no muzzle for that turret, which keeps the model
 * origin.
 */
export function muzzleOffset(
  layout: MuzzleLayout | undefined,
  turret: string,
  facing: Point,
  aim: Point,
  volley: number,
): Point | undefined {
  const part = layout?.turrets.get(turret);
  const pivot = part?.pivots[drawnIndex(facing)];
  const tips = part?.tips[drawnIndex(aim)];
  if (!pivot || !tips?.length) {
    return undefined;
  }
  const tip = tips[((volley % tips.length) + tips.length) % tips.length]!;
  return screenToWorld({
    x: (pivot.x + tip.x) * ENEMY_DISPLAY_SCALE,
    y: (pivot.y + tip.y) * ENEMY_DISPLAY_SCALE,
  });
}
