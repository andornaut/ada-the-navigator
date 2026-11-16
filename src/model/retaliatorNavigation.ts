import type { EnemyDefinition, EnemyNavigation, Point } from "../data/enemyCatalog.ts";
import { type EnemyIdentity, retaliatorVariant } from "../data/enemyIdentity.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { type WorldContext, worldDistance, worldPoint } from "./worldContacts.ts";

export interface RetaliatorAsteroid {
  readonly id: string;
  readonly position: Point;
  readonly physicalReach: number;
}

export interface RetaliatorNavigationContext extends WorldContext {
  readonly navigation: EnemyNavigation;
  readonly pursuit: Pick<EnemyDefinition["pursuit"], "homeRadius">;
  readonly physicalReach: number;
  /** Caller supplies only bounded, live, physical asteroid candidates. */
  readonly asteroids: readonly RetaliatorAsteroid[];
}

export interface RetaliatorNavigationPlan {
  readonly anchor: Point;
  readonly patrolRadius: readonly [number, number];
}

/** Idle-only inputs for the existing navigator; callers retain all combat and return paths. */
export function retaliatorNavigation(
  context: RetaliatorNavigationContext,
  actor: EnemyIdentity & { readonly home: Point },
): RetaliatorNavigationPlan | undefined {
  const variant = retaliatorVariant(actor);
  if (!variant) {
    return undefined;
  }
  const { navigation, pursuit } = context;
  // The existing offset ellipse reaches radius * (1 + max(1, ellipseRatio)) from its anchor.
  const extent = 1 + Math.max(1, navigation.ellipseRatio[1]);
  const leash = Math.min(pursuit.homeRadius, (context.worldSide ?? Infinity) / 2);
  const limit = leash / extent;
  const radius = (value: number) => Math.min(value, limit);
  const fallback = {
    anchor: { ...actor.home },
    patrolRadius: [radius(navigation.patrolRadius[0]), radius(navigation.patrolRadius[1])] as const,
  };
  if (variant === "retaliatorCargoHauler") {
    return {
      anchor: { ...actor.home },
      patrolRadius: [
        radius(navigation.patrolRadius[0] + navigation.approachRadius),
        radius(navigation.patrolRadius[1] + navigation.approachRadius),
      ],
    };
  }
  let selected: RetaliatorAsteroid | undefined;
  let anchor: Point | undefined;
  let nearest = Infinity;
  const orbitReach = fallback.patrolRadius[1] * extent;
  for (const asteroid of context.asteroids) {
    if (!Number.isFinite(asteroid.physicalReach) || asteroid.physicalReach < 0) {
      continue;
    }
    const distance = worldDistance(context, actor.home, asteroid.position);
    const standOff =
      asteroid.physicalReach + context.physicalReach + ENEMY_AVOIDANCE.clearance + orbitReach;
    if (!Number.isFinite(distance) || distance <= standOff) {
      continue;
    }
    const point = worldPoint(context, actor.home, asteroid.position);
    const share = (distance - standOff) / distance;
    const candidate = {
      x: actor.home.x + (point.x - actor.home.x) * share,
      y: actor.home.y + (point.y - actor.home.y) * share,
    };
    if (worldDistance(context, actor.home, candidate) + orbitReach > leash) {
      continue;
    }
    if (distance < nearest || (distance === nearest && asteroid.id < selected!.id)) {
      selected = asteroid;
      nearest = distance;
      anchor = candidate;
    }
  }
  return anchor ? { ...fallback, anchor } : fallback;
}
