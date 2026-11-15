import { expect, it } from "vitest";

import { enemyCatalog } from "../../data/enemyCatalog.ts";
import { ASTEROID_SHAPES, scenerySilhouette } from "../asteroids.ts";
import { outlinesContact } from "../convex.ts";
import { createEnemy } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import type { SpaceObject } from "../types.ts";
import { worldPoint } from "../worldContacts.ts";
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
        const pose = { facing, position: { x, y: 35 } };
        for (const clearance of [0, 40, 80]) {
          const drawn = scenerySilhouette(rock)!;
          const hit = outlinesContact(
            drawn.frames[frame % drawn.frames.length]!,
            worldPoint(context, pose.position, rock),
            enemyHull({ archetype: "frigate", facing })!,
            pose.position,
            clearance,
          );
          expect(query.clear(pose, clearance)).toBe(hit === null);
          expect(query.escape(pose, clearance)).toEqual(hit?.normal ?? null);
        }
      }
    }
    expect(metadataReads).toBe(preparedReads);
  }
});
