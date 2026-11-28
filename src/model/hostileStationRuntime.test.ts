import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createUnpopulatedFlight } from "./flight.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { hostileStationSites, stationPopulationObjects } from "./hostileStations/index.ts";
import { materializeHostileStationRegion } from "./hostileStations/materialization.ts";
import { resolveHostileStationEncounter } from "./hostileStations/persistence.ts";
import { flightWorldContext } from "./world/index.ts";

function fixture() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  const progress = model.state.progress[5];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, 5, 173, model.state.economy, 197);
  const site = hostileStationSites(
    { ...flightWorldContext(flight), galaxy: 5, geographySeed: 173 },
    {
      height: 200000,
      width: 200000,
      x: -100000,
      y: -100000,
    },
  )[0]!;
  const region = { height: 2, width: 2, x: site.x - 1, y: site.y - 1 };
  flight.player = { x: site.x, y: site.y + 1200 };
  return { flight, model, progress, region, site };
}

it("binds an actual geographic candidate to one registered body and two defenders without identifying it", () => {
  const { flight, progress, region, site } = fixture();
  materializeHostileStationRegion(CONTENT, progress, flight, region);
  const actors = stationPopulationObjects(flight);
  expect(actors.filter(({ enemy }) => enemy?.archetype === "hostileStation")).toHaveLength(1);
  expect(actors.filter(({ enemy }) => enemy?.archetype === "swarm")).toHaveLength(2);
  expect(flight.hostileStations![site.id]).toMatchObject({ bodyId: site.id, rewarded: false });
  expect(progress.hostileSites![site.id]).toEqual({
    identified: false,
    point: { x: site.x, y: site.y },
  });
  expect(progress.known).toEqual([]);
  const before = structuredClone(flight);
  materializeHostileStationRegion(CONTENT, progress, flight, region);
  expect(flight).toEqual(before);
});

it("does not replenish registered casualties or reconstruct a removed station on a repeated query", () => {
  const { flight, progress, region, site } = fixture();
  materializeHostileStationRegion(CONTENT, progress, flight, region);
  const encounter = flight.hostileStations![site.id]!;
  for (const id of [encounter.bodyId, encounter.defenderIds[0]]) {
    const actor = stationPopulationObjects(flight).find((object) => object.id === id)!;
    worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, actor, flight);
    flight.objects = flight.objects.filter((object) => object.id !== id);
  }
  materializeHostileStationRegion(CONTENT, progress, flight, region);
  expect(resolveHostileStationEncounter(flight, site.id).state).toBe("removed");
  expect(
    stationPopulationObjects(flight).filter(({ id }) => id === encounter.defenderIds[1]),
  ).toHaveLength(1);
  expect(stationPopulationObjects(flight).some(({ id }) => id === encounter.defenderIds[0])).toBe(
    false,
  );
});

it("retains geography but creates a fresh encounter registry and actor identity on fresh combat entry", () => {
  const { flight, model, progress, region, site } = fixture();
  materializeHostileStationRegion(CONTENT, progress, flight, region);
  const original = stationPopulationObjects(flight).find(({ id }) => id === site.id)!;
  const next = createUnpopulatedFlight(CONTENT, 5, flight.seed, model.state.economy, 198);
  next.player = { ...flight.player };
  materializeHostileStationRegion(CONTENT, progress, next, region);
  expect(resolveHostileStationEncounter(next, site.id).state).toBe("present");
  expect(stationPopulationObjects(next).find(({ id }) => id === site.id)).not.toBe(original);
  expect(next.hostileStations![site.id]!.rewarded).toBe(false);
  expect(Object.keys(progress.hostileSites!)).toEqual([site.id]);
});
