import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { relaunch } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
import { flightStationContext, stationsNear, worldStationById } from "./stations.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function model() {
  const game = new GameModel(CONTENT);
  game.state.prologueSeen = true;
  game.state.progress[1].opened = true;
  game.state.progress[1].introduced = true;
  game.state.progress[1].questComplete = true;
  game.state.progress[1].resolved = true;
  game.startGalaxy(1);
  game.state.dialogue = null;
  return game;
}
function legacy(game: GameModel) {
  const saved = JSON.parse(game.save());
  saved.version = 12;
  for (const galaxy of GALAXY_NUMBERS) {
    delete saved.progress[galaxy].geography;
  }
  if (saved.flight) {
    delete saved.flight.encounterSeed;
  }
  return saved;
}

it("migrates an active v12 save without changing its flight, coordinates, clocks or story", () => {
  const game = model();
  const saved = legacy(game);
  saved.flight.time = 12.5;
  const before = structuredClone(saved);
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const restored = restoreSave(saved)!;
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.flight).toEqual(before.flight);
    expect(restored.progress[1]).toEqual({
      ...before.progress[1],
      geography: { seed: before.flight.seed, sitePolicy: "legacy-fixed", version: 1 },
    });
    expect(restored.progress[3].geography).toEqual({
      seed: null,
      sitePolicy: "legacy-fixed",
      version: 1,
    });
    expect(saved).toEqual(before);
    expect(random).not.toHaveBeenCalled();
    const continued = relaunch(CONTENT, saved);
    expect(continued.state.flight).toEqual(before.flight);
  } finally {
    random.mockRestore();
  }
});

it("migrates home charts with legacy fixed stations and initializes missing procedural history once", () => {
  const game = model();
  const site = stationsNear(ECONOMY, 1, 12000, { x: 0, y: 0 })[0]!;
  expect(site).toBeDefined();
  game.state.progress[1].stations.push(site.id);
  game.returnHome();
  const saved = legacy(game);
  const charts = structuredClone(saved.progress[1]);
  const restored = restoreSave(saved)!;
  expect(restored.flight).toBeNull();
  expect(restored.progress[1]).toEqual({
    ...charts,
    geography: { seed: null, sitePolicy: "legacy-fixed", version: 1 },
  });
  const resumed = new GameModel(CONTENT, saved);
  resumed.startGalaxy(1);
  const first = resumed.state.flight!;
  expect(worldStationById(flightStationContext(first), ECONOMY, 1, site.id)).toEqual(site);
  const seed = first.seed;
  resumed.returnHome();
  resumed.startGalaxy(1);
  expect(resumed.state.flight!.seed).toBe(seed);
  expect(resumed.state.progress[1].resolved).toBe(true);
});

describe("persistent geography fresh entry", () => {
  it("keeps map/path/story/geography across Earth while clearing all retained combat state", () => {
    const game = model();
    const before = game.state.flight!;
    game.state.progress[1].known.push("growers");
    const chart = structuredClone(game.state.progress[1]);
    const mapped = game.map!.mapped;
    const enemy = createEnemy(
      enemyDefinition(1, "fighter"),
      { archetype: "fighter", id: "old-enemy", packId: null, phase: 0.5 },
      { x: 200, y: 200 },
    );
    enemy.hp = 0.5;
    const object: SpaceObject = {
      enemy,
      hp: 0.5,
      id: "old-enemy",
      kind: "enemy",
      radius: 20,
      x: 200,
      y: 200,
    };
    before.objects.push(object);
    before.world.notables[object.id] = object;
    before.world.notables["dead-enemy"] = null;
    before.combat = {
      initialPackSizes: { "old-pack": 4 },
      routeEncounters: [],
      unloadedPackMembers: { "old-pack": 2 },
    };
    const identity = flightEncounterSeed(before);
    game.returnHome();
    expect(game.state.flight).toBeNull();
    game.startGalaxy(1);
    const after = game.state.flight!;
    expect(after.seed).toBe(before.seed);
    expect(flightEncounterSeed(after)).not.toBe(identity);
    expect(game.state.progress[1]).toEqual(chart);
    expect(game.map!.mapped).toBe(mapped);
    expect(after.objects.some((object) => object.id === "old-enemy")).toBe(false);
    expect(Object.hasOwn(after.world.notables, "old-enemy")).toBe(false);
    expect(Object.hasOwn(after.world.notables, "dead-enemy")).toBe(false);
    expect(after.combat?.initialPackSizes["old-pack"]).toBeUndefined();
    expect(after.combat?.unloadedPackMembers?.["old-pack"]).toBeUndefined();
    expect(after.freshDistance).toBe(0);
  });

  it("keeps geography across shield depletion and gets fresh geography only on Restart", () => {
    const game = model();
    const first = game.state.flight!;
    const geography = structuredClone(game.state.progress[1].geography);
    first.shield = CONTENT.tuning.hazardDamage;
    first.objects = [{ ...first.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
    game.step(0.1, idle);
    expect(game.state.flight).toBeNull();
    expect(game.state.progress[1].geography).toEqual(geography);
    game.startGalaxy(1);
    expect(game.state.flight!.seed).toBe(first.seed);
    expect(flightEncounterSeed(game.state.flight!)).not.toBe(flightEncounterSeed(first));
    game.backToTitle();
    game.restart();
    expect(game.state.progress[1].geography).not.toEqual(geography);
    expect(game.state.progress[1].resolved).toBe(false);
  });

  it("keeps separate galaxy charts through travel and serialized home reentry", () => {
    const game = model();
    game.state.unlocked = [1, 3];
    const first = game.state.flight!;
    const chart = structuredClone(game.state.progress[1]);
    game.returnHome();
    game.startGalaxy(3);
    const second = game.state.flight!;
    expect(second.seed).not.toBe(first.seed);
    expect(second.seed).toBe(game.state.progress[3].geography!.seed);
    game.returnHome();
    const resumed = new GameModel(CONTENT, game.save());
    resumed.startGalaxy(1);
    expect(resumed.state.flight!.seed).toBe(first.seed);
    expect(resumed.state.progress[1]).toEqual(chart);
    expect(flightEncounterSeed(resumed.state.flight!)).not.toBe(flightEncounterSeed(first));
    resumed.returnHome();
    resumed.startGalaxy(3);
    expect(resumed.state.flight!.seed).toBe(second.seed);
  });

  it("rejects forged prior-format geography and malformed new generation policies", () => {
    const game = model();
    const forged = legacy(game);
    forged.progress[1].geography = { seed: 9, sitePolicy: "seeded", version: 1 };
    expect(restoreSave(forged)).toBeNull();
    for (const geography of [
      { seed: null, sitePolicy: "seeded", version: 1 },
      { seed: -1, sitePolicy: "legacy-fixed", version: 1 },
      { seed: 1, sitePolicy: "seeded", version: 2 },
    ]) {
      const saved = JSON.parse(game.save());
      saved.progress[1].geography = geography;
      expect(restoreSave(saved)).toBeNull();
    }
  });
});
