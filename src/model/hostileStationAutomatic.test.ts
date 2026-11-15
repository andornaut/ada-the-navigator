import { afterEach, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { settlementsNear } from "./andromedaPlaces.ts";
import { createUnpopulatedFlight, populateFlight, spawnPlannedHostileStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { hostileStationEncounterIds } from "./hostileStationPersistence.ts";
import { materializeGeneratedHostileStations } from "./hostileStationRuntime.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { planHostileStationFormation } from "./hostileStationSchedule.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import { flightStationContext, worldStationsNear } from "./stations.ts";
import type { FlightState } from "./types.ts";

const originallyBuilt = BUILT.has(5);
afterEach(() => {
  if (!originallyBuilt) {
    (BUILT as Set<GalaxyNumber>).delete(5);
  }
});
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function atCandidate() {
  (BUILT as Set<GalaxyNumber>).add(5);
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  model.state.progress[5].opened = true;
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const context = flightWorldContext(flight);
  const protection = ECONOMY.station.safeRadius + CONTENT.tuning.safeRadius;
  const before = structuredClone(model.state);
  const site = hostileStationSites(
    { ...context, galaxy: 5, geographySeed: flight.seed },
    {
      height: 200000,
      width: 200000,
      x: -100000,
      y: -100000,
    },
  ).find((candidate) => {
    if (
      worldStationsNear(flightStationContext(flight), ECONOMY, 5, protection, candidate).length ||
      settlementsNear(ECONOMY, protection, candidate).length
    ) {
      return false;
    }
    // Query this finite world's candidates without removing required actors or pickups.
    const probe = structuredClone(flight);
    probe.player = { x: candidate.x, y: candidate.y + CONTENT.tuning.chunkSize };
    probe.velocity = { x: 0, y: 0 };
    populateFlight(CONTENT, model.state.progress[5], probe);
    clearOptional(probe);
    const plan = planHostileStationFormation(
      { ...context, galaxy: 5 },
      hostileStationEncounterIds(candidate.id),
      candidate,
    );
    return plan !== null && spawnPlannedHostileStation(CONTENT, probe, plan).status === "created";
  })!;
  expect(model.state).toEqual(before);
  expect(site).toBeDefined();
  flight.player = { x: site.x, y: site.y + CONTENT.tuning.chunkSize };
  flight.velocity = { x: 0, y: 0 };
  return { flight, model, progress: model.state.progress[5], site };
}

/** Isolate admission in a cleared encounter area, preserving all required and registered actors. */
function clearOptional(flight: FlightState): void {
  const ids = new Set(
    stationPopulationObjects(flight)
      .filter(
        (actor) =>
          ["rock", "resource", "debris"].includes(actor.kind) ||
          actor.enemy?.packId?.startsWith("pack:"),
      )
      .map(({ id }) => id),
  );
  for (const actor of stationPopulationObjects(flight)) {
    if (ids.has(actor.id)) {
      worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, actor, flight);
    }
  }
  flight.objects = flight.objects.filter(({ id }) => !ids.has(id));
}

it("queries generated cells, retains encounters on Continue and credits a real hull hit once", () => {
  const { flight, model, progress, site } = atCandidate();
  model.step(0.001, idle);
  expect(progress.hostileSites![site.id]).toEqual({
    identified: false,
    point: { x: site.x, y: site.y },
  });
  clearOptional(flight);
  model.step(0.001, idle);
  const body = stationPopulationObjects(flight).find(({ id }) => id === site.id)!;
  expect(body?.enemy?.archetype).toBe("hostileStation");
  expect(flight.hostileStations![site.id]!.defenderIds).toHaveLength(2);
  model.markerTargetDisplayed(body.id);
  expect(model.map!.places.find(({ id }) => id === site.id)).toMatchObject({
    hostileStationStatus: "present",
    label: "Hostile station",
    travel: false,
  });
  const saved = relaunch(CONTENT, model.save());
  expect(saved.state.flight).toEqual(flight);
  const balance = model.state.economy.stardust;
  flight.shots.push({
    damage: 999,
    enemy: false,
    hitIds: [],
    id: "actual-station-hit",
    life: 1,
    piercing: false,
    projectile: "bolt",
    velocity: { x: 0, y: 0 },
    x: body.x,
    y: body.y,
  });
  model.step(0.001, idle);
  expect(model.state.economy.stardust).toBe(balance + 100);
  expect(model.map!.places.find(({ id }) => id === site.id)).toMatchObject({
    hostileStationStatus: "removed",
  });
  model.step(0.001, idle);
  expect(model.state.economy.stardust).toBe(balance + 100);
  expect(stationPopulationObjects(flight).some(({ id }) => id === site.id)).toBe(false);
  const continued = relaunch(CONTENT, model.save());
  expect(continued.state.flight).toEqual(flight);
});

it("leaves world generation and station scheduling paused under an existing card", () => {
  const { flight, model, progress } = atCandidate();
  model.state.dialogue = { choices: [], context: "test", text: "test", title: "test" };
  const before = structuredClone(model.state);
  model.step(1, idle);
  expect(model.state).toEqual(before);
  expect(progress.hostileSites).toBeUndefined();
  expect(flight.hostileStations).toBeUndefined();
});

it("does not claim Phantom space before its required chapter state is initialized", () => {
  const model = new GameModel(CONTENT);
  const progress = model.state.progress[6];
  progress.geography = freshGalaxyGeography(173);
  const flight = createUnpopulatedFlight(CONTENT, 6, 173, model.state.economy, 197);
  const site = hostileStationSites(
    { ...flightWorldContext(flight), galaxy: 6, geographySeed: 173 },
    {
      height: 200000,
      width: 200000,
      x: -100000,
      y: -100000,
    },
  )[0]!;
  flight.player = { x: site.x, y: site.y + CONTENT.tuning.chunkSize };
  populateFlight(CONTENT, progress, flight);
  expect(flight.chunks.length).toBeGreaterThan(0);
  expect(flight.phantom).toBeUndefined();
  const before = structuredClone({ flight, progress });
  materializeGeneratedHostileStations(CONTENT, progress, flight);
  expect({ flight, progress }).toEqual(before);
});
