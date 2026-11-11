import { describe, expect, it, vi } from "vitest";

import {
  ASTEROID_CATALOG,
  ASTEROID_SIZES,
  type AsteroidEntry,
  placeholderAsteroids,
  readAsteroidCatalog,
} from "../data/asteroid-catalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  ASTEROID_SHAPES,
  asteroidShape,
  bounce,
  orbitMotion,
  reflectDirection,
  sceneryBlocksSegment,
  sceneryContact,
} from "./asteroids.ts";
import { type ChunkPlanOptions, planChunk } from "./chunk-templates.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";
import type { SectorProgress, SpaceObject, Vec } from "./types.ts";

const progress: SectorProgress = {
  deposited: 0,
  disabledEnemies: 0,
  discoveries: 0,
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  stage: 0,
  stations: [],
};

const shapes = [...ASTEROID_SHAPES.values()];
const tuning = PROTOTYPE.tuning.flight;
const options: ChunkPlanOptions = {
  asteroids: { field: ASTEROID_FIELDS[1], shapes },
  clearance: tuning.shipRadius,
  objectsPerChunk: tuning.objectsPerChunk,
  rockRadius: tuning.rockRadius,
  sector: 1,
  seed: 173,
  shipRadius: tuning.shipRadius,
  size: PROTOTYPE.tuning.chunkSize,
  spawnWeights: tuning.spawnWeights,
  x: 2,
  y: -3,
};
const pair = (at: Vec) => [at.x, at.y];
/** Art's on-disk form: vectors as [x, y] pairs. */
const artJson = (entry: AsteroidEntry) => ({
  ...entry,
  collision: entry.collision.map((part) => part.map(pair)),
  pivot: pair(entry.pivot),
});
const rock = (id: string, extra: Partial<SpaceObject> = {}): SpaceObject => ({
  hp: 99,
  id,
  kind: "rock",
  radius: 40,
  x: 0,
  y: 0,
  ...extra,
});
const huge = shapes.find((shape) => shape.size === "huge")!;

describe("asteroid catalog", () => {
  it("reads Art's version 1 format, including the seeded placeholders", () => {
    const file = { asteroids: ASTEROID_CATALOG.asteroids.map(artJson), version: 1 };
    expect(readAsteroidCatalog(JSON.parse(JSON.stringify(file)))).toEqual(ASTEROID_CATALOG);
    expect(placeholderAsteroids(0x5eed)).toEqual(ASTEROID_CATALOG);
  });

  it.each([
    ["an unknown version", (file: { version: number }) => ({ ...file, version: 2 })],
    [
      "a duplicate id",
      (file: { asteroids: unknown[] }) => ({
        ...file,
        asteroids: [file.asteroids[0], file.asteroids[0]],
      }),
    ],
    [
      "a concave collision part",
      (file: { asteroids: Record<string, unknown>[] }) => ({
        ...file,
        asteroids: [
          {
            ...file.asteroids[0],
            collision: [
              [
                [0, 0],
                [10, 0],
                [2, 2],
                [0, 10],
              ],
            ],
          },
        ],
      }),
    ],
    [
      "an unknown size class",
      (file: { asteroids: Record<string, unknown>[] }) => ({
        ...file,
        asteroids: [{ ...file.asteroids[0], size: "giant" }],
      }),
    ],
  ])("rejects %s", (_, change) => {
    const file = { asteroids: ASTEROID_CATALOG.asteroids.map(artJson), version: 1 };
    expect(readAsteroidCatalog(change(file as never))).toBeUndefined();
  });

  it("varies sizes from small to much larger, lobed irregular shapes", () => {
    const bySize = Object.fromEntries(
      ASTEROID_SIZES.map((size) => [size, shapes.filter((shape) => shape.size === size)]),
    );
    for (const size of ASTEROID_SIZES) {
      expect(bySize[size]!.length).toBeGreaterThanOrEqual(3);
    }
    const largestSmall = Math.max(...bySize.small!.map((shape) => shape.radius));
    expect(Math.min(...bySize.huge!.map((shape) => shape.radius))).toBeGreaterThan(
      4 * largestSmall,
    );
    expect([...bySize.large!, ...bySize.huge!].every((shape) => shape.parts.length >= 2)).toBe(
      true,
    );
    // Irregular: vertex distances from the center differ within each outline.
    for (const shape of shapes) {
      const reach = shape.parts.flat().map((at) => Math.hypot(at.x, at.y));
      expect(Math.max(...reach) / Math.min(...reach)).toBeGreaterThan(1.15);
    }
  });

  it("converts frame pixels back to world units through the inverse projection", () => {
    const entry = ASTEROID_CATALOG.asteroids[0]!;
    const shape = asteroidShape(entry);
    const origin = { x: entry.pivot.x * entry.frame.width, y: entry.pivot.y * entry.frame.height };
    shape.parts.forEach((part, index) =>
      part.forEach((at, corner) => {
        const screen = entry.collision[index]![corner]!;
        expect(at.x - at.y).toBeCloseTo(screen.x - origin.x);
        expect((at.x + at.y) / 2).toBeCloseTo(screen.y - origin.y);
      }),
    );
  });
});

