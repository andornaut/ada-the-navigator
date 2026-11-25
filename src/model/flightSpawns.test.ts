import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createUnpopulatedFlight, stepFlight } from "./flight.ts";
import { escortPackId } from "./geography.ts";
import { planRegion, type SpawnSeeds } from "./spawnPlanner.ts";
import {
  chunkSpawnReach,
  chunkSpawnRegion,
  spawnGatherReach,
  spawnRules,
  worldSpawnExclusions,
  worldSpawnSites,
} from "./spawnTargets.ts";
import type { Vec } from "./types.ts";
import { periodicWorldGrid, worldCellAt, worldCellCenter, worldCellOrigin } from "./worldCells.ts";

/** A planned object as flight shows it: kind, archetype and position. */
interface Seen extends Vec {
  readonly archetype?: string;
  readonly kind: string;
  readonly radius: number;
}

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const context = { worldSide: GALAXY_SIDE };
const grid = periodicWorldGrid(context, CONTENT.tuning.chunkSize);
// Andromeda's route runs from its inner region, across the middle region's blend, to its outer
// region, and its targets include every enemy kind.
const GALAXY: GalaxyNumber = 5;
const WORLD_SEED = 4471;
const ROUTE = { from: 8000, to: 27000, y: 2600 } as const;
// Chunks this close to either end are loaded beside Ada, inside her safe radius.
const END_CHUNKS = 3;
const PLANNED = /^(pack:|rock:|rock-feature:|moving:)/;

/** A planned flight id's chunk key. */
function chunkOf(id: string): string {
  const body = id.startsWith("moving:") ? id.slice("moving:".length) : id;
  return body.split(":")[1]!;
}

/**
 * Flies Ada along the route in steps of a quarter chunk, in either direction, and records each
 * planned object the moment its chunk loads, by chunk.
 */
function fly(encounter: number, eastward: boolean): Map<string, Map<string, Seen>> {
  const flight = createUnpopulatedFlight(CONTENT, GALAXY, WORLD_SEED, undefined, encounter);
  flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
  const step = grid.pitch / 4;
  const xs: number[] = [];
  for (let x = ROUTE.from; x <= ROUTE.to; x += step) {
    xs.push(x);
  }
  const chunks = new Map<string, Map<string, Seen>>();
  for (const x of eastward ? xs : xs.reverse()) {
    flight.player = { x, y: ROUTE.y };
    flight.shield = Infinity;
    stepFlight(CONTENT, 1e-6, idle, flight);
    for (const object of flight.objects) {
      if (!PLANNED.test(object.id)) {
        continue;
      }
      const key = chunkOf(object.id);
      const seen = chunks.get(key) ?? new Map<string, Seen>();
      chunks.set(key, seen);
      if (!seen.has(object.id)) {
        seen.set(object.id, {
          kind: object.kind,
          radius: object.radius,
          x: object.x,
          y: object.y,
          ...(object.enemy ? { archetype: object.enemy.archetype } : {}),
        });
      }
    }
  }
  return chunks;
}

/** The planner's placements for one chunk, under the flight ids they take. */
function planned(seeds: SpawnSeeds, key: string): Map<string, Seen> {
  const [x, y] = key.split(",").map(Number) as [number, number];
  const cell = { x, y };
  const rules = spawnRules(GALAXY, GALAXY_SIDE);
  const centre = worldCellCenter(grid, cell);
  const reach = chunkSpawnReach(rules);
  const region = chunkSpawnRegion(
    rules,
    worldSpawnExclusions(context, GALAXY, WORLD_SEED, [{ x: 0, y: 0 }], reach, centre),
    worldSpawnSites(context, GALAXY, reach + spawnGatherReach(rules), centre),
    cell,
  );
  const result = new Map<string, Seen>();
  const placements = planRegion(rules, seeds, region).placements.filter(
    (placement) => placement.chunk === key,
  );
  const pack = `pack:${key}`;
  const leaders = placements.filter(
    (placement) => placement.category === "enemy" && placement.leader === undefined,
  );
  const escorts = placements.filter((placement) => placement.leader !== undefined);
  leaders.forEach((placement, index) =>
    result.set(`${pack}:${index}`, {
      archetype: placement.archetype!,
      kind: "enemy",
      radius: placement.radius,
      x: placement.x,
      y: placement.y,
    }),
  );
  escorts.forEach((placement, index) =>
    result.set(`${escortPackId(pack)}:${index}`, {
      archetype: placement.archetype!,
      kind: "enemy",
      radius: placement.radius,
      x: placement.x,
      y: placement.y,
    }),
  );
  for (const placement of placements) {
    if (placement.category === "rock") {
      result.set(placement.moving ? `moving:${placement.id}` : placement.id, {
        kind: placement.moving ? "debris" : "rock",
        radius: placement.radius,
        x: placement.x,
        y: placement.y,
      });
    }
  }
  return result;
}

/** Chunk keys along the route, away from its ends, in a fixed order. */
function inner(chunks: ReadonlyMap<string, unknown>): string[] {
  const first = worldCellAt(grid, { x: ROUTE.from, y: ROUTE.y }).x + END_CHUNKS;
  const last = worldCellAt(grid, { x: ROUTE.to, y: ROUTE.y }).x - END_CHUNKS;
  return [...chunks.keys()]
    .filter((key) => {
      const x = Number(key.split(",")[0]);
      return x >= first && x <= last;
    })
    .sort();
}

