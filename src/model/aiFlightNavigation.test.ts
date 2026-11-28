import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { actualGap } from "../testing/aiGeometry.ts";
import { protectAda } from "../testing/arrivalGrace.ts";
import { markerModel } from "../testing/markerModel.ts";
import { ASTEROID_SHAPES, worldSceneryBodyContact } from "./asteroids.ts";
import { GAME_AREA, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull } from "./enemyBody.ts";
import {
  createFlight,
  questFrigateHome,
  questGuardPlacementContext,
  routeBlocked,
  spawnQuestFrigateAt,
  stepFlight,
} from "./flight.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { newProgress } from "./progress.ts";
import { questGuardAnchor } from "./questGuardPlacement.ts";
import type { SpaceObject } from "./types.ts";
import {
  flightWorldContext,
  worldCellKey,
  worldCellsNear,
  worldDistance,
  worldGrid,
} from "./world/index.ts";

it.each([false, true])(
  "patrols a marked site-local frigate past an asteroid with hull clearance (turning=%s)",
  (turning) => {
    const flight = createFlight(CONTENT, 2, 173, newProgress());
    flight.objects = [];
    flight.world = { notables: {}, version: 1 };
    const destination: SpaceObject = {
      hp: 1,
      id: "quest",
      kind: "destination",
      radius: 30,
      x: 10000,
      y: 10000,
    };
    flight.objects.push(destination);
    flight.player = { x: destination.x, y: destination.y };
    const home = questFrigateHome(CONTENT, flight, "route:quest", destination.id)!;
    expect(home).not.toBeNull();
    const guard = spawnQuestFrigateAt(CONTENT, flight, "route:quest", destination.id, home)!;
    // Ada stays protected, so the guard keeps its patrol rather than engaging her.
    protectAda(flight);
    expect(guard).not.toBeNull();
    const grid = worldGrid(flightWorldContext(flight), CONTENT.tuning.chunkSize);
    flight.chunks = [
      ...new Set([
        ...flight.chunks,
        ...[flight.player, ...flight.objects].flatMap((point) =>
          Array.from(
            worldCellsNear(grid, CONTENT.tuning.chunkSize * ACTIVE_CHUNK_RADIUS, point),
            (cell) => worldCellKey(grid, cell),
          ),
        ),
      ]),
    ];
    const shape = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "large")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: CONTENT.tuning.flight.rockHp,
      id: "navigation-rock",
      kind: "rock",
      radius: shape.radius,
      spinStart: 0,
      x: guard.x,
      y: guard.y + 350,
    };
    flight.objects.push(rock);
    const start = { x: guard.x, y: guard.y };
    guard.enemy!.facing = turning ? { x: 0, y: -1 } : { x: 1, y: 0 };
    if (turning) {
      guard.enemy!.velocity = { x: 0, y: -enemyCatalog.frigate.physics.maxSpeed };
    }
    const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, reducedMotion: true, use: false };
    const tracker = markerModel(flight);
    tracker.step(1 / 30, idle);
    expect(tracker.flightEvents).toContainEqual({ id: "quest", type: "guardCue" });
    expect(flight.markerActors?.knowledge[guard.id]).toBe("sensed");
    const radius = guard.radius;
    const hp = guard.hp;
    let closest = Infinity;
    for (let step = 0; step < 600; step++) {
      stepFlight(CONTENT, 1 / 30, idle, flight);
      expect(flight.objects.filter(({ id }) => id === guard.id)).toHaveLength(1);
      expect(flight.summonedGuards ?? []).not.toContain(guard.id);
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
      expect(worldSceneryBodyContact({}, rock, guard, enemyHull(guard.enemy!)!, 0)).toBeNull();
      closest = Math.min(closest, actualGap(rock, guard, guard.enemy!.facing));
      const anchor = questGuardAnchor(questGuardPlacementContext(CONTENT, flight), guard)!;
      expect(worldDistance(flightWorldContext(flight), destination, guard)).toBeGreaterThanOrEqual(
        anchor.clearanceRadius,
      );
    }
    console.info(
      "AI_NAVIGATION_METRICS",
      JSON.stringify({ actualHullGap: closest, steps: 600, turning }),
    );
    expect(closest).toBeGreaterThanOrEqual(ENEMY_AVOIDANCE.clearance);
    expect(closest).toBeLessThan(350);
    expect(worldDistance(flightWorldContext(flight), start, guard)).toBeGreaterThan(100);
    expect(guard.enemy!.home).toEqual(home);
    expect(guard.radius).toBe(radius);
    expect(rock.radius).toBe(shape.radius);
    expect(guard.hp).toBe(hp);
    expect(routeBlocked("quest", flight)).toBe(true);
    flight.player = { x: destination.x - 2000, y: destination.y };
    expect(tracker.targetMarkers(GAME_AREA).some(({ id }) => id === guard.id)).toBe(true);
    expect(guard.enemy!.home).toEqual(home);
  },
);

it("retains an ordinary pursuing frigate while visible and unloads it only beyond the active region", () => {
  const flight = createFlight(CONTENT, 1, 173, newProgress());
  const definition = enemyDefinition(1, "frigate", "navigation-retention");
  const position = { x: 240, y: 0 };
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "navigation-retention", packId: null, phase: 0 },
    position,
  );
  enemy.engaged = true;
  enemy.lastSeen = { ...flight.player };
  const object: SpaceObject = {
    ...position,
    enemy,
    hp: enemy.hp,
    id: enemy.id,
    kind: "enemy",
    persistent: false,
    radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
  };
  flight.objects = [object];
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  expect(inGameArea(gameAreaPoint(flight.player, object))).toBe(true);
  stepFlight(CONTENT, 1 / 30, idle, flight);
  expect(flight.objects.filter(({ id }) => id === object.id)).toHaveLength(1);
  expect(object.enemy!.engaged).toBe(true);
  flight.player = { x: -CONTENT.tuning.chunkSize * (ACTIVE_CHUNK_RADIUS + 2), y: 0 };
  expect(inGameArea(gameAreaPoint(flight.player, object))).toBe(false);
  const events = stepFlight(CONTENT, 1 / 30, idle, flight);
  expect(flight.objects.some(({ id }) => id === object.id)).toBe(false);
  expect(flight.world.notables[object.id]).toBeUndefined();
  expect(events.some(({ type }) => type === "enemyDestroyed")).toBe(false);
});
