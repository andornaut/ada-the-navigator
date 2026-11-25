import type { EnemyDefinition, EnemyNavigation, Point } from "../data/enemyCatalog.ts";
import { type EnemyIdentity, retaliatorVariant } from "../data/enemyIdentity.ts";
import type { WorldContext } from "./worldContacts.ts";

/** Peaceful industrial routes keep their existing extent independently of combat pursuit. */
export const INDUSTRIAL_HOME_RADIUS = 2000;

export interface RetaliatorAsteroid {
  readonly id: string;
  readonly position: Point;
  readonly physicalReach: number;
}

export interface RetaliatorNavigationContext extends WorldContext {
  readonly navigation: EnemyNavigation;
  readonly pursuit: Pick<EnemyDefinition["pursuit"], "homeRadius">;
  readonly physicalReach: number;
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
  // The Mining Freighter traces asteroid edges instead (enemyAi.ts); its fallback is home.
  return fallback;
}
