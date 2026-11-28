import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import {
  enemyAssetKey,
  enemyGeometryKey,
  HULL_DESIGNS,
  PHANTOM_FLAGSHIP_ID,
} from "../data/enemyIdentity.ts";
import { MUZZLE_ART, muzzleArtForDefinition } from "../data/enemyMuzzles.ts";
import { GALAXY_ID, ROUTE_POSITION } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { restoreGameSave, SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { createEnemy } from "./ai/index.ts";
import { enemyHull, enemyPhysicalBody } from "./enemyBody.ts";
import { GameModel } from "./game.ts";

const home = { x: 5000, y: -5000 };

it.each([
  ["frigate", "narrow"],
  ["frigate", "compact"],
  ["capital", "narrow"],
  ["capital", "compact"],
] as const)("draws a saved %s %s profile as its class's stock hull", (archetype, hullProfile) => {
  const id = "ordinary:heavy:0";
  const stock = enemyDefinition(1, archetype, id);
  expect(enemyDefinition(1, archetype, id, 1, hullProfile)).toEqual(stock);
  const identity = { archetype, id, packId: null, phase: 0 };
  const actor = createEnemy(stock, { ...identity, hullProfile }, home);
  const defaultActor = createEnemy(stock, identity, home);
  expect(enemyAssetKey(actor)).toBe(archetype);
  expect(enemyGeometryKey(actor)).toBe(archetype);
  expect(enemyHull(actor)).toEqual(enemyHull(defaultActor));
  expect(enemyPhysicalBody(1, actor)).toEqual(enemyPhysicalBody(1, defaultActor));
});

it("restores explicit actors and wrecks in v14 while absent profiles keep stock identity", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const saved = model.saveDocument();
  expect(saved.version).toBe(14);
  const flight = saved.flight!;
  const archetype = "frigate";
  const hullProfile = "compact";
  const identity = { archetype, id: "ordinary:saved", packId: null, phase: 0 } as const;
  const actor = createEnemy(
    enemyDefinition(1, archetype, identity.id, 1, hullProfile),
    { ...identity, hullProfile },
    home,
  );
  flight.objects.push(
    { ...home, enemy: actor, hp: actor.hp, id: actor.id, kind: "enemy", radius: 40 },
    {
      ...home,
      hp: 1,
      id: "wreck:ordinary:wrecked",
      kind: "wreck",
      radius: 40,
      wreck: { age: 0, archetype, facing: actor.facing, hullProfile },
    },
  );
  const restored = restoreGameSave(CONTENT, saved);
  expect(restored?.flight?.objects.slice(-2)).toEqual(flight.objects.slice(-2));

  const stock = structuredClone(saved);
  stock.flight!.objects.at(-2)!.enemy = createEnemy(
    enemyDefinition(1, archetype, identity.id),
    identity,
    home,
  );
  const stockRead = restoreGameSave(CONTENT, stock)?.flight?.objects.at(-2)?.enemy;
  expect(stockRead?.hullProfile).toBeUndefined();
  expect(enemyAssetKey(stockRead!)).toBe("frigate");

  const invalid = structuredClone(saved);
  Object.assign(invalid.flight!.objects.at(-1)!.wreck!, { hullProfile: "giant" });
  expect(restoreGameSave(CONTENT, invalid)).toBeNull();
});

it("rejects a profile ledger for aliased, unrepresented or nonordinary pack IDs", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const saved = model.saveDocument();
  const flight = saved.flight!;
  const combat = (flight.combat ??= { initialPackSizes: {}, routeEncounters: [] });
  combat.initialPackSizes["pack:0,0"] = 1;
  combat.profiledPacks = { "pack:0,0": "capital" };
  expect(restoreGameSave(CONTENT, saved)?.flight?.combat?.profiledPacks).toEqual(
    combat.profiledPacks,
  );
  for (const id of ["pack:00,0", "pack:1000,0", "route:growers", "pack:0,0:escorts", "pack:1,1"]) {
    const invalid = structuredClone(saved);
    const state = invalid.flight!.combat!;
    if (id !== "pack:1,1") {
      state.initialPackSizes[id] = 1;
    }
    state.profiledPacks = { [id]: "capital" };
    expect(restoreGameSave(CONTENT, invalid)).toBeNull();
  }
});

it.each([
  [1, "frigate", "capital"],
  [2, "frigate", "capitalOutrigger"],
  [3, "frigateTwin", "capitalManta"],
  [4, "frigateTwin", "capitalCrossbow"],
  [5, "frigateTwin", "capitalBroad"],
  [6, "frigate", "capitalForked"],
] as const)("flies galaxy %i's frigates as %s and capitals as %s", (galaxy, frigate, capital) => {
  const position = ROUTE_POSITION[galaxy as GalaxyNumber];
  for (const [archetype, key] of [
    ["frigate", frigate],
    ["capital", capital],
  ] as const) {
    const id = `ordinary:${archetype}:0`;
    const definition = enemyDefinition(galaxy, archetype, id);
    expect(definition.assetKey).toBe(key);
    expect(muzzleArtForDefinition(definition)).toBe(MUZZLE_ART[key]);
    expect(MUZZLE_ART[key]).toBeDefined();
    expect(enemyGeometryKey({ archetype, id }, position)).toBe(key);
    expect(HULL_DESIGNS[archetype][GALAXY_ID[galaxy as GalaxyNumber]] ?? archetype).toBe(key);
  }
  // Admiral Archie's flagship keeps its own design in Phantom.
  expect(enemyGeometryKey({ archetype: "capital", id: PHANTOM_FLAGSHIP_ID }, position)).toBe(
    "archie",
  );
});

it("draws each galaxy's frigate and capital design with its own hull", () => {
  const facing = { x: 1, y: 0 };
  const hulls = [1, 2, 3, 4, 5, 6].map((galaxy) =>
    JSON.stringify(
      enemyHull(
        { archetype: "capital", facing, id: "ordinary:capital:0" },
        ROUTE_POSITION[galaxy as GalaxyNumber],
      ),
    ),
  );
  expect(new Set(hulls).size).toBe(6);
  const frigate = (galaxy: GalaxyNumber) =>
    enemyHull({ archetype: "frigate", facing, id: "ordinary:frigate:0" }, ROUTE_POSITION[galaxy]);
  expect(frigate(3)).toEqual(frigate(5));
  expect(frigate(1)).toEqual(frigate(2));
  expect(frigate(1)).not.toEqual(frigate(3));
});

it("rolls the Manta gunship, Cargo Hauler and Mining Freighter with equal weight", () => {
  const ids = Array.from(
    { length: 6000 },
    (_, index) => `pack:${index % 97},${index}:${index % 5}`,
  );
  const counts = new Map<string, number>();
  for (const id of ids) {
    const key = enemyAssetKey({ archetype: "retaliator", id });
    expect(enemyAssetKey({ archetype: "retaliator", id })).toBe(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.keys()].sort()).toEqual([
    "retaliator",
    "retaliatorCargoHauler",
    "retaliatorMiningFreighter",
  ]);
  for (const count of counts.values()) {
    expect(count / ids.length).toBeCloseTo(1 / 3, 1);
  }
  // A retaliator without an id flies the Manta gunship.
  expect(enemyAssetKey({ archetype: "retaliator" })).toBe("retaliator");
});
