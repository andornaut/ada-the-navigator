import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { playOpening, supportEntropy } from "../testing/launch.ts";
import { createEnemy } from "./enemyAi.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import {
  worldRecordObjectRemoval,
  worldRetainedPackMembers,
  worldSyncFlightRegion,
} from "./geography.ts";
import { markerActorTracked } from "./markerKnowledge.ts";
import { restoreSave } from "./save.ts";
import type { SpaceObject } from "./types.ts";

function fixture(archetype: "capital" | "fighter" = "fighter") {
  const game = new GameModel(CONTENT, supportEntropy);
  game.startGalaxy(1);
  playOpening(game);
  const saved = game.saveDocument();
  const flight = saved.flight!;
  const definition = enemyDefinition(1, archetype, "tracked", 2);
  const enemy = createEnemy(
    definition,
    { archetype, id: "tracked", packId: "tracked-pack", phase: 0.75, weaponLevel: 2 },
    { x: 20000, y: 20000 },
  );
  enemy.age = 12;
  enemy.primaryCooldown = 0.37;
  const object: SpaceObject = {
    enemy,
    hp: definition.hp,
    id: "tracked",
    kind: "enemy",
    persistent: false,
    radius: 10,
    x: 20000,
    y: 20000,
  };
  flight.objects = [object];
  flight.world.notables = {};
  flight.combat = { initialPackSizes: { "tracked-pack": 1 }, routeEncounters: [] };
  flight.markerActors = {
    encounterSeed: flightEncounterSeed(flight),
    knowledge: { tracked: "identified" },
  };
  saved.progress[1].markerKnowledge = { site: "sensed" };
  return { flight, game, object, saved };
}

it("retains a tracked unloaded actor once and restores exact combat and knowledge without advancing scans", () => {
  const { flight, object, saved } = fixture();
  const before = structuredClone(object);
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.objects).toEqual([]);
  expect(flight.world.notables.tracked).toEqual(before);
  expect(flight.combat!.unloadedPackMembers).toBeUndefined();
  expect(worldRetainedPackMembers({}, CONTENT, flight)["tracked-pack"]).toBe(1);
  const random = vi.spyOn(crypto, "getRandomValues");
  random.mockClear();
  try {
    const restored = restoreSave(saved)!;
    expect(restored).toEqual(saved);
    expect(restored.progress[1].known).toEqual(saved.progress[1].known);
    expect(random).not.toHaveBeenCalled();
    const continued = restored.flight!;
    continued.player = { x: object.x, y: object.y };
    worldSyncFlightRegion({}, CONTENT, continued);
    expect(continued.objects).toEqual([before]);
    expect(continued.world.notables).toEqual({});
    worldSyncFlightRegion({}, CONTENT, continued);
    expect(continued.objects).toHaveLength(1);
    expect(continued.combat!.unloadedPackMembers).toBeUndefined();
  } finally {
    random.mockRestore();
  }
});

it("writes a tracked actor tombstone after HP reaches zero and retains it on Continue", () => {
  const { flight, object, saved } = fixture();
  object.hp = 0;
  expect(markerActorTracked(flight, object.id)).toBe(true);
  worldRecordObjectRemoval({}, CONTENT, object, flight);
  flight.objects = [];
  expect(flight.world.notables).toEqual({ tracked: null });
  expect(restoreSave(saved)).toEqual(saved);
});

it("rejects wrong epochs and untracked retained enemies without changing legacy absence", () => {
  const { flight, object, saved } = fixture();
  flight.objects = [];
  flight.world.notables = { tracked: object };
  flight.markerActors!.encounterSeed += 1;
  expect(markerActorTracked(flight, object.id)).toBe(false);
  expect(restoreSave(saved)).toBeNull();
  delete flight.markerActors;
  expect(restoreSave(saved)).toBeNull();
  flight.world.notables = {};
  delete saved.progress[1].markerKnowledge;
  const restored = restoreSave(saved)!;
  expect(restored).toEqual(saved);
  expect(Object.hasOwn(restored.flight!, "markerActors")).toBe(false);
  expect(Object.hasOwn(restored.progress[1], "markerKnowledge")).toBe(false);
});

it("rejects malformed knowledge, duplicate actors, dead state and pack overcount", () => {
  const base = fixture().saved;
  for (const mutate of [
    (saved: typeof base) =>
      Object.assign(saved.progress[1], { markerKnowledge: { site: "scanned" } }),
    (saved: typeof base) =>
      Object.assign(saved.flight!, {
        markerActors: { encounterSeed: flightEncounterSeed(saved.flight!), knowledge: [] },
      }),
    (saved: typeof base) => {
      saved.flight!.world.notables.tracked = saved.flight!.objects[0]!;
    },
    (saved: typeof base) => {
      const object = saved.flight!.objects.pop()!;
      object.hp = 0;
      saved.flight!.world.notables.tracked = object;
    },
    (saved: typeof base) => {
      const object = saved.flight!.objects.pop()!;
      saved.flight!.world.notables.tracked = object;
      saved.flight!.combat!.unloadedPackMembers = { "tracked-pack": 1 };
    },
  ]) {
    const saved = structuredClone(base);
    mutate(saved);
    expect(restoreSave(saved)).toBeNull();
  }
});

it("keeps untracked unload counting and rejects old-epoch membership while accepting legacy seed aliases", () => {
  const { flight, object } = fixture();
  flight.markerActors!.encounterSeed += 1;
  const sibling = structuredClone(object);
  sibling.id = "sibling";
  sibling.x = flight.player.x;
  sibling.y = flight.player.y;
  flight.objects.push(sibling);
  flight.combat!.initialPackSizes["tracked-pack"] = 2;
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.world.notables).toEqual({});
  expect(flight.objects).toEqual([sibling]);
  expect(flight.combat!.unloadedPackMembers).toEqual({ "tracked-pack": 1 });
  const legacy = {
    markerActors: {
      encounterSeed: Number.MAX_SAFE_INTEGER,
      knowledge: { tracked: "sensed" as const },
    },
    seed: Number.MAX_SAFE_INTEGER,
  };
  expect(markerActorTracked(legacy, object.id)).toBe(true);
  expect(markerActorTracked(legacy, "absent")).toBe(false);
});

it("preserves geographic knowledge across fresh entry while discarding actor state", () => {
  const { game } = fixture();
  game.state.progress[1].markerKnowledge = { site: "identified" };
  const old = game.state.flight!;
  old.markerActors = {
    encounterSeed: flightEncounterSeed(old),
    knowledge: { tracked: "identified" },
  };
  game.returnHome();
  game.startGalaxy(1);
  const next = game.state.flight!;
  expect(next.markerActors).toBeUndefined();
  expect(flightEncounterSeed(next)).not.toBe(flightEncounterSeed(old));
  expect(game.state.progress[1].markerKnowledge).toEqual({ site: "identified" });
  expect(next.world.notables).toEqual({});
});

it("retains tracked ambient heavy mount bursts, phases and equipped level on Continue", () => {
  const { flight, object, saved } = fixture("capital");
  object.enemy!.firePhasesInitialized = true;
  object.enemy!.hardpoints[0]!.cooldown = 0.61;
  object.enemy!.hardpoints[0]!.burst = 2;
  const before = structuredClone(object);
  worldSyncFlightRegion({}, CONTENT, flight);
  expect(flight.world.notables.tracked).toEqual(before);
  const restored = restoreSave(saved)!;
  expect(restored).toEqual(saved);
  expect(restored.flight!.world.notables.tracked).toEqual(before);
});
