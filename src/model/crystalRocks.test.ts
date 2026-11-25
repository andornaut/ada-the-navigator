import { describe, expect, it } from "vitest";

import { ASTEROID_ART, type CrystalFlag } from "../data/asteroidCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { ASTEROID_SHAPES, galaxyCrystals, placedRockCrystals } from "./asteroids.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { GameModel } from "./game.ts";
import { ORE_FIELD_ROLE, oreFieldInCell } from "./oreFields.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { restoreSave } from "./save.ts";
import { planRegion, type SpawnPlacement } from "./spawnPlanner.ts";
import { chunkSpawnRegion, spawnRules } from "./spawnTargets.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, SpaceObject } from "./types.ts";

const SELECTION = ASTEROID_ART.crystals.selection;
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const sizeOf = (shape: string) => ASTEROID_SHAPES.get(shape)!.size;
const placedId = (id: string) =>
  id.startsWith(MOVING_ROCK_PREFIX) ? id.slice(MOVING_ROCK_PREFIX.length) : id;

/** Every rock the planner places in a square of chunks about the origin, moving rocks included. */
function plannedRocks(galaxy: GalaxyNumber, seed: number, span: number): SpawnPlacement[] {
  const rules = spawnRules(galaxy);
  const rocks: SpawnPlacement[] = [];
  for (let x = -span; x < span; x++) {
    for (let y = -span; y < span; y++) {
      const region = chunkSpawnRegion(rules, [], {}, { x, y });
      rocks.push(
        ...planRegion(rules, { encounter: seed, world: seed }, region).placements.filter(
          (placement) => placement.category === "rock" && placement.chunk === `${x},${y}`,
        ),
      );
    }
  }
  return rocks;
}

/** A flight's rocks after Ada visits each of `stops`, which loads their chunks. */
function visitedRocks(flight: FlightState, stops: readonly { x: number; y: number }[]) {
  const rocks = new Map<string, SpaceObject>();
  for (const stop of stops) {
    flight.player = { ...stop };
    stepFlight(CONTENT, 0.001, idle, flight);
    for (const object of flight.objects) {
      if (object.asteroid && (object.kind === "rock" || object.id.startsWith(MOVING_ROCK_PREFIX))) {
        rocks.set(object.id, object);
      }
    }
  }
  return [...rocks.values()];
}

