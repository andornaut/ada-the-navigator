import { beforeAll, describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheel.fixture.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { placementRadius } from "./asteroids.ts";
import {
  CARTWHEEL_MINING_PATROL,
  type CartwheelMiningPatrolContext,
  type CartwheelMiningRockPath,
  cartwheelPatrolAdmits,
  planCartwheelMiningPatrol,
} from "./cartwheel/patrol/index.ts";
import { closestOnSegment } from "./convex.ts";
import {
  createUnpopulatedFlight,
  planRequiredCartwheelRoute,
  populateFlight,
  stepFlight,
} from "./flight/index.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { worldOreFieldInCell } from "./oreFields.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import type { FlightInput, Vec } from "./types.ts";
import { shipTuning } from "./upgrades.ts";
import {
  CURRENT_FLIGHT_TOPOLOGY,
  flightWorldContext,
  worldDistance,
  worldPoint,
  wrapPoint,
} from "./world/index.ts";

const field = { guard: null, id: "field", x: 0, y: 0 } as const;
// Use the ordinary leash and a projected firing envelope supplied by the integration port.
const fighter = {
  pursuitRadius: enemyCatalog.fighter.pursuit.homeRadius,
  radius: 13,
  weaponReach: 450,
};
const moving = (id: string, x: number): CartwheelMiningRockPath => ({
  end: { x, y: 100 },
  id,
  radius: 20,
  start: { x, y: -100 },
});
const context = (rocks = [moving("a", 850), moving("b", 1050)]): CartwheelMiningPatrolContext => ({
  admits: () => true,
  allocation: {
    anchor: { x: 700, y: 0 },
    fighters: [fighter, fighter, fighter, fighter],
    id: "pack",
  },
  fieldIsClear: () => true,
  fields: [field],
  hubKnown: true,
  rocksNear: () => rocks,
});

function plan(input: CartwheelMiningPatrolContext = context()) {
  const result = planCartwheelMiningPatrol(input);
  expect(result.status).toBe("planned");
  if (result.status !== "planned") {
    throw new Error("Expected a mining patrol placement");
  }
  return result.plan;
}

const length = ([x, y]: readonly [Vec, Vec]) => Math.hypot(y.x - x.x, y.y - x.y);

describe("Cartwheel mining patrol placement", () => {
  it("keeps one allocation intact, staggers homes and places the full-width bypass beyond pursuit and fire", () => {
    const placement = plan();
    const [entry, exit] = placement.bypass;
    const halfWidth = CARTWHEEL_MINING_PATROL.bypassWidth / 2;
    expect(placement.allocationId).toBe("pack");
    expect(placement.coverIds).toEqual(["a", "b"]);
    expect(placement.homes).toHaveLength(4);
    expect(placement.homes[0]?.x).not.toBe(placement.homes[1]?.x);
    for (const [index, home] of placement.homes.entries()) {
      for (const other of placement.homes.slice(index + 1)) {
        expect(length([home, other])).toBeGreaterThanOrEqual(110);
      }
      expect(length([home, closestOnSegment(home, entry, exit)]) - halfWidth).toBeGreaterThan(
        fighter.pursuitRadius + fighter.weaponReach + fighter.radius,
      );
    }
    expect(entry.x).toBeLessThan(0);
    expect(exit.x).toBeLessThan(0);
    expect(
      length([field, closestOnSegment(field, entry, exit)]) - halfWidth,
    ).toBeGreaterThanOrEqual(950);
    expect(CARTWHEEL_MINING_PATROL).toEqual({
      bypassWidth: 220,
      warningRange: 800,
      warningSeconds: 2.5,
    });
  });

  it("skips rock queries and admission for protected sites, unknown Hub and absent allocations", () => {
    const rocksNear = vi.fn(() => []);
    const admits = vi.fn(() => true);
    const input = { ...context(), admits, rocksNear };
    expect(planCartwheelMiningPatrol({ ...input, hubKnown: false })).toEqual({
      status: "hub-unknown",
    });
    const unallocated = { ...input };
    delete unallocated.allocation;
    expect(planCartwheelMiningPatrol(unallocated)).toEqual({ status: "no-allocation" });
    expect(
      planCartwheelMiningPatrol({
        ...input,
        fieldIsClear: () => false,
        fields: [{ ...field, guard: field, id: "platform" }, field],
      }),
    ).toEqual({
      rejected: [
        { fieldId: "platform", reason: "guarded" },
        { fieldId: "field", reason: "required-site" },
      ],
      status: "no-placement",
    });
    expect(rocksNear).not.toHaveBeenCalled();
    expect(admits).not.toHaveBeenCalled();
  });

  it("requires two distinct moving paths, without treating a duplicated id or a static rock as cover", () => {
    const input = context([
      moving("one", 850),
      moving("one", 1050),
      { id: "static", radius: 40, start: { x: 900, y: 0 } },
    ]);
    const admits = vi.fn(() => true);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toEqual({
      rejected: [{ fieldId: "field", reason: "cover" }],
      status: "no-placement",
    });
    expect(admits).not.toHaveBeenCalled();
  });

  it("does not rely on predicted rocks as cover for the patrol", () => {
    const result = planCartwheelMiningPatrol(
      context([moving("live", 850), { ...moving("future", 1050), unspawned: "ambient" }]),
    );
    expect(result).toEqual({
      rejected: [{ fieldId: field.id, reason: "cover" }],
      status: "no-placement",
    });
  });

  it("refuses when moving rocks sweep the opposite search band from clear starting positions", () => {
    const tracks = Array.from({ length: 61 }, (_, index) => {
      const y = (index - 30) * 100;
      return { end: { x: -1050, y }, id: `cross:${index}`, radius: 20, start: { x: -6500, y } };
    });
    const admits = vi.fn(() => true);
    const input = context([moving("a", 850), moving("b", 1050), ...tracks]);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toMatchObject({
      rejected: expect.arrayContaining([{ fieldId: "field", reason: "bypass" }]),
      status: "no-placement",
    });
    expect(admits).not.toHaveBeenCalled();
  });

  it("passes the complete allocation to admission and leaves everything unplaced on refusal", () => {
    const input = context();
    const snapshot = structuredClone(input.allocation);
    const admits = vi.fn(() => false);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toMatchObject({
      rejected: expect.arrayContaining([{ fieldId: "field", reason: "admission" }]),
      status: "no-placement",
    });
    expect(input.allocation).toEqual(snapshot);
    expect(admits).toHaveBeenCalledWith(
      expect.objectContaining({
        allocationId: "pack",
        homes: expect.arrayContaining([...plan(input).homes]),
      }),
    );
  });

  it("tries an outward formation on the same approach if admission rejects the first", () => {
    const first = plan();
    const admits = vi.fn(
      ({ anchor, approach }: typeof first) =>
        anchor.x > first.anchor.x && approach[0].x === first.approach[0].x,
    );
    const alternate = plan({ ...context(), admits });
    expect(alternate.approach).toEqual(first.approach);
    expect(alternate.coverIds).toEqual(first.coverIds);
    expect(alternate.anchor.x).toBeGreaterThan(first.anchor.x);
    expect(admits).toHaveBeenCalledWith(first);
  });

  it("uses shortest wrapped paths for cover and normalises the returned placements", () => {
    const side = 20_000;
    const edge = { ...field, y: 9950 };
    const shifted = (p: Vec) => wrapPoint(side, { x: p.x + edge.x, y: p.y + edge.y });
    const input = context([
      {
        ...moving("a", 850),
        end: shifted({ x: 850, y: 100 }),
        start: shifted({ x: 850, y: -100 }),
      },
      {
        ...moving("b", 1050),
        end: shifted({ x: 1050, y: 100 }),
        start: shifted({ x: 1050, y: -100 }),
      },
    ]);
    const allocation = { ...input.allocation!, anchor: shifted(input.allocation!.anchor) };
    const placement = plan({ ...input, allocation, fields: [edge], worldSide: side });
    expect(placement.coverIds).toEqual(["a", "b"]);
    expect(placement.homes).toEqual(plan().homes.map(shifted));
  });
});

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function discoverMiningPatrol(knowHub: boolean) {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, {
    mode: "space",
    prologueSeen: true,
    selectedGalaxy: 2,
    started: true,
    unlocked: [...GALAXY_NUMBERS],
  });
  const progress = model.state.progress[2];
  progress.opened = true;
  model.state.economy.levels.engine = ECONOMY.engineLevels.maxSpeed.length + 1;
  const flight = createUnpopulatedFlight(CONTENT, 2, 1, model.state.economy, 1);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  model.state.flight = flight;
  planRequiredCartwheelRoute(CONTENT, progress, flight);
  if (knowHub) {
    visitCartwheelHubFixture(CONTENT, model);
    expect(progress.known).toContain("hub");
    if (model.state.dialogue) {
      model.choose("continue");
    }
  }
  const world = flightWorldContext(flight);
  const ore = worldOreFieldInCell(world, 2, { x: -1, y: 4 })!;
  expect(ore.guard).toBeNull();
  flight.player = { x: ore.x, y: ore.y };
  populateFlight(CONTENT, progress, flight);
  expect(flight.objects.some(({ id }) => id.startsWith(`${ore.id}:`))).toBe(true);
  // Page in the cover before reaching the seeded fighter allocation on the west approach.
  for (const offset of [
    { x: 850, y: 0 },
    { x: 0, y: 850 },
    { x: -850, y: 0 },
    { x: 0, y: -850 },
    { x: 1450, y: 0 },
    { x: 0, y: 1450 },
    { x: -1450, y: 0 },
  ]) {
    flight.player = { x: ore.x + offset.x, y: ore.y + offset.y };
    populateFlight(CONTENT, progress, flight);
  }
  return { flight, model, progress, world };
}

