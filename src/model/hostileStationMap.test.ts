import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation } from "./flight.ts";
import { flightEncounterSeed, flightWorldContext } from "./flightTopology.ts";
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

it("maps only identified sites without travel permission or altered chart totals", () => {
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
    travel: false,
    x: site.x,
    y: site.y,
  });
  expect(map.mapped).toBe(mapped);
  expect(progress.stations).not.toContain(site.id);
  expect(model.state).toEqual(before);
});

it("reads retained, disabled and removed current bodies without payout or mutation", () => {
  const { body, flight, model, progress, site } = fixture();
  acknowledgeHostileStationIdentification(progress, flight, body.id);
  flight.player = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.world.notables[body.id]).toBe(body);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("present");
  const definition = enemyEquipmentDefinition(flight.galaxy, body.enemy!);
  for (const part of definition.hardpoints.filter((part) => part.kind === "weapon")) {
    body.enemy = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, body.enemy!);
  }
  const before = structuredClone(model.state);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("disabled");
  expect(model.state).toEqual(before);
  expect(flight.hostileStations![site.id]!.rewarded).toBe(false);
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, body, flight);
  expect(model.map!.places.find(({ id }) => id === site.id)?.hostileStationStatus).toBe("removed");
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
  expect(place.travel).toBe(false);
  expect(model.state).toEqual(before);
});
