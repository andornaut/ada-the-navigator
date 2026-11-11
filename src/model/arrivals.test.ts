import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { createEnemy } from "./enemy-ai.ts";
import { createFlight, ensureDestination, ensureStation, stepFlight, teleport } from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import { playOpening } from "./test-launch.ts";
import type { FlightState, SectorProgress, SpaceObject, Vec } from "./types.ts";

const calm = PROTOTYPE.tuning.flight.arrivalCalm;
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: Pick<SectorProgress, "known"> = { known: [] };
const encounterShips = (flight: FlightState) =>
  flight.objects.filter(
    (object) =>
      object.kind === "enemy" &&
      object.hp > 0 &&
      object.routeId === undefined &&
      !object.persistent,
  );
const closest = (flight: FlightState, point: Vec) =>
  Math.min(
    Infinity,
    ...encounterShips(flight).map((object) => Math.hypot(object.x - point.x, object.y - point.y)),
  );

describe("calm launches", () => {
  it.each([1, 2, 3] as const)(
    "places no encounter ship within 2000 of a galaxy %i flight start",
    (sector: SectorId) => {
      let near = 0;
      let elsewhere = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const flight = createFlight(PROTOTYPE, sector, seed, progress);
        near = Math.max(near, closest(flight, { x: 0, y: 0 }) < calm ? 1 : 0);
        // Encounters still appear beyond the calm radius, and none inside it on the way back.
        flight.player = { x: 3500, y: 0 };
        stepFlight(PROTOTYPE, 0.001, idle, flight);
        elsewhere += encounterShips(flight).length;
        flight.player = { x: 0, y: 0 };
        stepFlight(PROTOTYPE, 0.001, idle, flight);
        expect(closest(flight, { x: 0, y: 0 })).toBeGreaterThanOrEqual(calm);
      }
      expect(near).toBe(0);
      expect(elsewhere).toBeGreaterThan(0);
    },
  );

  it("starts every galaxy jump calm, since a jump begins a new flight at its start", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    const flight = model.state.flight!;
    expect(flight.player).toEqual({ x: 0, y: 0 });
    expect(closest(flight, flight.player)).toBeGreaterThanOrEqual(calm);
  });
});

describe("calm Travel arrivals", () => {
  function farFlight(): FlightState {
    const flight = createFlight(PROTOTYPE, 1, 4242, progress);
    return flight;
  }
  function raider(point: Vec, id: string): SpaceObject {
    const enemy = createEnemy(
      enemyCatalog.fighter,
      { archetype: "fighter", id, packId: "raiders", phase: 0 },
      point,
    );
    return { ...point, enemy, hp: 4, id, kind: "enemy", radius: 10 };
  }

  it("clears encounter ships near a destination arrival without casualties and keeps it calm", () => {
    const flight = farFlight();
    flight.player = { x: 30000, y: 0 };
    const destination = ensureDestination(PROTOTYPE, "growers", flight);
    const guard = flight.objects.find((object) => object.routeId !== undefined);
    flight.player = { x: 0, y: 0 };
    flight.objects.push(raider({ x: destination.x + 700, y: destination.y }, "raiders:0"));
    flight.combat = { initialPackSizes: { raiders: 1 }, routeEncounters: [] };
    expect(teleport(PROTOTYPE, "growers", flight)).toBe(true);
    expect(flight.arrivals).toEqual([{ x: destination.x, y: destination.y }]);
    // The raider left without a casualty or tombstone.
    expect(flight.objects.map((object) => object.id)).not.toContain("raiders:0");
    expect(Object.hasOwn(flight.world.notables, "raiders:0")).toBe(false);
    if (guard) {
      expect(flight.objects).toContain(guard);
    }
    for (let step = 0; step < 4; step++) {
      stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    }
    expect(closest(flight, destination)).toBeGreaterThanOrEqual(calm - 50);
  });

  it("keeps a station arrival calm", () => {
    const flight = farFlight();
    const [site] = stationsNear(ECONOMY, 1, 60000, { x: 20000, y: 0 });
    expect(site).toBeDefined();
    const station = ensureStation(PROTOTYPE, site!.id, flight)!;
    flight.player = { x: 0, y: 0 };
    expect(teleport(PROTOTYPE, station.id, flight)).toBe(true);
    const arrival = flight.arrivals!.at(-1)!;
    expect(Math.hypot(arrival.x - station.x, arrival.y - station.y)).toBeLessThan(200);
    stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    expect(closest(flight, arrival)).toBeGreaterThanOrEqual(calm);
  });

  it("gives the same world for the same seed and travel", () => {
    const travel = () => {
      const flight = createFlight(PROTOTYPE, 1, 99, progress);
      flight.player = { x: 30000, y: 0 };
      ensureDestination(PROTOTYPE, "growers", flight);
      flight.player = { x: 0, y: 0 };
      teleport(PROTOTYPE, "growers", flight);
      stepFlight(PROTOTYPE, 1 / 60, idle, flight);
      return flight;
    };
    const first = travel();
    expect(travel()).toEqual(first);
    expect(first.arrivals).toHaveLength(1);
  });

  it("saves Travel arrivals and rejects malformed ones", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    const flight = model.state.flight!;
    flight.arrivals = [{ x: 4000, y: -1200 }];
    expect(restoreSave(model.save())?.flight?.arrivals).toEqual([{ x: 4000, y: -1200 }]);
    const broken = JSON.parse(model.save()) as { flight: { arrivals: unknown } };
    broken.flight.arrivals = [{ x: "far" }];
    expect(restoreSave(broken)).toBeNull();
  });
});
