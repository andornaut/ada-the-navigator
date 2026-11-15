import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { actualGap } from "../testing/aiGeometry.ts";
import { markerModel } from "../testing/markerModel.ts";
import { ASTEROID_SHAPES, worldSceneryBodyContact } from "./asteroids.ts";
import { GAME_AREA, gameAreaPoint, inGameArea } from "./edgeMarkers.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyHull } from "./enemyBody.ts";
import {
  createFlight,
  ensureDestinationAt,
  routeBlocked,
  spawnChapterEnemy,
  stepFlight,
} from "./flight.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { newProgress } from "./progress.ts";
import type { SpaceObject } from "./types.ts";

it.each([false, true])(
  "flies a marked frigate past an asteroid with hull clearance (turning=%s)",
  (turning) => {
    const flight = createFlight(CONTENT, 1, 173, newProgress());
    flight.objects = [];
    const destination = ensureDestinationAt(CONTENT, "quest", { x: 800, y: 0 }, flight);
    const guard = spawnChapterEnemy(CONTENT, "frigate", "route:quest", { x: -800, y: 0 }, flight, {
      routeId: "quest",
    })!;
    // Keep the canonical guard and escorts, isolating this one obstacle from seeded ambient layout.
    flight.objects = flight.objects.filter(
      (object) =>
        object.id === destination.id ||
        object.id === guard.id ||
        object.enemy?.escortOf === guard.id,
    );
    const shape = [...ASTEROID_SHAPES.values()].find((s) => s.size === "large")!;
    const rock: SpaceObject = {
      asteroid: shape.id,
      hp: CONTENT.tuning.flight.rockHp,
      id: "navigation-rock",
      kind: "rock",
      radius: shape.radius,
      spinStart: 0,
      x: 0,
      y: 0,
    };
    flight.objects.push(rock);
    flight.player = { x: destination.x, y: destination.y };
    guard.enemy!.facing = turning ? { x: 0, y: -1 } : { x: 1, y: 0 };
    if (turning) {
      guard.enemy!.velocity = { x: 0, y: -enemyCatalog.frigate.physics.maxSpeed };
    }
    const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, reducedMotion: true, use: false };
    expect(stepFlight(CONTENT, 1 / 30, idle, flight)).toContainEqual({
      id: "quest",
      type: "guardCue",
    });
    const tracker = markerModel(flight);
    tracker.markerTargetDisplayed(guard.id);
    expect(tracker.targetMarkers(GAME_AREA).some(({ id }) => id === guard.id)).toBe(true);
    const radius = guard.radius;
    let closest = Infinity;
    let steps = 0;
    while (flight.summonedGuards && steps++ < 1350) {
      stepFlight(CONTENT, 1 / 30, idle, flight);
      expect(flight.objects.filter(({ id }) => id === guard.id)).toHaveLength(1);
      expect(flight.shots.some((shot) => shot.enemy)).toBe(false);
      expect(worldSceneryBodyContact({}, rock, guard, enemyHull(guard.enemy!)!, 0)).toBeNull();
      closest = Math.min(closest, actualGap(rock, guard, guard.enemy!.facing));
      tracker.targetMarkers(GAME_AREA);
    }
    console.info(
      "AI_NAVIGATION_METRICS",
      JSON.stringify({
        actualHullGap: closest,
        passageGap: ENEMY_AVOIDANCE.passageClearance,
        physicalRadius: radius,
        preferredGap: ENEMY_AVOIDANCE.clearance,
        steps,
        turning,
      }),
    );
    expect(flight.summonedGuards).toBeUndefined();
    expect(closest).toBeGreaterThanOrEqual(ENEMY_AVOIDANCE.clearance);
    expect(guard.radius).toBe(radius);
    expect(rock.radius).toBe(shape.radius);
    expect(routeBlocked("quest", flight)).toBe(true);
    expect(tracker.targetMarkers(GAME_AREA).some(({ id }) => id === guard.id)).toBe(false);
    expect(inGameArea(gameAreaPoint(flight.player, guard))).toBe(true);
    const hp = guard.hp;
    const policy = enemyDefinition(flight.galaxy, "frigate", guard.id).pursuit;
    const returnBound = Math.ceil((policy.maxSeconds + policy.unseenSeconds) * 30);
    let returning = 0;
    while (!guard.enemy!.returning && returning++ < returnBound) {
      stepFlight(CONTENT, 1 / 30, idle, flight);
      expect(flight.objects.filter(({ id }) => id === guard.id)).toHaveLength(1);
    }
    expect(guard.enemy!.returning).toBe(true);
    expect(guard.hp).toBe(hp);
    expect(routeBlocked("quest", flight)).toBe(true);
  },
  10000,
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
