import { isDeepStrictEqual } from "node:util";

import { expect, it } from "vitest";

import { enemyCatalog } from "../../data/enemyCatalog.ts";
import { ASTEROID_SHAPES, scenerySilhouette } from "../asteroids.ts";
import { type Contact, outlinesContact, type Parts } from "../convex.ts";
import { createEnemy } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import type { SpaceObject } from "../types.ts";
import { worldPoint } from "../worldContacts.ts";
import { navigationLookAhead } from "./prediction.ts";
import { worldNavigationQuery } from "./worldNavigation.ts";

it("matches authored hull contacts across wrapped positions, headings, frames and clearances", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
  const rock: SpaceObject = {
    asteroid: shape.id,
    hp: 10,
    id: "query-rock",
    kind: "rock",
    radius: shape.radius,
    x: 990,
    y: 0,
  };
  const definition = enemyCatalog.frigate;
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "query-guard", packId: null, phase: 0.4 },
    { x: 980, y: 0 },
  );
  let metadataReads = 0;
  const drawn = scenerySilhouette(rock)!;
  // The authored contact depends on the frame only through its outline, so frames that share an
  // outline share each pose's oracle result.
  const oracles = new Map<Parts, Map<string, Contact | null>>();
  const mismatches: unknown[] = [];
  for (const frame of [0, 1, 7]) {
    const context = {
      drawnOf: () => {
        metadataReads++;
        return scenerySilhouette(rock);
      },
      frameOf: () => frame,
      worldSide: 2000,
    };
    const query = worldNavigationQuery(context, [rock], definition, { ...enemy, radius: 40 })!;
    expect(query).toBeDefined();
    const preparedReads = metadataReads;
    for (let heading = 0; heading < 16; heading++) {
      const facing = { x: Math.cos((heading * Math.PI) / 8), y: Math.sin((heading * Math.PI) / 8) };
      for (const x of [-990, -850, 700, 980, 1200]) {
        for (const y of [-80, 0, 35, 120]) {
          const pose = { facing, position: { x, y }, time: 0 };
          for (const clearance of [0, 40, 80]) {
            const outline = drawn.frames[frame % drawn.frames.length]!;
            const results = oracles.get(outline) ?? new Map<string, Contact | null>();
            oracles.set(outline, results);
            const key = `${heading}:${x}:${y}:${clearance}`;
            if (!results.has(key)) {
              results.set(
                key,
                outlinesContact(
                  outline,
                  worldPoint(context, pose.position, rock),
                  enemyHull({ archetype: "frigate", facing })!,
                  pose.position,
                  clearance,
                ),
              );
            }
            const hit = results.get(key) ?? null;
            const clear = query.clear(pose, clearance);
            const escape = query.escape(pose, clearance);
            const normal = hit?.normal ?? null;
            if (clear !== (hit === null) || !isDeepStrictEqual(escape, normal)) {
              mismatches.push({ clear, clearance, escape, frame, heading, normal, x, y });
            }
          }
        }
      }
    }
    expect(metadataReads).toBe(preparedReads);
  }
  expect(mismatches).toEqual([]);
});

it("tests a moving rock where its velocity puts it at each pose's time", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
  const velocity = { x: -60, y: 45 };
  const rock: SpaceObject = {
    asteroid: shape.id,
    hp: 10,
    id: "moving:query",
    kind: "debris",
    radius: shape.radius,
    velocity,
    x: 300,
    y: -100,
  };
  const definition = enemyCatalog.frigate;
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "query-mover", packId: null, phase: 0.4 },
    { x: 0, y: 0 },
  );
  const context = { drawnOf: scenerySilhouette, frameOf: () => 0 };
  const query = worldNavigationQuery(context, [rock], definition, { ...enemy, radius: 40 })!;
  for (const time of [0, 0.5, 2, 4]) {
    const placed: SpaceObject = {
      asteroid: shape.id,
      hp: 10,
      id: "query-still",
      kind: "rock",
      radius: shape.radius,
      x: rock.x + velocity.x * time,
      y: rock.y + velocity.y * time,
    };
    const stationary = worldNavigationQuery(context, [placed], definition, {
      ...enemy,
      radius: 40,
    })!;
    for (const x of [-100, 0, 150, 300]) {
      for (const y of [-120, 0, 90]) {
        for (const clearance of [0, 40, 80]) {
          const facing = { x: 1, y: 0 };
          const pose = { facing, position: { x, y }, time };
          expect(query.clear(pose, clearance)).toBe(
            stationary.clear({ ...pose, time: 0 }, clearance),
          );
          expect(query.escape(pose, clearance)).toEqual(
            stationary.escape({ ...pose, time: 0 }, clearance),
          );
        }
      }
    }
  }
});

it("admits a moving rock only when its path over the look-ahead comes within reach", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
  const definition = enemyCatalog.frigate;
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "query-reach", packId: null, phase: 0.4 },
    { x: 0, y: 0 },
  );
  const context = { drawnOf: scenerySilhouette, frameOf: () => 0 };
  const lookAhead = navigationLookAhead(definition);
  const far = definition.physics.maxSpeed * lookAhead + 1000;
  const rock = (x: number, vx: number): SpaceObject => ({
    asteroid: shape.id,
    hp: 10,
    id: "moving:reach",
    kind: "debris",
    radius: shape.radius,
    velocity: { x: vx, y: 0 },
    x,
    y: 0,
  });
  const query = (object: SpaceObject) =>
    worldNavigationQuery(context, [object], definition, { ...enemy, radius: 40 });
  // Closing fast enough to cross the 1000-unit gap within the look-ahead.
  const closing = -1200 / lookAhead;
  expect(query(rock(far, closing))).toBeDefined();
  expect(query(rock(far, -closing))).toBeUndefined();
  expect(query(rock(far, 0))).toBeUndefined();
});

it("rechecks clearance when either centre changes between checks of the same pose", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((entry) => entry.size === "large")!;
  const rock: SpaceObject = {
    asteroid: shape.id,
    hp: 10,
    id: "projection-rock",
    kind: "rock",
    radius: shape.radius,
    x: 990,
    y: 0,
  };
  const definition = enemyCatalog.frigate;
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "projection-guard", packId: null, phase: 0.4 },
    { x: -990, y: 0 },
  );
  const context = { drawnOf: scenerySilhouette, frameOf: () => 0, worldSide: 2000 };
  const query = worldNavigationQuery(context, [rock], definition, { ...enemy, radius: 40 })!;
  const pose = { facing: enemy.facing, position: { ...enemy.position }, time: 0 };
  expect(query.clear(pose, 0)).toBe(false);
  expect(query.clear(pose, 40)).toBe(false);

  pose.position.y = 500;
  expect(query.clear(pose, 40)).toBe(true);
  rock.y = 500;
  expect(query.clear(pose, 0)).toBe(false);
});
