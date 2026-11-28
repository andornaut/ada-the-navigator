import type { RockRicochet } from "../data/types.ts";
import {
  cappedAsteroidVelocity,
  sceneryShape,
  silhouetteArea,
  silhouetteWorldReach,
  worldSceneryBodyContact,
} from "./asteroids.ts";
import type { Contact } from "./convex.ts";
import type { SpaceObject, Vec } from "./types.ts";
import {
  periodicWorldGrid,
  worldCellAt,
  worldCellKey,
  worldCellsNear,
  type WorldContext,
  worldDistance,
  wrapPoint,
} from "./world/index.ts";

/** Flight ids of planned moving rocks, which arrival disks also absorb. */
export const MOVING_ROCK_PREFIX = "moving:";

/** Passes over the touching rocks in one step, so a push-out that meets a third rock settles. */
const RICOCHET_PASSES = 8;
/** World units a push-out carries past touching, as for Ada against scenery. */
const SEPARATION = 0.01;

export interface RicochetContext {
  readonly world: WorldContext;
  /** The chunk pitch, whose cells index the rocks. */
  readonly chunkSize: number;
  /** The frame a rock shows and collides with now. */
  readonly frameOf: (object: SpaceObject) => number;
}

/**
 * Whether an object is an asteroid that ricochets: a static rock, placed or in an ore field, or a
 * planned moving rock. River debris, legacy orbiting rocks and quest debris do not.
 */
export function ricochetRock(object: SpaceObject): boolean {
  return (
    object.hp > 0 &&
    !object.river &&
    !object.orbit &&
    (object.kind === "rock" || object.id.startsWith(MOVING_ROCK_PREFIX)) &&
    sceneryShape(object) !== null
  );
}

/** A rock's mass: its drawn area (gameplay/rules.md). */
export function rockMass(object: SpaceObject): number {
  return silhouetteArea(sceneryShape(object)!.silhouette);
}

function reachOf(object: SpaceObject): number {
  return silhouetteWorldReach(sceneryShape(object)!.silhouette);
}

/** A canonical pair is clear on this axis if neither the direct gap nor its seam image fits. */
function separatedOnAxis(a: number, b: number, reach: number, halfSide?: number): boolean {
  const gap = Math.abs(a - b);
  return (
    gap > reach &&
    (halfSide === undefined ||
      (a >= -halfSide &&
        a < halfSide &&
        b >= -halfSide &&
        b < halfSide &&
        2 * halfSide - gap > reach))
  );
}

/** Rock `a`'s drawn outline against rock `b`'s, at their current frames; the contact pushes `a`. */
export function rocksContact(
  context: RicochetContext,
  a: SpaceObject,
  b: SpaceObject,
): Contact | null {
  return rockContact(context, a, b, reachOf(a) + reachOf(b));
}

function rockContact(
  context: RicochetContext,
  a: SpaceObject,
  b: SpaceObject,
  reach: number,
): Contact | null {
  if (worldDistance(context.world, a, b) >= reach) {
    return null;
  }
  const own = sceneryShape(a)!.silhouette;
  const other = sceneryShape(b)!.silhouette;
  const frame = context.frameOf(a);
  return worldSceneryBodyContact(
    context.world,
    b,
    a,
    own.frames[frame] ?? own.frames[0]!,
    context.frameOf(b),
    0,
    other,
  );
}

/**
 * A ricochet's new velocity for one rock, capped at the fastest a rock leaves one. A struck
 * static rock then drifts and settles; a moving rock keeps the velocity, its own from now on.
 */
function deflect(tuning: RockRicochet, velocity: Vec, rock: SpaceObject): void {
  rock.velocity = cappedAsteroidVelocity(tuning.maxSpeed, sceneryShape(rock)!.size, velocity);
  if (rock.kind === "rock") {
    rock.settle = tuning.settleSeconds;
  }
}

