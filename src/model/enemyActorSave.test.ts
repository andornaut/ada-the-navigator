import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import * as profiles from "../data/enemyActorDefinition.ts";
import * as actors from "../data/enemyActors.ts";
import * as catalog from "../data/enemyCatalog.ts";
import { ROUTE } from "../data/galaxies.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./ai/index.ts";
import { GameModel } from "./game.ts";

function fixture() {
  const game = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  game.startGalaxy(1);
  playOpening(game);
  const saved = structuredClone(game.saveDocument());
  const definition = catalog.enemyDefinition(1, "fighter", "actor");
  const enemy = createEnemy(
    definition,
    { archetype: "fighter", id: "actor", packId: null, phase: 0 },
    { x: 20, y: 30 },
  );
  saved.flight!.objects = [
    { enemy, hp: definition.hp, id: "actor", kind: "enemy", radius: 10, x: 20, y: 30 },
  ];
  saved.flight!.world.notables = {};
  return saved;
}

it("rejects unavailable hostile station routes before resolving any enemy profile", () => {
  const base = fixture();
  const profile = vi.spyOn(profiles, "enemyActorDefinition");
  const available = vi.spyOn(actors, "enemyActorAvailable");
  try {
    for (const galaxy of ROUTE) {
      if (actors.enemyActorAvailable(galaxy, "hostileStation")) {
        continue;
      }
      const saved = structuredClone(base);
      saved.selectedGalaxy = galaxy;
      saved.unlocked = [...ROUTE];
      saved.flight!.galaxy = galaxy;
      Object.assign(saved.flight!.objects[0]!.enemy!, { archetype: "hostileStation" });
      profile.mockClear();
      available.mockClear();
      expect(restoreSave(saved)).toBeNull();
      expect(available).toHaveBeenCalledWith(galaxy, "hostileStation");
      expect(profile).not.toHaveBeenCalled();
    }
  } finally {
    profile.mockRestore();
    available.mockRestore();
  }
});

it("rejects an unknown actor and leaves station wrecks outside the seven-ship economy catalog", () => {
  const saved = fixture();
  Object.assign(saved.flight!.objects[0]!.enemy!, { archetype: "unknown" });
  expect(restoreSave(saved)).toBeNull();
  saved.flight!.objects = [
    {
      hp: 1,
      id: "station-wreck",
      kind: "wreck",
      radius: 10,
      wreck: { age: 0, archetype: "fighter", facing: { x: 0, y: -1 } },
      x: 20,
      y: 30,
    },
  ];
  Object.assign(saved.flight!.objects[0]!.wreck!, { archetype: "hostileStation" });
  expect(restoreSave(saved)).toBeNull();
});
