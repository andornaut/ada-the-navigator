import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { visitCartwheelHubFixture } from "../testing/cartwheelFixture.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { placementRadius } from "./asteroids.ts";
import {
  CARTWHEEL_MINING_PATROL,
  type CartwheelMiningPatrolContext,
  type CartwheelMiningRockPath,
  cartwheelPatrolAdmits,
  planCartwheelMiningPatrol,
} from "./cartwheelMiningPatrol.ts";
import { closestOnSegment } from "./convex.ts";
import {
  createUnpopulatedFlight,
  planRequiredCartwheelRoute,
  populateFlight,
  stepFlight,
} from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY, flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { worldOreFieldInCell } from "./oreFields.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import type { FlightInput, Vec } from "./types.ts";
import { worldDistance, worldPoint } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

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
  const directions = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  for (const radius of [850, 1450]) {
    for (const direction of directions) {
      flight.player = { x: ore.x + radius * direction.x, y: ore.y + radius * direction.y };
      populateFlight(CONTENT, progress, flight);
      if (flight.cartwheelMiningPatrol) {
        return { flight, model, ore, progress, world };
      }
    }
  }
  return { flight, model, ore, progress, world };
}

it("uses a real pending fighter allocation only after discovery and reserves its bypass", () => {
  const unknown = discoverMiningPatrol(false);
  expect(unknown.flight.cartwheelMiningPatrol).toBeUndefined();

  const { flight, model, ore, progress, world } = discoverMiningPatrol(true);
  expect(flight.cartwheelMiningPatrol?.plan.fieldId).toBe(ore.id);
  const patrol = flight.cartwheelMiningPatrol!;
  const { actors, plan } = patrol;
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
  const count = new Set(population.map(({ id }) => id));
  const [entry, exit] = plan.bypass;
  const end = worldPoint(world, entry, exit);
  const nearest = closestOnSegment(worldPoint(world, entry, ore), entry, end);
  expect(worldDistance(world, ore, nearest)).toBeGreaterThanOrEqual(
    950 + CARTWHEEL_MINING_PATROL.bypassWidth / 2,
  );
  expect(length([entry, end])).toBeCloseTo(900, 8);
  for (const amount of [0, 0.5, 1]) {
    flight.player = {
      x: entry.x + (end.x - entry.x) * amount,
      y: entry.y + (end.y - entry.y) * amount,
    };
    populateFlight(CONTENT, progress, flight);
  }
  const generated = stationPopulationObjects(flight).filter(
    ({ id, kind }) => !count.has(id) && (kind === "rock" || id.startsWith(MOVING_ROCK_PREFIX)),
  );
  expect(generated.length).toBeGreaterThan(0);
  for (const rock of generated) {
    const point = worldPoint(world, entry, rock);
    expect(length([point, closestOnSegment(point, entry, end)])).toBeGreaterThanOrEqual(
      CARTWHEEL_MINING_PATROL.bypassWidth / 2 + placementRadius(rock) - 1e-6,
    );
  }
  expect(flight.cartwheelMiningPatrol).toBe(patrol);
  const oldSave = model.save();
  expect(restoreSave(oldSave)?.flight?.cartwheelMiningPatrol).toEqual(patrol);

  flight.player = { x: plan.anchor.x + 600, y: plan.anchor.y };
  const events = stepFlight(CONTENT, 0.001, { ...idle, cartwheelHubKnown: true }, flight);
  expect(events.filter(({ type }) => type === "cartwheelPatrolWarning")).toHaveLength(1);
  expect(cartwheelPatrolAdmits(flight, { id: actors[0]! })).toBe(false);
  const saved = model.save();
  expect(restoreSave(saved)?.flight?.cartwheelMiningPatrol).toEqual(patrol);
  const restored = relaunch(CONTENT, saved).state.flight!;
  expect(restored.cartwheelMiningPatrol).toEqual(patrol);
  expect(
    stepFlight(CONTENT, 0.001, { ...idle, cartwheelHubKnown: true }, restored).some(
      ({ type }) => type === "cartwheelPatrolWarning",
    ),
  ).toBe(false);
  expect(cartwheelPatrolAdmits(restored, { id: actors[0]! })).toBe(false);

  const admittedAt = patrol.warnedAt! + CARTWHEEL_MINING_PATROL.warningSeconds;
  while (restored.time + 0.05 < admittedAt) {
    const frame = stepFlight(CONTENT, 0.05, { ...idle, cartwheelHubKnown: true }, restored);
    expect(frame.some(({ type }) => type === "cartwheelPatrolWarning")).toBe(false);
    expect(cartwheelPatrolAdmits(restored, { id: actors[0]! })).toBe(false);
  }
  stepFlight(CONTENT, 0.051, { ...idle, cartwheelHubKnown: true }, restored);
  expect(restored.time).toBeGreaterThan(admittedAt);
  expect(cartwheelPatrolAdmits(restored, { id: actors[0]! })).toBe(true);

  // Fly the entire marked bypass after the fighters can engage, with real collision and paging.
  restored.player = { ...entry };
  restored.velocity = { x: 0, y: 0 };
  const leg = { x: end.x - entry.x, y: end.y - entry.y };
  const move = { x: leg.x / length([entry, end]), y: leg.y / length([entry, end]) };
  const startShield = restored.shield;
  let along = 0;
  for (let step = 0; step < 320 && along < length([entry, end]); step++) {
    const frame = stepFlight(CONTENT, 0.05, { ...idle, cartwheelHubKnown: true, move }, restored);
    const point = worldPoint(world, entry, restored.player);
    along = move.x * (point.x - entry.x) + move.y * (point.y - entry.y);
    expect(Math.abs(move.x * (point.y - entry.y) - move.y * (point.x - entry.x))).toBeLessThan(
      CARTWHEEL_MINING_PATROL.bypassWidth / 2,
    );
    expect(frame.some(({ type }) => type === "cartwheelPatrolWarning")).toBe(false);
  }
  expect(along).toBeGreaterThanOrEqual(length([entry, end]));
  expect(restored.shield).toBe(startShield);

  const malformed = JSON.parse(saved);
  malformed.flight.cartwheelMiningPatrol.plan.bypass = [entry];
  expect(restoreSave(JSON.stringify(malformed))).toBeNull();
});
