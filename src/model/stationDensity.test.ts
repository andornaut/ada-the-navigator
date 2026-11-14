import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import { ensureDestination, ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { worldSettlementsNear } from "./legacySettlements.ts";
import { restoreSave } from "./save.ts";
import {
  flightStationContext,
  stationById,
  stationsNear,
  worldInfillStationInCell,
  worldLegacyStationsNear,
  worldStationById,
  worldStationsNear,
} from "./stations.ts";

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
    const edge = -GALAXY_SIDE / ECONOMY.station.cellSize / 2;
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
        worldSettlementsNear(context, ECONOMY, ECONOMY.station.destinationClearance, site),
      ).toEqual([]);
      const blocked = { ...context, stationExclusions: [{ x: site.x + GALAXY_SIDE, y: site.y }] };
      expect(worldStationById(blocked, ECONOMY, 5, site.id)).toBeNull();
    }
    expect(accepted.length).toBeGreaterThan(0);
    expect(worldStationById(context, ECONOMY, 5, `station:infill:${-edge},0`)).toBeNull();
  });

  it("round-trips a genuinely docked infill station without growing the save schema", () => {
    const model = new GameModel(CONTENT);
    model.state.prologueSeen = true;
    model.startGalaxy(1);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    const site = stationById(ECONOMY, 1, "station:infill:1,0")!;
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
      const model = new GameModel(CONTENT);
      model.state.prologueSeen = true;
      model.startGalaxy(1);
      model.state.dialogue = null;
      const flight = model.state.flight!;
      const site = stationById(ECONOMY, 1, "station:infill:1,0")!;
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