function preparePatrolCheckpoint() {
  const { flight, model, progress, world } = discoverMiningPatrol(true);
  const patrol = flight.cartwheelMiningPatrol;
  expect(patrol).toBeDefined();
  const pendingSave = model.save();
  const before = new Set(stationPopulationObjects(flight).map(({ id }) => id));
  const [entry, exit] = patrol!.plan.bypass;
  const end = worldPoint(world, entry, exit);
  for (const amount of [0, 0.5, 1]) {
    flight.player = {
      x: entry.x + (end.x - entry.x) * amount,
      y: entry.y + (end.y - entry.y) * amount,
    };
    populateFlight(CONTENT, progress, flight);
  }
  const generatedIds = Object.freeze(
    stationPopulationObjects(flight)
      .filter(
        ({ id, kind }) => !before.has(id) && (kind === "rock" || id.startsWith(MOVING_ROCK_PREFIX)),
      )
      .map(({ id }) => id),
  );
  expect(flight.cartwheelMiningPatrol).toBe(patrol);
  const bypassSave = model.save();

  flight.player = { x: patrol!.plan.anchor.x + 600, y: patrol!.plan.anchor.y };
  const events = stepFlight(CONTENT, 0.001, { ...idle, cartwheelHubKnown: true }, flight);
  return Object.freeze({
    bypassSave,
    generatedIds,
    pendingSave,
    warnedSave: model.save(),
    warningCount: events.filter(({ type }) => type === "cartwheelPatrolWarning").length,
  });
}

