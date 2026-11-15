import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import {
  type EnemyArchetype,
  enemyCatalog,
  enemyOnly,
  PHANTOM_FLAGSHIP_ID,
} from "../data/enemyCatalog.ts";
import { enemyEquipmentDefinition, rollEnemyWeaponLevel } from "./enemyEquipment.ts";
import { createFlight, spawnChapterEnemy } from "./flight.ts";
import { GameModel } from "./game.ts";
import { newProgress } from "./progress.ts";
import { restoreSave } from "./save.ts";

const enter = (encounterSeed: number) =>
  createFlight(CONTENT, 6, 77, newProgress(), undefined, encounterSeed);

it("resolves one equipped roll through real enemy and mandatory escort producers", () => {
  const flight = enter(71);
  for (const [index, kind] of (Object.keys(enemyCatalog) as EnemyArchetype[]).entries()) {
    const id = kind === "capital" ? PHANTOM_FLAGSHIP_ID : `equipment:${kind}`;
    const actor = spawnChapterEnemy(
      CONTENT,
      kind,
      id,
      { x: 10000 + index * 1000, y: 1200 },
      flight,
    )!;
    expect(spawnChapterEnemy(CONTENT, kind, id, actor, flight)).toBe(actor);
    expect(actor.enemy!.weaponLevel).toBe(
      rollEnemyWeaponLevel({ encounterSeed: 71, galaxy: 6 }, id),
    );
  }
  const frigate = flight.objects.find((object) => object.id === "equipment:frigate")!;
  const escorts = flight.objects.filter((object) => object.enemy?.escortOf === frigate.id);
  expect(escorts).toHaveLength(2);
  for (const object of flight.objects.filter((object) => object.enemy)) {
    const enemy = object.enemy!;
    expect([2, 3]).toContain(enemy.weaponLevel);
    const definition = enemyEquipmentDefinition(flight.galaxy, enemy);
    expect(definition.fire.level).toBe(enemyOnly(definition.fire.weapon) ? 1 : enemy.weaponLevel);
    for (const part of definition.hardpoints) {
      if (part.kind === "weapon") {
        expect(part.fire.level).toBe(enemyOnly(part.fire.weapon) ? 1 : enemy.weaponLevel);
      }
    }
  }
});

it("rerolls fresh-entry equipment independently of unchanged geography", () => {
  const first = enter(71);
  const next = enter(72);
  const sites = (flight: typeof first) =>
    flight.objects
      .filter((object) => object.kind !== "enemy")
      .map(({ id, x, y }) => ({ id, x, y }));
  expect(first.seed).toBe(next.seed);
  expect(sites(first)).toEqual(sites(next));
  const id = Array.from({ length: 16 }, (_, index) => `equipment:${index}`).find(
    (id) =>
      rollEnemyWeaponLevel({ encounterSeed: 71, galaxy: 6 }, id) !==
      rollEnemyWeaponLevel({ encounterSeed: 72, galaxy: 6 }, id),
  )!;
  expect(id).toBeDefined();
  const a = spawnChapterEnemy(CONTENT, "fighter", id, { x: 6000, y: 1200 }, first)!;
  const b = spawnChapterEnemy(CONTENT, "fighter", id, { x: 6000, y: 1200 }, next)!;
  expect(a.enemy!.weaponLevel).not.toBe(b.enemy!.weaponLevel);
});

it("preserves spawned equipment and exact combat clocks through save and actual Continue", () => {
  const model = new GameModel(CONTENT);
  model.state.unlocked = [1, 6];
  model.startGalaxy(6);
  const flight = model.state.flight!;
  const actor = spawnChapterEnemy(
    CONTENT,
    "platform",
    "equipment:resume",
    { x: 6000, y: 1200 },
    flight,
  )!;
  actor.enemy!.age = 12;
  actor.enemy!.primaryCooldown = 0.37;
  const pending = actor.enemy!.hardpoints.find((part) => part.id === "port")!;
  pending.cooldown = 0.061;
  pending.burst = 1;
  const saved = model.save();
  const expected = restoreSave(saved)!.flight!;
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const resumed = new GameModel(CONTENT, saved);
    resumed.continueGame();
    expect(resumed.state.flight).toEqual(expected);
    expect(random).not.toHaveBeenCalled();
    expect(enemyEquipmentDefinition(6, actor.enemy!)).toBe(
      enemyEquipmentDefinition(
        6,
        resumed.state.flight!.objects.find((object) => object.id === actor.id)!.enemy!,
      ),
    );
  } finally {
    random.mockRestore();
  }
});
