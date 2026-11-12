import { describe, expect, it } from "vitest";

import {
  ASTEROID_ART,
  ASTEROID_SIZES,
  type AsteroidArt,
  RESOURCE_ART,
} from "../data/asteroid-catalog.ts";
import { ASTEROID_FIELDS, CHUNK_CATALOG } from "../data/chunk-catalog.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { playOpening, relaunch, seedLaunches } from "../testing/launch.ts";
import {
  ASTEROID_SHAPES,
  bounce,
  orbitMotion,
  placementRadius,
  reflectDirection,
  rockFrame,
  sceneryBlocksSegment,
  sceneryBodyContact,
  sceneryContact,
  scenerySilhouette,
  silhouette,
} from "./asteroids.ts";
import { type ChunkPlanOptions, planChunk } from "./chunk-templates.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, ensureDestination, ensureStation, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { SHIP_HEADINGS } from "./nose.ts";
import { restoreSave } from "./save.ts";
import { shipBody } from "./ship-body.ts";
import { stationsNear } from "./stations.ts";
import type { SectorProgress, SpaceObject, Vec } from "./types.ts";

const progress: SectorProgress = {
  charted: [],
  deposited: 0,
  disabledEnemies: 0,
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

const shapes = [...ASTEROID_SHAPES.values()];
const tuning = PROTOTYPE.tuning.flight;
const options: ChunkPlanOptions = {
  asteroids: { field: ASTEROID_FIELDS[1]!, shapes },
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
// A screen offset from a rock's pivot as the world offset that projects to it.
const world = (screen: Vec): Vec => ({ x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 });
const idleInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
// Every Art rock as the flight object that draws it: plain rocks as rocks, resource rocks on the
// plain shape they collide on.
const drawnRocks: { art: AsteroidArt; object: SpaceObject }[] = [
  ...ASTEROID_ART.asteroids.map((art) => ({
    art,
    object: rock(art.id, { asteroid: art.id, radius: art.footprintRadius }),
  })),
  ...RESOURCE_ART!.rocks.map((art) => {
    const plain = art.id.replace(/^resource-/, "asteroid-");
    return {
      art,
      object: rock(art.id, {
        asteroid: plain,
        kind: "resource",
        radius: ASTEROID_SHAPES.get(plain)!.radius,
      }),
    };
  }),
];

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
    // A medium rock whose frames differ: a point drawn in one frame and not in frame 0.
    const medium = shapes.find((shape) => shape.id === "asteroid-m4")!;
    const object = rock("spinner", { asteroid: medium.id, radius: medium.radius });
    const reach = medium.silhouette.reach;
    let probe: { frame: number; at: Vec } | undefined;
    for (let frame = 1; frame < medium.frames.length && !probe; frame++) {
      for (let angle = 0; angle < Math.PI * 2 && !probe; angle += Math.PI / 32) {
        for (const share of [0.6, 0.75, 0.9]) {
          const at = world({
            x: Math.cos(angle) * reach * share,
            y: Math.sin(angle) * reach * share,
          });
          if (sceneryContact(object, at, 1, frame) && !sceneryContact(object, at, 1, 0)) {
            probe = { at, frame };
            break;
          }
        }
      }
    }
    expect(probe, "frames differ in silhouette").toBeDefined();
  });
});