describe("scenery contact and bounce", () => {
  it("measures circle overlap with a circle and with the actual polygon of a huge asteroid", () => {
    const contact = sceneryContact(rock("circle"), { x: 45, y: 0 }, 10)!;
    expect(contact.depth).toBeCloseTo(5);
    expect(contact.normal).toEqual({ x: 1, y: 0 });
    const object = rock("huge", { asteroid: huge.id, radius: huge.radius });
    // Inside the bounding circle but outside the outline, a probe must not collide.
    const gaps = Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2;
      return { x: Math.cos(angle) * (huge.radius - 1), y: Math.sin(angle) * (huge.radius - 1) };
    });
    expect(gaps.some((at) => !sceneryContact(object, at, 1))).toBe(true);
    const inner = sceneryContact(object, { x: 0, y: 0 }, 10)!;
    expect(inner.depth).toBeGreaterThan(10);
    expect(Math.hypot(inner.normal.x, inner.normal.y)).toBeCloseTo(1);
  });

  it("reverses only the approaching normal component, at least the recoil speed", () => {
    const normal = { x: -1, y: 0 };
    const still = { x: 0, y: 0 };
    expect(bounce(0.4, 24, normal, still, { x: 200, y: 0 })).toEqual({ x: -80, y: 0 });
    expect(bounce(0.4, 24, normal, still, { x: 10, y: 0 })).toEqual({ x: -24, y: 0 });
    const glancing = bounce(0.4, 24, normal, still, { x: 50, y: 180 });
    expect(glancing).toEqual({ x: -24, y: 180 });
    expect(bounce(0.4, 24, normal, still, { x: -30, y: 5 })).toEqual({ x: -30, y: 5 });
    // A drifting surface pushes a resting ship away relative to the surface's motion.
    expect(bounce(0.4, 24, normal, { x: -10, y: 0 }, still).x).toBeCloseTo(-34);
    expect(reflectDirection(normal, { x: 1, y: 0 })).toEqual({ x: -1, y: 0 });
  });

  it("blocks sight lines through the outline, not the empty bounding circle", () => {
    const object = rock("huge", { asteroid: huge.id, radius: huge.radius });
    expect(sceneryBlocksSegment(object, { x: -300, y: 0 }, { x: 300, y: 0 }, 0)).toBe(true);
    expect(
      sceneryBlocksSegment(
        object,
        { x: -300, y: huge.radius + 5 },
        { x: 300, y: huge.radius + 5 },
        0,
      ),
    ).toBe(false);
  });
});

describe("asteroid chunk fields", () => {
  it("regenerates the same asteroids, drift and features for the same chunk seed", () => {
    const first = planChunk(CHUNK_CATALOG, options);
    expect(planChunk(CHUNK_CATALOG, { ...options, x: 40 })).not.toEqual(first);
    expect(planChunk(CHUNK_CATALOG, options)).toEqual(first);
  });

  it("varies sizes, features and drifting asteroids across chunks while keeping corridors open", () => {
    const sizes = new Set<string>();
    const variants = new Set<string>();
    let drifting = 0;
    let features = 0;
    for (let x = -12; x < 12; x++) {
      for (let y = -12; y < 12; y++) {
        const plan = planChunk(CHUNK_CATALOG, { ...options, x, y });
        const center = { x: (x + 0.5) * options.size, y: (y + 0.5) * options.size };
        const free = options.shipRadius + options.clearance;
        for (const placement of plan.placements) {
          expect(Math.abs(placement.x - center.x) - placement.radius).toBeGreaterThanOrEqual(free);
          expect(Math.abs(placement.y - center.y) - placement.radius).toBeGreaterThanOrEqual(free);
          if (placement.asteroid) {
            const shape = ASTEROID_SHAPES.get(placement.asteroid)!;
            sizes.add(shape.size);
            variants.add(shape.id);
            expect(placement.radius).toBe(shape.radius);
          }
          if (placement.orbit) {
            drifting++;
            const { radius, rate } = placement.orbit;
            const range = ASTEROID_SHAPES.get(placement.asteroid!)!.drift.speed;
            expect(Math.abs(radius * rate)).toBeLessThanOrEqual(range[1] + 1e-9);
            expect(Math.abs(rate)).toBeLessThanOrEqual(0.3);
            // The whole drift path keeps the corridor clearance.
            const reach = placement.radius + radius;
            expect(Math.abs(placement.x - center.x) - reach).toBeGreaterThanOrEqual(free - 1e-9);
            expect(Math.abs(placement.y - center.y) - reach).toBeGreaterThanOrEqual(free - 1e-9);
          }
          features += placement.id.endsWith(":feature") ? 1 : 0;
        }
      }
    }
    expect([...sizes].sort()).toEqual([...ASTEROID_SIZES].sort());
    expect(variants.size).toBeGreaterThan(ASTEROID_SIZES.length * 2);
    expect(drifting).toBeGreaterThan(20);
    expect(features).toBeGreaterThan(20);
  });
});