/** Same ids and kinds; positions within the distance one step of motion can move them. */
function expectSame(actual: ReadonlyMap<string, Seen>, expected: ReadonlyMap<string, Seen>) {
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [id, want] of expected) {
    const got = actual.get(id)!;
    expect({ archetype: got.archetype, kind: got.kind }, id).toEqual({
      archetype: want.archetype,
      kind: want.kind,
    });
    expect(Math.hypot(got.x - want.x, got.y - want.y), id).toBeLessThan(0.01);
  }
}

describe("flight spawns from the planner", () => {
  const encounter = 902;
  const east = fly(encounter, true);
  const west = fly(encounter, false);

  it("loads exactly the planner's placements in every chunk along a route", () => {
    const keys = inner(east);
    expect(keys.length).toBeGreaterThan(40);
    const kinds = new Set<string>();
    for (const key of keys) {
      const expected = planned({ encounter, world: WORLD_SEED }, key);
      expectSame(east.get(key)!, expected);
      for (const seen of expected.values()) {
        kinds.add(seen.archetype ?? seen.kind);
      }
    }
    // The route meets static and moving rocks and enemy groups.
    expect(kinds).toContain("rock");
    expect(kinds).toContain("debris");
    expect(
      [...kinds].filter((kind) => kind !== "rock" && kind !== "debris").length,
    ).toBeGreaterThan(1);
  });

  it("loads the same chunk content whichever direction Ada approaches from", () => {
    const keys = inner(east);
    expect(inner(west)).toEqual(keys);
    for (const key of keys) {
      expectSame(west.get(key)!, east.get(key)!);
    }
  });

  it("keeps every chunk's static rocks clear of every other footprint across chunk edges", () => {
    const keys = inner(east);
    const rules = spawnRules(GALAXY, GALAXY_SIDE);
    for (const key of keys) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      const origin = worldCellOrigin(grid, { x, y });
      for (const [id, rock] of east.get(key)!) {
        if (rock.kind !== "rock") {
          continue;
        }
        // Lanes keep a static rock's centre inside its chunk's quadrants.
        expect(rock.x - origin.x, id).toBeGreaterThan(rules.corridor!);
        expect(origin.x + grid.pitch - rock.x, id).toBeGreaterThan(rules.corridor!);
        expect(rock.y - origin.y, id).toBeGreaterThan(rules.corridor!);
        expect(origin.y + grid.pitch - rock.y, id).toBeGreaterThan(rules.corridor!);
      }
    }
  });

  it("keeps rocks identical across fresh entries in chunks no enemy group reaches", () => {
    const other = fly(encounter + 1, true);
    const rules = spawnRules(GALAXY, GALAXY_SIDE);
    const largest = Math.max(
      ...rules.bands.flatMap((band) =>
        band.rocks.flatMap((target) => target.shapes.map((shape) => shape.radius)),
      ),
    );
    // An enemy footprint within this distance of a chunk's square could take a rock's place.
    const reach = rules.gap + largest;
    const enemies = [...east.values(), ...other.values()].flatMap((chunk) =>
      [...chunk.values()].filter((seen) => seen.kind === "enemy"),
    );
    const rocks = (chunk: ReadonlyMap<string, Seen>) =>
      new Map([...chunk].filter(([, seen]) => seen.kind !== "enemy"));
    let compared = 0;
    let changed = 0;
    // Groups in unloaded rows two chunks off the route cannot reach the three middle rows.
    const row = worldCellAt(grid, { x: ROUTE.from, y: ROUTE.y }).y;
    for (const key of inner(east)) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      if (Math.abs(y - row) > 1) {
        continue;
      }
      const origin = worldCellOrigin(grid, { x, y });
      const reached = enemies.some((enemy) => {
        const dx = Math.max(origin.x - enemy.x, 0, enemy.x - origin.x - grid.pitch);
        const dy = Math.max(origin.y - enemy.y, 0, enemy.y - origin.y - grid.pitch);
        return Math.hypot(dx, dy) < enemy.radius + reach;
      });
      if (reached) {
        const before = [...rocks(east.get(key)!)].map(([id, seen]) => `${id}@${seen.x},${seen.y}`);
        const after = [...rocks(other.get(key)!)].map(([id, seen]) => `${id}@${seen.x},${seen.y}`);
        changed += before.sort().join() === after.sort().join() ? 0 : 1;
        continue;
      }
      compared++;
      expectSame(rocks(other.get(key)!), rocks(east.get(key)!));
    }
    expect(compared).toBeGreaterThan(10);
    // Enemy groups claim space first, so some reached chunks place their rocks elsewhere.
    expect(changed).toBeGreaterThan(0);
  });

  it("plans at most one enemy group per chunk, so a pack takes its chunk's key", () => {
    for (let galaxy = 1; galaxy <= 6; galaxy++) {
      const rules = spawnRules(galaxy as GalaxyNumber, GALAXY_SIDE);
      // Two anchors in one chunk would be closer than its diagonal.
      expect(rules.lattice!.spacing).toBeGreaterThan(Math.SQRT2 * grid.pitch);
    }
  });
});
