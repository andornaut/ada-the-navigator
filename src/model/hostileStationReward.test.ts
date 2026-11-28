import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { fromScreen } from "./convex.ts";
import { enemyStardust, rollHeavyDefeatUpgrade } from "./drops.ts";
import { enemyHull } from "./enemyBody.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation, stepFlight } from "./flight/index.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import { hostileStationSites } from "./hostileStations/index.ts";
import {
  hostileStationEncounterIds,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./hostileStations/persistence.ts";
import { queueHostileStationReward } from "./hostileStations/reward.ts";
import { planHostileStationFormation } from "./hostileStations/schedule.ts";
import type { FlightEvent } from "./types.ts";
import { flightWorldContext } from "./world/index.ts";

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

function setRewardRoll(
  body: ReturnType<typeof fixture>["body"],
  flight: ReturnType<typeof fixture>["flight"],
  upgrade: boolean,
): void {
  while (
    rollHeavyDefeatUpgrade(ECONOMY, { id: body.id, seed: flight.seed }, "hostileStation") !==
    upgrade
  ) {
    flight.seed++;
  }
}

it("claims the authoritative destroyed station once before a queued depletion", () => {
  const { body, flight } = fixture();
  setRewardRoll(body, flight, false);
  body.hp = body.enemy!.hp = 0;
  const events: FlightEvent[] = [{ amount: 3, type: "stardust" }, { type: "depleted" }];
  queueHostileStationReward(flight, events, body, CONTENT);
  expect(events).toEqual([
    { amount: 3, type: "stardust" },
    {
      amount: enemyStardust({ id: body.id, seed: flight.seed }, "hostileStation"),
      type: "stardust",
    },
    { type: "depleted" },
  ]);
  queueHostileStationReward(flight, events, body, CONTENT);
  expect(events).toHaveLength(3);
  const resumed = structuredClone(flight);
  queueHostileStationReward(
    resumed,
    events,
    resumed.objects.find(({ id }) => id === body.id)!,
    CONTENT,
  );
  expect(events).toHaveLength(3);
});

it("does not claim from an active station, detached copy or missing body", () => {
  const { body, flight } = fixture();
  const events: FlightEvent[] = [];
  queueHostileStationReward(flight, events, body, CONTENT);
  body.enemy!.disabled = true;
  queueHostileStationReward(flight, events, body, CONTENT);
  body.hp = body.enemy!.hp = 0;
  queueHostileStationReward(flight, events, structuredClone(body), CONTENT);
  expect(events).toEqual([]);
  flight.objects = flight.objects.filter(({ id }) => id !== body.id);
  queueHostileStationReward(flight, events, body, CONTENT);
  expect(events).toEqual([]);
});

it("emits the existing Stardust event from real station hull destruction before cleanup", () => {
  const { body, flight } = fixture();
  setRewardRoll(body, flight, false);
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
    id: "station-hull-hit",
    life: 1,
    piercing: false,
    projectile: "bolt",
    velocity: { x: 0, y: 0 },
    x: body.x + solid.x,
    y: body.y + solid.y,
  });
  const events = stepFlight(
    CONTENT,
    0.001,
    {
      aim: { x: 0, y: 0 },
      move: { x: 0, y: 0 },
      use: false,
    },
    flight,
  );
  expect(events).toContainEqual({ id: body.id, type: "enemyDestroyed" });
  expect(events.filter(({ type }) => type === "stardust")).toEqual([
    {
      amount: enemyStardust({ id: body.id, seed: flight.seed }, "hostileStation"),
      type: "stardust",
    },
  ]);
  expect(flight.hostileStations![body.id]!.rewarded).toBe(true);
  expect(flight.objects.some(({ id }) => id === `wreck:${body.id}`)).toBe(false);
});

it("replaces a hostile station's full reward with one upgrade and respects old paid states", () => {
  const { body, flight } = fixture();
  setRewardRoll(body, flight, true);
  body.hp = body.enemy!.hp = 0;
  const events: FlightEvent[] = [];
  queueHostileStationReward(flight, events, body, CONTENT);
  expect(events).toEqual([]);
  expect(flight.objects.filter(({ upgrade }) => upgrade)).toHaveLength(1);
  const continued = structuredClone(flight);
  const sameBody = continued.objects.find(({ id }) => id === body.id)!;
  queueHostileStationReward(continued, events, sameBody, CONTENT);
  expect(continued.objects.filter(({ upgrade }) => upgrade)).toHaveLength(1);
  expect(events).toEqual([]);
});
