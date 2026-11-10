import type { WeaponDefinition } from "../data/weapon-catalog.ts";
import type { Vec } from "./types.ts";

export interface VolleyContext {
  readonly aim: Vec;
  readonly baseDamage: number;
  readonly baseLifetime: number;
  readonly baseSpeed: number;
  readonly origin: Vec;
  readonly viewportWidth: number;
}
export interface ProjectileFade {
  readonly fadeStartFraction: number;
  readonly initialLife: number;
  readonly projectedRange: number;
}
export interface PlayerProjectile extends Vec {
  readonly damage: number;
  readonly fade?: ProjectileFade;
  readonly life: number;
  readonly projectile: WeaponDefinition["projectileKind"];
  readonly velocity: Vec;
}
export interface PlayerVolley {
  readonly interval: number;
  readonly projectiles: readonly PlayerProjectile[];
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Flight owns collision, aging and identity; this helper only describes one automatic volley. */
export function planPlayerVolley(
  definition: WeaponDefinition,
  context: VolleyContext,
): PlayerVolley {
  if (
    ![
      context.baseDamage,
      context.baseLifetime,
      context.baseSpeed,
      context.viewportWidth,
      definition.damageRatio,
      definition.intervalSeconds,
      definition.speedRatio,
    ].every(positive) ||
    ![context.origin.x, context.origin.y].every(Number.isFinite) ||
    !definition.anglesDegrees.length ||
    !definition.anglesDegrees.every(Number.isFinite) ||
    (definition.rangeScreenWidths !== null && !positive(definition.rangeScreenWidths)) ||
    (definition.fadeStartFraction !== null &&
      (!Number.isFinite(definition.fadeStartFraction) ||
        definition.fadeStartFraction < 0 ||
        definition.fadeStartFraction >= 1 ||
        definition.rangeScreenWidths === null))
  ) {
    throw new RangeError("Invalid player projectile definition or context");
  }
  const interval = definition.intervalSeconds;
  const length = Math.hypot(context.aim.x, context.aim.y);
  if (!Number.isFinite(length) || length === 0) {
    return { interval, projectiles: [] };
  }
  const aim = { x: context.aim.x / length, y: context.aim.y / length };
  const speed = context.baseSpeed * definition.speedRatio;
  const damage = context.baseDamage * definition.damageRatio;
  const projectiles = definition.anglesDegrees.map((degrees): PlayerProjectile => {
    const angle = (degrees * Math.PI) / 180;
    const heading = {
      x: aim.x * Math.cos(angle) - aim.y * Math.sin(angle),
      y: aim.x * Math.sin(angle) + aim.y * Math.cos(angle),
    };
    const projectedSpeed = speed * Math.hypot(heading.x - heading.y, (heading.x + heading.y) / 2);
    const projectedRange =
      definition.rangeScreenWidths === null
        ? null
        : context.viewportWidth * definition.rangeScreenWidths;
    const life = projectedRange === null ? context.baseLifetime : projectedRange / projectedSpeed;
    const projectile: PlayerProjectile = {
      damage,
      life,
      projectile: definition.projectileKind,
      velocity: { x: heading.x * speed, y: heading.y * speed },
      x: context.origin.x,
      y: context.origin.y,
    };
    if (projectedRange !== null && definition.fadeStartFraction !== null) {
      return {
        ...projectile,
        fade: {
          fadeStartFraction: definition.fadeStartFraction,
          initialLife: life,
          projectedRange,
        },
      };
    }
    return projectile;
  });
  return { interval, projectiles };
}

/** Constant-speed flight makes remaining lifetime equivalent to remaining projected distance. */
export function projectileOpacity(fade: ProjectileFade, remainingLife: number): number {
  if (!positive(fade.initialLife) || !Number.isFinite(remainingLife)) {
    return 0;
  }
  const traveled = 1 - Math.max(0, Math.min(1, remainingLife / fade.initialLife));
  return traveled <= fade.fadeStartFraction
    ? 1
    : Math.max(0, (1 - traveled) / (1 - fade.fadeStartFraction));
}