describe("rock silhouettes", () => {
  it("sit inside each rock's drawn sprite box, a resource rock on its own drawing", () => {
    for (const { art, object } of drawnRocks) {
      const left = -art.pivot.x * art.display.width;
      const top = -art.pivot.y * art.display.height;
      const drawn = scenerySilhouette(object)!;
      expect(drawn, art.id).toEqual(silhouette(art));
      // The silhouette radius is the farthest drawn vertex from the pivot over every frame.
      const farthest = art.frames.flatMap((frame) =>
        frame.collision
          .flat()
          .map((at) =>
            Math.hypot(
              (at.x - art.pivot.x * art.frame.width) * (art.display.width / art.frame.width),
              (at.y - art.pivot.y * art.frame.height) * (art.display.height / art.frame.height),
            ),
          ),
      );
      expect(drawn.reach, art.id).toBeCloseTo(Math.max(...farthest), 9);
      expect(drawn.frames.flat(2).every((at) => Math.hypot(at.x, at.y) <= drawn.reach)).toBe(true);
      for (const at of drawn.frames.flat(2)) {
        expect(at.x, art.id).toBeGreaterThanOrEqual(left - 1e-6);
        expect(at.x, art.id).toBeLessThanOrEqual(left + art.display.width + 1e-6);
        expect(at.y, art.id).toBeGreaterThanOrEqual(top - 1e-6);
        expect(at.y, art.id).toBeLessThanOrEqual(top + art.display.height + 1e-6);
      }
    }
  });

  it("meet a body at every rock's drawn top, bottom and sides in every frame, not past them", () => {
    // A body of radius 3 screen px touches 2 px beyond the outermost drawn point and misses 3.5 px
    // beyond it, where every drawn point lies on the far side of that line.
    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];
    let checked = 0;
    for (const { art, object } of drawnRocks) {
      const drawn = scenerySilhouette(object)!;
      drawn.frames.forEach((parts, frame) => {
        const points = parts.flat();
        for (const direction of directions) {
          const extreme = points.reduce((best, at) =>
            at.x * direction.x + at.y * direction.y > best.x * direction.x + best.y * direction.y
              ? at
              : best,
          );
          const beyond = (gap: number) =>
            world({ x: extreme.x + direction.x * gap, y: extreme.y + direction.y * gap });
          expect(sceneryContact(object, beyond(2), 3, frame), `${art.id} ${frame}`).not.toBeNull();
          expect(sceneryContact(object, beyond(3.5), 3, frame), `${art.id} ${frame}`).toBeNull();
          checked++;
        }
      });
    }
    expect(checked).toBe(
      4 *
        [...ASTEROID_ART.asteroids, ...RESOURCE_ART!.rocks].reduce(
          (n, a) => n + a.frames.length,
          0,
        ),
    );
  });

  it("draw a resource rock's crystals above its plain shape, and hit them", () => {
    const highest = (object: SpaceObject, frame: number) =>
      scenerySilhouette(object)!
        .frames[frame]!.flat()
        .reduce((best, at) => (at.y < best.y ? at : best));
    // The resource rock and frame whose crest stands highest above its plain rock's top.
    let tallest: { frame: number; gap: number; plain: SpaceObject; resource: SpaceObject } | null =
      null;
    for (const { object } of drawnRocks.filter((entry) => entry.object.kind === "resource")) {
      const plain = rock("plain", { asteroid: object.asteroid!, radius: object.radius });
      for (let frame = 0; frame < scenerySilhouette(object)!.frames.length; frame++) {
        const gap = highest(plain, frame).y - highest(object, frame).y;
        if (!tallest || gap > tallest.gap) {
          tallest = { frame, gap, plain, resource: object };
        }
      }
    }
    const { frame, gap, plain, resource } = tallest!;
    expect(gap).toBeGreaterThan(6);
    // Just under the crystals' crest and above the plain rock's top.
    const crest = highest(resource, frame);
    const at = world({ x: crest.x, y: crest.y + 2 });
    expect(sceneryContact(resource, at, 1, frame)).not.toBeNull();
    expect(sceneryContact(plain, at, 1, frame)).toBeNull();
  });

  it("strike a real shot through the drawn top of a rock, not one just above it", () => {
    const speed = PROTOTYPE.tuning.maxSpeed * PROTOTYPE.tuning.flight.projectileSpeedFactor;
    const art = ASTEROID_ART.asteroids.find((entry) => entry.id === "asteroid-l1")!;
    const object = drawnRocks.find((entry) => entry.art === art)!.object;
    const top = Math.min(
      ...scenerySilhouette(object)!
        .frames[0]!.flat()
        .map((at) => at.y),
    );
    // The top lies on a vertex: 2 px into the rock below it hits, 4 px above it misses.
    const fire = (screenY: number) => {
      const flight = createFlight(PROTOTYPE, 1, 7, { known: [] });
      flight.objects = [{ ...object, hp: 999, persistent: true }];
      flight.player = world({ x: 0, y: 260 });
      const direction = world({ x: 1, y: 0 });
      const span = Math.hypot(direction.x, direction.y);
      flight.shots = [
        {
          damage: 1,
          enemy: false,
          hitIds: [],
          id: "shot",
          life: 2,
          piercing: false,
          projectile: "bolt",
          velocity: { x: (direction.x / span) * speed, y: (direction.y / span) * speed },
          ...world({ x: -260, y: screenY }),
        },
      ];
      for (let step = 0; step < 60 && flight.shots.length; step++) {
        stepFlight(PROTOTYPE, 1 / 60, { ...idleInput, reducedMotion: true }, flight);
        flight.objects = flight.objects.filter((entry) => entry.id === object.id);
      }
      return flight.objects[0]!.hp < 999;
    };
    expect(fire(top + 2)).toBe(true);
    expect(fire(top - 4)).toBe(false);
  });

  it("never draw Ada's ship overlapping a rock after contact, at any frame, heading or approach", () => {
    const flight = createFlight(PROTOTYPE, 1, 7, { known: [] });
    let approaches = 0;
    let touched = 0;
    for (const { art, object } of drawnRocks) {
      const drawn = scenerySilhouette(object)!;
      // Every heading against frame 0, and every later spin frame at a heading that walks round.
      const cases: [number, number][] = [];
      for (let heading = 0; heading < SHIP_HEADINGS; heading++) {
        cases.push([0, heading]);
      }
      for (let frame = 1; frame < drawn.frames.length; frame++) {
        cases.push([frame, (frame * 5) % SHIP_HEADINGS]);
      }
      for (const [frame, heading] of cases) {
        const facing = {
          x: Math.cos((heading * Math.PI * 2) / SHIP_HEADINGS),
          y: Math.sin((heading * Math.PI * 2) / SHIP_HEADINGS),
        };
        // Four approaches, turned by the heading and frame so the cases cover every angle.
        for (let turn = 0; turn < 4; turn++) {
          const angle =
            ((turn + ((heading + frame * 7) % SHIP_HEADINGS) / SHIP_HEADINGS) / 4) * Math.PI * 2;
          const held = { ...object, hp: 999, persistent: true, spinStart: frame };
          // Start 26 px out from where the drawn rock ends along this screen direction, beyond
          // the ship's 21 px half-width, and fly at its pivot.
          const along = (t: number) => world({ x: Math.cos(angle) * t, y: Math.sin(angle) * t });
          let edge = drawn.reach;
          while (edge > 0 && !sceneryContact(held, along(edge), 0.5, frame)) {
            edge -= 1;
          }
          const start = along(edge + 26);
          const span = Math.hypot(start.x, start.y);
          const move = { x: -start.x / span, y: -start.y / span };
          flight.objects = [held];
          flight.shots = [];
          flight.player = { ...start };
          flight.facing = facing;
          flight.velocity = {
            x: move.x * PROTOTYPE.tuning.maxSpeed,
            y: move.y * PROTOTYPE.tuning.maxSpeed,
          };
          let reached = false;
          for (let step = 0; step < 16; step++) {
            // Aiming holds the heading while she flies in.
            stepFlight(
              PROTOTYPE,
              1 / 60,
              { ...idleInput, aim: facing, move, reducedMotion: true },
              flight,
            );
            flight.objects = flight.objects.filter((entry) => entry.id === object.id);
            flight.shots = [];
            const overlap = sceneryBodyContact(held, flight.player, shipBody(flight.facing), frame);
            // To the push-out's 0.01 margin.
            expect(
              overlap?.depth ?? 0,
              `${art.id} frame ${frame} heading ${heading} angle ${turn}`,
            ).toBeLessThan(0.02);
            reached ||=
              sceneryBodyContact(held, flight.player, shipBody(flight.facing), frame, 2) !== null;
          }
          approaches++;
          touched += reached ? 1 : 0;
        }
      }
    }
    expect(approaches).toBeGreaterThan(4 * SHIP_HEADINGS * drawnRocks.length);
    // Nearly every approach reaches the rock, so the check above is not vacuous.
    expect(touched / approaches).toBeGreaterThan(0.9);
    // About 4.5 s in the check container and up to twice that on CI runners: over 6x locally.
  }, 40_000);
});

