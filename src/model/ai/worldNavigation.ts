import type { EnemyDefinition } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import {
  sceneryBound,
  type Silhouette,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "../asteroids.ts";
import {
  closestOnSegment,
  type Contact,
  grown,
  inside,
  outlineContact,
  outlinesContact,
  type Parts,
  partsReach,
  worldParts,
} from "../convex.ts";
import type { EnemyState } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import type { SpaceObject } from "../types.ts";
import { type WorldContext, worldDistance, worldPoint } from "../worldContacts.ts";
import type { NavigationPose, NavigationQuery } from "./navigationQuery.ts";
import { navigationReach } from "./prediction.ts";

export interface NavigationWorld extends WorldContext {
  readonly drawnOf: (object: SpaceObject) => Silhouette | null;
  readonly frameOf: (object: SpaceObject) => number;
}

/** Bounds follow immutable outline identity; positions, frames and poses are not cached. */
const bounded = new WeakMap<
  Parts,
  {
    edges: {
      a: Parts[number][number];
      b: Parts[number][number];
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[];
    part: Parts[number];
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[]
>();

/** Scenery berth uses authored geometry; protected-area routing and physical collision stay separate. */
export function worldNavigationQuery(
  context: NavigationWorld,
  objects: readonly SpaceObject[],
  definition: Pick<EnemyDefinition, "navigation" | "physics">,
  enemy: Pick<EnemyState, "archetype" | "facing" | "position"> & { readonly radius: number },
): NavigationQuery | undefined {
  const reach = navigationReach(definition);
  const initialHull = enemyHull(enemy);
  const hullRadius = initialHull ? partsReach(worldParts(initialHull)) : enemy.radius;
  const candidates = objects.filter(
    (object) =>
      object.hp > 0 &&
      ["rock", "debris"].includes(object.kind) &&
      worldDistance(context, enemy.position, object) <=
        reach +
          sceneryBound(object, hullRadius + ENEMY_AVOIDANCE.clearance, context.drawnOf(object)),
  );
  if (!candidates.length) {
    return undefined;
  }
  // Frames and silhouettes are fixed for this query's simulation slice.
  const obstacles = candidates.map((object) => {
    const drawn = context.drawnOf(object);
    const frame = context.frameOf(object);
    const outline =
      drawn?.frames[((frame % drawn.frames.length) + drawn.frames.length) % drawn.frames.length];
    return {
      drawn,
      frame,
      object,
      outline,
      reach: outline ? partsReach(worldParts(outline)) : 0,
    };
  });
  let previousPose: NavigationPose | undefined;
  let body: ReturnType<typeof enemyHull> = null;
  let bodyReach = enemy.radius;
  const bodyAt = (pose: NavigationPose): void => {
    if (previousPose !== pose) {
      previousPose = pose;
      body = enemyHull({ archetype: enemy.archetype, facing: pose.facing });
      bodyReach = body ? partsReach(worldParts(body)) : enemy.radius;
    }
  };
  const overlaps = (parts: Parts, x: number, y: number, margin: number): boolean => {
    let bounds = bounded.get(parts);
    if (!bounds) {
      bounds = parts.map((part) => ({
        bottom: Math.max(...part.map((point) => point.y)),
        edges: part.map((a, index) => {
          const b = part[(index + 1) % part.length]!;
          return {
            a,
            b,
            bottom: Math.max(a.y, b.y),
            left: Math.min(a.x, b.x),
            right: Math.max(a.x, b.x),
            top: Math.min(a.y, b.y),
          };
        }),
        left: Math.min(...part.map((point) => point.x)),
        part,
        right: Math.max(...part.map((point) => point.x)),
        top: Math.min(...part.map((point) => point.y)),
      }));
      bounded.set(parts, bounds);
    }
    const center = { x, y };
    return bounds.some(({ bottom, edges, left, part, right, top }) => {
      if (x < left - margin || x > right + margin || y < top - margin || y > bottom + margin) {
        return false;
      }
      if (x >= left && x <= right && y >= top && y <= bottom && inside(part, center)) {
        return true;
      }
      return (
        margin > 0 &&
        edges.some((edge) => {
          if (
            x < edge.left - margin ||
            x > edge.right + margin ||
            y < edge.top - margin ||
            y > edge.bottom + margin
          ) {
            return false;
          }
          const nearest = closestOnSegment(center, edge.a, edge.b);
          return Math.hypot(center.x - nearest.x, center.y - nearest.y) < margin;
        })
      );
    });
  };
  const contact = (
    pose: NavigationPose,
    clearance: number,
    obstacle: (typeof obstacles)[number],
  ): Contact | null => {
    bodyAt(pose);
    const { drawn, frame, object, outline, reach } = obstacle;
    const image = worldPoint(context, pose.position, object);
    const bound = outline
      ? reach + bodyReach + clearance
      : sceneryBound(object, bodyReach + clearance, drawn);
    if (Math.hypot(pose.position.x - image.x, pose.position.y - image.y) >= bound) {
      return null;
    }
    return outline
      ? body
        ? outlinesContact(outline, image, body, pose.position, clearance)
        : outlineContact(outline, image, pose.position, enemy.radius + clearance)
      : body
        ? worldSceneryBodyContact(context, object, pose.position, body, frame, clearance, drawn)
        : worldSceneryContact(
            context,
            object,
            pose.position,
            enemy.radius + clearance,
            frame,
            drawn,
          );
  };
  return {
    clear(pose, clearance) {
      bodyAt(pose);
      return !obstacles.some((obstacle) => {
        const { object, outline } = obstacle;
        if (!outline) {
          return contact(pose, clearance, obstacle) !== null;
        }
        const image = worldPoint(context, pose.position, object);
        if (
          Math.hypot(pose.position.x - image.x, pose.position.y - image.y) >=
          obstacle.reach + bodyReach + clearance
        ) {
          return false;
        }
        const shape = worldParts(outline);
        const parts = body ? grown(shape, worldParts(body)) : shape;
        // Boolean admission needs no exit normal or depth. Existing primitives retain exact contact boundaries.
        return overlaps(
          parts,
          pose.position.x - image.x,
          pose.position.y - image.y,
          body ? clearance : enemy.radius + clearance,
        );
      });
    },
    escape(pose, clearance) {
      let deepest: Contact | null = null;
      for (const object of obstacles) {
        const hit = contact(pose, clearance, object);
        if (hit && (!deepest || hit.depth > deepest.depth)) {
          deepest = hit;
        }
      }
      return deepest?.normal ?? null;
    },
  };
}