/**
 * Resolves one touching pair, `a` moving: the closing speed along the contact normal reverses
 * at the restitution, with an impulse each rock takes over its mass, and the overlap splits the
 * same way, so the pair ends apart.
 */
function ricochet(
  context: RicochetContext,
  tuning: RockRicochet,
  contact: Contact,
  a: SpaceObject,
  b: SpaceObject,
): void {
  const { normal } = contact;
  const inverseA = 1 / rockMass(a);
  const inverseB = 1 / rockMass(b);
  const total = inverseA + inverseB;
  const va = a.velocity ?? { x: 0, y: 0 };
  const vb = b.velocity ?? { x: 0, y: 0 };
  const closing = (va.x - vb.x) * normal.x + (va.y - vb.y) * normal.y;
  if (closing < 0) {
    const impulse = (-(1 + tuning.restitution) * closing) / total;
    deflect(
      tuning,
      { x: va.x + normal.x * impulse * inverseA, y: va.y + normal.y * impulse * inverseA },
      a,
    );
    deflect(
      tuning,
      { x: vb.x - normal.x * impulse * inverseB, y: vb.y - normal.y * impulse * inverseB },
      b,
    );
  }
  const push = contact.depth + SEPARATION;
  a.x += (normal.x * push * inverseA) / total;
  a.y += (normal.y * push * inverseA) / total;
  b.x -= (normal.x * push * inverseB) / total;
  b.y -= (normal.y * push * inverseB) / total;
  const side = context.world.worldSide;
  if (side !== undefined) {
    Object.assign(a, wrapPoint(side, a));
    Object.assign(b, wrapPoint(side, b));
  }
}

/**
 * Every moving rock that touches another asteroid ricochets off it, and both respond
 * (gameplay/rules.md "Space encounters and feedback"). Rocks are taken in id order and found
 * through the chunk grid, so the result follows from the rocks alone, and a step costs the
 * moving rocks' neighbours, never every pair. Passes repeat while any pair still touches, up to
 * RICOCHET_PASSES.
 */
export function ricochetRocks(
  context: RicochetContext,
  tuning: RockRicochet,
  objects: readonly SpaceObject[],
): void {
  const rocks = objects
    .filter(ricochetRock)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!rocks.some((rock) => rock.velocity)) {
    return;
  }
  const grid = periodicWorldGrid(context.world, context.chunkSize);
  const maximumReach = Math.max(...rocks.map(reachOf));
  const halfSide = grid.worldSide === undefined ? undefined : grid.worldSide / 2;
  for (let pass = 0; pass < RICOCHET_PASSES; pass++) {
    const cells = new Map<string, SpaceObject[]>();
    for (const rock of rocks) {
      const key = worldCellKey(grid, worldCellAt(grid, rock));
      const cell = cells.get(key);
      if (cell) {
        cell.push(rock);
      } else {
        cells.set(key, [rock]);
      }
    }
    // A pair of rocks moving as the pass began is resolved once, from its lower id.
    const moving = new Set(rocks.filter((rock) => rock.velocity));
    let touched = false;
    for (const a of rocks) {
      if (!a.velocity) {
        continue;
      }
      const reach = reachOf(a);
      for (const at of worldCellsNear(grid, reach + maximumReach, a)) {
        for (const b of cells.get(worldCellKey(grid, at)) ?? []) {
          if (b === a || (moving.has(a) && moving.has(b) && b.id < a.id)) {
            continue;
          }
          const combinedReach = reach + reachOf(b);
          // Leave floating-point boundary decisions and aliases to the original distance check.
          const limit = combinedReach * (1 + 4 * Number.EPSILON);
          if (
            separatedOnAxis(a.x, b.x, limit, halfSide) ||
            separatedOnAxis(a.y, b.y, limit, halfSide)
          ) {
            continue;
          }
          const contact = rockContact(context, a, b, combinedReach);
          if (contact) {
            ricochet(context, tuning, contact, a, b);
            touched = true;
          }
        }
      }
    }
    if (!touched) {
      return;
    }
  }
}
