import { expect } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { createUnpopulatedFlight } from "../model/flight.ts";
import { freshGalaxyGeography } from "../model/galaxyGeography.ts";
import { GameModel } from "../model/game.ts";
import { stationsNear } from "../model/stations.ts";
import { type StationService, stationSpecialty } from "../model/stationServices.ts";
import { supportEntropy } from "./launchSeeds.ts";
export function dockedStock(galaxy: GalaxyNumber = 1, specialty: StationService = "weaponsAmmo") {
  const model = new GameModel(CONTENT, supportEntropy);
  model.state.selectedGalaxy = galaxy;
  model.state.unlocked = [1, galaxy];
  model.state.started = true;
  model.state.mode = "space";
  model.state.progress[galaxy].geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, galaxy, 173, model.state.economy, 197);
  model.state.flight = flight;
  const site = stationsNear(ECONOMY, galaxy, 40000, flight.player).find(
    (site) => stationSpecialty(galaxy, site.id) === specialty,
  )!;
  expect(site).toBeDefined();
  model.state.docked = site.id;
  model.state.progress[galaxy].stations.push(site.id);
  model.state.economy.stardust = 100000;
  return model;
}
