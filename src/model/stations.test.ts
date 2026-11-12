import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { playOpening } from "../testing/launch.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  createFlight,
  ensureDestination,
  stationDock,
  stationDockClear,
  stationMouthRadius,
  stepFlight,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { SHIP_REACH, shipTouches } from "./ship-body.ts";
import {
  stationById,
  stationInCell,
  stationIndicatorTarget,
  type StationSite,
  stationsNear,
} from "./stations.ts";
import type { FlightInput, FlightState, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const { safeRadius } = ECONOMY.station;
const dockClear = stationDockClear();

function sites(sector: SectorId, span = 15): StationSite[] {
  const found: StationSite[] = [];
  for (let x = -span; x <= span; x++) {
    for (let y = -span; y <= span; y++) {
      const site = stationInCell(ECONOMY, sector, { x, y });
      if (site) {
        found.push(site);
      }
    }
  }
  return found;
}
const site = sites(1, 3)[0]!;
const dock = stationDock(site);
const { dockOutward } = ECONOMY.station;
// Ada approaches the dock moving against its outward direction, 200 units out.
const approach = { x: dock.x + dockOutward.x * 200, y: dock.y + dockOutward.y * 200 };

/** A flight parked inside a station's safe area with nothing else nearby. */
function atStation(seed = 5): FlightState {
  const flight = createFlight(PROTOTYPE, 1, seed, { known: [] });
  flight.player = { ...approach };
  stepFlight(PROTOTYPE, 1 / 60, idle, flight);
  flight.objects = flight.objects.filter((object) => object.kind === "station");
  flight.shots = [];
  return flight;
}
function launched(): GameModel {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.player = { ...approach };
  model.step(1 / 60, idle);
  flight.objects = flight.objects.filter((object) => object.kind === "station");
  flight.shots = [];
  return model;
}

describe("station placement", () => {
  it("places the same stations on every flight from the sector's seed", () => {
    expect(sites(1)).toEqual(sites(1));
    expect(sites(1)).not.toEqual(sites(2));
    const first = atStation(1);
    const second = atStation(987654);
    const station = (flight: FlightState) =>
      flight.objects.find((object) => object.kind === "station");
    expect(station(first)).toMatchObject({ id: site.id, x: site.x, y: site.y });
    expect(station(second)).toEqual(station(first));
    expect(stationById(ECONOMY, 1, site.id)).toEqual(site);
    expect(stationById(ECONOMY, 1, "station:x,1")).toBeNull();
  });

  it.each([1, 2, 3] as const)(
    "keeps sector %i stations one per 12000 cell, 8000 apart and off the start",
    (sector) => {
      const found = sites(sector);
      // Every one of the 961 cells holds a station clear of the start.
      expect(found).toHaveLength(961);
      for (const [index, first] of found.entries()) {
        expect(Math.hypot(first.x, first.y)).toBeGreaterThanOrEqual(
          ECONOMY.station.originClearance,
        );
        for (const second of found.slice(index + 1)) {
          expect(distance(first, second)).toBeGreaterThanOrEqual(8000);
        }
      }
    },
  );

  it("finds stations near a point by distance", () => {
    expect(stationsNear(ECONOMY, 1, 10, site)).toEqual([site]);
    expect(stationsNear(ECONOMY, 1, 10, { x: site.x + 20, y: site.y })).toEqual([]);
  });

  it("fills every cell at least 8000 apart on the existing grid", () => {
    const { cellSize, jitter } = ECONOMY.station;
    expect(cellSize - jitter).toBeGreaterThanOrEqual(8000);
    expect(ECONOMY.station).toMatchObject({ cellSize: 12000, chance: 1, jitter: 4000 });
  });

  it("keeps every station from the half-occupied grid in place, so saves keep their stations", () => {
    const half = { ...ECONOMY, station: { ...ECONOMY.station, chance: 0.5 } };
    for (const sector of [1, 2, 3] as const) {
      let kept = 0;
      let added = 0;
      for (let x = -15; x <= 15; x++) {
        for (let y = -15; y <= 15; y++) {
          const before = stationInCell(half, sector, { x, y });
          const now = stationInCell(ECONOMY, sector, { x, y });
          if (before) {
            expect(now).toEqual(before);
            expect(stationById(ECONOMY, sector, before.id)).toEqual(before);
            kept++;
          } else if (now) {
            added++;
          }
        }
      }
      expect(kept).toBeGreaterThan(300);
      expect(added).toBeGreaterThan(300);
    }
  });

  it("places the same stations in flights of every seed", () => {
    for (const sector of [1, 2, 3] as const) {
      for (const seed of [1, 7, 99, 4242]) {
        const flight = createFlight(PROTOTYPE, sector, seed, { known: [] });
        const expected = stationInCell(ECONOMY, sector, { x: 2, y: 1 })!;
        flight.player = { x: expected.x + 600, y: expected.y };
        stepFlight(PROTOTYPE, 1 / 60, idle, flight);
        const placed = flight.objects.filter((object) => object.kind === "station");
        expect(placed.map((station) => station.id)).toContain(expected.id);
        for (const station of placed) {
          expect(stationById(ECONOMY, sector, station.id)).toMatchObject({
            x: station.x,
            y: station.y,
          });
        }
      }
    }
  });

  it("marks the nearest undiscovered station within 2000 for the direction indicator", () => {
    const { indicatorRange } = ECONOMY.station;
    expect(indicatorRange).toBe(2000);
    const near = { x: site.x + indicatorRange - 1, y: site.y };
    expect(stationIndicatorTarget(ECONOMY, 1, [], near)).toEqual(site);
    expect(stationIndicatorTarget(ECONOMY, 1, [], { x: site.x, y: site.y - 600 })).toEqual(site);
    expect(
      stationIndicatorTarget(ECONOMY, 1, [], { x: site.x + indicatorRange + 1, y: site.y }),
    ).toBeNull();
    expect(stationIndicatorTarget(ECONOMY, 1, [site.id], near)).toBeNull();
  });

  it("keeps story destinations away from stations", () => {
    const flight = createFlight(PROTOTYPE, 1, 9, { known: [] });
    // The first destination would land on the station, straight ahead of Ada.
    flight.player = { x: site.x, y: site.y + PROTOTYPE.tuning.chunkSize * 2 };
    const destination = ensureDestination(PROTOTYPE, "growers", flight);
    for (const station of stationsNear(ECONOMY, 1, 20000, destination)) {
      expect(distance(station, destination)).toBeGreaterThanOrEqual(
        ECONOMY.station.destinationClearance,
      );
    }
  });
});

describe("station safe area", () => {
  it("protects Ada from enemy fire inside the safe area and ends danger", () => {
    const flight = atStation();
    flight.dangerFor = 2;
    flight.shots.push({
      ...flight.player,
      enemy: true,
      hitIds: [],
      id: "incoming",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    stepFlight(PROTOTYPE, 0.05, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(flight.dangerFor).toBe(0);
    expect(flight.shots).toEqual([]);
  });

  it("keeps enemies from entering the safe area or targeting Ada inside it", () => {
    const flight = atStation();
    const at = { x: site.x + safeRadius + 40, y: site.y };
    const definition = enemyCatalog.fighter;
    flight.objects.push({
      ...at,
      enemy: createEnemy(definition, { archetype: "fighter", id: "f", packId: null, phase: 0 }, at),
      hp: definition.hp,
      id: "f",
      kind: "enemy",
      radius: PROTOTYPE.tuning.flight.shipRadius,
    });
    flight.player = { x: site.x + 100, y: site.y };
    for (let step = 0; step < 120; step++) {
      stepFlight(PROTOTYPE, 1 / 30, idle, flight);
      const enemy = flight.objects.find((object) => object.id === "f")!;
      expect(distance(enemy, site)).toBeGreaterThanOrEqual(
        safeRadius + PROTOTYPE.tuning.flight.shipRadius - 1e-6,
      );
    }
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(flight.shots.filter((shot) => shot.enemy)).toEqual([]);
  });
});

describe("station discovery and docking", () => {
  it("discovers a station in its safe area and offers it as a travel destination", () => {
    const model = launched();
    expect(model.state.progress[1].stations).toEqual([site.id]);
    expect(model.destinations()).toContainEqual({ id: site.id, label: "Station" });
    const flight = model.state.flight!;
    flight.player = { x: site.x + 6000, y: site.y };
    model.step(1 / 60, idle);
    flight.dangerFor = 0;
    model.teleport(site.id);
    expect(distance(flight.player, dock)).toBeCloseTo(dockClear + 40, 9);
    model.step(0.1, idle);
    expect(model.state.docked).toBeNull();
  });

  it("docks when Ada flies into the dock and pauses action like a conversation", () => {
    const model = launched();
    const up = { ...idle, move: { x: -dockOutward.x, y: -dockOutward.y } };
    for (let step = 0; step < 120 && !model.state.docked; step++) {
      model.step(1 / 30, up);
    }
    expect(model.state.docked).toBe(site.id);
    const flight = model.state.flight!;
    expect(shipTouches(flight.facing, flight.player, dock, stationMouthRadius())).toBe(true);
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
    const time = flight.time;
    const position = { ...flight.player };
    model.step(1, up);
    expect(flight.time).toBe(time);
    expect(flight.player).toEqual(position);
    expect(model.selectWeapon("basic")).toBe(false);
    const saved = model.save();
    expect(restoreSave(saved)?.docked).toBe(site.id);
    model.undock();
    expect(model.state.docked).toBeNull();
    // Undocking places Ada at rest just outside the dock, along its outward direction.
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
    expect(distance(flight.player, dock)).toBeCloseTo(dockClear + 1, 9);
    expect(flight.player.y).toBeGreaterThan(dock.y);
    model.step(1 / 30, idle);
    expect(model.state.docked).toBeNull();
    // Flying straight back in docks again.
    for (let step = 0; step < 120 && !model.state.docked; step++) {
      model.step(1 / 30, up);
    }
    expect(model.state.docked).toBe(site.id);
  });

  it("docks when Ada's drawn ship overlaps the forgiving mouth circle", () => {
    const { dockForgiveness, dockMouthRadius } = ECONOMY.station;
    // Three times the 5.87 mouth radius.
    expect(stationMouthRadius()).toBe(dockMouthRadius * dockForgiveness);
    expect(stationMouthRadius()).toBeCloseTo(17.62, 2);
    // No heading of her ship reaches the mouth from the clear distance.
    expect(dockClear).toBeCloseTo(stationMouthRadius() + SHIP_REACH, 9);
    const at = (reach: number, facing: Vec) => {
      const model = launched();
      const flight = model.state.flight!;
      flight.player = { x: dock.x + dockOutward.x * reach, y: dock.y + dockOutward.y * reach };
      flight.facing = facing;
      flight.velocity = { x: 0, y: 0 };
      model.step(1 / 60, idle);
      return model.state.docked;
    };
    // For each of four headings, the nearest outward distance at which the drawn ship clears the
    // mouth: just inside it docks, just outside it does not.
    for (const facing of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]) {
      let low = 0;
      let high = dockClear;
      while (high - low > 1e-3) {
        const middle = (low + high) / 2;
        const player = { x: dock.x + dockOutward.x * middle, y: dock.y + dockOutward.y * middle };
        if (shipTouches(facing, player, dock, stationMouthRadius())) {
          low = middle;
        } else {
          high = middle;
        }
      }
      expect(at(low - 0.05, facing)).toBe(site.id);
      expect(at(high + 0.05, facing)).toBeNull();
    }
  });

  it("refuses travel and purchases outside a dock", () => {
    const model = launched();
    model.state.economy.stardust = 500;
    expect(model.buy({ kind: "weapon", weapon: "rapidMissile" })).toEqual({
      kind: "refused",
      reason: "notForSale",
    });
    expect(model.state.economy.stardust).toBe(500);
  });
});
