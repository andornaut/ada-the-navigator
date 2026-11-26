import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { settlementById, settlementsNear } from "./andromedaPlaces.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { retainedSettlementWithin } from "./legacySettlements.ts";
import {
  flightStationContext,
  stationById,
  stationsNear,
  worldInfillStationInCell,
  worldLegacyStationsNear,
  worldStationById,
  worldStationInCell,
  worldStationsNear,
} from "./stations.ts";
import { periodicWorldGrid, worldCellAt, worldCellCenter } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";

describe("additive station density", () => {
  it.each([1, 2, 3, 4, 5, 6] as const)(
    "approximately doubles accepted sites in galaxy %i without moving legacy stations",
    (galaxy) => {
      const radius = 240000;
      const point = { x: 0, y: 0 };
      const legacy = worldLegacyStationsNear({}, ECONOMY, galaxy, radius, point);
      const actual = stationsNear(ECONOMY, galaxy, radius, point);
      const infill = actual.filter(({ id }) => id.startsWith("station:infill:"));
      console.info(
        "ACCEPTED_DENSITY",
        JSON.stringify({
          galaxy,
          infill: infill.length,
          legacy: legacy.length,
          ratio: actual.length / legacy.length,
          total: actual.length,
        }),
      );
      expect(actual.filter(({ id }) => !id.startsWith("station:infill:"))).toEqual(legacy);
      expect(actual.length / legacy.length).toBeGreaterThanOrEqual(1.95);
      expect(actual.length / legacy.length).toBeLessThanOrEqual(2.05);
      expect(new Set(actual.map(({ id }) => id)).size).toBe(actual.length);
      let minimum = Infinity;
      for (const [index, first] of actual.entries()) {
        expect(stationById(ECONOMY, galaxy, first.id)).toEqual(first);
        for (const second of actual.slice(index + 1)) {
          minimum = Math.min(minimum, Math.hypot(first.x - second.x, first.y - second.y));
        }
      }
      expect(minimum).toBeGreaterThanOrEqual(ECONOMY.station.minimumSpacing - 1e-8);
    },
  );

  it("keeps Andromeda's accepted settlements clear of every new station", () => {
    const settlements = settlementsNear(ECONOMY, 96000, { x: 0, y: 0 });
    expect(settlements.length).toBeGreaterThan(100);
    for (const settlement of settlements) {
      expect(stationsNear(ECONOMY, 5, ECONOMY.station.destinationClearance, settlement)).toEqual(
        [],
      );
    }
  });

  it("keeps Andromeda's conflicting primary station in its cell and clear of the retained settlement", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.prologueSeen = true;
    model.state.unlocked = [1, 5];
    model.state.progress[5].opened = true;
    model.startGalaxy(5);
    const flight = model.state.flight!;
    const context = flightStationContext(flight);
    const settlement = settlementById(ECONOMY, "settlement:5,-8")!;
    const cell = { x: 5, y: -7 };
    const station = worldStationInCell(context, ECONOMY, 5, cell)!;
    const grid = periodicWorldGrid(context, ECONOMY.station.cellSize);

    expect(station.id).toBe("station:5,-7");
    expect(worldCellAt(grid, station)).toEqual(cell);
    const center = worldCellCenter(grid, cell);
    expect(
      Math.max(Math.abs(station.x - center.x), Math.abs(station.y - center.y)),
    ).toBeLessThanOrEqual(ECONOMY.station.jitter / 2);
    expect(worldStationById(context, ECONOMY, 5, station.id)).toEqual(station);
    expect(wrappedDistance(GALAXY_SIDE, station, settlement)).toBeGreaterThanOrEqual(
      ECONOMY.station.destinationClearance,
    );
    flight.player = { x: station.x, y: station.y };
    model.state.dialogue = null;
    model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(flight.objects).toContainEqual(expect.objectContaining(station));
    flight.player = { x: settlement.x, y: settlement.y };
    model.state.dialogue = null;
    model.step(0.01, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    expect(flight.objects).toContainEqual(expect.objectContaining(settlement));
  });

  it("keeps Andromeda's original settlement clear when the new grid admits a nearby infill cell", () => {
    const context = { worldSide: GALAXY_SIDE };
    const settlement = settlementsNear(ECONOMY, GALAXY_SIDE / 2, { x: 0, y: 0 }).find(
      ({ id }) => id === "settlement:-4,1",
    )!;
    const infill = worldInfillStationInCell(context, ECONOMY, 5, { x: -3, y: 2 });
    expect(infill).not.toBeNull();
    expect(wrappedDistance(GALAXY_SIDE, infill!, settlement)).toBeGreaterThanOrEqual(
      ECONOMY.station.destinationClearance,
    );
  });

  it("uses strict infill IDs and includes offset sites in tiny boundary queries", () => {
    for (const id of [
      "station:infill:-0,1",
      "station:infill:01,2",
      "station:infill:1.5,2",
      "station:infill:9007199254740992,2",
    ]) {
      expect(stationById(ECONOMY, 1, id)).toBeNull();
    }
    const site = worldInfillStationInCell({}, ECONOMY, 5, { x: 1, y: 1 })!;
    expect(site).not.toBeNull();
    expect(stationsNear(ECONOMY, 5, 0, site)).toEqual([site]);
  });

  it("keeps infill and retained settlements canonical across a periodic seam", () => {
    const context = { worldSide: GALAXY_SIDE };
    const edge = -periodicWorldGrid(context, ECONOMY.station.cellSize).periodCells! / 2;
    const accepted = [];
    for (let y = -4; y <= 4; y++) {
      const site = worldInfillStationInCell(context, ECONOMY, 5, { x: edge, y });
      if (!site) {
        continue;
      }
      accepted.push(site);
      expect(worldStationById(context, ECONOMY, 5, site.id)).toEqual(site);
      expect(
        worldStationsNear(context, ECONOMY, 5, 0, { x: site.x + GALAXY_SIDE, y: site.y }),
      ).toEqual([site]);
      expect(
        retainedSettlementWithin(context, ECONOMY, ECONOMY.station.destinationClearance, site),
      ).toBe(false);
      const blocked = { ...context, stationExclusions: [{ x: site.x + GALAXY_SIDE, y: site.y }] };
      expect(worldStationById(blocked, ECONOMY, 5, site.id)).toBeNull();
    }
    expect(accepted.length).toBeGreaterThan(0);
    expect(worldStationById(context, ECONOMY, 5, `station:infill:${-edge},0`)).toBeNull();
  });

  it("round-trips a genuinely docked infill station without growing the save schema", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.prologueSeen = true;
    model.startGalaxy(1);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    const site = worldStationById(flightStationContext(flight), ECONOMY, 1, "station:infill:1,0")!;
    expect(ensureStation(CONTENT, site.id, flight)).toMatchObject(site);
    flight.player = { x: site.x, y: site.y };
    flight.dangerFor = 0;
    model.step(1 / 60, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    model.interact();
    expect(model.state.docked).toBe(site.id);
    const restored = restoreSave(model.save())!;
    expect(restored).not.toBeNull();
    expect(restored.docked).toBe(site.id);
    expect(restored.flight!.objects).toContainEqual(expect.objectContaining(site));
  });

  it.each([false, true])(
    "suppresses infill beside a retained destination (resident=%s) consistently",
    (resident) => {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      model.state.prologueSeen = true;
      model.startGalaxy(1);
      model.state.dialogue = null;
      const flight = model.state.flight!;
      const site = worldStationById(
        flightStationContext(flight),
        ECONOMY,
        1,
        "station:infill:1,0",
      )!;
      const destination = ensureDestination(CONTENT, "growers", flight);
      destination.x = site.x;
      destination.y = site.y;
      if (resident) {
        flight.objects = flight.objects.filter(({ id }) => id !== destination.id);
        flight.world.notables[destination.id] = destination;
      }
      const before = { x: destination.x, y: destination.y };
      const context = flightStationContext(flight);
      expect(worldStationById(context, ECONOMY, 1, site.id)).toBeNull();
      expect(worldStationsNear(context, ECONOMY, 1, 0, site)).toEqual([]);
      expect(ensureStation(CONTENT, site.id, flight)).toBeNull();
      expect(destination).toMatchObject(before);
      model.state.progress[1].stations.push(site.id);
      model.state.docked = site.id;
      expect(model.stationServices).toBeNull();
      expect(model.jobBoard()).toEqual([]);
      expect(model.destinations().some(({ id }) => id === site.id)).toBe(false);
      expect(model.map!.places.some(({ id }) => id === site.id)).toBe(false);
    },
  );
});
