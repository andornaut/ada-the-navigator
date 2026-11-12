import { describe, expect, it, vi } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { createEnemy, stepDebris, stepEnemy } from "./enemy-ai.ts";
import { GameModel } from "./game.ts";
import { newerSave, readSave, restoreSave, SAVE_VERSION, writeSave } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, GameState, PickupRelease, SpaceObject } from "./types.ts";

describe("save boundary", () => {
  it("roundtrips real initial and launched states without sharing mutable references", () => {
    const model = new GameModel(PROTOTYPE);
    expect(restoreSave(model.save())).toEqual(model.state);
    model.startSector(1);
    playOpening(model);
    const restored = restoreSave(model.save());
    expect(restored).toEqual(model.state);
    expect(restored?.flight).not.toBe(model.state.flight);
  });
  it("rejects truncated, corrupt and unsupported data without throwing", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    for (const change of [
      { version: 2 },
      { flight: {} },
      { progress: {} },
      { unlocked: [4] },
      { unlocked: [1, 7] },
      { selectedSector: "1" },
      { selectedSector: 7 },
    ]) {
      expect(restoreSave({ ...model.state, ...change })).toBeNull();
    }
    expect(restoreSave("{broken")).toBeNull();
    expect(relaunch(PROTOTYPE, "{broken").state.mode).toBe("home");
  });
  it("tolerates blocked storage reads and writes", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("quota");
      },
    };
    expect(readSave(storage, "save")).toBeNull();
    expect(writeSave(storage, "save", "{} ")).toBe(false);
  });
});

function combatSnapshot() {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
  playOpening(model);
  if (!model.state.flight) {
    throw new Error("Expected launched flight");
  }
  const enemy = createEnemy(
    enemyCatalog.capital,
    { archetype: "capital", id: "guard", packId: "pack", phase: -0.7 },
    { x: -20, y: 30 },
  );
  enemy.age = 9.25;
  enemy.engaged = true;
  enemy.lastSeen = { x: 50, y: -10 };
  enemy.lastSeenAge = 0.4;
  enemy.primaryCooldown = 0.8;
  enemy.pursuitSeconds = 7.5;
  enemy.velocity = { x: -4, y: 12 };
  enemy.hardpoints[1]!.hp = 0;
  enemy.hardpoints[3]!.cooldown = 0.3;
  enemy.hardpoints[4]!.cooldown = 1.7;
  return {
    ...model.state,
    flight: {
      ...model.state.flight,
      combat: { initialPackSizes: { pack: 3 }, routeEncounters: ["growers"] },
      objects: [
        {
          enemy,
          hp: enemy.hp,
          id: enemy.id,
          kind: "enemy" as const,
          radius: 90,
          routeId: "growers",
          x: enemy.position.x,
          y: enemy.position.y,
        },
        {
          hp: 2,
          id: "debris",
          kind: "debris" as const,
          radius: 8,
          velocity: { x: -14, y: 2.5 },
          x: 8,
          y: -12,
        },
      ],
      shots: [
        {
          enemy: true,
          hitIds: ["old-target"],
          id: "missile",
          life: 1.2,
          piercing: false,
          projectile: "missile" as const,
          velocity: { x: -40, y: 10 },
          x: 3,
          y: -9,
        },
      ],
    },
  };
}

