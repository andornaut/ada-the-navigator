import { ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_TUNING } from "../data/phantom.ts";
import { type Parts, partsReach, worldParts } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { stationFormationClear, type StationPlacementContext } from "./stationPlacement.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { worldDelta, worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

export interface PhantomEncounterPlacementContext extends StationPlacementContext {
  readonly fixedIds: ReadonlySet<string>;
  readonly waypoint: Readonly<Vec>;
}

/** Each perimeter is visited once, in a stable order, within the geometry-derived grid bound. */
function* offsets(steps: number): Iterable<Vec> {
  yield { x: 0, y: 0 };
  for (let ring = 1; ring <= steps; ring++) {
    for (let x = -ring; x <= ring; x++) {
      yield { x, y: -ring };
      yield { x, y: ring };
    }
    for (let y = -ring + 1; y < ring; y++) {
      yield { x: -ring, y };
      yield { x: ring, y };
    }
  }
}

/** Place complete authored groups without changing existing actors, combat state or home. */
export function placePhantomEncounter(
  context: PhantomEncounterPlacementContext,
  groups: readonly (readonly SpaceObject[])[],
): readonly SpaceObject[] | null {
  const actors = groups.flat();
  if (!actors.length) {
    return [];
  }
  const world = flightWorldContext(context.flight);
  // One synchronous placement search changes positions only, so assembled bodies stay exact.
  const bodies = new Map<string, Parts | null>();
  const inheritedBodyOf = context.bodyOf;
  const bodyOf = (actor: SpaceObject): Parts | null => {
    if (!bodies.has(actor.id)) {
      bodies.set(
        actor.id,
        inheritedBodyOf
          ? inheritedBodyOf(actor)
          : actor.enemy
            ? enemyPhysicalBody(ROUTE_POSITION[context.flight.galaxy], actor.enemy)
            : null,
      );
    }
    return bodies.get(actor.id)!;
  };
  const preparedContext = { ...context, bodyOf };
  const reaches = new Map<SpaceObject, number>();
  for (const actor of actors) {
    const body = bodyOf(actor);
    if (!body) {
      return null;
    }
    reaches.set(actor, partsReach(worldParts(body)));
  }
  const withinArena = (original: readonly SpaceObject[], placed: readonly SpaceObject[]) =>
    placed.every(
      (actor, index) =>
        worldDistance(world, context.waypoint, actor) + reaches.get(original[index]!)! <=
        PHANTOM_TUNING.battleReach,
    );
  if (withinArena(actors, actors) && stationFormationClear(preparedContext, actors)) {
    return actors;
  }
  const placed = new Map<number, readonly SpaceObject[]>();
  const settled: SpaceObject[] = [];
  // Settled groups already passed admission; candidates still collide against their full hulls.
  const clearCandidate = (candidate: readonly SpaceObject[]) => {
    const ignoreIds = context.ignoreIds
      ? new Set([...context.ignoreIds].filter((id) => !settled.some((actor) => actor.id === id)))
      : undefined;
    return stationFormationClear(
      {
        ...preparedContext,
        ...(ignoreIds ? { ignoreIds } : {}),
        flight: { ...context.flight, objects: [...context.flight.objects, ...settled] },
      },
      candidate,
    );
  };
  // A fixed actor fixes its entire explicit group; no label-based follower inference is needed.
  for (const [index, group] of groups.entries()) {
    if (!group.some(({ id }) => context.fixedIds.has(id))) {
      continue;
    }
    if (!withinArena(group, group) || !clearCandidate(group)) {
      return null;
    }
    placed.set(index, group);
    settled.push(...group);
  }
  // Keep other clear originals before relocating any blocked group into their space.
  for (const [index, group] of groups.entries()) {
    if (placed.has(index)) {
      continue;
    }
    if (withinArena(group, group) && clearCandidate(group)) {
      placed.set(index, group);
      settled.push(...group);
    }
  }
  for (const [index, group] of groups.entries()) {
    if (placed.has(index)) {
      continue;
    }
    const stride = 2 * Math.min(...group.map((actor) => reaches.get(actor)!));
    if (!Number.isFinite(stride) || stride <= 0) {
      return null;
    }
    for (const offset of offsets(Math.ceil(PHANTOM_TUNING.battleReach / stride))) {
      const anchor = {
        x: context.waypoint.x + offset.x * stride,
        y: context.waypoint.y + offset.y * stride,
      };
      const delta = worldDelta(world, group[0]!, anchor);
      const candidate = group.map((actor) => {
        const raw = { x: actor.x + delta.x, y: actor.y + delta.y };
        const point = world.worldSide === undefined ? raw : wrapPoint(world.worldSide, raw);
        return {
          ...actor,
          ...point,
          ...(actor.enemy
            ? { enemy: { ...actor.enemy, position: { ...actor.enemy.position, ...point } } }
            : {}),
        };
      });
      if (!withinArena(group, candidate) || !clearCandidate(candidate)) {
        continue;
      }
      placed.set(index, candidate);
      settled.push(...candidate);
      break;
    }
    if (!placed.has(index)) {
      return null;
    }
  }
  return groups.flatMap((_, index) => placed.get(index)!);
}
