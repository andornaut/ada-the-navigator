import { afterEach, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS, ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { settlementsNear } from "./andromeda/places.ts";
import { fromScreen } from "./convex.ts";
import { enemyStardust } from "./drops.ts";
import { enemyHull } from "./enemyBody.ts";
import {
  createUnpopulatedFlight,
  populateFlight,
  spawnPlannedHostileStation,
} from "./flight/index.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import { hostileStationSites, stationPopulationObjects } from "./hostileStations/index.ts";
import { materializeGeneratedHostileStations } from "./hostileStations/materialization.ts";
import { hostileStationEncounterIds } from "./hostileStations/persistence.ts";
import { planHostileStationFormation } from "./hostileStations/schedule.ts";
import { flightStationContext, worldStationsNear } from "./stations/index.ts";
import type { FlightState } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

const originallyBuilt = BUILT.has(5);
afterEach(() => {
  if (!originallyBuilt) {
    (BUILT as Set<GalaxyNumber>).delete(5);
  }
});
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function atCandidate() {
  (BUILT as Set<GalaxyNumber>).add(5);
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  model.state.progress[5].opened = true;
  model.startGalaxy(5);
  const flight = model.state.flight!;
  const context = flightWorldContext(flight);
  const protection = ECONOMY.station.exclusionRadius + CONTENT.tuning.exclusionRadius;
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
          ["rock", "debris"].includes(actor.kind) || actor.enemy?.packId?.startsWith("pack:"),
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
    travel: true,
  });
  const saved = relaunch(CONTENT, model.save());
  expect(saved.state.flight).toEqual(flight);
  const balance = model.state.economy.stardust;
  const reward = enemyStardust({ id: body.id, seed: flight.seed }, "hostileStation");
  // The Andromeda ring's open center is flyable. Hit one of its solid convex faces.
  const part = enemyHull(body.enemy!, ROUTE_POSITION[flight.galaxy])![0]!;
  const solid = fromScreen(
    part.reduce(
      (point, vertex) => ({
        x: point.x + vertex.x / part.length,
        y: point.y + vertex.y / part.length,
      }),
      { x: 0, y: 0 },
    ),
  );
  flight.shots.push({
    damage: 999,
    enemy: false,
    hitIds: [],
    id: "actual-station-hit",
    life: 1,
    piercing: false,
    projectile: "bolt",
    velocity: { x: 0, y: 0 },
    x: body.x + solid.x,
    y: body.y + solid.y,
  });
  model.step(0.001, idle);
  expect(model.state.economy.stardust).toBe(balance + reward);
  expect(model.map!.places.find(({ id }) => id === site.id)).toMatchObject({
    hostileStationStatus: "removed",
  });
  model.step(0.001, idle);
  expect(model.state.economy.stardust).toBe(balance + reward);
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
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
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