describe("scenery contact and bounce", () => {
  it("measures circle overlap with a circle and with the drawn silhouette of a huge asteroid", () => {
    const contact = sceneryContact(rock("circle"), { x: 45, y: 0 }, 10)!;
    expect(contact.depth).toBeCloseTo(5);
    expect(contact.normal).toEqual({ x: 1, y: 0 });
    const object = rock("huge", { asteroid: huge.id, radius: huge.radius });
    const reach = huge.silhouette.reach;
    // Inside the silhouette's bounding circle but outside the outline, a probe must not collide.
    const gaps = Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2;
      return world({ x: Math.cos(angle) * (reach - 1), y: Math.sin(angle) * (reach - 1) });
    });
    expect(gaps.some((at) => !sceneryContact(object, at, 1))).toBe(true);
    // A body at the centre of the drawn rock is pushed out along a world unit normal, by a depth
    // that clears the drawing once moved.
    const part = huge.silhouette.frames[0]![0]!;
    const centre = world({
      x: part.reduce((sum, at) => sum + at.x, 0) / part.length,
      y: part.reduce((sum, at) => sum + at.y, 0) / part.length,
    });
    const inner = sceneryContact(object, centre, 10)!;
    expect(inner.depth).toBeGreaterThan(10);
    expect(Math.hypot(inner.normal.x, inner.normal.y)).toBeCloseTo(1);
    const out = {
      x: centre.x + inner.normal.x * (inner.depth + 0.01),
      y: centre.y + inner.normal.y * (inner.depth + 0.01),
    };
    expect(sceneryContact(object, out, 10)).toBeNull();
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

  it("blocks sight lines through the drawn rock, not just above its drawn top", () => {
    const object = rock("huge", { asteroid: huge.id, radius: huge.radius });
    const top = Math.min(...huge.silhouette.frames[0]!.flat().map((at) => at.y));
    const line = (y: number) =>
      sceneryBlocksSegment(object, world({ x: -400, y }), world({ x: 400, y }), 0);
    expect(line(top + 2)).toBe(true);
    expect(line(top - 2)).toBe(false);
    // Within the inflation of the top, a segment counts as blocked.
    expect(
      sceneryBlocksSegment(
        object,
        world({ x: -400, y: top - 2 }),
        world({ x: 400, y: top - 2 }),
        3,
      ),
    ).toBe(true);
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
    const asteroids = { field: { ...ASTEROID_FIELDS[1]!, driftChance: 1 }, shapes };
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

describe("rock start frames", () => {
  it("begin a spinning rock on its start frame and hold it under reduced motion", () => {
    const medium = [...ASTEROID_SHAPES.values()].find((shape) => shape.size === "medium")!;
    for (const start of [0, 5, 23]) {
      expect(rockFrame(medium, 9, false, "ore:1,2:0", 0, start)).toBe(start);
      expect(rockFrame(medium, 9, true, "ore:1,2:0", 40, start)).toBe(start);
    }
    expect(rockFrame(medium, 9, true, "ore:1,2:0", 40)).toBe(0);
    const later = new Set(
      Array.from({ length: 60 }, (_, i) => rockFrame(medium, 9, false, "ore:1,2:0", i * 4, 5)),
    );
    expect(later.size).toBeGreaterThan(1);
  });
});

describe("asteroids in flight", () => {
  // The explored chunks, and so the huge and drifting asteroids these tests rely on, come from
  // this launch seed.
  const LAUNCH_SEED = 173;
  function launched() {
    seedLaunches(LAUNCH_SEED);
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
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
        if (object.asteroid && object.kind === "rock") {
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
    expect(sized?.hp).toBe(ASTEROID_FIELDS[1]!.hp.large);
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
        const body = shipBody(flight.facing);
        expect(sceneryBodyContact(wall, flight.player, body)).toBeNull();
        // Within 4 px of the drawn rock: a bounce moves her up to about 1.5 px away in its step.
        const contact = sceneryBodyContact(wall, flight.player, body, 0, 4);
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
      expect(sceneryBodyContact(wall, flight.player, shipBody(flight.facing), 0, 2)).toBeNull();
      expect(flight.shield).toBe(shield);
    }
  });

  it("never ends a step with Ada's drawn ship inside a large rock, from any angle or speed", () => {
    const large = shapes.find((shape) => shape.size === "large")!;
    const { flight, model } = launched();
    const shield = flight.shield;
    const start = { ...flight.player };
    const overlaps: string[] = [];
    for (let degrees = 0; degrees < 360; degrees += 15) {
      for (const deflection of [0.35, 0.7, 1]) {
        const angle = (degrees * Math.PI) / 180;
        const toward = { x: Math.cos(angle), y: Math.sin(angle) };
        const wall = rock(`sweep:${degrees}:${deflection}`, {
          asteroid: large.id,
          radius: large.radius,
          x: start.x + toward.x * (large.radius + 60),
          y: start.y + toward.y * (large.radius + 60),
        });
        flight.player = { ...start };
        flight.velocity = { x: 0, y: 0 };
        flight.facing = { ...toward };
        const move = { x: toward.x * deflection, y: toward.y * deflection };
        for (let step = 0; step < 150; step++) {
          flight.objects = [
            wall,
            ...flight.objects.filter((object) => ["destination", "station"].includes(object.kind)),
          ];
          model.step(1 / 60, { ...idle, move: step < 100 ? move : { x: 0, y: 0 } });
          if (sceneryBodyContact(wall, flight.player, shipBody(flight.facing))) {
            overlaps.push(`${degrees} deg at ${deflection} on step ${step}`);
            break;
          }
        }
      }
    }
    expect(overlaps).toEqual([]);
    expect(flight.shield).toBe(shield);
  });

  it("returns the restitution share of a head-on approach as recoil", () => {
    const { flight, model } = launched();
    flight.facing = { x: 1, y: 0 };
    const wall = rock("wall", { x: flight.player.x, y: flight.player.y });
    // One unit past where the circle first meets Ada's drawn ship, to 0.001.
    let low = 0;
    let high = 200;
    while (high - low > 1e-3) {
      const middle = (low + high) / 2;
      wall.x = flight.player.x + middle;
      if (sceneryBodyContact(wall, flight.player, shipBody(flight.facing))) {
        low = middle;
      } else {
        high = middle;
      }
    }
    wall.x = flight.player.x + high + 1;
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
    const resumed = relaunch(PROTOTYPE, model.save());
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

  /**
   * Distance from `point` to the edge of an object's reach for clearances: a drawn rock's
   * silhouette radius, else its radius, a drift path included.
   */
  const gap = (point: Vec, object: SpaceObject) => {
    const radius = placementRadius(object);
    const reach = object.orbit
      ? { radius: radius + object.orbit.radius, x: object.orbit.x, y: object.orbit.y }
      : { radius, x: object.x, y: object.y };
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
            const reach = placementRadius(placement) + (placement.orbit?.radius ?? 0);
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

  it("clears a huge rock whose drawn silhouette, not its footprint, reaches a new station's safe area", () => {
    const flight = createFlight(PROTOTYPE, 1, 173, progress);
    const site = stationsNear(ECONOMY, 1, ECONOMY.station.cellSize, { x: 60000, y: 0 })[0]!;
    const safe = ECONOMY.station.safeRadius;
    const shape = ASTEROID_SHAPES.get("asteroid-h2")!;
    const silhouette = placementRadius({ asteroid: shape.id, kind: "rock", radius: shape.radius });
    // The silhouette radius on the world plane reaches far past the footprint.
    expect(silhouette).toBeGreaterThan(shape.radius + 40);
    const at = (id: string, distance: number) =>
      rock(id, { asteroid: shape.id, radius: shape.radius, x: site.x + distance, y: site.y });
    const reaching = at("reaching", safe + shape.radius + 10);
    const clear = at("clear", safe + silhouette + 10);
    flight.objects.push(reaching, clear);
    expect(ensureStation(PROTOTYPE, site.id, flight)).not.toBeNull();
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
