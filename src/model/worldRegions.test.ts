import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunkCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { type ChunkPlanOptions, planChunk } from "./chunkTemplates.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import {
  archivedObjectIds,
  prunePackState,
  worldActivateFlightRegion,
  worldActivateRouteEncounter,
  worldPrunePackState,
  worldRecordObjectRemoval,
  worldRetainedPackMembers,
  worldSyncFlightRegion,
} from "./geography.ts";
import { rocksOverlap } from "./rockSpacing.ts";
import type { SpaceObject } from "./types.ts";
import { nearestImage } from "./worldGeometry.ts";
const context = { worldSide: 1152000 };
const options: ChunkPlanOptions = {
  asteroids: { field: ASTEROID_FIELDS[1]!, shapes: [...ASTEROID_SHAPES.values()] },
  clearance: CONTENT.tuning.flight.shipRadius,
  galaxy: 1,
  objectsPerChunk: CONTENT.tuning.flight.objectsPerChunk,
  rockRadius: CONTENT.tuning.flight.rockRadius,
  seed: 173,
  shipRadius: CONTENT.tuning.flight.shipRadius,
  size: 512,
  spawnWeights: CONTENT.tuning.flight.spawnWeights,
  x: 1124,
  y: 0,
};
function empty() {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  flight.objects = [];
  flight.chunks = [];
  flight.world = { notables: {}, version: 1 };
  flight.player = { x: 575990, y: 0 };
  return flight;
}
function object(id: string, x: number, persistent = false): SpaceObject {
  return { hp: 4, id, kind: "rock", persistent, radius: 10, x, y: 0 };
}
function enemy(id: string, x: number): SpaceObject {
  const at = { x, y: 0 };
  return {
    ...at,
    enemy: createEnemy(
      enemyCatalog.swarm,
      { archetype: "swarm", id, packId: "pack:-1125,0", phase: 0 },
      at,
    ),
    hp: 4,
    id,
    kind: "enemy",
    persistent: false,
    radius: 10,
  };
}
describe("periodic chunk plans and retention", () => {
  it("regenerates the same canonical plan, IDs and ports through positive and negative aliases", () => {
    const expected = planChunk(CHUNK_CATALOG, { ...options, ...context });
    expect(expected.placements.length).toBeGreaterThan(0);
    for (const period of [-2, -1, 1, 2]) {
      expect(
        planChunk(CHUNK_CATALOG, {
          ...options,
          ...context,
          x: options.x + 2250 * period,
          y: options.y - 2250 * period,
        }),
      ).toEqual(expected);
    }
    expect(new Set(expected.placements.map((p) => p.id)).size).toBe(expected.placements.length);
    expect(planChunk(CHUNK_CATALOG, { ...options, x: 4, y: 3 })).toEqual(
      planChunk(CHUNK_CATALOG, { ...options, ...context, x: 4, y: 3 }),
    );
    expect(() => planChunk(CHUNK_CATALOG, { ...options, worldSide: 1152001 })).toThrow(RangeError);
  });
  it("keeps cross-seam drawn rocks separate using one image of the canonical neighbour", () => {
    for (const y of [-2, 0, 2]) {
      const left = planChunk(CHUNK_CATALOG, { ...options, ...context, y });
      const right = planChunk(CHUNK_CATALOG, { ...options, ...context, x: -1125, y });
      const east = nearestImage(
        context.worldSide,
        left.ports.east.center,
        right.ports.west.center,
      ).point;
      expect(east).toEqual(left.ports.east.center);
      for (const a of left.placements.filter((p) => p.kind === "rock")) {
        for (const b of right.placements.filter((p) => p.kind === "rock")) {
          const image = { ...b, ...nearestImage(context.worldSide, a, b).point };
          expect(rocksOverlap(a, image)).toBe(false);
        }
      }
    }
  });
  it("retains ordinary seam neighbours and canonicalizes chunk aliases until genuine departure", () => {
    const flight = empty();
    const rock = object("ordinary", -575990);
    flight.objects = [rock];
    flight.chunks = ["-1125,0", "1125,0", "-1124,0", "0,0"];
    const visited = JSON.stringify(flight.visited);
    worldSyncFlightRegion(context, CONTENT, flight);
    expect(flight.objects).toEqual([rock]);
    expect(flight.chunks).toEqual(["-1125,0", "-1124,0"]);
    expect(archivedObjectIds(flight).has(rock.id)).toBe(false);
    flight.player = { x: 573000, y: 0 };
    worldSyncFlightRegion(context, CONTENT, flight);
    expect(flight.objects).toEqual([]);
    expect(archivedObjectIds(flight).has(rock.id)).toBe(true);
    expect(flight.world.notables).toEqual({});
    expect(JSON.stringify(flight.visited)).toBe(visited);
  });
  it("activates a retained seam identity once while preserving permanent tombstones", () => {
    const flight = empty();
    const guard = object("unique", -575990, true);
    flight.world.notables = { defeated: null, unique: guard };
    worldActivateFlightRegion(context, CONTENT, flight.player, flight);
    worldActivateFlightRegion(
      context,
      CONTENT,
      { x: flight.player.x + context.worldSide, y: 0 },
      flight,
    );
    expect(flight.objects).toEqual([guard]);
    expect(flight.world.notables).toEqual({ defeated: null });
    worldRecordObjectRemoval(context, CONTENT, guard, flight);
    expect(flight.world.notables.unique).toBeNull();
  });
  it("archives and reactivates unique route guards without duplicating pack counts", () => {
    const flight = empty();
    const guard = enemy("route-guard", 0);
    guard.persistent = true;
    guard.routeId = "route";
    flight.objects = [guard];
    worldSyncFlightRegion(context, CONTENT, flight);
    expect(flight.world.notables[guard.id]).toEqual(guard);
    expect(worldRetainedPackMembers(context, CONTENT, flight)).toEqual({ "pack:-1125,0": 1 });
    worldActivateRouteEncounter(context, CONTENT, "route", flight);
    worldActivateRouteEncounter(context, CONTENT, "route", flight);
    expect(flight.objects).toEqual([guard]);
    expect(worldRetainedPackMembers(context, CONTENT, flight)).toEqual({});
  });
  it("preserves only caller-retained encounter role denominators without inventing renewal state", () => {
    const flight = empty();
    flight.combat = {
      initialPackSizes: { "pack:-1125,0": 2, "pack:-1125,0:escorts": 3, "pack:other": 1 },
      routeEncounters: [],
      unloadedPackMembers: { "pack:-1125,0": 2, "pack:-1125,0:escorts": 3 },
    };
    const retained = { ...context, retainedEncounters: new Set(["pack:-1125,0"]) };
    worldPrunePackState(retained, flight);
    expect(flight.combat.initialPackSizes).toEqual({
      "pack:-1125,0": 2,
      "pack:-1125,0:escorts": 3,
    });
    worldSyncFlightRegion(retained, CONTENT, flight);
    expect(flight.combat.unloadedPackMembers).toEqual({
      "pack:-1125,0": 2,
      "pack:-1125,0:escorts": 3,
    });
    worldPrunePackState(context, flight);
    expect(flight.combat.initialPackSizes).toEqual({});
    expect(flight.combat.unloadedPackMembers).toBeUndefined();
    flight.combat.initialPackSizes = { legacy: 2 };
    prunePackState(flight);
    expect(flight.combat.initialPackSizes).toEqual({});
  });
});
