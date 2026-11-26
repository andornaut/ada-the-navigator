import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function model() {
  const game = new GameModel(CONTENT, supportEntropy);
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
  saved.version = SAVE_VERSION - 1;
  for (const galaxy of GALAXY_NUMBERS) {
    delete saved.progress[galaxy].geography;
  }
  if (saved.flight) {
    delete saved.flight.encounterSeed;
  }
  return saved;
}

it("resets prior-version active and home saves instead of migrating them", () => {
  const game = model();
  expect(restoreSave(game.save())).not.toBeNull();
  const active = legacy(game);
  expect(active.version).toBe(SAVE_VERSION - 1);
  expect(restoreSave(active)).toBeNull();
  game.returnHome();
  const home = legacy(game);
  expect(restoreSave(home)).toBeNull();
  const restarted = relaunch(CONTENT, home);
  expect(restarted.state.flight).toBeNull();
  expect(restarted.state.progress[1].resolved).toBe(false);
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
    endArrivalGrace(first);
    first.objects = [{ ...first.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
    game.step(0.1, idle);
    expect(game.state.flight).toBeNull();
    expect(game.state.progress[1].geography).toEqual(geography);
    game.startGalaxy(1);
    expect(game.state.flight!.seed).toBe(first.seed);
    expect(flightEncounterSeed(game.state.flight!)).not.toBe(flightEncounterSeed(first));
    game.backToTitle();
    game.restart();
    expect(game.state.progress[1].geography).toBeUndefined();
    expect(game.state.progress[1].resolved).toBe(false);
    game.startGalaxy(1);
    expect(game.state.progress[1].geography).not.toEqual(geography);
    expect(game.state.flight!.seed).not.toBe(first.seed);
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
    const resumed = new GameModel(CONTENT, supportEntropy, game.save());
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
