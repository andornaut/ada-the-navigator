import type { WeaponDefinition } from "../data/weaponCatalog.ts";
import { playerWeaponCoverage, type PlayerWeaponCoverageContext } from "./playerWeaponCoverage.ts";
import type { Vec } from "./types.ts";

export interface VolleyContext {
  readonly coverage?: PlayerWeaponCoverageContext;
  readonly aim: Vec;
  readonly baseDamage: number;
  readonly baseLifetime: number;
  readonly baseSpeed: number;
  /** Shooter velocity captured once at launch; omitted for existing stationary/allied fire. */
  readonly inheritedVelocity?: Vec;
  readonly origin: Vec;
  readonly viewportWidth: number;
}
export interface ProjectileFade {
  readonly fadeStartFraction: number;
  readonly initialLife: number;
  /** Weapon-relative range used for lifetime, excluding inherited launch velocity. */
  readonly projectedRange: number;
}
/** A bolt fired in a fan of several: the volley's bolt count and its world fire point. */
export interface BoltFan {
  readonly count: number;
  readonly origin: Vec;
}
export interface PlayerProjectile extends Vec {
  readonly blast?: number;
  readonly damage: number;
  readonly fade?: ProjectileFade;
  /** Presentation only: the fan a bolt belongs to, which draws as one wedge while it is close. */
  readonly fan?: BoltFan;
  readonly life: number;
  readonly projectile: Exclude<WeaponDefinition["projectileKind"], "beam">;
  readonly velocity: Vec;
}
export interface PlayerVolley {
  readonly interval: number;
  readonly projectiles: readonly PlayerProjectile[];
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * The unit world heading `degrees` off `aim` in the projected aim plane, so a fan spreads the
 * same on screen at every heading and whoever fires it; a zero aim gives a zero heading.
 */
export function fanHeading(aim: Vec, degrees: number): Vec {
  const length = Math.hypot(aim.x, aim.y);
  if (!Number.isFinite(length) || length === 0) {
    return { x: 0, y: 0 };
  }
  const unit = { x: aim.x / length, y: aim.y / length };
  const projectedAim = { x: unit.x - unit.y, y: (unit.x + unit.y) / 2 };
  const angle = (degrees * Math.PI) / 180;
  const projected = {
    x: projectedAim.x * Math.cos(angle) - projectedAim.y * Math.sin(angle),
    y: projectedAim.x * Math.sin(angle) + projectedAim.y * Math.cos(angle),
  };
  const world = { x: projected.x / 2 + projected.y, y: projected.y - projected.x / 2 };
  const worldLength = Math.hypot(world.x, world.y);
  return { x: world.x / worldLength, y: world.y / worldLength };
}

/**
 * Flight owns collision, aging and identity; this helper only describes one automatic volley
 * of projectiles. A hitscan beam has no projectile and is refused.
 */
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
    definition.projectileKind === "beam" ||
    (context.inheritedVelocity !== undefined &&
      ![context.inheritedVelocity.x, context.inheritedVelocity.y].every(Number.isFinite)) ||
    (context.coverage !== undefined &&
      (![context.coverage.centre.x, context.coverage.centre.y].every(Number.isFinite) ||
        !positive(context.coverage.viewportWidth) ||
        !positive(context.coverage.viewportHeight))) ||
    (definition.blastRadius !== null && !positive(definition.blastRadius)) ||
    !definition.anglesDegrees.length ||
    !definition.anglesDegrees.every(Number.isFinite) ||
    (definition.rangeWorld !== null && !positive(definition.rangeWorld)) ||
    (definition.fadeStartFraction !== null &&
      (!Number.isFinite(definition.fadeStartFraction) ||
        definition.fadeStartFraction < 0 ||
        definition.fadeStartFraction >= 1 ||
        definition.rangeWorld === null))
  ) {
    throw new RangeError("Invalid player projectile definition or context");
  }
  const interval = definition.intervalSeconds;
  const length = Math.hypot(context.aim.x, context.aim.y);
  if (!Number.isFinite(length) || length === 0) {
    return { interval, projectiles: [] };
  }
  const speed = context.baseSpeed * definition.speedRatio;
  const damage = context.baseDamage * definition.damageRatio;
  const count = definition.anglesDegrees.length;
  const fan =
    definition.projectileKind === "bolt" && count > 1
      ? { fan: { count, origin: { x: context.origin.x, y: context.origin.y } } }
      : {};
  const projectiles = definition.anglesDegrees.map((degrees): PlayerProjectile => {
    const heading = fanHeading(context.aim, degrees);
    return {
      ...(definition.blastRadius === null ? {} : { blast: definition.blastRadius }),
      damage,
      ...projectileReach(
        context.coverage && definition.projectileKind === "bolt"
          ? {
              ...definition,
              rangeWorld: playerWeaponCoverage(context.coverage, {
                direction: heading,
                origin: context.origin,
              }),
            }
          : definition,
        speed,
        context.baseLifetime,
      ),
      ...fan,
      projectile: definition.projectileKind as PlayerProjectile["projectile"],
      velocity: {
        x: heading.x * speed + (context.inheritedVelocity?.x ?? 0),
        y: heading.y * speed + (context.inheritedVelocity?.y ?? 0),
      },
      x: context.origin.x,
      y: context.origin.y,
    };
  });
  return { interval, projectiles };
}

/**
 * A projectile's life, and its fade when the weapon fades, at `speed`: a ranged weapon flies its
 * snapshotted weapon-relative range, excluding inherited velocity; others fly `baseLifetime`.
 */
export function projectileReach(
  definition: Pick<WeaponDefinition, "fadeStartFraction" | "rangeWorld">,
  speed: number,
  baseLifetime: number,
): { fade?: ProjectileFade; life: number } {
  const range = definition.rangeWorld;
  if (range === null) {
    return { life: baseLifetime };
  }
  const life = range / speed;
  return definition.fadeStartFraction === null
    ? { life }
    : {
        fade: {
          fadeStartFraction: definition.fadeStartFraction,
          initialLife: life,
          projectedRange: range,
        },
        life,
      };
}

/** Remaining lifetime tracks weapon-relative range independently of inherited launch velocity. */
export function projectileOpacity(fade: ProjectileFade, remainingLife: number): number {
  if (!positive(fade.initialLife) || !Number.isFinite(remainingLife)) {
    return 0;
  }
  const traveled = 1 - Math.max(0, Math.min(1, remainingLife / fade.initialLife));
  return traveled <= fade.fadeStartFraction
    ? 1
    : Math.max(0, (1 - traveled) / (1 - fade.fadeStartFraction));
}
