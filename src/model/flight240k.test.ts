import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { createUnpopulatedFlight, stepFlight } from "./flight.ts";
import { ACTIVE_CHUNK_RADIUS } from "./geography.ts";
import { worldOreFieldInCell, worldOreFieldsNear } from "./oreFields.ts";
import { retaliatorAsteroidQuery } from "./retaliatorAsteroids.ts";
import { worldStationsNear } from "./stations.ts";
import type { SpaceObject, Vec } from "./types.ts";
import {
  flightWorldContext,
  periodicWorldGrid,
  worldCellAt,
  worldCellKey,
  worldCellsNear,
} from "./world/index.ts";

vi.mock("../data/world.ts", () => ({ GALAXY_SIDE: 240_000 }));

const half = GALAXY_SIDE / 2;
const context = { worldSide: GALAXY_SIDE };
const nominal = CONTENT.tuning.chunkSize;
const grid = periodicWorldGrid(context, nominal);
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function openFlight(player: Vec, generated = false, galaxy: GalaxyNumber = 1) {
  const flight = createUnpopulatedFlight(CONTENT, galaxy, 173);
  flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
  flight.chunks = generated
    ? [...worldCellsNear(grid, 2 * grid.pitch, player)].map((cell) => worldCellKey(grid, cell))
    : [];
  flight.player = { ...player };
  flight.freshChunk = worldCellKey(grid, worldCellAt(grid, player));
  return flight;
}

describe("240,000-unit periodic flight ownership", () => {
  it("divides the 240,000-unit world into whole chunks", () => {
    expect(nominal).toBe(512);
    expect(grid.periodCells).toBe(468);
    expect(grid.pitch * grid.periodCells!).toBe(GALAXY_SIDE);
  });

  it("generates the same cells and IDs from both corner images, then crosses without a world-sized trip", () => {
    const point = { x: half - 1, y: half - 1 };
    const flight = openFlight(point);
    const image = openFlight({
      x: point.x - GALAXY_SIDE,
      y: point.y - GALAXY_SIDE,
    });
    stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
    stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, image);
    const keys = [...worldCellsNear(grid, 2 * grid.pitch, point)].map((cell) =>
      worldCellKey(grid, cell),
    );
    expect(flight.chunks).toEqual(keys);
    expect(image.chunks).toEqual(keys);
    const ambient = (objects: SpaceObject[]) =>
      objects.filter(({ id }) => /^rock(-feature)?:/.test(id));
    expect(ambient(flight.objects).length).toBeGreaterThan(0);
    expect(ambient(image.objects)).toEqual(ambient(flight.objects));
    for (const object of ambient(flight.objects)) {
      const [, owner] = object.id.split(":");
      expect(worldCellKey(grid, worldCellAt(grid, object))).toBe(owner);
    }
    flight.velocity = { x: 100, y: 100 };
    stepFlight(CONTENT, 3 * SIMULATION_STEP_SECONDS, { ...idle, move: { x: 1, y: 1 } }, flight);
    expect(flight.player.x).toBeLessThan(-half + 20);
    expect(flight.player.y).toBeLessThan(-half + 20);
    expect(flight.freshDistance).toBeLessThan(20);
    expect(new Set(flight.chunks).size).toBe(flight.chunks.length);
    expect(flight.chunks.length).toBeLessThanOrEqual((2 * ACTIVE_CHUNK_RADIUS + 1) ** 2);
  });

  it.each(["x", "y"] as const)(
    "reactivates and hits a reloaded rock through the %s seam once",
    (axis) => {
      const player = { x: 6000, y: 6000 };
      player[axis] = half - 400;
      const flight = openFlight(player, true);
      const position = { ...player, [axis]: -half + 4 };
      const rock: SpaceObject = {
        ...position,
        asteroid: ASTEROID_SHAPES.values().next().value!.id,
        hp: 1,
        id: "retained-seam-rock",
        kind: "rock",
        persistent: true,
        radius: 10,
      };
      flight.world.notables[rock.id] = rock;
      const query = retaliatorAsteroidQuery(flightWorldContext(flight), nominal, [rock]);
      const home = { ...player, [axis]: half - 8 };
      expect(query(15, home).map(({ id }) => id)).toEqual([rock.id]);
      expect(query(15, { ...home, [axis]: home[axis] - GALAXY_SIDE }).map(({ id }) => id)).toEqual([
        rock.id,
      ]);
      const velocity = { x: 0, y: 0 };
      velocity[axis] = 1800;
      flight.shots.push({
        ...player,
        [axis]: half - 15,
        damage: 10,
        enemy: false,
        hitIds: [],
        id: "seam-shot",
        life: 1,
        piercing: false,
        velocity,
      });
      stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
      expect(rock.hp).toBeLessThanOrEqual(0);
      expect(flight.world.notables[rock.id]).toBeNull();
      expect(flight.objects.some(({ id }) => id === rock.id)).toBe(false);
      stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
      expect(flight.world.notables[rock.id]).toBeNull();
    },
  );

  it("materializes every rock of an ore field from the owning flight chunk through either chart image", () => {
    const reach = ORE_FIELDS.clearance + ORE_FIELDS.diameter / 2;
    const field = Array.from({ length: 53 }, (_, index) =>
      worldOreFieldInCell(context, 2, { x: 26, y: index - 26 }),
    ).find(
      (site) =>
        site &&
        worldCellAt(grid, site).x !== Math.floor(site.x / nominal) &&
        worldStationsNear(context, ECONOMY, 2, reach, site).length === 0,
    );
    if (!field) {
      throw new Error("No clear ore field whose nominal and actual chunk owners differ");
    }
    const player = { x: field.x + 900, y: field.y };
    const owner = worldCellKey(grid, worldCellAt(grid, field));
    const ids = field.rocks.map((_, index) => `${field.id}:${index}`);
    const spawn = (point: Vec) => {
      const flight = openFlight(point, false, 2);
      stepFlight(CONTENT, SIMULATION_STEP_SECONDS, idle, flight);
      expect(flight.chunks).toContain(owner);
      const placed = flight.objects.filter(({ id }) => ids.includes(id));
      expect(placed.map(({ id }) => id).sort()).toEqual([...ids].sort());
      return placed;
    };
    expect(spawn({ x: player.x - GALAXY_SIDE, y: player.y })).toEqual(spawn(player));
  });

  it("uses one canonical ore-field identity and guards cannot share the odd-grid seam", () => {
    const oreGrid = periodicWorldGrid(context, ORE_FIELDS.cellSize);
    expect(oreGrid.periodCells).toBe(53);
    let fields = 0;
    for (const x of [-26, 26]) {
      for (let y = -26; y <= 26; y++) {
        const field = worldOreFieldInCell(context, 2, { x, y });
        expect(worldOreFieldInCell(context, 2, { x: x + 53, y: y - 53 })).toEqual(field);
        if (!field) {
          continue;
        }
        fields++;
        expect(
          worldOreFieldsNear(context, 2, 2, {
            x: field.x + GALAXY_SIDE,
            y: field.y,
          }),
        ).toEqual([field]);
        expect(field.rocks.length).toBeGreaterThanOrEqual(6);
        expect(field.rocks.length).toBeLessThanOrEqual(10);
        if (x === 26 || y === 26) {
          expect(field.guard).toBeNull();
        }
      }
    }
    expect(fields).toBeGreaterThan(0);
  });
});
