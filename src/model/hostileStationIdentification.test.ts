import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation } from "./flight.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import {
  hostileStationEncounterIds,
  identifiedHostileStationSites,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./hostileStationPersistence.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.selectedGalaxy = 5;
  model.state.started = true;
  model.state.mode = "space";
  const progress = model.state.progress[5];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, 5, 173, model.state.economy, 197);
  model.state.flight = flight;
  const site = { id: "hostile-station:5:173:0,0:0", point: { x: 20000, y: 0 } };
  rememberHostileStationSite(progress, 5, site);
  const ids = hostileStationEncounterIds(site.id);
  const created = spawnPlannedHostileStation(CONTENT, flight, {
    defenders: ids.defenderIds.map((id, index) => ({
      id,
      point: { x: 19500 + index * 1000, y: 400 },
    })),
    id: site.id,
    point: site.point,
  });
  expect(created.status).toBe("created");
  registerHostileStationEncounter(progress, flight, site.id);
  return { flight, model, progress, site };
}

it("records geographic identification even when the current actor was already identified", () => {
  const { flight, model, progress, site } = fixture();
  flight.markerActors = {
    encounterSeed: flightEncounterSeed(flight),
    knowledge: { [site.id]: "identified" },
  };
  expect(identifiedHostileStationSites(progress)).toEqual([]);
  model.markerTargetDisplayed(site.id);
  expect(identifiedHostileStationSites(progress)).toEqual([site]);
  const before = structuredClone(model.state);
  model.markerTargetDisplayed(site.id);
  expect(model.state).toEqual(before);
});

it("keeps docked, dialogue and non-flight acknowledgments from identifying geography", () => {
  const { model, progress, site } = fixture();
  model.state.docked = "some-station";
  model.markerTargetDisplayed(site.id);
  model.state.docked = null;
  model.state.dialogue = { choices: [], context: "test", text: "test", title: "test" };
  model.markerTargetDisplayed(site.id);
  model.state.dialogue = null;
  model.state.mode = "home";
  model.markerTargetDisplayed(site.id);
  expect(identifiedHostileStationSites(progress)).toEqual([]);
});

it("does not identify a remembered site without its registered loaded live body", () => {
  const { flight, model, progress, site } = fixture();
  flight.objects = flight.objects.filter(({ id }) => id !== site.id);
  model.markerTargetDisplayed(site.id);
  expect(identifiedHostileStationSites(progress)).toEqual([]);
});
