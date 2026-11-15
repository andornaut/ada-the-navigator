import { expect, it } from "vitest";

import { enemyActorAvailable, isEnemyActorKind, shipCatalogEntry } from "./enemyActors.ts";
import { type EnemyArchetype, enemyCatalog } from "./enemyCatalog.ts";
import { ROUTE } from "./galaxies.ts";

it("recognizes the station actor without adding an economy-bearing ship type", () => {
  const keys = Object.keys(enemyCatalog);
  expect(isEnemyActorKind("hostileStation")).toBe(true);
  expect(shipCatalogEntry("hostileStation")).toBeUndefined();
  for (const [key, definition] of Object.entries(enemyCatalog)) {
    expect(isEnemyActorKind(key)).toBe(true);
    if (isEnemyActorKind(key)) {
      expect(shipCatalogEntry(key)).toBe(definition);
    }
  }
  for (const invalid of [
    null,
    undefined,
    1,
    {},
    "",
    "constructor",
    "__proto__",
    "hostile-station",
  ]) {
    expect(isEnemyActorKind(invalid)).toBe(false);
  }
  expect(Object.keys(enemyCatalog)).toEqual(keys);
  expect(Object.hasOwn(enemyCatalog, "hostileStation")).toBe(false);
});

it("admits station definitions only in Andromeda, Cartwheel and Phantom through route order", () => {
  expect(ROUTE.map((galaxy) => enemyActorAvailable(galaxy, "hostileStation"))).toEqual([
    false,
    false,
    false,
    true,
    true,
    true,
  ]);
  expect(enemyActorAvailable(2, "hostileStation")).toBe(true);
  expect(enemyActorAvailable(3, "hostileStation")).toBe(false);
});

it("preserves existing ship definition availability without choosing any placement or density", () => {
  for (const kind of Object.keys(enemyCatalog) as EnemyArchetype[]) {
    expect(ROUTE.every((galaxy) => enemyActorAvailable(galaxy, kind))).toBe(true);
  }
});