describe("crystal rock selection", () => {
  it("reads Art's rule: medium and larger rocks outside Cartwheel, a quarter of them", () => {
    expect(SELECTION).toEqual({
      ordinary: {
        except: ["cartwheel"],
        salt: "crystals",
        share: 0.25,
        sizes: ["medium", "large", "huge"],
        value: "small",
      },
      oreField: "full",
    });
    expect(galaxyCrystals(SELECTION, 2)).toBeUndefined();
    const rule = galaxyCrystals(SELECTION, 1)!;
    expect(rule.shapes.map(sizeOf).sort()).toEqual(
      [...ASTEROID_SHAPES.values()]
        .filter((shape) => shape.size !== "small")
        .map((shape) => shape.size)
        .sort(),
    );
    // Every flag the rule sets has a variant for each shape it applies to.
    for (const shape of rule.shapes) {
      expect(ASTEROID_ART.crystals.variants[shape]?.[rule.value], shape).toBeDefined();
    }
  });

  it.each([1, 3, 4, 5, 6] as const)(
    "flags about 1 in 4 medium-or-larger planned rocks in galaxy %i and never a small one",
    (galaxy) => {
      const rocks = plannedRocks(galaxy, 4242, 12);
      const small = rocks.filter((rock) => sizeOf(rock.shape!) === "small");
      const eligible = rocks.filter((rock) => sizeOf(rock.shape!) !== "small");
      const flagged = eligible.filter((rock) => rock.crystals);
      expect(small.length).toBeGreaterThan(200);
      expect(eligible.length).toBeGreaterThan(600);
      expect(small.filter((rock) => rock.crystals)).toEqual([]);
      expect(flagged.every((rock) => rock.crystals === "small")).toBe(true);
      expect(flagged.length / eligible.length).toBeGreaterThan(0.2);
      expect(flagged.length / eligible.length).toBeLessThan(0.3);
    },
  );

  it("flags no ordinary rock in Cartwheel", () => {
    const rocks = plannedRocks(2, 4242, 12);
    expect(rocks.filter((rock) => sizeOf(rock.shape!) !== "small").length).toBeGreaterThan(600);
    expect(rocks.filter((rock) => rock.crystals)).toEqual([]);
  });

  it("gives a moving rock its placed rock's flag, from the placed rock's id", () => {
    const rule = galaxyCrystals(SELECTION, 1);
    const rocks = plannedRocks(1, 4242, 12);
    const moving = rocks.filter((rock) => rock.moving);
    expect(moving.filter((rock) => rock.crystals).length).toBeGreaterThan(0);
    for (const rock of rocks) {
      expect(rock.crystals).toBe(
        placedRockCrystals(rule, 4242, { id: rock.id, shape: rock.shape! }),
      );
    }
    // In flight a moving rock's id carries a prefix; its flag stays its placed rock's.
    const flight = createFlight(CONTENT, 1, 4242, { known: [] });
    const visited = visitedRocks(
      flight,
      Array.from({ length: 12 }, (_, index) => ({ x: index * 1500, y: index * -700 })),
    );
    const movers = visited.filter((rock) => rock.id.startsWith(MOVING_ROCK_PREFIX));
    expect(movers.filter((rock) => rock.crystals).length).toBeGreaterThan(0);
    for (const rock of visited) {
      expect(rock.crystals, rock.id).toBe(
        placedRockCrystals(rule, flight.seed, { id: placedId(rock.id), shape: rock.asteroid! }),
      );
    }
  });

  it("makes every Cartwheel ore-field rock a full crystal rock and no other Cartwheel rock", () => {
    const fields = [];
    for (let x = -6; x <= 6; x++) {
      for (let y = -6; y <= 6; y++) {
        const field = oreFieldInCell(2, { x, y });
        if (
          field &&
          Math.hypot(field.x, field.y) > 6000 &&
          stationsNear(ECONOMY, 2, ORE_FIELDS.clearance + ORE_FIELDS.diameter, field).length === 0
        ) {
          fields.push(field);
        }
      }
    }
    const flight = createFlight(CONTENT, 2, 7, { known: [] });
    const rocks = visitedRocks(
      flight,
      fields.slice(0, 4).map((field) => ({ x: field.x + 700, y: field.y })),
    );
    const ore = rocks.filter((rock) => rock.role === ORE_FIELD_ROLE);
    expect(ore.length).toBeGreaterThan(10);
    expect(ore.every((rock) => rock.crystals === "full")).toBe(true);
    const ordinary = rocks.filter((rock) => rock.role !== ORE_FIELD_ROLE);
    expect(ordinary.length).toBeGreaterThan(10);
    expect(ordinary.filter((rock) => rock.crystals)).toEqual([]);
  });
});

describe("crystal rocks across Continue", () => {
  it("keeps every rock's flag in the save and on the same seed's regenerated chunks", () => {
    const game = new GameModel(CONTENT);
    game.state.prologueSeen = true;
    game.state.progress[1].opened = true;
    game.state.progress[1].introduced = true;
    game.state.progress[1].questComplete = true;
    game.state.progress[1].resolved = true;
    game.startGalaxy(1);
    game.state.dialogue = null;
    const flight = game.state.flight!;
    visitedRocks(
      flight,
      Array.from({ length: 6 }, (_, index) => ({ x: index * 1200, y: 0 })),
    );
    const flags = (value: FlightState) =>
      new Map(
        value.objects
          .filter((object) => object.asteroid)
          .map((object): [string, CrystalFlag | undefined] => [object.id, object.crystals]),
      );
    const before = flags(flight);
    expect([...before.values()].filter(Boolean).length).toBeGreaterThan(0);
    const resumed = relaunch(CONTENT, game.save());
    expect(resumed.state.flight).not.toBeNull();
    expect(flags(resumed.state.flight!)).toEqual(before);
    // A flight of the same seed places the same rocks with the same flags.
    const again = createFlight(CONTENT, 1, flight.seed, { known: [] });
    const regenerated = flags(again);
    for (const [id, crystals] of regenerated) {
      if (before.has(id)) {
        expect(crystals, id).toBe(before.get(id));
      }
    }
  });

  it("rejects a saved rock with an unknown crystals flag", () => {
    const game = new GameModel(CONTENT);
    game.state.prologueSeen = true;
    game.state.progress[1].opened = true;
    game.startGalaxy(1);
    game.state.dialogue = null;
    const saved = JSON.parse(game.save()) as { flight: { objects: Record<string, unknown>[] } };
    const rock = saved.flight.objects.find((object) => object.asteroid)!;
    rock.crystals = "small";
    expect(restoreSave(saved)?.flight).toBeTruthy();
    rock.crystals = "huge";
    expect(restoreSave(saved)).toBeNull();
  });
});
