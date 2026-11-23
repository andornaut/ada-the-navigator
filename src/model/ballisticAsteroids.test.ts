import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { seedLaunches } from "../testing/launchSeeds.ts";
import { ASTEROID_SHAPES, asteroidSize, placementRadius } from "./asteroids.ts";
import {
  assignBallisticVelocities,
  ballisticEncounterSpacing,
  hostsEncounterCell,
  planBallisticAsteroids,
} from "./ballisticAsteroids.ts";
import {
  createFlight,
  createUnpopulatedFlight,
  ensureDestinationAt,
  populateFlight,
  stepFlight,
} from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY, flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { restoreSave } from "./save.ts";
import { type FlightState, type SpaceObject } from "./types.ts";
import { periodicWorldGrid } from "./worldCells.ts";
import { worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

const chunkSize = CONTENT.tuning.chunkSize;
const rockHp = CONTENT.tuning.flight.rockHp;
const wrapped = periodicWorldGrid({ worldSide: GALAXY_SIDE }, chunkSize);
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const isBallistic = (object: SpaceObject) => object.id.startsWith("ballistic:");

describe("ballistic asteroid requests", () => {
  it("preserves the original lattice target, separate seeded size draws and coherent groups", () => {
    const sizes = { huge: 0, large: 0, medium: 0, small: 0 };
    let eligible = 0;
    let encounters = 0;
    let grouped = 0;
    let requested = 0;
    let slowest = Infinity;
    let fastest = 0;
    let mixed = 0;
    for (const galaxy of [1, 2, 6] as const) {
      const spacing = ballisticEncounterSpacing(chunkSize, galaxy);
      for (const worldSeed of [173, 182, 9471]) {
        for (let x = -83; x < 83; x++) {
          for (let y = 19; y < 140; y++) {
            if (!hostsEncounterCell(spacing, x) || !hostsEncounterCell(spacing, y)) {
              continue;
            }
            eligible++;
            const rocks = planBallisticAsteroids({ galaxy, rockHp, worldSeed }, wrapped, {
              x,
              y,
            });
            if (!rocks.length) {
              continue;
            }
            encounters++;
            requested += rocks.length;
            assignBallisticVelocities(worldSeed, rocks);
            const first = rocks[0]!.velocity!;
            const groupSizes = new Set<string>();
            let cellGroup = 0;
            for (const rock of rocks) {
              const size = asteroidSize(rock);
              sizes[size]++;
              const { x, y } = rock.velocity!;
              const speed = Math.hypot(x, y);
              slowest = Math.min(slowest, speed);
              fastest = Math.max(fastest, speed);
              if (x === first.x && y === first.y) {
                grouped++;
                cellGroup++;
                groupSizes.add(size);
              }
            }
            expect(cellGroup).toBe(Math.ceil(rocks.length * 0.75));
            if (groupSizes.size > 1) {
              mixed++;
            }
          }
        }
      }
    }
    const rate = encounters / (eligible / 4);
    expect(rate).toBeCloseTo(3, 1);
    expect(mixed).toBeGreaterThan(encounters / 2);
    expect(slowest).toBeGreaterThanOrEqual(10);
    expect(fastest).toBeLessThanOrEqual(80);
    expect(slowest).toBeLessThan(10.1);
    expect(fastest).toBeGreaterThan(79.9);
    expect(sizes.small / requested).toBeCloseTo(0.6, 1);
    expect(sizes.medium / requested).toBeCloseTo(0.3, 1);
    expect(sizes.large / requested).toBeCloseTo(0.09, 2);
    expect(sizes.huge / requested).toBeCloseTo(0.01, 2);
    console.info(
      "BALLISTIC_REQUESTS",
      JSON.stringify({
        eligible,
        encounters,
        fastest,
        grouped,
        mixed,
        rate,
        requested,
        sizes,
        slowest,
      }),
    );
  });

  it("keeps admitted shapes and velocities when only the enemy encounter seed changes", () => {
    const first = createFlight(CONTENT, 6, 77, { known: [] }, undefined, 71);
    const next = createFlight(CONTENT, 6, 77, { known: [] }, undefined, 72);
    expect(first.seed).toBe(next.seed);
    expect(first.encounterSeed).not.toBe(next.encounterSeed);
    const movers = first.objects.filter(isBallistic);
    expect(movers.length).toBeGreaterThan(0);
    expect(next.objects.filter(isBallistic)).toEqual(movers);
  });

  it("requests the same full states through either wrapped cell alias", () => {
    const context = { galaxy: 1, rockHp, worldSeed: 173 } as const;
    const cell = { x: 0, y: 0 };
    const requested = planBallisticAsteroids(context, wrapped, cell);
    expect(requested.length).toBeGreaterThan(0);
    expect(
      planBallisticAsteroids(context, wrapped, {
        x: wrapped.periodCells!,
        y: -wrapped.periodCells!,
      }),
    ).toEqual(requested);
  });
});

function requests(flight: FlightState): SpaceObject[] {
  const grid = periodicWorldGrid(flightWorldContext(flight), chunkSize);
  return flight.chunks.flatMap((key) => {
    const [x, y] = key.split(",").map(Number);
    return planBallisticAsteroids({ galaxy: flight.galaxy, rockHp, worldSeed: flight.seed }, grid, {
      x: x!,
      y: y!,
    });
  });
}

it.each([
  [1, 173],
  [2, 174],
  [6, 173],
] as const)(
  "reports actual wrapped-world admissions in galaxy %s with world seed %s",
  (galaxy, worldSeed) => {
    const start = performance.now();
    const point = { x: 119_800, y: -119_680 };
    const flight = createFlight(CONTENT, galaxy, worldSeed, { known: [] }, undefined, 9471);
    flight.topology = CURRENT_FLIGHT_TOPOLOGY;
    flight.player = point;
    ensureDestinationAt(CONTENT, "ballistic-fixture", point, flight);
    worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
    const planned = requests(flight);
    const admitted = flight.objects.filter(isBallistic);
    expect(planned.length).toBeGreaterThan(0);
    expect(admitted.length).toBeGreaterThan(0);
    expect(admitted.length).toBeLessThan(planned.length);
    expect(new Set(admitted.map(({ id }) => id)).size).toBe(admitted.length);
    const byId = new Map(planned.map((object) => [object.id, object]));
    const world = flightWorldContext(flight);
    for (const object of admitted) {
      const source = byId.get(object.id)!;
      expect(source).toBeDefined();
      expect(object.asteroid).toEqual(source.asteroid);
      expect(object.velocity).toBeDefined();
      expect(worldDistance(world, object, flight.player)).toBeGreaterThan(
        CONTENT.tuning.safeRadius + placementRadius(object),
      );
    }
    const summary = (objects: SpaceObject[]) =>
      Object.fromEntries(
        (["small", "medium", "large", "huge"] as const).map((size) => [
          size,
          objects.filter((rock) => asteroidSize(rock) === size).length,
        ]),
      );
    console.info(
      "BALLISTIC_ADMISSIONS",
      JSON.stringify({
        admitted: summary(admitted),
        galaxy,
        milliseconds: performance.now() - start,
        requested: summary(planned),
      }),
    );
  },
);

it("restores a live mover and continues straight across a seam without changing its recorded identity", () => {
  seedLaunches(173);
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  const point = { x: 119_875, y: 31_800 };
  flight.player = point;
  stepFlight(CONTENT, 0.001, idle, flight);
  expect(restoreSave(model.save())).not.toBeNull();
  const original = flight.objects.find(isBallistic)!;
  expect(original.asteroid).toBeDefined();
  // Keep a real admitted shape and velocity while arranging a deterministic seam crossing.
  const vx = original.velocity!.x;
  const side = Math.sign(vx);
  original.x = side * (GALAXY_SIDE / 2 - Math.abs(vx) * 0.01);
  original.y = point.y + 375;
  const saved = restoreSave(model.save());
  expect(saved).not.toBeNull();
  expect(saved!.flight!.objects.find(({ id }) => id === original.id)).toEqual(original);
  const resumed = relaunch(CONTENT, model.save()).state.flight!;
  expect(resumed.objects.find(({ id }) => id === original.id)).toEqual(original);
  const start = { x: original.x, y: original.y };
  stepFlight(CONTENT, 0.02, idle, resumed);
  const advanced = resumed.objects.find(({ id }) => id === original.id)!;
  expect(advanced.velocity).toEqual(original.velocity);
  expect(Math.sign(advanced.x)).toBe(-side);
  expect(worldDistance(flightWorldContext(resumed), start, advanced)).toBeCloseTo(
    Math.hypot(original.velocity!.x, original.velocity!.y) * 0.02,
    6,
  );
});

it.each([
  ["flight start", { x: 0, y: 0 }],
  ["Travel arrival across the X seam", { x: GALAXY_SIDE / 2 - 10, y: 31_800 }],
] as const)("absorbs only the mover entering the %s safety disk", (label, center) => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  flight.player = wrapPoint(GALAXY_SIDE, { x: center.x, y: center.y + chunkSize });
  if (label !== "flight start") {
    flight.arrivals = [center];
  }
  populateFlight(CONTENT, { known: [] }, flight);
  const shape = ASTEROID_SHAPES.get("asteroid-m1")!;
  const mover = {
    asteroid: shape.id,
    hp: rockHp,
    kind: "debris",
    radius: shape.radius,
    velocity: { x: -60, y: 0 },
  } as const;
  const exclusion = CONTENT.tuning.safeRadius + placementRadius(mover);
  const entering = {
    ...mover,
    ...wrapPoint(GALAXY_SIDE, { x: center.x + exclusion + 0.5, y: center.y }),
    id: "ballistic:entering",
  };
  const passing = {
    ...mover,
    ...wrapPoint(GALAXY_SIDE, { x: center.x + 0.5, y: center.y + exclusion + 1 }),
    id: "ballistic:passing",
  };
  flight.objects = [entering, passing];
  const world = flightWorldContext(flight);
  expect(worldDistance(world, center, entering)).toBeGreaterThan(exclusion);
  const start = { x: passing.x, y: passing.y };
  const dt = 1 / 60;
  const events = stepFlight(CONTENT, dt, idle, flight);
  expect(flight.objects).not.toContain(entering);
  expect(flight.objects).toContain(passing);
  expect(passing.hp).toBe(rockHp);
  expect(passing.velocity).toEqual({ x: -60, y: 0 });
  expect(worldDistance(world, start, passing)).toBeCloseTo(1, 8);
  expect(flight.lastBump).toBeUndefined();
  expect(events).toEqual([]);
});
