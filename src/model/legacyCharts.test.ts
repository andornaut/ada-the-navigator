import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { settlementById } from "./andromedaPlaces.ts";
import { newGameState } from "./game.ts";
import { legacyCharts } from "./legacyCharts.ts";
import { stationById, stationsNear } from "./stations.ts";
import type { GameState, HeldActivity, JobOffer } from "./types.ts";

const SIDE = 1_152_000;
const context = { catalog: ECONOMY, worldSide: SIDE };
const initial = (): Pick<GameState, "progress" | "jobs" | "tasks"> => {
  const { jobs, progress, tasks } = newGameState();
  return { jobs, progress, tasks };
};
const site = (galaxy: GalaxyNumber, far = true) => {
  const found = stationsNear(ECONOMY, galaxy, 20_000, { x: far ? SIDE : 0, y: 0 })[0];
  expect(found).toBeDefined();
  return found!;
};
const offer = (galaxy: GalaxyNumber): JobOffer => ({
  id: "job:fixture",
  item: "stranded craft",
  reward: 1,
  station: site(galaxy, false).id,
  target: { id: "", x: 0, y: 0 },
  type: "rescue",
});

describe("persistent legacy charts", () => {
  it.each([
    [-SIDE / 2, 0, false],
    [SIDE / 2 - 1, 0, false],
    [SIDE / 2, 0, true],
    [-SIDE / 2 - 1, 0, true],
    [0, -SIDE / 2, false],
    [0, SIDE / 2, true],
    [0, -SIDE / 2 - 1, true],
  ])("classifies absolute target (%s,%s) with half-open bounds", (x, y, expected) => {
    const state = initial();
    state.tasks[3] = { ...offer(3), kind: "job", target: { id: "", x, y } };
    expect(legacyCharts(context, state)).toEqual(expected ? { 3: true } : {});
  });

  it.each(["stations", "greetings", "known"] as const)(
    "resolves an actual legacy station referenced only by %s",
    (field) => {
      const state = initial();
      const id = site(2).id;
      if (field === "greetings") {
        state.progress[2].greetings[id] = 1;
      } else {
        state.progress[2][field].push(id);
      }
      expect(legacyCharts(context, state)).toEqual({ 2: true });
    },
  );

  it.each(["origin", "station", "targetId", "target", "spot"])(
    "inspects board %s references even with no held task",
    (field) => {
      const state = initial();
      const job = offer(1);
      let origin = job.station;
      if (field === "origin") {
        origin = site(1).id;
      }
      if (field === "station") {
        job.station = site(1).id;
      }
      if (field === "targetId") {
        job.target.id = site(1).id;
      }
      if (field === "target") {
        job.target.x = SIDE;
      }
      if (field === "spot") {
        job.spot = { x: 0, y: SIDE };
      }
      state.jobs.boards[1] = { [origin]: [job] };
      expect(legacyCharts(context, state)).toEqual({ 1: true });
    },
  );

  it("inspects empty board origins and held job origins and search spots", () => {
    const state = initial();
    state.jobs.boards[1] = { [site(1).id]: [] };
    state.tasks[4] = { ...offer(4), kind: "job", station: site(4).id };
    state.tasks[6] = { ...offer(6), kind: "job", spot: { x: SIDE, y: 0 } };
    expect(legacyCharts(context, state)).toEqual({ 1: true, 4: true, 6: true });
  });

  it("resolves Andromeda station and shifted settlement coordinates", () => {
    const state = initial();
    state.progress[5].andromeda = { station: site(5).id };
    expect(legacyCharts(context, state)).toEqual({ 5: true });
    const catalog = {
      ...ECONOMY,
      station: {
        ...ECONOMY.station,
        cellSize: 100,
        chance: 1,
        destinationClearance: 0,
        jitter: 0,
        originClearance: 0,
      },
    };
    const id = "settlement:99,99";
    expect(stationById(catalog, 5, "station:99,99")).toMatchObject({ x: 9950, y: 9950 });
    expect(settlementById(catalog, id)).toMatchObject({ x: 10000, y: 10000 });
    state.progress[5].andromeda = { settlement: id };
    expect(legacyCharts({ catalog, worldSide: 20000 }, state)).toEqual({ 5: true });
  });

  it.each(["target", "targetId", "start", "position"])(
    "includes a courier's absolute %s",
    (field) => {
      const state = initial();
      const task: HeldActivity = {
        courier: { patrolSpawned: false, position: { x: 0, y: 0 } },
        id: "courierRun",
        kind: "activity",
        place: "courier",
        reward: 1,
        start: { x: 0, y: 0 },
        target: { id: "destination", x: 0, y: 0 },
      };
      if (field === "target") {
        task.target!.x = SIDE;
      }
      if (field === "targetId") {
        task.target!.id = site(6).id;
      }
      if (field === "start") {
        task.start!.x = SIDE;
      }
      if (field === "position") {
        task.courier!.position.y = SIDE;
      }
      state.tasks[6] = task;
      expect(legacyCharts(context, state)).toEqual({ 6: true });
    },
  );

  it("includes a supply run's destination", () => {
    const state = initial();
    state.tasks[1] = {
      carrying: true,
      id: "supplyRun",
      kind: "activity",
      place: "hub",
      reward: 1,
      target: { ...site(1) },
    };
    expect(legacyCharts(context, state)).toEqual({ 1: true });
  });

  it("ignores relative calf offsets, historical chart records and unresolved metadata", () => {
    const state = initial();
    state.tasks[3] = {
      id: "guideCalf",
      kind: "activity",
      place: "family",
      reward: 1,
      start: { x: SIDE, y: SIDE },
    };
    state.progress[3].explored.push("999999,999999");
    state.progress[3].charted.push("landmark:999999,999999");
    state.progress[3].known.push("authored-place", "station:unknown", "settlement:unknown");
    expect(legacyCharts(context, state)).toEqual({});
  });

  it("does not mutate or rewrite input and never inspects an active flight", () => {
    const state = newGameState();
    state.progress[2].stations.push(site(2).id);
    const before = structuredClone(state);
    const freeze = (value: unknown): void => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    };
    freeze(state);
    expect(legacyCharts(context, state)).toEqual({ 2: true });
    expect(state).toEqual(before);
    const input = {
      ...state,
      get flight(): never {
        throw new Error("Flight is not a persistent chart reference");
      },
    };
    expect(legacyCharts(context, input)).toEqual({ 2: true });
  });

  it("retains a noncanonical settlement identity even when its shifted point is inside", () => {
    const catalog = {
      ...ECONOMY,
      station: {
        ...ECONOMY.station,
        cellSize: 100,
        chance: 1,
        destinationClearance: 0,
        jitter: 0,
        originClearance: 0,
      },
    };
    const state = initial();
    const y = Array.from({ length: 100 }, (_, index) => index).find(
      (cell) =>
        settlementById(catalog, `settlement:-101,${cell}`) &&
        settlementById(catalog, `settlement:-100,${cell}`),
    );
    expect(y).toBeDefined();
    const id = `settlement:-101,${y}`;
    expect(settlementById(catalog, id)).toMatchObject({ x: -10000 });
    state.progress[5].andromeda = { settlement: id };
    expect(legacyCharts({ catalog, worldSide: 20000 }, state)).toEqual({ 5: true });
    state.progress[5].andromeda = { settlement: `settlement:-100,${y}` };
    expect(legacyCharts({ catalog, worldSide: 20000 }, state)).toEqual({});
  });

  it("rejects a side that does not contain a whole station grid", () => {
    expect(() => legacyCharts({ catalog: ECONOMY, worldSide: SIDE + 1 }, initial())).toThrow(
      RangeError,
    );
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "requires an explicit positive safe integer side (%s)",
    (worldSide) => {
      expect(() => legacyCharts({ catalog: ECONOMY, worldSide }, initial())).toThrow(RangeError);
    },
  );
});
