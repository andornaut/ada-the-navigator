import { afterEach, expect, it, vi } from "vitest";

import { ANDROMEDA_REDACT } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import * as asteroids from "./asteroids.ts";
import * as debris from "./debrisBody.ts";
import { debrisFrameOf, debrisSilhouette } from "./debrisBody.ts";
import { admitRedactEncounter, createUnpopulatedFlight, stepFlight } from "./flight.ts";
import { SceneryFrames } from "./sceneryFrames.ts";
import type { FlightState, SpaceObject } from "./types.ts";

afterEach(() => vi.restoreAllMocks());
const context = (): Pick<FlightState, "galaxy" | "seed" | "time"> => ({
  galaxy: 1,
  seed: 173,
  time: 12,
});
const rock = (): SpaceObject => ({
  asteroid: "asteroid-s1",
  hp: 10,
  id: "frame-rock",
  kind: "rock",
  radius: 30,
  x: 0,
  y: 0,
});
function reference(flight: ReturnType<typeof context>, reduced: boolean, object: SpaceObject) {
  const shape = asteroids.sceneryShape(object);
  return debrisSilhouette(flight.galaxy, object)
    ? debrisFrameOf(flight.galaxy, object, reduced, flight.time)
    : shape
      ? asteroids.rockFrame(shape, flight.seed, reduced, object.id, flight.time, object.spinStart)
      : 0;
}

it("evaluates canonical spinning geometry once for repeated collision and visibility reads", () => {
  const cache = new SceneryFrames();
  const flight = context();
  const object = rock();
  const expected = reference(flight, false, object);
  const before = structuredClone({ flight, object });
  const compute = vi.spyOn(asteroids, "rockFrame");
  for (let read = 0; read < 20; read++) {
    expect(cache.frame(flight, false, object)).toBe(expected);
  }
  expect(compute).toHaveBeenCalledTimes(1);
  flight.time += 1 / 60;
  cache.frame(flight, false, object);
  expect(compute).toHaveBeenCalledTimes(2);
  expect(object).toEqual(before.object);
});

it("matches canonical frames across time, identity, shape, motion settings and debris classification changes", () => {
  const cache = new SceneryFrames();
  const flight = context();
  const object = rock();
  let reduced = false;
  const changes = [
    () => {},
    () => {
      flight.time = 27;
    },
    () => {
      flight.seed = 22;
    },
    () => {
      object.id = "other-piece";
    },
    () => {
      object.spinStart = 5;
    },
    () => {
      object.asteroid = "asteroid-m2";
    },
    () => {
      reduced = true;
    },
    () => {
      reduced = false;
      flight.galaxy = 3;
      object.kind = "debris";
      delete object.asteroid;
      object.velocity = { x: 5, y: 0 };
    },
    () => {
      object.orbit = { phase: 0, radius: 10, rate: 1, x: 0, y: 0 };
    },
    () => {
      delete object.orbit;
      delete object.velocity;
    },
    () => {
      object.velocity = { x: 0, y: 3 };
    },
    () => {
      flight.galaxy = 2;
    },
  ];
  for (const change of changes) {
    change();
    const expected = reference(flight, reduced, object);
    expect(cache.frame(flight, reduced, object)).toBe(expected);
    expect(cache.frame(flight, reduced, object)).toBe(expected);
  }
});

it("deduplicates frame hashing in the actual capital encounter AI and projectile slice", () => {
  const flight = createUnpopulatedFlight(CONTENT, 5, 0);
  const site = { x: 12000, y: 12000 };
  flight.player = { x: site.x, y: site.y + 300 };
  admitRedactEncounter(CONTENT, flight, site, { x: site.x + 1000, y: site.y });
  const capital = flight.objects.find(({ id }) => id === ANDROMEDA_REDACT.id)!;
  expect(capital.enemy?.archetype).toBe("capital");
  const age = capital.enemy!.age;
  const target = { ...rock(), x: site.x, y: site.y + 130 };
  flight.objects.push(target);
  flight.shots.push({
    damage: 1,
    enemy: false,
    hitIds: [],
    id: "frame-shot",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: target.x,
    y: target.y,
  });
  const compute = vi.spyOn(asteroids, "rockFrame");
  stepFlight(CONTENT, 1 / 60, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false }, flight);
  expect(capital.enemy!.age).toBeGreaterThan(age);
  expect(target.hp).toBe(9);
  expect(compute.mock.calls.some(([, , , id]) => id === target.id)).toBe(true);
  const keys = compute.mock.calls.map(([, seed, reduced, id, time, start]) =>
    JSON.stringify([seed, reduced, id, time, start]),
  );
  expect(new Set(keys).size).toBe(keys.length);
});

it("invalidates a same-object same-time rock entry when canonical shape metadata is replaced", () => {
  const cache = new SceneryFrames();
  const flight = context();
  const object = rock();
  const shapes = asteroids.ASTEROID_SHAPES as Map<string, asteroids.AsteroidShape>;
  const original = shapes.get(object.asteroid!)!;
  for (flight.time = 0; flight.time < original.frames.length; flight.time++) {
    if (reference(flight, false, object) !== 0) {
      break;
    }
  }
  const before = cache.frame(flight, false, object);
  expect(before).not.toBe(0);
  try {
    shapes.set(object.asteroid!, { ...original, spin: false });
    expect(cache.frame(flight, false, object)).toBe(0);
    expect(cache.frame(flight, false, object)).not.toBe(before);
  } finally {
    shapes.set(object.asteroid!, original);
  }
  expect(cache.frame(flight, false, object)).toBe(before);
});

it("never reuses a traveling-debris result across replacement of its live frame provider", () => {
  const cache = new SceneryFrames();
  const flight = { ...context(), galaxy: 3 as const };
  const object: SpaceObject = {
    hp: 1,
    id: "live-debris",
    kind: "debris",
    radius: 20,
    velocity: { x: 2, y: 0 },
    x: 0,
    y: 0,
  };
  const before = cache.frame(flight, false, object);
  const replacement = (before + 1) % debrisSilhouette(flight.galaxy, object)!.frames.length;
  const provider = vi.spyOn(debris, "debrisFrameOf").mockReturnValue(replacement);
  expect(cache.frame(flight, false, object)).toBe(replacement);
  expect(cache.frame(flight, false, object)).toBe(replacement);
  expect(provider).toHaveBeenCalledTimes(2);
});