describe("asteroids in flight", () => {
  // Launches draw their world seed from crypto; a fixed seed makes the explored chunks, and so
  // the huge and drifting asteroids these tests rely on, the same on every run.
  const LAUNCH_SEED = 173;
  function launched() {
    const random = vi
      .spyOn(globalThis.crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        (array as unknown as Uint32Array).fill(LAUNCH_SEED);
        return array;
      });
    const model = new GameModel(PROTOTYPE);
    try {
      model.startSector(1);
      playOpening(model);
    } finally {
      random.mockRestore();
    }
    const flight = model.state.flight!;
    expect(flight.seed).toBe(LAUNCH_SEED);
    flight.objects = flight.objects.filter((object) => object.kind !== "rock");
    flight.shots = [];
    return { flight, model };
  }
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

  function explore(model: GameModel): Map<string, SpaceObject> {
    const flight = model.state.flight!;
    const seen = new Map<string, SpaceObject>();
    for (let step = 0; step < 40; step++) {
      flight.player.x += 900;
      model.step(1 / 60, idle);
      for (const object of flight.objects) {
        if (object.asteroid) {
          seen.set(object.id, object);
        }
      }
    }
    return seen;
  }

  it("generates large irregular and drifting asteroids as the ship explores", () => {
    const { model } = launched();
    const all = [...explore(model).values()];
    expect(all.some((object) => ASTEROID_SHAPES.get(object.asteroid!)!.size === "huge")).toBe(true);
    expect(all.some((object) => object.orbit && object.velocity && !object.persistent)).toBe(true);
    const sized = all.find((object) => ASTEROID_SHAPES.get(object.asteroid!)!.size === "large");
    expect(sized?.hp).toBe(ASTEROID_FIELDS[1].hp.large);
  });

  it("bounces Ada off a large irregular asteroid head-on and glancing, without damage or sticking", () => {
    const large = shapes.find((shape) => shape.size === "large")!;
    for (const [move, label] of [
      [{ x: 1, y: 0 }, "head-on"],
      [{ x: 0.95, y: 0.31 }, "glancing"],
    ] as const) {
      const { flight, model } = launched();
      const shield = flight.shield;
      const wall = rock(`wall:${label}`, {
        asteroid: large.id,
        radius: large.radius,
        x: flight.player.x + large.radius + 60,
        y: flight.player.y,
      });
      flight.objects.push(wall);
      flight.velocity = { x: 0, y: 0 };
      let contacts = 0;
      let rebound = 0;
      let kept = Infinity;
      for (let step = 0; step < 240; step++) {
        // Only the rock and safe areas remain, so any shield loss would come from scenery.
        flight.objects = flight.objects.filter(
          (object) => object === wall || ["destination", "station"].includes(object.kind),
        );
        const before = { ...flight.velocity };
        model.step(1 / 60, { ...idle, move: step < 90 ? move : { x: 0, y: 0 } });
        expect(sceneryContact(wall, flight.player, tuning.shipRadius)).toBeNull();
        const contact = sceneryContact(wall, flight.player, tuning.shipRadius + 1);
        if (contact) {
          const into = before.x * contact.normal.x + before.y * contact.normal.y;
          const out = flight.velocity.x * contact.normal.x + flight.velocity.y * contact.normal.y;
          if (into < 0 && out > 0) {
            contacts++;
            rebound = Math.max(rebound, out);
            kept = Math.min(kept, Math.hypot(flight.velocity.x, flight.velocity.y));
          }
        }
      }
      expect(contacts, label).toBeGreaterThan(0);
      expect(rebound, label).toBeGreaterThanOrEqual(tuning.sceneryRecoil - 1e-6);
      // Every bounce leaves her moving.
      expect(kept, label).toBeGreaterThanOrEqual(tuning.sceneryRecoil - 1e-6);
      // After release she coasts away from the rock instead of resting against it.
      expect(sceneryContact(wall, flight.player, tuning.shipRadius + 2)).toBeNull();
      expect(flight.shield).toBe(shield);
    }
  });

  it("returns the restitution share of a head-on approach as recoil", () => {
    const { flight, model } = launched();
    const wall = rock("wall", { x: flight.player.x + 52, y: flight.player.y });
    flight.objects.push(wall);
    flight.velocity = { x: 150, y: 0 };
    model.step(1 / 60, idle);
    expect(flight.velocity.x).toBeLessThan(0);
    expect(-flight.velocity.x).toBeGreaterThan(150 * tuning.sceneryRestitution * 0.8);
    expect(-flight.velocity.x).toBeLessThanOrEqual(150 * tuning.sceneryRestitution + 1e-6);
  });

  it("resumes a drifting asteroid on its seeded path after paging and a save round-trip", () => {
    const { flight, model } = launched();
    explore(model);
    const drifter = flight.objects.find((object) => object.orbit);
    expect(drifter, "the fixed launch seed explores into a drifting asteroid").toBeDefined();
    if (!drifter) {
      return;
    }
    const orbit = { ...drifter.orbit! };
    const start = { x: drifter.x, y: drifter.y };
    model.step(1, idle);
    const moved = orbitMotion(flight.time, orbit);
    expect(drifter.x).toBeCloseTo(moved.position.x);
    expect(drifter.y).toBeCloseTo(moved.position.y);
    expect(Math.hypot(drifter.x - start.x, drifter.y - start.y)).toBeGreaterThan(0);
    expect(drifter.velocity!.x).toBeCloseTo(moved.velocity.x);
    // Paging out keeps no ledger entry: the path is regenerated from the chunk seed.
    flight.player.x += 20 * PROTOTYPE.tuning.chunkSize;
    model.step(1 / 60, idle);
    expect(flight.objects.some((object) => object.id === drifter.id)).toBe(false);
    expect(Object.hasOwn(flight.world.notables, drifter.id)).toBe(false);
    for (let step = 0; step < 300; step++) {
      model.step(1 / 60, idle);
    }
    const resumed = new GameModel(PROTOTYPE, model.save());
    const again = resumed.state.flight!;
    expect(again.time).toBe(flight.time);
    again.player.x = orbit.x + 700;
    again.player.y = orbit.y;
    resumed.step(1 / 60, idle);
    const back = again.objects.find((object) => object.id === drifter.id)!;
    expect(back.orbit).toEqual(orbit);
    const expected = orbitMotion(again.time, orbit);
    expect(back.x).toBeCloseTo(expected.position.x);
    expect(back.y).toBeCloseTo(expected.position.y);
    expect(restoreSave(resumed.save())?.flight?.objects).toContainEqual(back);
  });

  it("bounces enemies off scenery by the same rule", () => {
    const flight = createFlight(PROTOTYPE, 1, 173, progress);
    flight.objects = [];
    const definition = enemyCatalog.fighter;
    const at = { x: flight.player.x + 600, y: flight.player.y };
    const enemy: SpaceObject = {
      ...at,
      enemy: createEnemy(
        definition,
        { archetype: "fighter", id: "bouncer", packId: null, phase: 0 },
        at,
      ),
      hp: definition.hp,
      id: "bouncer",
      kind: "enemy",
      radius: definition.sizeRatio * tuning.shipRadius,
    };
    enemy.enemy!.engaged = true;
    enemy.enemy!.velocity = { x: -120, y: 0 };
    const wall = rock("wall", { x: at.x - 40 - enemy.radius - 1, y: at.y });
    flight.objects.push(enemy, wall);
    stepFlight(PROTOTYPE, 1 / 30, idle, flight);
    expect(enemy.enemy!.velocity.x).toBeGreaterThan(0);
    expect(sceneryContact(wall, enemy, enemy.radius)).toBeNull();
    expect(flight.objects).toContain(wall);
  });
});
