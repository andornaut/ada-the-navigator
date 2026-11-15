import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { playOpening } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
import type { SpaceObject } from "./types.ts";

function snapshot(retained = false) {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
  playOpening(model);
  const saved = model.saveDocument();
  const definition = enemyDefinition(1, "capital", "guard");
  const enemy = createEnemy(
    definition,
    { archetype: "capital", id: "guard", packId: null, phase: 0.75 },
    { x: 20, y: 30 },
  );
  enemy.age = 12;
  enemy.primaryCooldown = 0.37;
  enemy.hardpoints[0]!.cooldown = 0.61;
  enemy.hardpoints[0]!.burst = 2;
  const object: SpaceObject = {
    enemy,
    hp: definition.hp,
    id: "guard",
    kind: "enemy",
    radius: 30,
    x: 20,
    y: 30,
  };
  saved.flight!.objects = retained ? [] : [object];
  saved.flight!.world.notables = retained ? { guard: object } : {};
  return { enemy, saved };
}

describe("saved equipped enemy levels", () => {
  it.each([undefined, 1, 2, 3])(
    "retains level %s and exact live/retained flight clocks without random draws",
    (level) => {
      for (const retained of [false, true]) {
        const { enemy, saved } = snapshot(retained);
        if (level !== undefined) {
          Object.assign(enemy, { weaponLevel: level });
        }
        const random = vi.spyOn(crypto, "getRandomValues");
        random.mockClear();
        try {
          const restored = restoreSave(saved);
          expect(restored).toEqual(saved);
          expect(restored!.version).toBe(SAVE_VERSION);
          expect(random).not.toHaveBeenCalled();
          expect(restored!.flight).not.toBe(saved.flight);
        } finally {
          random.mockRestore();
        }
      }
    },
  );

  it.each([false, true])("rejects invalid equipped levels in retained=%s enemies", (retained) => {
    const { enemy, saved } = snapshot(retained);
    for (const weaponLevel of [null, 0, 4, 1.5, "2", NaN, Infinity]) {
      Object.assign(enemy, { weaponLevel });
      expect(restoreSave(saved)).toBeNull();
    }
  });

  it("roundtrips independent encounter seed bounds without inserting one in legacy flights", () => {
    const { saved } = snapshot();
    delete saved.flight!.encounterSeed;
    expect(restoreSave(saved)).toEqual(saved);
    expect(Object.hasOwn(restoreSave(saved)!.flight!, "encounterSeed")).toBe(false);
    for (const encounterSeed of [0, 0xffffffff]) {
      Object.assign(saved.flight!, { encounterSeed });
      expect(restoreSave(saved)).toEqual(saved);
    }
  });

  it("rejects malformed encounter seeds without normalizing or changing the geography seed", () => {
    const { saved } = snapshot();
    const seed = saved.flight!.seed;
    for (const encounterSeed of [null, -1, 0x100000000, 0.5, "1", NaN, Infinity]) {
      Object.assign(saved.flight!, { encounterSeed });
      expect(restoreSave(saved)).toBeNull();
      expect(saved.flight!.seed).toBe(seed);
    }
  });
});
