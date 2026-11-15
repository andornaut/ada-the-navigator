import type { EnemyDefinition } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import {
  sceneryBound,
  type Silhouette,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "../asteroids.ts";
import {
  type Contact,
  outlineContact,
  outlinesContact,
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

/** Scenery berth uses authored geometry; protected-area routing and physical collision stay separate. */
export function worldNavigationQuery(
  context: NavigationWorld,
  objects: readonly SpaceObject[],
  definition: Pick<EnemyDefinition, "navigation" | "physics">,
  enemy: Pick<EnemyState, "archetype" | "facing" | "position"> & { readonly radius: number },
): NavigationQuery {
  const reach = navigationReach(definition);
  const initialHull = enemyHull(enemy);
  const hullRadius = initialHull ? partsReach(worldParts(initialHull)) : enemy.radius;
  const candidates = objects.filter(
    (object) =>
      object.hp > 0 &&
      ["rock", "resource", "debris"].includes(object.kind) &&
      worldDistance(context, enemy.position, object) <=
        reach +
          sceneryBound(object, hullRadius + ENEMY_AVOIDANCE.clearance, context.drawnOf(object)),
  );
  const contact = (
    pose: NavigationPose,
    clearance: number,
    object: SpaceObject,
  ): Contact | null => {
    const body = enemyHull({ archetype: enemy.archetype, facing: pose.facing });
    const drawn = context.drawnOf(object);
    const frame = context.frameOf(object);
    const image = worldPoint(context, pose.position, object);
    const outline =
      drawn?.frames[((frame % drawn.frames.length) + drawn.frames.length) % drawn.frames.length];
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
      return !candidates.some((object) => contact(pose, clearance, object) !== null);
    },
    escape(pose, clearance) {
      let deepest: Contact | null = null;
      for (const object of candidates) {
        const hit = contact(pose, clearance, object);
        if (hit && (!deepest || hit.depth > deepest.depth)) {
          deepest = hit;
        }
      }
      return deepest?.normal ?? null;
    },
  };
}
