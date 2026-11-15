import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import * as profiles from "../data/enemyActorDefinition.ts";
import { ROUTE } from "../data/galaxies.ts";
import { SWARM_GROUP_MINIMUM } from "../data/spawnerCatalog.ts";
import { playOpening } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import {
  escortPackId,
  worldRecordObjectRemoval,
  worldRetainedPackMembers,
  worldSyncFlightRegion,
} from "./geography.ts";
import { restoreSave } from "./save.ts";
import type { SpaceObject } from "./types.ts";

function fixture() {
  const game = new GameModel(CONTENT);
  game.state.unlocked = [...ROUTE];
  game.startGalaxy(2);
  playOpening(game);
  const saved = structuredClone(game.saveDocument());
  const flight = saved.flight!;
  const pack = "hostile-station:planned";
  const defenders = escortPackId(pack);
  const definition = profiles.enemyActorDefinition(2, "hostileStation", "planned", 3);
  const state = createEnemy(
    definition,
    { archetype: "platform", id: "planned", packId: pack, phase: 0.75, weaponLevel: 3 },
    { x: 20000, y: 20000 },
  );
  Object.assign(state, { archetype: "hostileStation" });
  state.age = 12;
  state.primaryCooldown = 0.37;
  state.firePhasesInitialized = true;
  state.hardpoints[0]!.cooldown = 0.061;
  state.hardpoints[0]!.burst = 1;
  const station: SpaceObject = {
    enemy: state,
    hp: definition.hp,
    id: state.id,
    kind: "enemy",
    persistent: true,
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    x: 20000,
    y: 20000,
  };
  const actors = [
    station,
    ...Array.from({ length: SWARM_GROUP_MINIMUM }, (_, index): SpaceObject => {
      const id = `planned:defender:${index}`;
      const point = { x: 20300 + index * 100, y: 20000 };
      const profile = profiles.enemyActorDefinition(2, "swarm", id, 3);
      const enemy = createEnemy(
        profile,
        { archetype: "swarm", id, packId: defenders, phase: 0.5, weaponLevel: 3 },
        point,
      );
      enemy.primaryCooldown = 0.19;
      return { ...point, enemy, hp: profile.hp, id, kind: "enemy", persistent: true, radius: 10 };
    }),
  ];
  flight.objects = actors;
  flight.world.notables = {};
  flight.combat = {
    initialPackSizes: { [defenders]: SWARM_GROUP_MINIMUM, [pack]: 1 },
    routeEncounters: [],
  };
  return { actors, defenders, flight, pack, saved, station };
}

it("pages a station and defenders through Continue once with exact clocks and bursts", () => {
  const { actors, defenders, flight, pack, saved, station } = fixture();
  expect(restoreSave(saved)).toEqual(saved);
  const before = structuredClone(actors);
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.objects).toEqual([]);
  expect(Object.values(flight.world.notables)).toEqual(before);
  expect(worldRetainedPackMembers({}, CONTENT, flight)).toEqual({
    [defenders]: SWARM_GROUP_MINIMUM,
    [pack]: 1,
  });
  expect(flight.combat!.unloadedPackMembers).toBeUndefined();
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const resumed = new GameModel(CONTENT, saved);
    resumed.continueGame();
    const continued = resumed.state.flight!;
    expect(continued).toEqual(flight);
    expect(random).not.toHaveBeenCalled();
    continued.player = { x: station.x, y: station.y };
    worldSyncFlightRegion({}, CONTENT, continued);
    worldSyncFlightRegion({}, CONTENT, continued);
    expect([...continued.objects].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...before].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(continued.world.notables).toEqual({});
    expect(new Set(continued.objects.map(({ id }) => id)).size).toBe(before.length);
  } finally {
    random.mockRestore();
  }
});

it("keeps defender casualty tombstones and role denominators through paging and Continue", () => {
  const { actors, defenders, flight, saved, station } = fixture();
  const casualty = actors[1]!;
  casualty.hp = 0;
  casualty.enemy!.hp = 0;
  worldRecordObjectRemoval({}, CONTENT, casualty, flight);
  flight.objects = actors.filter((object) => object !== casualty);
  worldSyncFlightRegion({}, CONTENT, flight);
  const resumed = new GameModel(CONTENT, saved);
  resumed.continueGame();
  const continued = resumed.state.flight!;
  expect(continued.world.notables[casualty.id]).toBeNull();
  expect(continued.combat!.initialPackSizes[defenders]).toBe(SWARM_GROUP_MINIMUM);
  continued.player = { x: station.x, y: station.y };
  worldSyncFlightRegion({}, CONTENT, continued);
  worldSyncFlightRegion({}, CONTENT, continued);
  expect(continued.objects.map(({ id }) => id).sort()).toEqual(
    actors
      .filter((object) => object !== casualty)
      .map(({ id }) => id)
      .sort(),
  );
  expect(continued.world.notables[casualty.id]).toBeNull();
  expect(worldRetainedPackMembers({}, CONTENT, continued)[defenders] ?? 0).toBe(0);
});

it("restores an absent legacy station level as L1 without inserting it or rerolling state", () => {
  const { saved, station } = fixture();
  delete station.enemy!.weaponLevel;
  const resolve = vi.spyOn(profiles, "enemyActorDefinition");
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const restored = restoreSave(saved)!;
    expect(restored).toEqual(saved);
    expect(resolve).toHaveBeenCalledWith(2, "hostileStation", station.id, 1);
    expect(Object.hasOwn(restored.flight!.objects[0]!.enemy!, "weaponLevel")).toBe(false);
    expect(random).not.toHaveBeenCalled();
  } finally {
    resolve.mockRestore();
    random.mockRestore();
  }
});

it("keeps station hardpoint, HP, level, duplicate identity and marker-epoch validation", () => {
  const { saved } = fixture();
  for (const mutate of [
    (copy: typeof saved) => {
      copy.flight!.objects[0]!.enemy!.hardpoints.pop();
    },
    (copy: typeof saved) => {
      copy.flight!.objects[0]!.enemy!.hp = -1;
    },
    (copy: typeof saved) => {
      Object.assign(copy.flight!.objects[0]!.enemy!, { weaponLevel: 4 });
    },
    (copy: typeof saved) => {
      copy.flight!.world.notables.planned = copy.flight!.objects[0]!;
    },
    (copy: typeof saved) => {
      copy.flight!.objects.push(structuredClone(copy.flight!.objects[0]!));
    },
    (copy: typeof saved) => {
      copy.flight!.markerActors = {
        encounterSeed: copy.flight!.encounterSeed! + 1,
        knowledge: { planned: "identified" },
      };
    },
  ]) {
    const copy = structuredClone(saved);
    mutate(copy);
    expect(restoreSave(copy)).toBeNull();
  }
});
