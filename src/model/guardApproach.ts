import type { SpaceObject, Vec } from "./types.ts";
import { type WorldContext, worldDelta, worldPoint } from "./worldContacts.ts";

export interface GuardObstacle extends Vec {
  readonly radius: number;
}

/** A local tangent detour keeps a summoned guard outside protected areas on its way to Ada. */
export function guardApproach(
  context: WorldContext,
  obstacles: readonly GuardObstacle[],
  player: Vec,
  guard: Pick<SpaceObject, "radius" | "x" | "y">,
): Vec {
  const target = worldPoint(context, guard, player);
  const delta = worldDelta(context, guard, player);
  const squared = delta.x ** 2 + delta.y ** 2;
  if (!squared) {
    return target;
  }
  const blocked = obstacles
    .flatMap((obstacle) => {
      const center = worldPoint(context, guard, obstacle);
      const offset = { x: center.x - guard.x, y: center.y - guard.y };
      const along = (offset.x * delta.x + offset.y * delta.y) / squared;
      const radius = obstacle.radius + guard.radius;
      // Ada can remain inside safety. The guard still stops at that area's boundary.
      if (along <= 0 || Math.hypot(target.x - center.x, target.y - center.y) <= radius) {
        return [];
      }
      const nearest = Math.min(1, along);
      if (Math.hypot(offset.x - nearest * delta.x, offset.y - nearest * delta.y) >= radius) {
        return [];
      }
      return [{ along, center, radius }];
    })
    .sort((a, b) => a.along - b.along);
  const obstacle = blocked[0];
  if (!obstacle) {
    return target;
  }
  // One hull radius of steering clearance leaves room for the ship's existing turn physics.
  const radius = obstacle.radius + guard.radius;
  const offset = { x: guard.x - obstacle.center.x, y: guard.y - obstacle.center.y };
  const distance = Math.hypot(offset.x, offset.y);
  const angle = Math.atan2(offset.y, offset.x);
  if (distance <= radius) {
    return {
      x: obstacle.center.x + Math.cos(angle) * radius,
      y: obstacle.center.y + Math.sin(angle) * radius,
    };
  }
  const tangent = Math.acos(radius / distance);
  const candidates = [angle + tangent, angle - tangent].map((heading) => ({
    x: obstacle.center.x + Math.cos(heading) * radius,
    y: obstacle.center.y + Math.sin(heading) * radius,
  }));
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y),
  )[0]!;
}
