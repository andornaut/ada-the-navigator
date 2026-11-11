import { describe, expect, it, vi } from "vitest";

import { ASTEROID_ART, ASTEROID_SIZES } from "../data/asteroid-catalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  ASTEROID_SHAPES,
  bounce,
  orbitMotion,
  reflectDirection,
  rockFrame,
  sceneryBlocksSegment,
  sceneryContact,
} from "./asteroids.ts";
import { type ChunkPlanOptions, planChunk } from "./chunk-templates.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, ensureDestination, ensureStation, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import { playOpening } from "./test-launch.ts";
import type { SectorProgress, SpaceObject, Vec } from "./types.ts";

const progress: SectorProgress = {
  deposited: 0,
  disabledEnemies: 0,
  discoveries: 0,
  donated: {},
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

describe("asteroid footprints", () => {
  // Gameplay's size classes (art/asteroids.md "Classes"): footprint radius ranges in world units.
  const RANGES = { huge: [84, 104], large: [52, 70], medium: [24, 34], small: [12, 18] } as const;

  it("collide with Art's own footprint per frame, its radius inside the class range", () => {
    const counts = Object.fromEntries(
      ASTEROID_SIZES.map((size) => [size, shapes.filter((shape) => shape.size === size).length]),
    );
    expect(counts).toEqual({ huge: 3, large: 3, medium: 4, small: 4 });
    for (const art of ASTEROID_ART.asteroids) {
      const shape = ASTEROID_SHAPES.get(art.id)!;
      expect(shape.radius).toBe(art.footprintRadius);
      expect(shape.frames).toEqual(art.frames.map((frame) => frame.footprint));
      const [low, high] = RANGES[art.size];
      expect(shape.radius, art.id).toBeGreaterThanOrEqual(low);
      expect(shape.radius, art.id).toBeLessThanOrEqual(high);
      // The broad-phase radius reaches every frame's footprint, to Art's two-decimal rounding of
      // both the points and the radius.
      const reach = Math.max(...shape.frames.flat(2).map((at) => Math.hypot(at.x, at.y)));
      expect(Math.abs(reach - shape.radius), art.id).toBeLessThanOrEqual(0.02);
    }
  });

  it("drift only small and medium rocks", () => {
    for (const shape of shapes) {
      expect(shape.drift.eligible, shape.id).toBe(
        shape.size === "small" || shape.size === "medium",
      );
    }
  });

  it("turn spinning rocks through every frame at a seeded rate, in either direction", () => {
    const small = shapes.find((shape) => shape.size === "small")!;
    const still = shapes.find((shape) => shape.size === "huge")!;
    const [, fast] = (small.spin as { degPerSecond: readonly [number, number] }).degPerSecond;
    const frames = (id: string, seconds: number[]) =>
      seconds.map((at) => rockFrame(small, 7, false, id, at));
    expect(
      new Set(
        frames(
          "rock-a",
          Array.from({ length: 400 }, (_, i) => i * 0.25),
        ),
      ).size,
    ).toBe(24);
    const steps = new Set<number>();
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const [now, next] = frames(id, [0, 15 / fast]);
      steps.add((next! - now! + 24) % 24);
    }
    // Each rock moves at most one frame per 15 / fast seconds; both directions occur.
    expect([...steps].every((step) => [0, 1, 23].includes(step))).toBe(true);
    expect(steps.has(1) && steps.has(23)).toBe(true);
    expect(rockFrame(small, 7, true, "rock-a", 3)).toBe(0);
    expect(rockFrame(still, 7, false, "rock-a", 3)).toBe(0);
  });

  it("hit a spinning rock's current frame, not frame 0", () => {
    // A medium rock whose frames differ: a probe inside one frame's base and outside another's.
    const medium = shapes.find((shape) => shape.id === "asteroid-m4")!;
    const object = rock("spinner", { asteroid: medium.id, radius: medium.radius });
    let probe: { frame: number; at: Vec } | undefined;
    for (let frame = 1; frame < medium.frames.length && !probe; frame++) {
      for (let angle = 0; angle < Math.PI * 2 && !probe; angle += Math.PI / 32) {
        for (const reach of [0.6, 0.75, 0.9].map((share) => share * medium.radius)) {
          const at = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
          if (sceneryContact(object, at, 1, frame) && !sceneryContact(object, at, 1, 0)) {
            probe = { at, frame };
            break;
          }
        }
      }
    }
    expect(probe, "frames differ in footprint").toBeDefined();
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
  it("keeps every drift path clear of every other rock and drift path in its chunk", () => {
    const free = options.shipRadius + options.clearance;
    // Every eligible rock drifts, so neighbouring paths compete for the same room.
    const asteroids = { field: { ...ASTEROID_FIELDS[1], driftChance: 1 }, shapes };
    let pairs = 0;
    let bothDrift = 0;
    for (let x = -24; x < 24; x++) {
      for (let y = -24; y < 24; y++) {
        const { placements } = planChunk(CHUNK_CATALOG, { ...options, asteroids, x, y });
        placements.forEach((a, index) => {
          for (const b of placements.slice(index + 1)) {
            if (!a.orbit && !b.orbit) {
              continue;
            }
            pairs++;
            bothDrift += a.orbit && b.orbit ? 1 : 0;
            const reach =
              a.radius + (a.orbit?.radius ?? 0) + b.radius + (b.orbit?.radius ?? 0) + 2 * free;
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(reach - 1e-9);
          }
        });
      }
    }
    expect(pairs).toBeGreaterThan(50);
    expect(bothDrift, "neighbouring drift paths are exercised").toBeGreaterThan(10);
  });

  it("keeps large and huge asteroids out of the chunk passages and edges", () => {
    const free = options.shipRadius + options.clearance;
    let big = 0;
    for (let x = -12; x < 12; x++) {
      for (let y = -12; y < 12; y++) {
        const plan = planChunk(CHUNK_CATALOG, { ...options, x, y });
        const origin = { x: x * options.size, y: y * options.size };
        for (const placement of plan.placements) {
          const size = placement.asteroid && ASTEROID_SHAPES.get(placement.asteroid)!.size;
          if (size !== "large" && size !== "huge") {
            continue;
          }
          big++;
          expect(placement.orbit).toBeUndefined();
          for (const along of [placement.x - origin.x, placement.y - origin.y]) {
            // Clear of the passages through the chunk center and along its edges.
            expect(Math.abs(along - options.size / 2) - placement.radius).toBeGreaterThanOrEqual(
              free,
            );
            expect(along - placement.radius).toBeGreaterThanOrEqual(free);
            expect(options.size - along - placement.radius).toBeGreaterThanOrEqual(free);
          }
        }
      }
    }
    expect(big).toBeGreaterThan(20);
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

  /** Distance from `point` to the edge of an object's footprint, a drift path included. */
  const gap = (point: Vec, object: SpaceObject) => {
    const reach = object.orbit
      ? { radius: object.radius + object.orbit.radius, x: object.orbit.x, y: object.orbit.y }
      : object;
    return Math.hypot(reach.x - point.x, reach.y - point.y) - reach.radius;
  };
  const drifter = (id: string, from: Vec, distance: number): SpaceObject => {
    const center = { x: from.x + distance, y: from.y };
    // Phase 0 puts the rock on the far side of its path, outside any safe area it reaches.
    return rock(id, {
      orbit: { ...center, phase: 0, radius: 40, rate: 0.2 },
      radius: 20,
      x: center.x + 40,
      y: center.y,
    });
  };

  it("keeps every asteroid and drift path clear of stations, destinations and the launch point", () => {
    const { flight, model } = launched();
    const sizes = new Set<string>();
    let stations = 0;
    const check = () => {
      const areas = flight.objects.filter((o) => o.kind === "station" || o.kind === "destination");
      stations = Math.max(stations, areas.filter((o) => o.kind === "station").length);
      for (const object of flight.objects) {
        if (!object.asteroid) {
          continue;
        }
        sizes.add(ASTEROID_SHAPES.get(object.asteroid)!.size);
        for (const area of areas) {
          const safe =
            area.kind === "station" ? ECONOMY.station.safeRadius : PROTOTYPE.tuning.safeRadius;
          expect(gap(area, object), `${object.id} near ${area.id}`).toBeGreaterThan(safe);
        }
      }
    };
    for (let step = 0; step < 40; step++) {
      flight.player.x += 900;
      model.step(1 / 60, idle);
      check();
    }
    // Fly past a station so its own chunks generate around it.
    const site = stationsNear(ECONOMY, 1, ECONOMY.station.cellSize, flight.player)[0]!;
    for (let step = -4; step <= 4; step++) {
      flight.player = { x: site.x + step * 300, y: site.y + 500 };
      model.step(1 / 60, idle);
      check();
    }
    expect(stations).toBeGreaterThan(0);
    expect(sizes).toContain("large");
    expect(sizes).toContain("huge");
    // Beside the launch point after its chunks paged out, regenerated layout keeps the launch
    // point's safe radius although Ada is elsewhere. Some planned layout would reach it.
    const safe = PROTOTYPE.tuning.safeRadius;
    const beside = { x: 3 * safe, y: 0 };
    const planned = [];
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        const plan = planChunk(CHUNK_CATALOG, { ...options, seed: flight.seed, x, y });
        planned.push(
          ...plan.placements.filter((placement) => {
            const reach = placement.radius + (placement.orbit?.radius ?? 0);
            return (
              Math.hypot(placement.x, placement.y) - reach <= safe &&
              Math.hypot(placement.x - beside.x, placement.y - beside.y) - reach > safe
            );
          }),
        );
      }
    }
    expect(planned.length).toBeGreaterThan(0);
    flight.player = { ...beside };
    model.step(1 / 60, idle);
    expect(flight.chunks).toContain("0,0");
    for (const object of flight.objects) {
      if (["rock", "resource"].includes(object.kind) || object.role === "discovery") {
        expect(gap({ x: 0, y: 0 }, object), object.id).toBeGreaterThan(safe);
      }
    }
    check();
  });

  it("clears a drift path that would reach a newly placed destination's safe area", () => {
    const flight = createFlight(PROTOTYPE, 1, 173, progress);
    const target = ensureDestination(PROTOTYPE, "probe", structuredClone(flight));
    const safe = PROTOTYPE.tuning.safeRadius;
    const reaching = drifter("reaching", target, safe + 20 + 10);
    const clear = drifter("clear", target, safe + 20 + 40 + 10);
    // Only the reaching rock's path, not its current position, enters the safe area.
    expect(Math.hypot(reaching.x - target.x, reaching.y - target.y)).toBeGreaterThan(safe);
    flight.objects.push(reaching, clear);
    ensureDestination(PROTOTYPE, "probe", flight);
    expect(flight.objects).not.toContain(reaching);
    expect(flight.objects).toContain(clear);
  });

  it("clears a drift path that would reach a newly placed station's safe area", () => {
    const flight = createFlight(PROTOTYPE, 1, 173, progress);
    const site = stationsNear(ECONOMY, 1, ECONOMY.station.cellSize, { x: 60000, y: 0 })[0]!;
    expect(flight.objects.some((o) => o.id === site.id)).toBe(false);
    const safe = ECONOMY.station.safeRadius;
    const reaching = drifter("reaching", site, safe + 20 + 10);
    const clear = drifter("clear", site, safe + 20 + 40 + 10);
    expect(Math.hypot(reaching.x - site.x, reaching.y - site.y)).toBeGreaterThan(safe);
    flight.objects.push(reaching, clear);
    expect(ensureStation(PROTOTYPE, site.id, flight)).not.toBeNull();
    expect(flight.objects).not.toContain(reaching);
    expect(flight.objects).toContain(clear);
  });

  it("bounces Ada off a drifting asteroid that moves into her, without damage", () => {
    const { flight, model } = launched();
    const shield = flight.shield;
    const rate = -0.3;
    const radius = 60;
    const center = { x: flight.player.x + radius, y: flight.player.y };
    // The rock starts a quarter loop above its center and sweeps through Ada's resting spot.
    const moving = rock("drifter", {
      orbit: { ...center, phase: -Math.PI / 2 - rate * flight.time, radius, rate },
      radius: 20,
      x: center.x,
      y: center.y - radius,
    });
    flight.objects.push(moving);
    flight.velocity = { x: 0, y: 0 };
    let pushed = 0;
    for (let step = 0; step < 480; step++) {
      // Only the rock and safe areas remain, so any shield loss would come from the rock.
      flight.objects = flight.objects.filter(
        (object) => object === moving || ["destination", "station"].includes(object.kind),
      );
      model.step(1 / 60, idle);
      const contact = sceneryContact(moving, flight.player, tuning.shipRadius + 1);
      if (contact) {
        pushed = Math.max(
          pushed,
          flight.velocity.x * contact.normal.x + flight.velocity.y * contact.normal.y,
        );
      }
    }
    expect(pushed).toBeGreaterThan(0);
    expect(flight.shield).toBe(shield);
    expect(flight.objects).toContain(moving);
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