describe("combat save boundary", () => {
  it("preserves the full interrupted snapshot and clones nested state", () => {
    const snapshot = combatSnapshot();
    const restored = restoreSave(JSON.stringify(snapshot));
    expect(restored).toEqual(snapshot);
    expect(restored?.flight?.objects[0]).not.toBe(snapshot.flight.objects[0]);
    const resumed = restored as unknown as ReturnType<typeof combatSnapshot>;
    resumed.flight.objects[0]!.enemy!.hardpoints[1]!.hp = 4;
    resumed.flight.combat.initialPackSizes.pack = 1;
    resumed.flight.shots[0]!.hitIds.push("new-target");
    expect(snapshot.flight.objects[0]!.enemy!.hardpoints[1]!.hp).toBe(0);
    expect(snapshot.flight.combat.initialPackSizes.pack).toBe(3);
    expect(snapshot.flight.shots[0]!.hitIds).toEqual(["old-target"]);
  });

  it("continues canonical AI and ballistic debris identically after restoration", () => {
    const snapshot = combatSnapshot();
    const resumed = restoreSave(JSON.stringify(snapshot)) as unknown as typeof snapshot;
    expect(resumed).not.toBeNull();
    const before = snapshot.flight.objects[0]!.enemy!;
    const after = resumed.flight.objects[0]!.enemy!;
    const context = {
      adaSpeed: 200,
      adaWidth: 20,
      dt: 0.5,
      initialPackSizes: snapshot.flight.combat.initialPackSizes,
      peers: [before],
      player: { x: 50, y: -10 },
      speedCapRatio: 1.1,
      targetable: true,
      visibility: "visible" as const,
    };
    expect(stepEnemy(enemyCatalog.capital, { ...context, peers: [after] }, after)).toEqual(
      stepEnemy(enemyCatalog.capital, context, before),
    );
    const debris = snapshot.flight.objects[1]!;
    const restoredDebris = resumed.flight.objects[1]!;
    expect(
      stepDebris(0.5, {
        id: restoredDebris.id,
        position: { x: restoredDebris.x, y: restoredDebris.y },
        velocity: restoredDebris.velocity!,
      }),
    ).toEqual(
      stepDebris(0.5, {
        id: debris.id,
        position: { x: debris.x, y: debris.y },
        velocity: debris.velocity!,
      }),
    );
  });

  it.each(["fleeing", "returning"] as const)("preserves latched %s state", (flag) => {
    const snapshot = combatSnapshot();
    snapshot.flight.objects[0]!.enemy![flag] = true;
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each(["age", "hp", "lastSeenAge", "phase", "primaryCooldown", "pursuitSeconds"])(
    "rejects nonfinite enemy %s",
    (field) => {
      const snapshot = combatSnapshot();
      Object.assign(snapshot.flight.objects[0]!.enemy!, { [field]: Infinity });
      expect(restoreSave(snapshot)).toBeNull();
    },
  );

  it.each(["home", "position", "velocity", "lastSeen"] as const)(
    "rejects nonfinite enemy %s coordinates",
    (field) => {
      const snapshot = combatSnapshot();
      snapshot.flight.objects[0]!.enemy![field] = { x: NaN, y: 0 };
      expect(restoreSave(snapshot)).toBeNull();
    },
  );

  it.each([
    { archetype: "unknown" },
    { archetype: "toString" },
    { engaged: 1 },
    { fleeing: "false" },
    { returning: null },
    { packId: 2 },
    { id: "wrong-object" },
    { lastSeen: {} },
    { pursuitSeconds: -1 },
    { primaryCooldown: -1 },
    { hardpoints: [] },
  ])("rejects malformed enemy state %j", (change) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!, change);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it.each([
    { cooldown: Infinity },
    { cooldown: -1 },
    { hp: NaN },
    { hp: -1 },
    { id: "unknown" },
    { id: "command" },
  ])("rejects malformed or duplicate hardpoints %j", (change) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!.hardpoints[1]!, change);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it.each([
    { initialPackSizes: { pack: NaN }, routeEncounters: [] },
    { initialPackSizes: { pack: -1 }, routeEncounters: [] },
    { initialPackSizes: { pack: 1.5 }, routeEncounters: [] },
    { initialPackSizes: [], routeEncounters: [] },
    { initialPackSizes: {}, routeEncounters: ["hub"] },
    { initialPackSizes: {}, routeEncounters: [1] },
    { initialPackSizes: {} },
    null,
  ])("rejects malformed or cross-sector combat metadata %j", (combat) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight, { combat });
    expect(restoreSave(snapshot)).toBeNull();
  });

  it.each([{ projectile: "laser" }, { projectile: null }, { velocity: { x: 0, y: Infinity } }])(
    "rejects malformed projectiles %j",
    (change) => {
      const snapshot = combatSnapshot();
      Object.assign(snapshot.flight.shots[0]!, change);
      expect(restoreSave(snapshot)).toBeNull();
    },
  );

  it.each([{ velocity: { x: Infinity, y: 0 } }, { velocity: null }])(
    "rejects malformed ballistic velocity %j",
    (change) => {
      const snapshot = combatSnapshot();
      Object.assign(snapshot.flight.objects[1]!, change);
      expect(restoreSave(snapshot)).toBeNull();
    },
  );

  it.each(["hub", "unknown", null, 1])("rejects invalid route association %j", (routeId) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!, { routeId });
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("accepts current snapshots without optional combat fields", () => {
    const snapshot = combatSnapshot();
    Reflect.deleteProperty(snapshot.flight, "combat");
    for (const object of snapshot.flight.objects) {
      for (const key of ["enemy", "velocity", "routeId"]) {
        Reflect.deleteProperty(object, key);
      }
    }
    Reflect.deleteProperty(snapshot.flight.shots[0]!, "projectile");
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each(Object.keys(enemyCatalog) as (keyof typeof enemyCatalog)[])(
    "accepts canonical %s state including null observation and pack",
    (archetype) => {
      const snapshot = combatSnapshot();
      snapshot.flight.objects[0]!.enemy = createEnemy(
        enemyCatalog[archetype],
        { archetype, id: "guard", packId: null, phase: 0 },
        { x: -20, y: 30 },
      );
      expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );

  it("roundtrips released Stardust with and without a settle origin, and rejects a bad origin", () => {
    const snapshot = combatSnapshot();
    const pickup = (id: string, release: PickupRelease): SpaceObject => ({
      amount: 1,
      hp: 1,
      id,
      kind: "pickup",
      radius: 6,
      release,
      role: "stardust",
      x: 40,
      y: 12,
    });
    const objects: SpaceObject[] = snapshot.flight.objects;
    objects.push(
      pickup("stardust:1", { at: 3, from: { x: 36, y: 10 } }),
      pickup("stardust:2", { at: 3.24 }),
    );
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
    Object.assign(objects.at(-1)!, { release: { at: 3.24, from: "pivot" } });
    expect(restoreSave(JSON.stringify(snapshot))).toBeNull();
  });

  it("rejects AI state attached to ballistic debris", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!, { kind: "debris" });
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("accepts bolt projectiles with consistent combat metadata", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.shots[0]!, { projectile: "bolt" });
    snapshot.flight.combat = { initialPackSizes: { pack: 1 }, routeEncounters: [] };
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

function notableSnapshot(): GameState & { flight: FlightState } {
  const snapshot = combatSnapshot();
  const notable = snapshot.flight.objects[0]! as SpaceObject;
  return {
    ...snapshot,
    flight: {
      ...snapshot.flight,
      objects: snapshot.flight.objects.slice(1) as SpaceObject[],
      world: { notables: { [notable.id]: notable }, version: 1 as const },
    },
  };
}

describe("retired capital layouts", () => {
  const legacy = (archetype: string, hardpoints: [string, number, number][]) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!, {
      archetype,
      hardpoints: hardpoints.map(([id, hp, cooldown]) => ({ aim: null, cooldown, hp, id })),
    });
    return snapshot;
  };
  const parts = (snapshot: unknown) =>
    restoreSave(JSON.stringify(snapshot))!.flight!.objects[0]!.enemy!.hardpoints.map(
      ({ cooldown, hp, id }) => [id, hp, cooldown],
    );

  it("moves an earlier capital onto the current layout, keeping its damage", () => {
    const snapshot = legacy("capital", [
      ["command", 5, 0],
      ["engine-left", 0, 0],
      ["engine-right", 4, 0],
      ["weapon-left", 2, 0.3],
      ["weapon-right", 3, 1.7],
    ]);
    expect(parts(snapshot)).toEqual([
      ["command", 5, 0],
      ["engine-left", 0, 0],
      ["engine-right", 4, 0],
      ["weapon-left", 2, 0.3],
      ["weapon-right", 3, 1.7],
      ["weapon-rear-left", 3, 0],
      ["weapon-rear-right", 3, 0],
    ]);
  });

  it("turns a retired oversized capital into a capital", () => {
    const snapshot = legacy("oversizedCapital", [
      ["command", 4, 0],
      ["engine-left", 4, 0],
      ["engine-right", 0, 0],
      ["port", 1, 0.5],
      ["center", 0, 0],
      ["starboard", 3, 0],
    ]);
    const restored = restoreSave(JSON.stringify(snapshot))!;
    expect(restored.flight!.objects[0]!.enemy!.archetype).toBe("capital");
    expect(parts(snapshot)).toEqual([
      ["command", 4, 0],
      ["engine-left", 4, 0],
      ["engine-right", 0, 0],
      ["weapon-left", 1, 0.5],
      ["weapon-right", 3, 0],
      ["weapon-rear-left", 3, 0],
      ["weapon-rear-right", 3, 0],
    ]);
  });

  it("still rejects an unknown capital layout", () => {
    const snapshot = legacy("capital", [
      ["command", 5, 0],
      ["engine-left", 4, 0],
      ["mystery", 3, 0],
    ]);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it.each([{ tactic: { integrity: 1, phase: "orbit", seconds: 0, volleys: 0 } }, { escortOf: 5 }])(
    "rejects malformed behaviour state %j",
    (change) => {
      const snapshot = combatSnapshot();
      Object.assign(snapshot.flight.objects[0]!.enemy!, change);
      expect(restoreSave(snapshot)).toBeNull();
    },
  );
});

describe("enemy orientation save boundary", () => {
  function oriented() {
    const snapshot = combatSnapshot();
    const enemy = snapshot.flight.objects[0]!.enemy!;
    enemy.facing = { x: 0.6, y: 0.8 };
    enemy.heading = { x: -0.8, y: 0.6 };
    enemy.aim = { x: 0, y: 1 };
    enemy.hardpoints[3]!.aim = { x: 1, y: 0 };
    return snapshot;
  }
  const strip = (enemy: object) => {
    for (const key of ["facing", "heading", "aim"]) {
      Reflect.deleteProperty(enemy, key);
    }
    for (const part of (enemy as { hardpoints: object[] }).hardpoints) {
      Reflect.deleteProperty(part, "aim");
    }
  };

  it("roundtrips hull facing, movement heading and weapon aims exactly", () => {
    const snapshot = oriented();
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("starts older saves facing their velocity with unset heading and aims", () => {
    const snapshot = oriented();
    strip(snapshot.flight.objects[0]!.enemy!);
    const enemy = restoreSave(JSON.stringify(snapshot))!.flight!.objects[0]!.enemy!;
    const speed = Math.hypot(-4, 12);
    expect(enemy.facing.x).toBeCloseTo(-4 / speed, 12);
    expect(enemy.facing.y).toBeCloseTo(12 / speed, 12);
    expect(enemy.heading).toBeNull();
    expect(enemy.aim).toBeNull();
    expect(enemy.hardpoints.every((part) => part.aim === null)).toBe(true);
  });

  it("starts stopped older saves facing up, including inactive notables", () => {
    const snapshot = notableSnapshot();
    const notable = snapshot.flight.world.notables.guard!.enemy!;
    notable.velocity = { x: 0, y: 0 };
    strip(notable);
    const restored = restoreSave(JSON.stringify(snapshot))!;
    expect(restored.flight!.world.notables.guard!.enemy!.facing).toEqual({ x: 0, y: -1 });
  });

  it.each([{ facing: { x: NaN, y: 0 } }, { facing: null }, { heading: {} }, { aim: "east" }])(
    "rejects malformed enemy orientation %j",
    (change) => {
      const snapshot = oriented();
      Object.assign(snapshot.flight.objects[0]!.enemy!, change);
      expect(restoreSave(snapshot)).toBeNull();
    },
  );

  it("rejects a malformed hardpoint aim", () => {
    const snapshot = oriented();
    Object.assign(snapshot.flight.objects[0]!.enemy!.hardpoints[3]!, { aim: { x: 1 } });
    expect(restoreSave(snapshot)).toBeNull();
  });
});

describe("asteroid save boundary", () => {
  it("restores a placeholder rock as the Art rock it was drawn as, at that rock's radius", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as GameState;
    const legacy: SpaceObject = {
      asteroid: "placeholder-huge-1",
      hp: 16,
      id: "chunk:9,9:feature",
      kind: "rock",
      radius: 92.5,
      x: 4800,
      y: 4800,
    };
    saved.flight!.objects = [...saved.flight!.objects, legacy];
    const restored = restoreSave(JSON.stringify(saved));
    const rock = restored?.flight?.objects.find((object) => object.id === legacy.id);
    expect(rock).toEqual({ ...legacy, asteroid: "asteroid-h2", radius: 99.5 });
    // An id that is neither current nor legacy still rejects the save.
    saved.flight!.objects = [...saved.flight!.objects.slice(0, -1), { ...legacy, asteroid: "x" }];
    expect(restoreSave(JSON.stringify(saved))).toBeNull();
  });

  it("keeps whale debris stone shapes and resource rock classes, rejecting misplaced ones", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as GameState;
    const base = saved.flight!.objects;
    const stone: SpaceObject = {
      asteroid: "asteroid-s2",
      hp: 3,
      id: "whale-debris:0",
      kind: "debris",
      radius: 17.2,
      x: 4800,
      y: 4800,
    };
    const ore: SpaceObject = {
      hp: 5,
      id: "chunk:9,9:1",
      kind: "resource",
      radius: 54,
      resource: "large",
      x: 5200,
      y: 4800,
    };
    saved.flight!.objects = [...base, stone, ore];
    const restored = restoreSave(JSON.stringify(saved))!.flight!.objects;
    expect(restored.slice(-2)).toEqual([stone, ore]);
    for (const bad of [
      { ...ore, resource: "huge" },
      { ...stone, resource: "medium" },
      { ...ore, asteroid: "asteroid-s2", kind: "pickup" },
    ]) {
      saved.flight!.objects = [...base, bad as SpaceObject];
      expect(restoreSave(JSON.stringify(saved))).toBeNull();
    }
  });

  it("keeps a story scene and a replay scene, rejecting unknown ones", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as GameState;
    saved.flight!.storyScene = { at: 3, id: "blocked", lineDue: false };
    saved.progress[2].replayScene = "docking";
    const restored = restoreSave(JSON.stringify(saved))!;
    expect(restored.flight!.storyScene).toEqual({ at: 3, id: "blocked", lineDue: false });
    expect(restored.progress[2].replayScene).toBe("docking");
    const replay = JSON.parse(JSON.stringify(saved)) as { progress: Record<number, unknown> };
    Object.assign(replay.progress[2]!, { replayScene: "duel" });
    expect(restoreSave(JSON.stringify(replay))).toBeNull();
    for (const scene of [
      { at: 3, id: "duel", lineDue: false },
      { at: -1, id: "blocked", lineDue: false },
      { at: 3, id: "blocked" },
    ]) {
      const bad = JSON.parse(JSON.stringify(saved)) as { flight: { storyScene: unknown } };
      bad.flight.storyScene = scene;
      expect(restoreSave(JSON.stringify(bad))).toBeNull();
    }
  });
});

describe("current generation save boundary", () => {
  it("roundtrips inactive notable parts, AI and active projectiles exactly", () => {
    const snapshot = notableSnapshot();
    const restored = restoreSave(JSON.stringify(snapshot));
    expect(restored).toEqual(snapshot);
    expect(restored!.flight!.world).not.toBe(snapshot.flight.world);
    const object = restored!.flight!.world.notables.guard!;
    expect(object.enemy!.hardpoints[1]!.hp).toBe(0);
    expect(object.enemy!.hardpoints[4]!.cooldown).toBe(1.7);
    expect(restored!.flight!.shots).toEqual(snapshot.flight.shots);
  });

  it("serializes only the current schema without decoding discarded ordinary history", () => {
    const snapshot = notableSnapshot();
    const model = relaunch(PROTOTYPE, JSON.stringify(snapshot));
    expect(model.state).toEqual(snapshot);
    const parse = vi.spyOn(JSON, "parse");
    try {
      const first = model.save();
      expect(model.save()).toBe(first);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it.each([
    null,
    {},
    { notables: {}, version: 2 },
    { notables: [], version: 1 },
    { extra: [], notables: {}, version: 1 },
  ])("rejects invalid persistent world metadata %j", (world) => {
    const snapshot = notableSnapshot();
    Object.assign(snapshot.flight, { world });
    expect(restoreSave(snapshot)).toBeNull();
  });

  it.each([
    { enemy: { archetype: "unknown" } },
    { velocity: { x: null, y: 0 } },
    { cooldown: -1 },
    { routeId: "hub" },
    { persistent: "true" },
    { hp: 0 },
    { kind: "destination" },
    { id: "different" },
  ])("validates complete retained object records %j", (change) => {
    const snapshot = notableSnapshot();
    Object.assign(snapshot.flight.world.notables.guard!, change);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("rejects ordinary scenery and trash mobs in the persistent ledger", () => {
    const snapshot = notableSnapshot();
    snapshot.flight.world.notables = {
      rock: { hp: 2, id: "rock", kind: "rock", radius: 10, x: 5000, y: 0 },
    };
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("preserves explicit defeated tombstones while preventing duplicate canonical ownership", () => {
    const snapshot = notableSnapshot();
    Object.assign(snapshot.flight.world.notables, { "route:workshop": null });
    expect(restoreSave(snapshot)).toEqual(snapshot);
    snapshot.flight.objects.push(snapshot.flight.world.notables.guard!);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("accepts a destroyed hull with required live parts but rejects an unrecorded defeated notable", () => {
    const snapshot = notableSnapshot();
    snapshot.flight.world.notables.guard!.enemy!.hp = 0;
    expect(restoreSave(snapshot)).toEqual(snapshot);
    for (const part of snapshot.flight.world.notables.guard!.enemy!.hardpoints) {
      part.hp = 0;
    }
    expect(restoreSave(snapshot)).toBeNull();
    Object.assign(snapshot.flight.world.notables, { guard: null });
    expect(restoreSave(snapshot)).toEqual(snapshot);
  });

  it("rejects ambiguous chunk keys, unbounded active keys and malformed visited pages", () => {
    for (const key of ["bad", "1.5,0", "01,0", "-0,0", "0,Infinity", "9007199254740992,0"]) {
      const snapshot = notableSnapshot();
      snapshot.flight.chunks = [key];
      expect(restoreSave(snapshot)).toBeNull();
    }
    for (const visited of [
      null,
      [],
      { "0,0": "broken" },
      { "01,0": btoa("x".repeat(32)) },
      { "0,0": btoa("x".repeat(33)) },
      { "0,0": btoa("\0".repeat(32)) },
    ]) {
      const snapshot = notableSnapshot();
      Object.assign(snapshot.flight, { visited });
      expect(restoreSave(snapshot)).toBeNull();
    }
    const snapshot = notableSnapshot();
    snapshot.flight.chunks = Array.from({ length: 50 }, (_, index) => `${index},0`);
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("rejects unsafe generation coordinates and fractional seed identities", () => {
    const snapshot = notableSnapshot();
    snapshot.flight.player.x = Number.MAX_VALUE;
    expect(restoreSave(snapshot)).toBeNull();
    snapshot.flight.player.x = 0;
    snapshot.flight.seed = 1.5;
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("rejects old generation schemas and uses the existing safe home fallback without migration", () => {
    const snapshot = notableSnapshot();
    const old = JSON.parse(JSON.stringify(snapshot)) as { flight: Record<string, unknown> };
    delete old.flight.world;
    delete old.flight.visited;
    old.flight.dormant = { packMembers: {}, pages: {}, routes: [], version: 1 };
    old.flight.exploredChunks = ["0,0"];
    expect(restoreSave(old)).toBeNull();
    expect(relaunch(PROTOTYPE, old).state.mode).toBe("home");
    expect(relaunch(PROTOTYPE, old).state.flight).toBeNull();
    expect(old.flight).not.toHaveProperty("world");
  });
});

// CLEANUP (added 2026-11-11): remove with the save loader's story-delivery drop.
describe("deliveries to story places in older saves", () => {
  it("drops a held delivery or board offer to a story place that takes none, keeping the save", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.unlocked = [1, 2, 3];
    model.startSector(3);
    playOpening(model);
    model.state.dialogue = null;
    const station = stationsNear(ECONOMY, 3, 40_000, { x: 0, y: 0 })[0]!;
    const job = (id: string, target: string) => ({
      id,
      item: "song shells",
      reward: 30,
      station: station.id,
      target: { id: target, x: 100, y: 200 },
      type: "delivery" as const,
    });
    const saved = JSON.parse(model.save()) as GameState;
    // The older shape: a held delivery to the whale family, and one on offer to the whale.
    saved.tasks[3] = { ...job("job:7", "family"), carrying: true, kind: "job" };
    saved.jobs.boards[3] = { [station.id]: [job("job:8", "whale"), job("job:9", "family")] };
    saved.economy.stardust = 123;
    const restored = restoreSave(JSON.stringify(saved));
    expect(restored).not.toBeNull();
    expect(restored!.tasks[3]).toBeUndefined();
    expect(restored!.jobs.boards[3]![station.id]).toEqual([]);
    expect(restored!.economy.stardust).toBe(123);
    // A delivery to a station still loads as it was.
    const kept = structuredClone(saved);
    const other = stationsNear(ECONOMY, 3, 40_000, { x: 0, y: 0 })[1]!;
    kept.tasks[3] = { ...job("job:7", other.id), carrying: true, kind: "job" };
    kept.jobs.boards[3] = {};
    expect(restoreSave(JSON.stringify(kept))!.tasks[3]).toMatchObject({ target: { id: other.id } });
  });
});

describe("a save from a newer version", () => {
  it("is told apart from this build's, older and malformed saves", () => {
    expect(SAVE_VERSION).toBe(1);
    expect(newerSave({ version: 2 })).toBe(true);
    expect(newerSave(JSON.stringify({ mode: "home", version: 7 }))).toBe(true);
    for (const saved of [
      { version: 1 },
      { version: 0 },
      { version: "2" },
      { version: Number.NaN },
      {},
      null,
      "not json",
      [2],
    ]) {
      expect(newerSave(saved), JSON.stringify(saved)).toBe(false);
    }
  });

  it("is never restored, so the game cannot read or replace it", () => {
    expect(restoreSave({ mode: "home", version: 2 })).toBeNull();
  });
});
