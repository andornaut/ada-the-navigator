import { afterEach, expect, it, vi } from "vitest";

import { GALAXY_SIDE } from "../data/world.ts";
import * as asteroids from "./asteroids.ts";
import { retaliatorAsteroidQuery } from "./retaliatorAsteroids.ts";
import type { SpaceObject } from "./types.ts";

const shape = [...asteroids.ASTEROID_SHAPES.values()][0]!;
const rock = (id: string, x: number, y = 0): SpaceObject => ({
  asteroid: shape.id,
  hp: 1,
  id,
  kind: "rock",
  radius: shape.radius,
  x,
  y,
});
afterEach(() => vi.restoreAllMocks());

it("supplies only live authored asteroid bodies in stable id order, with actual positions and reaches", () => {
  const first = rock("z-rock", 0);
  const ore = { ...rock("a-resource", 1), kind: "resource" as const };
  const objects = [
    first,
    ore,
    { ...rock("dead", 0), hp: 0 },
    { ...rock("debris", 0), kind: "debris" as const },
    { ...rock("unknown", 0), asteroid: "missing" },
  ];
  const before = structuredClone(objects);
  const query = retaliatorAsteroidQuery({}, 512, objects);
  expect(query(10, { x: 0, y: 0 })).toEqual(
    [ore, first].map((o) => ({
      id: o.id,
      physicalReach: asteroids.placementRadius(o),
      position: { x: o.x, y: o.y },
    })),
  );
  expect(objects).toEqual(before);
});

it("uses physical footprint reach and shortest wrapped distance across the world seam", () => {
  const asteroid = rock("seam-rock", -GALAXY_SIDE / 2 + 1);
  const home = { x: GALAXY_SIDE / 2 - 1, y: 0 };
  expect(
    retaliatorAsteroidQuery({ worldSide: GALAXY_SIDE }, 512, [asteroid])(1, home).map((a) => a.id),
  ).toEqual([asteroid.id]);
  expect(retaliatorAsteroidQuery({}, 512, [asteroid])(1, home)).toEqual([]);
});

it("prepares actual asteroid metadata once per slice rather than rescanning it per ship", () => {
  const compute = vi.spyOn(asteroids, "placementRadius");
  const query = retaliatorAsteroidQuery({}, 512, [rock("local", 0), rock("remote", 10000)]);
  expect(compute).toHaveBeenCalledTimes(2);
  for (const home of [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 0, y: 0 },
  ]) {
    expect(query(1, home)).toHaveLength(1);
  }
  expect(compute).toHaveBeenCalledTimes(2);
});