describe("Cartwheel mining patrol flight", () => {
  let checkpoint: ReturnType<typeof preparePatrolCheckpoint>;
  beforeAll(() => {
    checkpoint = preparePatrolCheckpoint();
  });

  it("uses a real pending fighter allocation only after discovery and reserves its bypass", () => {
    const unknown = discoverMiningPatrol(false);
    expect(unknown.flight.cartwheelMiningPatrol).toBeUndefined();

    const flight = restoreSave(checkpoint.pendingSave)!.flight!;
    const patrol = flight.cartwheelMiningPatrol!;
    const { actors, plan } = patrol;
    const world = flightWorldContext(flight);
    const ore = worldOreFieldInCell(world, 2, { x: -1, y: 4 })!;
    expect(plan.fieldId).toBe(ore.id);
    expect(actors).toHaveLength(4);
    expect(unknown.flight.combat?.initialPackSizes[plan.allocationId]).toBe(actors.length);
    expect(flight.combat?.initialPackSizes[plan.allocationId]).toBe(actors.length);
    const population = stationPopulationObjects(flight);
    const members = population.filter(({ id }) => actors.includes(id));
    expect(members.map(({ id }) => id).sort()).toEqual([...actors].sort());
    expect(
      members.every((object) => object.persistent && !cartwheelPatrolAdmits(flight, object)),
    ).toBe(true);
    expect(plan.coverIds.length).toBeGreaterThanOrEqual(2);
    for (const id of plan.coverIds) {
      expect(id.startsWith(MOVING_ROCK_PREFIX)).toBe(true);
      expect(population.find((object) => object.id === id)?.velocity).toBeDefined();
    }

    const [entry, exit] = plan.bypass;
    const end = worldPoint(world, entry, exit);
    const nearest = closestOnSegment(worldPoint(world, entry, ore), entry, end);
    expect(worldDistance(world, ore, nearest)).toBeGreaterThanOrEqual(
      950 + CARTWHEEL_MINING_PATROL.bypassWidth / 2,
    );
    expect(length([entry, end])).toBeCloseTo(900, 8);
    const bypass = restoreSave(checkpoint.bypassSave)!.flight!;
    expect(bypass.cartwheelMiningPatrol).toEqual(patrol);
    const bypassObjects = new Map(stationPopulationObjects(bypass).map((rock) => [rock.id, rock]));
    expect(checkpoint.generatedIds.length).toBeGreaterThan(0);
    for (const id of checkpoint.generatedIds) {
      const rock = bypassObjects.get(id)!;
      const point = worldPoint(world, entry, rock);
      expect(length([point, closestOnSegment(point, entry, end)])).toBeGreaterThanOrEqual(
        CARTWHEEL_MINING_PATROL.bypassWidth / 2 + placementRadius(rock) - 1e-6,
      );
    }

    expect(checkpoint.warningCount).toBe(1);
    const warned = restoreSave(checkpoint.warnedSave)!.flight!;
    expect(warned.cartwheelMiningPatrol).toEqual({ ...patrol, warnedAt: warned.time });
    expect(cartwheelPatrolAdmits(warned, { id: actors[0]! })).toBe(false);
    const restored = relaunch(CONTENT, checkpoint.warnedSave).state.flight!;
    expect(restored.cartwheelMiningPatrol).toEqual(warned.cartwheelMiningPatrol);
    expect(
      stepFlight(CONTENT, 0.001, { ...idle, cartwheelHubKnown: true }, restored).some(
        ({ type }) => type === "cartwheelPatrolWarning",
      ),
    ).toBe(false);
    expect(cartwheelPatrolAdmits(restored, { id: actors[0]! })).toBe(false);

    const admittedAt =
      warned.cartwheelMiningPatrol!.warnedAt! + CARTWHEEL_MINING_PATROL.warningSeconds;
    // Jump the idle clock to the boundary, then use real steps on both sides.
    restored.time = admittedAt - 0.01;
    for (const [dt, admitted] of [
      [0.005, false],
      [0.01, true],
    ] as const) {
      const frame = stepFlight(CONTENT, dt, { ...idle, cartwheelHubKnown: true }, restored);
      expect(frame.some(({ type }) => type === "cartwheelPatrolWarning")).toBe(false);
      expect(cartwheelPatrolAdmits(restored, { id: actors[0]! })).toBe(admitted);
    }
    expect(restored.time).toBeGreaterThan(admittedAt);

    const malformed = JSON.parse(checkpoint.warnedSave);
    malformed.flight.cartwheelMiningPatrol.plan.bypass = [entry];
    expect(restoreSave(JSON.stringify(malformed))).toBeNull();
  });

  it("flies the entire 900-unit bypass after resuming a warned patrol", () => {
    const flight = relaunch(CONTENT, checkpoint.warnedSave).state.flight!;
    const { actors, plan, warnedAt } = flight.cartwheelMiningPatrol!;
    const world = flightWorldContext(flight);
    const [entry, exit] = plan.bypass;
    const end = worldPoint(world, entry, exit);
    const distance = length([entry, end]);
    expect(distance).toBeCloseTo(900, 8);

    flight.time = warnedAt! + CARTWHEEL_MINING_PATROL.warningSeconds + 0.005;
    expect(cartwheelPatrolAdmits(flight, { id: actors[0]! })).toBe(true);
    flight.player = { ...entry };
    const move = { x: (end.x - entry.x) / distance, y: (end.y - entry.y) / distance };
    const speed = shipTuning(ECONOMY, CONTENT, flight.levels).physics.maxSpeed;
    flight.velocity = { x: move.x * speed, y: move.y * speed };
    flight.facing = move;
    const startShield = flight.shield;
    const lastBump = flight.lastBump;
    const dt = 0.15;
    // stepFlight still integrates collisions at 60 Hz. Leave a full step of cruise
    // distance inside each sampled edge of the lane.
    const lateralLimit = CARTWHEEL_MINING_PATROL.bypassWidth / 2 - speed * dt;
    let along = 0;
    for (let step = 0; step < 60 && along < distance; step++) {
      const frame = stepFlight(CONTENT, dt, { ...idle, cartwheelHubKnown: true, move }, flight);
      const point = worldPoint(world, entry, flight.player);
      along = move.x * (point.x - entry.x) + move.y * (point.y - entry.y);
      expect(Math.abs(move.x * (point.y - entry.y) - move.y * (point.x - entry.x))).toBeLessThan(
        lateralLimit,
      );
      expect(flight.shield).toBe(startShield);
      expect(flight.lastBump).toBe(lastBump);
      expect(frame.some(({ type }) => type === "cartwheelPatrolWarning")).toBe(false);
    }
    expect(along).toBeGreaterThanOrEqual(distance);
    expect(flight.shield).toBe(startShield);
    expect(actors.some((id) => (flight.world.notables[id]?.hp ?? 0) > 0)).toBe(true);
    expect(flight.objects.some(({ id }) => actors.includes(id))).toBe(false);
  });
});
