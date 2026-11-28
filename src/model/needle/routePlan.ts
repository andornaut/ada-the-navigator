import { encounterTable, type EnemyArchetype } from "../../data/enemyCatalog.ts";
import { NEEDLE } from "../../data/needle.ts";
import { closestOnSegment } from "../convex.ts";
import { dropRandom } from "../drops.ts";
import { rollEncounter } from "../encounterRoll.ts";
import type { Vec } from "../types.ts";
import { type WorldContext, worldDelta, worldDistance, worldPoint } from "../world/index.ts";
import { inNeedleChannel, type needleCourses } from "./geometry.ts";

/** Authored spawn descriptors are neither active actors nor discovery/quest associations. */
export interface NeedleExitSpawn {
  readonly archetype: EnemyArchetype;
  readonly home: Vec;
  readonly id: string;
  readonly packId: string;
  readonly point: Vec;
}

/** The existing world-seed draw stream and authored exit formation are preserved exactly. */
export function planNeedleExit(seed: number, center: Vec): readonly NeedleExitSpawn[] {
  const next = dropRandom(seed, "needle:exit");
  const pack = rollEncounter(
    encounterTable(4).filter((entry) => entry.archetype === "swarm"),
    next(),
    next(),
  );
  return Array.from({ length: pack.count }, (_, index) => {
    const angle = (index * Math.PI * 2) / pack.count;
    return {
      archetype: pack.archetype,
      home: { x: center.x, y: center.y },
      id: `needle:exit:${index}`,
      packId: "needle:exit",
      point: {
        x: center.x + Math.cos(angle) * NEEDLE.exitPackRadius,
        y: center.y + Math.sin(angle) * NEEDLE.exitPackRadius,
      },
    };
  });
}

export interface NeedleCadencePlacement {
  readonly hullReach: number;
  readonly perception: number;
  readonly pursuitRadius: number;
  /** The normal formation check against generated scenery and retained actors. */
  readonly canPlace: (site: Vec) => boolean;
}

/** Probe both sides of the exit with no mutations to the authored swarm or disk route. */
export function planNeedleCadence(
  world: WorldContext,
  courses: NonNullable<ReturnType<typeof needleCourses>>,
  talkRange: number,
  placement: NeedleCadencePlacement,
): Vec | null {
  const { activity, eye, practice } = courses;
  const { canPlace, hullReach, perception, pursuitRadius } = placement;
  const exit = eye.path.at(-1)!;
  const tangent = worldDelta(world, eye.path.at(-2)!, exit);
  const length = Math.hypot(tangent.x, tangent.y);
  const forward = { x: tangent.x / length, y: tangent.y / length };
  const along = (point: Vec) => {
    const relative = worldDelta(world, exit, point);
    return relative.x * forward.x + relative.y * forward.y;
  };
  const depth =
    Math.max(along(eye.holodisk), along(eye.pack) + NEEDLE.exitPackRadius) + hullReach + talkRange;
  const clearance = perception + pursuitRadius + hullReach;
  const lateral = clearance * 1.25;
  const route = [...eye.path, eye.holodisk];
  for (const side of [1, -1]) {
    const site = {
      x: exit.x + forward.x * depth - forward.y * lateral * side,
      y: exit.y + forward.y * depth + forward.x * lateral * side,
    };
    const obstructsRoute = route.slice(1).some((to, index) => {
      const from = route[index]!;
      const nearest = closestOnSegment(
        worldPoint(world, from, site),
        from,
        worldPoint(world, from, to),
      );
      return worldDistance(world, site, nearest) <= clearance;
    });
    if (
      !obstructsRoute &&
      worldDistance(world, site, eye.pack) > clearance + NEEDLE.exitPackRadius &&
      [practice, eye, activity].every(
        (course) =>
          !inNeedleChannel({ radius: hullReach }, course, worldPoint(world, course.path[0]!, site)),
      ) &&
      canPlace(site)
    ) {
      return site;
    }
  }
  return null;
}
