import spearArt from "../../public/art/enemies/fleetInterceptor-jets.json" with { type: "json" };
import type { Point } from "../data/enemyCatalog.ts";
import { ENEMY_DISPLAY_SCALE, type MuzzleArt, type MuzzleLayout } from "../data/enemyMuzzles.ts";

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

/** Spear's flush emitter uses the same heading and frame centre as the drawn hull. */
export function spearMuzzleOffset(facing: Point): Point {
  const [x, y] = spearArt.headings[drawnIndex(facing)]!.muzzles[0]!;
  const half = spearArt.frame / 2;
  return screenToWorld({
    x: (x! - half) * ENEMY_DISPLAY_SCALE,
    y: (y! - half) * ENEMY_DISPLAY_SCALE,
  });
}

/**
 * World offset from the hull centre to a turret's drawn barrel tip: the pivot of the hull's
 * drawn heading plus the muzzle of the top's drawn aim frame, cycling through the top's barrels
 * by `volley`; an aft top's drawn aim is `(k + 8) mod 16` at hull heading k. Undefined when the
 * art defines no muzzle for that turret, which keeps the model origin.
 */
export function muzzleOffset(
  layout: MuzzleLayout | undefined,
  turret: string | null,
  facing: Point,
  aim: Point,
  volley: number,
): Point | undefined {
  const part = turret === null ? layout?.primary : layout?.turrets.get(turret);
  const heading = drawnIndex(facing);
  const pivot = part?.pivots[heading];
  const tips =
    part?.tips[part.aft ? (heading + DRAWN_DIRECTIONS / 2) % DRAWN_DIRECTIONS : drawnIndex(aim)];
  if (!pivot || !tips?.length) {
    return undefined;
  }
  const tip = tips[((volley % tips.length) + tips.length) % tips.length]!;
  return screenToWorld({
    x: (pivot.x + tip.x) * ENEMY_DISPLAY_SCALE,
    y: (pivot.y + tip.y) * ENEMY_DISPLAY_SCALE,
  });
}

/** The actual drawn base anchor, converted once from raw frame px into world axes. */
export function hardpointAnchorOffset(
  art: MuzzleArt | undefined,
  id: string,
  facing: Point,
): Point | undefined {
  const anchor = art?.anchors.get(id)?.[drawnIndex(facing)];
  return anchor
    ? screenToWorld({ x: anchor.x * ENEMY_DISPLAY_SCALE, y: anchor.y * ENEMY_DISPLAY_SCALE })
    : undefined;
}

/**
 * World offset from the hull centre to a fixed front Laser's drawn shot origin at the hull's drawn
 * heading, or undefined when Art draws none for it.
 */
export function fixedMuzzleOffset(
  art: MuzzleArt | undefined,
  id: string,
  facing: Point,
): Point | undefined {
  const muzzle = art?.fixed.get(id)?.[drawnIndex(facing)];
  return muzzle
    ? screenToWorld({ x: muzzle.x * ENEMY_DISPLAY_SCALE, y: muzzle.y * ENEMY_DISPLAY_SCALE })
    : undefined;
}
