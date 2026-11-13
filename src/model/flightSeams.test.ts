import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition, heavyLoadout } from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { PHANTOM_DESTINATIONS, PHANTOM_TUNING } from "../data/phantom.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEnemy } from "./enemyAi.ts";
import {
  activeEnemyBeams,
  carryPickup,
  createFlight,
  inBattle,
  inDanger,
  pickupTouched,
  stepFlight,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { pickupOutline } from "./pickupBody.ts";
import type { FlightInput, SpaceObject, Vec } from "./types.ts";
import { worldCellKey, worldCellsNear, worldGrid } from "./worldCells.ts";
import { wrappedDelta, wrappedDistance } from "./worldGeometry.ts";

const half = GALAXY_SIDE / 2;
const idle: FlightInput = {
  aim: { x: 0, y: 0 },
  fire: false,
  move: { x: 0, y: 0 },
  turn: 0,
  use: false,
};
function fixture(player: Vec, galaxy: GalaxyNumber = 1) {
  const flight = createFlight(CONTENT, galaxy, 77, { known: [] });
  flight.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
  flight.player = { ...player };
  flight.objects = [];
  flight.shots = [];
  flight.freshChunk = null;
  const grid = worldGrid(flightWorldContext(flight), CONTENT.tuning.chunkSize);
  flight.chunks = [...worldCellsNear(grid, CONTENT.tuning.chunkSize * 2, player)].map((cell) =>
    worldCellKey(grid, cell),
  );
  return flight;
}

describe("explicit flight seam callers", () => {
  it("crosses either axis without reversing velocity or crediting a whole-world trip", () => {
    for (const axis of ["x", "y"] as const) {
      const player = { x: 0, y: 0 };
      player[axis] = half - 1;
      const flight = fixture(player);
      flight.velocity[axis] = 100;
      const move = { x: 0, y: 0 };
      move[axis] = 1;
      stepFlight(CONTENT, 0.05, { ...idle, move, throttle: 1 }, flight);
      expect(flight.player[axis]).toBeLessThan(-half + 20);
      expect(flight.velocity[axis]).toBeGreaterThan(0);
      expect(flight.freshDistance).toBeLessThan(20);
      expect(new Set(flight.chunks).size).toBe(flight.chunks.length);
    }
  });

  it("pulls a pickup along the shortest seam path and leaves one canonical object", () => {
    const flight = fixture({ x: half - 2, y: 0 });
    const pickup = { x: -half + 3, y: 0 };
    carryPickup({ tractorRadius: 20, tractorSpeed: 100 }, 0.01, flight, pickup);
    expect(pickup).toEqual({ x: -half + 2, y: 0 });
    expect(wrappedDistance(GALAXY_SIDE, pickup, flight.player)).toBe(4);
  });

  it("hits one asteroid through the seam and releases its loot only once", () => {
    const flight = fixture({ x: half - 400, y: 0 });
    const rock: SpaceObject = {
      hp: 1,
      id: "seam-rock",
      kind: "rock",
      radius: 10,
      x: -half + 4,
      y: 0,
    };
    flight.objects.push(rock);
    const shot = {
      damage: 10,
      enemy: false,
      hitIds: [],
      id: "seam-shot",
      life: 1,
      piercing: false,
      velocity: { x: 800, y: 0 },
      x: half - 15,
      y: 0,
    };
    flight.shots.push(shot, { ...shot, hitIds: [], id: "second-shot" });
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(rock.hp).toBeLessThanOrEqual(0);
    expect(flight.objects.some(({ id }) => id === rock.id)).toBe(false);
    const loot = flight.objects.filter(({ kind }) => kind === "pickup");
    const units = loot.reduce(
      (sum, item) => sum + (item.role === "cargo" ? 1 : (item.amount ?? 0)),
      0,
    );
    expect(units).toBeGreaterThanOrEqual(1);
    expect(units).toBeLessThanOrEqual(5);
    expect(loot.every(({ x, y }) => x >= -half && x < half && y >= -half && y < half)).toBe(true);
  });

  it("admits a nearby enemy across the seam using local visibility and perception", () => {
    const flight = fixture({ x: half - 100, y: 0 });
    const point = { x: -half + 100, y: 0 };
    const state = createEnemy(
      enemyCatalog.fighter,
      { archetype: "fighter", id: "seam-fighter", packId: null, phase: 0 },
      point,
    );
    const enemy: SpaceObject = {
      enemy: state,
      hp: state.hp,
      id: state.id,
      kind: "enemy",
      radius: 15,
      ...point,
    };
    flight.objects.push(enemy);
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(enemy.enemy?.engaged).toBe(true);
    expect(enemy.enemy?.position).toEqual({ x: enemy.x, y: enemy.y });
    expect(enemy.x).toBeGreaterThanOrEqual(-half);
    expect(enemy.x).toBeLessThan(half);
  });
});

describe("reviewed seam guards and drawn pickups", () => {
  it("collects the actual drawn ore outline through the seam", () => {
    const flight = fixture({ x: half - 2, y: 0 });
    const pickup: SpaceObject = {
      hp: 1,
      id: "seam-ore",
      kind: "pickup",
      radius: 7,
      role: "cargo",
      x: -half + 2,
      y: 0,
    };
    const outline = pickupOutline(pickup);
    expect(outline).not.toBeNull();
    expect(pickupTouched(CONTENT, flight, pickup, pickup.radius, outline)).toBe(true);
    flight.objects.push(pickup);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(flight.cargo).toBe(1);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(flight.cargo).toBe(1);
  });

  it("counts nearby seam enemies and shots as danger but keeps legacy distant operands distant", () => {
    const flight = fixture({ x: half - 10, y: 0 });
    const position = { x: -half + 10, y: 0 };
    const state = createEnemy(
      enemyCatalog.fighter,
      { archetype: "fighter", id: "nearby", packId: null, phase: 0 },
      position,
    );
    state.engaged = true;
    flight.objects.push({
      enemy: state,
      hp: state.hp,
      id: state.id,
      kind: "enemy",
      radius: 15,
      ...position,
    });
    expect(inBattle(CONTENT, 720, flight)).toBe(true);
    expect(inDanger(CONTENT, 720, flight)).toBe(true);
    flight.objects = [];
    flight.shots.push({
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "danger-shot",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      ...position,
    });
    expect(inDanger(CONTENT, 720, flight)).toBe(true);
    delete flight.topology;
    expect(inDanger(CONTENT, 720, flight)).toBe(false);
  });

  it("clamps a Phantom blockade through its home seam without a world-sized displacement", () => {
    const flight = fixture({ x: half - 100, y: 300 }, 6);
    const home = { x: half - 300, y: 0 };
    const point = { x: -half + 400, y: 0 };
    const state = createEnemy(
      enemyCatalog.fighter,
      { archetype: "fighter", id: "blockade", packId: null, phase: 0 },
      point,
    );
    state.home = home;
    state.engaged = true;
    const enemy: SpaceObject = {
      enemy: state,
      hp: state.hp,
      id: state.id,
      kind: "enemy",
      radius: 15,
      routeId: PHANTOM_DESTINATIONS[0],
      ...point,
    };
    flight.objects.push(enemy);
    stepFlight(CONTENT, 1 / 60, idle, flight);
    expect(wrappedDistance(GALAXY_SIDE, home, enemy)).toBeLessThanOrEqual(
      PHANTOM_TUNING.blockadeReach + 0.001,
    );
    expect(wrappedDistance(GALAXY_SIDE, point, enemy)).toBeLessThan(150);
  });

  it("tracks a charged lance along the short seam direction", () => {
    const flight = fixture({ x: half - 200, y: 0 }, 2);
    const id = Array.from({ length: 500 }, (_, index) => `lance:${index}`).find((candidate) =>
      [...heavyLoadout("frigate", ROUTE_POSITION[2], candidate)!.values()].includes("chargedLance"),
    )!;
    expect(id).toBeDefined();
    const mount = [...heavyLoadout("frigate", ROUTE_POSITION[2], id)!].find(
      ([, weapon]) => weapon === "chargedLance",
    )![0];
    const definition = enemyDefinition(2, "frigate", id);
    const point = { x: -half + 200, y: 0 };
    const state = createEnemy(
      definition,
      { archetype: "frigate", id, packId: null, phase: 0 },
      point,
    );
    for (const part of state.hardpoints) {
      part.cooldown = part.id === mount ? 0 : 999;
    }
    flight.objects.push({
      enemy: state,
      hp: state.hp,
      id,
      kind: "enemy",
      radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
      ...point,
    });
    stepFlight(CONTENT, 1 / 60, idle, flight);
    const beam = activeEnemyBeams(flight).find(({ kind }) => kind === "lance");
    expect(beam).toBeDefined();
    flight.player.y = 50;
    stepFlight(CONTENT, 0.1, idle, flight);
    const delta = wrappedDelta(GALAXY_SIDE, beam!.muzzle, flight.player);
    expect(beam!.direction.x).toBeCloseTo(delta.x / Math.hypot(delta.x, delta.y), 8);
    expect(beam!.direction.y).toBeCloseTo(delta.y / Math.hypot(delta.x, delta.y), 8);
  });
});
