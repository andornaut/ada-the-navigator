import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { enemyStardust } from "./drops.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation } from "./flight.ts";
import { hit } from "./flight/hitResolution.ts";
import {
  CURRENT_FLIGHT_TOPOLOGY,
  flightEncounterSeed,
  flightWorldContext,
} from "./flightTopology.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import {
  acknowledgeHostileStationIdentification,
  hostileStationEncounterIds,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./hostileStationPersistence.ts";
import { planHostileStationFormation } from "./hostileStationSchedule.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import type { FlightEvent } from "./types.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.selectedGalaxy = 5;
  model.state.mode = "space";
  model.state.started = true;
  model.state.progress[5].geography = freshGalaxyGeography(173);
  const progress = model.state.progress[5];
  const flight = createUnpopulatedFlight(CONTENT, 5, 173, model.state.economy, 71);
  model.state.flight = flight;
  const context = { ...flightWorldContext(flight), galaxy: 5 as const, geographySeed: 173 };
  const site = hostileStationSites(context, {
    height: 200000,
    width: 200000,
    x: -100000,
    y: -100000,
  })[0]!;
  expect(site).toBeDefined();
  rememberHostileStationSite(progress, 5, { id: site.id, point: { x: site.x, y: site.y } });
  flight.player = { x: site.x, y: site.y + 1200 };
  const plan = planHostileStationFormation(context, hostileStationEncounterIds(site.id), site)!;
  const created = spawnPlannedHostileStation(CONTENT, flight, plan);
  expect(created.status).toBe("created");
  if (created.status !== "created") {
    throw Error("Map fixture station admission failed");
  }
  registerHostileStationEncounter(progress, flight, site.id);
  return { body: created.station, flight, model, progress, site };
}

it("maps only identified sites and permits travel without altering chart totals", () => {
  const { body, flight, model, progress, site } = fixture();
  const mapped = model.map!.mapped;
  progress.markerKnowledge = { [site.id]: "sensed" };
  flight.markerActors = {
    encounterSeed: flightEncounterSeed(flight),
    knowledge: { [body.id]: "sensed" },
  };
  expect(model.map!.places.some(({ id }) => id === site.id)).toBe(false);
  expect(acknowledgeHostileStationIdentification(progress, flight, body.id)).toBe(true);
  const before = structuredClone(model.state);
  const map = model.map!;
  expect(map.places.find(({ id }) => id === site.id)).toEqual({
    hostileStationStatus: "present",
    id: site.id,
    job: false,
    kind: "hostileStation",
    label: "Hostile station",
    objective: false,
    symbol: "hostileStation",
    taskCategory: "generic",
    travel: true,
    x: site.x,
    y: site.y,
  });
  expect(map.mapped).toBe(mapped);
  expect(progress.stations).not.toContain(site.id);
  expect(model.state).toEqual(before);
});

it("reads live, legacy paid, and removed bodies without map side effects", () => {
  const { body, flight, model, progress, site } = fixture();
  acknowledgeHostileStationIdentification(progress, flight, body.id);
  flight.player = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.world.notables[body.id]).toBe(body);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("present");
  const hp = body.hp;
  const events: FlightEvent[] = [];
  hit(CONTENT, 7, body.enemy!.hardpoints[0]!.id, body, flight, events);
  expect(body).toMatchObject({ enemy: { disabled: false, hp: hp - 7 }, hp: hp - 7 });
  expect(events).toEqual([]);
  const before = structuredClone(model.state);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("present");
  expect(model.state).toEqual(before);
  expect(flight.hostileStations![site.id]!.rewarded).toBe(false);

  // Older saves could already have paid for disabling the retained station.
  model.state.unlocked = [1, 5];
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  body.enemy!.disabled = true;
  flight.hostileStations![site.id]!.rewarded = true;
  model.state.economy.stardust += enemyStardust(
    { id: body.id, seed: flight.seed },
    "hostileStation",
  );
  const saved = model.save();
  const decoded = restoreSave(saved);
  expect(decoded?.flight?.world.notables[body.id]?.enemy?.disabled).toBe(true);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, saved);
  resumed.continueGame();
  const retained = resumed.state.flight!;
  const legacy = retained.world.notables[body.id]!;
  const paid = structuredClone(resumed.state);
  expect(resumed.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe(
    "disabled",
  );
  expect(resumed.state).toEqual(paid);
  const prior = retained.objects.length;
  hit(CONTENT, legacy.hp, null, legacy, retained, events);
  expect(events).toEqual([{ id: body.id, type: "enemyDestroyed" }]);
  expect(retained.objects).toHaveLength(prior);
  worldRecordObjectRemoval(flightWorldContext(retained), CONTENT, legacy, retained);
  expect(resumed.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe(
    "removed",
  );
  expect(retained.hostileStations![site.id]!.rewarded).toBe(true);
  expect(resumed.state.economy.stardust).toBe(paid.economy.stardust);
});

it("keeps an identified geographic point on a new encounter without carrying old removal status", () => {
  const { body, flight, model, progress, site } = fixture();
  acknowledgeHostileStationIdentification(progress, flight, body.id);
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, body, flight);
  flight.objects = flight.objects.filter(({ id }) => id !== body.id);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("removed");
  model.state.flight = createUnpopulatedFlight(CONTENT, 5, 173, model.state.economy, 72);
  const before = structuredClone(model.state);
  const place = model.map!.places.find(({ id }) => id === site.id)!;
  expect(place.hostileStationStatus).toBe("unresolved");
  expect({ x: place.x, y: place.y }).toEqual({ x: site.x, y: site.y });
  expect(place.travel).toBe(true);
  expect(model.state).toEqual(before);
});
