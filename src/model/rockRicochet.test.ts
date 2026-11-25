import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { RockRicochet } from "../data/types.ts";
import { ASTEROID_SHAPES, type AsteroidShape, silhouetteArea } from "./asteroids.ts";
import { createFlight, stepFlight } from "./flight.ts";
import {
  MOVING_ROCK_PREFIX,
  type RicochetContext,
  ricochetRocks,
  rockMass,
  rocksContact,
} from "./rockRicochet.ts";
import type { FlightInput, FlightState, GalaxyProgress, SpaceObject, Vec } from "./types.ts";

const RULES = CONTENT.tuning.flight.rockRicochet;
const context: RicochetContext = {
  chunkSize: CONTENT.tuning.chunkSize,
  frameOf: () => 0,
  world: {},
};
const shapes = [...ASTEROID_SHAPES.values()].sort(
  (a, b) => silhouetteArea(a.silhouette) - silhouetteArea(b.silhouette),
);
const smallest = shapes[0]!;
const largest = shapes.at(-1)!;

function rock(id: string, shape: AsteroidShape, at: Vec, velocity?: Vec): SpaceObject {
  return {
    asteroid: shape.id,
    hp: 5,
    id,
    kind: velocity ? "debris" : "rock",
    radius: shape.radius,
    ...at,
    ...(velocity ? { velocity } : {}),
  };
}

function mover(id: string, shape: AsteroidShape, at: Vec, velocity: Vec): SpaceObject {
  return rock(`${MOVING_ROCK_PREFIX}${id}`, shape, at, velocity);
}

