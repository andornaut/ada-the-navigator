import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { fromScreen } from "./convex.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyHull } from "./enemyBody.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation, stepFlight } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { freshGalaxyGeography } from "./galaxyGeography.ts";
import { GameModel } from "./game.ts";
import {
  hostileStationEncounterIds,
  registerHostileStationEncounter,
  rememberHostileStationSite,
} from "./hostileStationPersistence.ts";
import { queueHostileStationReward } from "./hostileStationReward.ts";
import { planHostileStationFormation } from "./hostileStationSchedule.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import type { FlightEvent } from "./types.ts";

function fixture() {
  const model = new GameModel(CONTENT);
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

function disable(
  body: ReturnType<typeof fixture>["body"],
  flight: ReturnType<typeof fixture>["flight"],
): void {
  const definition = enemyEquipmentDefinition(flight.galaxy, body.enemy!);
  for (const part of body.enemy!.hardpoints) {
    body.enemy = damageEnemy(definition, { amount: 999, hardpointId: part.id }, body.enemy!);
  }
  expect(body.enemy!.disabled).toBe(true);
}

it("claims the authoritative disabled station once before a queued depletion", () => {
  const { body, flight } = fixture();
  disable(body, flight);
  const events: FlightEvent[] = [{ amount: 3, type: "stardust" }, { type: "depleted" }];
  queueHostileStationReward(flight, events, body);
  expect(events).toEqual([
    { amount: 3, type: "stardust" },
    { amount: 100, type: "stardust" },
    { type: "depleted" },
  ]);
  queueHostileStationReward(flight, events, body);
  expect(events).toHaveLength(3);
  const resumed = structuredClone(flight);
  queueHostileStationReward(
    resumed,
    events,
    resumed.objects.find(({ id }) => id === body.id)!,
  );
  expect(events).toHaveLength(3);
});

it("does not claim from an active station, detached copy or missing body", () => {
  const { body, flight } = fixture();
  const events: FlightEvent[] = [];
  queueHostileStationReward(flight, events, body);
  disable(body, flight);
  queueHostileStationReward(flight, events, structuredClone(body));
  expect(events).toEqual([]);
  flight.objects = flight.objects.filter(({ id }) => id !== body.id);
  queueHostileStationReward(flight, events, body);
  expect(events).toEqual([]);
});

it("emits the existing Stardust event from real station hull destruction before cleanup", () => {
  const { body, flight } = fixture();
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
    { amount: 100, type: "stardust" },
  ]);
  expect(flight.hostileStations![body.id]!.rewarded).toBe(true);
  expect(flight.objects.some(({ id }) => id === `wreck:${body.id}`)).toBe(false);
});
