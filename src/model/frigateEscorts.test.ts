import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { SPAWNER_POLICIES, SPAWNER_REGIONS } from "../data/spawnerCatalog.ts";
import { createEnemy, stepEnemy } from "./enemyAi.ts";
import {
  createFlight,
  createUnpopulatedFlight,
  ensureRouteEncounter,
  routeBlocked,
  spawnChapterEnemy,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { recordObjectRemoval } from "./geography.ts";
import { newProgress } from "./progress.ts";
import { restoreSave } from "./save.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const followers = (objects: readonly SpaceObject[], id: string) =>
  objects.filter((object) => object.enemy?.escortOf === id);

it("creates two required escorts once and keeps the frigate as the only route blocker", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 231);
  const site: SpaceObject = {
    hp: 1,
    id: "quest",
    kind: "destination",
    radius: 30,
    x: SPAWNER_REGIONS.centerDistances[2] + SPAWNER_POLICIES[1].localRadius * 2,
    y: 0,
  };
  flight.objects.push(site);
  const leader = ensureRouteEncounter(CONTENT, "quest", flight)!;
  const escort = followers(flight.objects, leader.id);
  expect(escort).toHaveLength(2);
  expect(escort.every((object) => object.persistent && object.enemy?.archetype === "fighter")).toBe(
    true,
  );
  expect(escort.every((object) => object.routeId === undefined)).toBe(true);
  expect(routeBlocked(site.id, flight)).toBe(true);
  expect(ensureRouteEncounter(CONTENT, "quest", flight)).toBe(leader);
  expect(followers(flight.objects, leader.id).map((object) => object.id)).toEqual(
    escort.map((object) => object.id),
  );
  const home = { ...leader.enemy!.home };
  flight.player = { x: site.x, y: site.y };
  expect(stepFlight(CONTENT, 0.001, idle, flight)).toContainEqual({
    id: site.id,
    type: "guardCue",
  });
  for (const member of [leader, ...escort]) {
    expect(flight.objects.find((object) => object.id === member.id)).toBe(member);
    expect(flight.summonedGuards ?? []).not.toContain(member.id);
  }
  expect(leader.enemy!.home).toEqual(home);
  expect(followers(flight.objects, leader.id).map((object) => object.id)).toEqual(
    escort.map((object) => object.id),
  );
  leader.enemy!.disabled = true;
  expect(routeBlocked(site.id, flight)).toBe(false);
});

it("retains exact required followers through saving, region reentry and a casualty", () => {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.startGalaxy(1);
  const flight = model.state.flight!;
  flight.objects = [];
  const point = { x: 40000, y: 40000 };
  const leader = spawnChapterEnemy(CONTENT, "frigate", "chapter:frigate", point, flight)!;
  const escort = followers(flight.objects, leader.id);
  expect(escort).toHaveLength(2);
  escort[0]!.hp = 0;
  escort[0]!.enemy!.hp = 0;
  recordObjectRemoval(CONTENT, escort[0]!, flight);
  flight.objects = flight.objects.filter((object) => object.id !== escort[0]!.id);
  escort[1]!.enemy!.hp = 1;
  escort[1]!.hp = 1;
  syncFlightRegion(CONTENT, flight);
  expect(flight.world.notables[escort[1]!.id]?.enemy?.hp).toBe(1);
  const snapshot = model.saveDocument();
  const restored = restoreSave(JSON.stringify(snapshot));
  expect(restored).toEqual(snapshot);
  const loaded = restored!.flight!;
  expect(spawnChapterEnemy(CONTENT, "frigate", leader.id, point, loaded)?.id).toBe(leader.id);
  expect(followers(loaded.objects, leader.id)).toHaveLength(1);
  expect(followers(loaded.objects, leader.id)[0]!.enemy!.hp).toBe(1);
  expect(loaded.world.notables[escort[0]!.id]).toBeNull();
});

it("places each ambient frigate with its full two-fighter escort", () => {
  const point = { x: 30000, y: 0 };
  let seen = 0;
  for (let seed = 0; seed < 12; seed++) {
    const flight = createFlight(CONTENT, 6, seed, newProgress());
    flight.player = point;
    stepFlight(CONTENT, 0.001, idle, flight);
    for (const leader of flight.objects.filter(
      (object) => object.enemy?.archetype === "frigate" && object.enemy.packId?.startsWith("pack:"),
    )) {
      const escort = followers(flight.objects, leader.id);
      expect(escort).toHaveLength(2);
      expect(escort.every((object) => object.enemy?.archetype === "fighter")).toBe(true);
      seen++;
    }
  }
  expect(seen).toBeGreaterThan(0);
});

it("uses the existing fallback when the escort leader is disabled", () => {
  const flight = createFlight(CONTENT, 1, 232, newProgress());
  flight.objects = [];
  const leader = spawnChapterEnemy(
    CONTENT,
    "frigate",
    "chapter:fallback",
    { x: 300, y: 0 },
    flight,
  )!;
  const escort = followers(flight.objects, leader.id)[0]!.enemy!;
  const definition = enemyDefinition(1, "fighter", escort.id);
  escort.engaged = true;
  const context = {
    adaWidth: 20,
    dt: 0.01,
    inPlayView: true,
    initialPackSizes: {},
    lead: 0,
    peers: [],
    player: { x: 0, y: 0 },
    playerVelocity: { x: 0, y: 0 },
    targetable: true,
    visibility: "visible" as const,
  };
  const disabled = { ...leader.enemy!, disabled: true };
  const absent = stepEnemy(definition, context, escort);
  expect(stepEnemy(definition, { ...context, peers: [disabled] }, escort)).toEqual(absent);
  expect(absent.state.velocity).not.toEqual({ x: 0, y: 0 });
});

it("does not retrofit or reroll an existing legacy frigate when reopening its chapter", () => {
  const flight = createFlight(CONTENT, 1, 233, newProgress());
  const definition = enemyDefinition(1, "frigate", "legacy");
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "legacy", packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
  const legacy: SpaceObject = {
    enemy,
    hp: enemy.hp,
    id: "legacy",
    kind: "enemy",
    persistent: true,
    radius: 40,
    x: 0,
    y: 0,
  };
  flight.objects = [legacy];
  expect(spawnChapterEnemy(CONTENT, "frigate", "legacy", legacy, flight)).toBe(legacy);
  expect(followers(flight.objects, legacy.id)).toEqual([]);
});