/** Places `a` on the x axis just inside touching `b`, which sits at `b`'s position. */
function touching(a: SpaceObject, b: SpaceObject, overlap = 0.5): void {
  let inside = 0;
  let outside = 4 * (a.radius + b.radius) + 400;
  for (let i = 0; i < 60; i++) {
    const middle = (inside + outside) / 2;
    a.x = b.x + middle;
    a.y = b.y;
    if (rocksContact(context, a, b)) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  a.x = b.x + inside - overlap;
}

function speed(object: SpaceObject): number {
  return Math.hypot(object.velocity?.x ?? 0, object.velocity?.y ?? 0);
}

function overlapping(objects: readonly SpaceObject[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const a of objects) {
    for (const b of objects) {
      if (a.id < b.id && rocksContact(context, a, b)) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}

describe("rock ricochet", () => {
  it("weighs each rock by its drawn outline's area", () => {
    const square = {
      frames: [
        [
          [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
          ],
        ],
      ],
      reach: 5,
    };
    expect(silhouetteArea(square)).toBe(12);
    const small = rock("small", smallest, { x: 0, y: 0 });
    expect(rockMass(small)).toBe(silhouetteArea(smallest.silhouette));
    expect(rockMass(rock("large", largest, { x: 0, y: 0 }))).toBeGreaterThan(rockMass(small));
  });

  it("deflects a mover off a static rock, which then drifts", () => {
    const still = rock("still", smallest, { x: 0, y: 0 });
    const moving = mover("a", smallest, { x: 0, y: 0 }, { x: -40, y: 0 });
    touching(moving, still);
    const normal = rocksContact(context, moving, still)!.normal;
    const closing = -40 * normal.x;
    ricochetRocks(context, RULES, [still, moving]);
    const separating =
      (moving.velocity!.x - still.velocity!.x) * normal.x +
      (moving.velocity!.y - still.velocity!.y) * normal.y;
    expect(separating).toBeCloseTo(-closing * RULES.restitution);
    expect(still.settle).toBe(RULES.settleSeconds);
    expect(still.kind).toBe("rock");
    expect(moving.settle).toBeUndefined();
    expect(overlapping([still, moving])).toEqual([]);
  });

  it("bounces two movers off each other", () => {
    const left = mover("left", smallest, { x: 0, y: 0 }, { x: 30, y: 0 });
    const right = mover("right", smallest, { x: 0, y: 0 }, { x: -30, y: 0 });
    touching(right, left);
    ricochetRocks(context, RULES, [left, right]);
    expect(left.velocity!.x).toBeLessThan(30);
    expect(right.velocity!.x).toBeGreaterThan(-30);
    expect(left.settle).toBeUndefined();
    expect(right.settle).toBeUndefined();
    expect(overlapping([left, right])).toEqual([]);
  });

  it("deflects the smaller rock more, by the ratio of their areas", () => {
    const loose: RockRicochet = { ...RULES, maxSpeed: 1000 };
    const big = mover("big", largest, { x: 0, y: 0 }, { x: 0, y: 0 });
    const small = mover("small", smallest, { x: 0, y: 0 }, { x: -50, y: 0 });
    touching(small, big);
    ricochetRocks(context, loose, [big, small]);
    const bigChange = Math.hypot(big.velocity!.x, big.velocity!.y);
    const smallChange = Math.hypot(small.velocity!.x + 50, small.velocity!.y);
    expect(smallChange).toBeGreaterThan(bigChange);
    expect(smallChange / bigChange).toBeCloseTo(rockMass(big) / rockMass(small));
  });

  it("caps every rock leaving a ricochet at the fastest speed", () => {
    const big = mover("big", largest, { x: 0, y: 0 }, { x: RULES.maxSpeed, y: 0 });
    const small = mover("small", smallest, { x: 0, y: 0 }, { x: -RULES.maxSpeed, y: 0 });
    touching(small, big);
    const uncapped = [structuredClone(big), structuredClone(small)];
    ricochetRocks(context, { ...RULES, maxSpeed: 1000 }, uncapped);
    expect(Math.max(...uncapped.map(speed))).toBeGreaterThan(RULES.maxSpeed);
    ricochetRocks(context, RULES, [big, small]);
    expect(speed(big)).toBeLessThanOrEqual(RULES.maxSpeed + 1e-9);
    expect(speed(small)).toBeCloseTo(RULES.maxSpeed);
  });

  it("lets a clustered mover leave the cluster's shared velocity", () => {
    const shared = { x: -40, y: 0 };
    const still = rock("still", smallest, { x: 0, y: 0 });
    const front = mover("front", smallest, { x: 0, y: 0 }, { ...shared });
    const back = mover("back", smallest, { x: 0, y: 300 }, { ...shared });
    touching(front, still);
    ricochetRocks(context, RULES, [still, front, back]);
    expect(front.velocity).not.toEqual(shared);
    expect(back.velocity).toEqual(shared);
  });

  it("is deterministic and independent of the rocks' order", () => {
    const scene = () => {
      const still = rock("still", largest, { x: 0, y: 0 });
      const a = mover("a", smallest, { x: 0, y: 0 }, { x: -40, y: 10 });
      const b = mover("b", smallest, { x: 0, y: 0 }, { x: 20, y: -30 });
      touching(a, still);
      b.x = a.x + 1;
      b.y = a.y + 2;
      return [still, a, b];
    };
    const first = scene();
    const second = scene();
    const reversed = scene().reverse();
    ricochetRocks(context, RULES, first);
    ricochetRocks(context, RULES, second);
    ricochetRocks(context, RULES, reversed);
    expect(second).toEqual(first);
    expect([...reversed].reverse()).toEqual(first);
  });

  it("leaves no rock overlapping another after a ricochet into a cluster", () => {
    const rocks = [rock("a", smallest, { x: 0, y: 0 })];
    const second = rock("b", smallest, { x: 0, y: 0 });
    touching(second, rocks[0]!, -1);
    rocks.push(second);
    const third = rock("c", smallest, { x: 0, y: 0 });
    touching(third, second, -1);
    rocks.push(third);
    const incoming = mover("m", largest, { x: 0, y: 0 }, { x: -60, y: 0 });
    touching(incoming, third, 3);
    rocks.push(incoming);
    expect(overlapping(rocks)).not.toEqual([]);
    ricochetRocks(context, RULES, rocks);
    expect(overlapping(rocks)).toEqual([]);
  });

  it("ignores rocks outside the moving rocks' neighbourhood", () => {
    const far = rock("far", smallest, { x: 5000, y: 5000 });
    const moving = mover("a", smallest, { x: 0, y: 0 }, { x: -40, y: 0 });
    ricochetRocks(context, RULES, [far, moving]);
    expect(far.velocity).toBeUndefined();
    expect(moving.velocity).toEqual({ x: -40, y: 0 });
  });
});

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: GalaxyProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  greetings: {},
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};

function empty(): FlightState {
  const flight = createFlight(CONTENT, 1, 173, progress);
  flight.objects = [];
  return flight;
}

describe("rock ricochet in flight", () => {
  it("settles a struck static rock to rest within its settle time, where it stays", () => {
    const flight = empty();
    const still = rock("still", smallest, { x: 600, y: 0 });
    const moving = mover("a", smallest, { x: 0, y: 0 }, { x: -40, y: 0 });
    touching(moving, still, 0);
    flight.objects.push(still, moving);
    stepFlight(CONTENT, 0.1, idle, flight);
    expect(still.settle).toBeGreaterThan(0);
    expect(speed(still)).toBeGreaterThan(0);
    // The mover leaves at its new constant velocity.
    const after = { ...moving.velocity! };
    for (let t = 0; t < RULES.settleSeconds; t += 0.1) {
      stepFlight(CONTENT, 0.1, idle, flight);
    }
    expect(moving.velocity).toEqual(after);
    expect(still.velocity).toBeUndefined();
    expect(still.settle).toBeUndefined();
    const rest = { x: still.x, y: still.y };
    stepFlight(CONTENT, 1, idle, flight);
    expect({ x: still.x, y: still.y }).toEqual(rest);
  });

  it("absorbs a struck static rock at an arrival disk, as it does moving rocks", () => {
    const flight = empty();
    flight.player = { x: 0, y: 900 };
    const drifting: SpaceObject = {
      ...rock("drifting", smallest, { x: CONTENT.tuning.exclusionRadius + 60, y: 0 }),
      settle: RULES.settleSeconds,
      velocity: { x: -80, y: 0 },
    };
    flight.objects.push(drifting);
    stepFlight(CONTENT, 2, idle, flight);
    expect(flight.objects).not.toContain(drifting);
  });
});
