import { PLAYER_WEAPON_COVERAGE } from "../data/playerWeaponCoverage.ts";
import { toScreen } from "./convex.ts";
import type { Vec } from "./types.ts";

export interface PlayerWeaponCoverageContext {
  readonly centre: Vec;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

/** World travel from a muzzle to the projected boundary, captured once at fire time. */
export function playerWeaponCoverage(
  context: PlayerWeaponCoverageContext,
  ray: { readonly direction: Vec; readonly origin: Vec },
): number {
  const { centre, viewportHeight, viewportWidth } = context;
  const { direction, origin } = ray;
  if (
    ![centre.x, centre.y, origin.x, origin.y, direction.x, direction.y].every(Number.isFinite) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(viewportWidth) ||
    viewportHeight <= 0 ||
    viewportWidth <= 0
  ) {
    return 0;
  }
  const length = Math.hypot(direction.x, direction.y);
  if (!length || !Number.isFinite(length)) {
    return 0;
  }
  const shape = PLAYER_WEAPON_COVERAGE;
  const width = shape.halfWidth * (viewportWidth / shape.viewportWidth);
  const height = shape.halfHeight * (viewportHeight / shape.viewportHeight);
  const dx = origin.x - centre.x;
  const dy = origin.y - centre.y;
  const offset = toScreen({ x: dx, y: dy });
  const heading = toScreen({ x: direction.x / length, y: direction.y / length });
  const x = offset.x / width;
  const y = offset.y / height;
  const vx = heading.x / width;
  const vy = heading.y / height;
  const inside = (travel: number) =>
    Math.abs(x + vx * travel) ** shape.exponent + Math.abs(y + vy * travel) ** shape.exponent <= 1;
  if (!inside(0)) {
    return 0;
  }
  // The enclosing rectangle bounds the unique forward exit of this convex shape.
  let high = Math.min(
    vx ? (Math.sign(vx) - x) / vx : Infinity,
    vy ? (Math.sign(vy) - y) / vy : Infinity,
  );
  if (!Number.isFinite(high) || high <= 0) {
    return 0;
  }
  let low = 0;
  for (let step = 0; step < 64; step++) {
    const middle = low + (high - low) / 2;
    if (inside(middle)) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return low;
}
