import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { playOpening, relaunch } from "../testing/launch.ts";
import { createEnemy, stepDebris, stepEnemy } from "./enemyAi.ts";
import { GameModel } from "./game.ts";
import { restoreSave, SAVE_VERSION } from "./save.ts";
import { stationsNear } from "./stations.ts";
import type { FlightState, GameState, PickupRelease, SpaceObject } from "./types.ts";

describe("save boundary", () => {
  it("roundtrips real initial and launched states without sharing mutable references", () => {
    const model = new GameModel(CONTENT);
    expect(restoreSave(model.save())).toEqual(model.state);
    model.startGalaxy(1);
    playOpening(model);
    const restored = restoreSave(model.save());
    expect(restored).toEqual(model.state);
    expect(restored?.flight).not.toBe(model.state.flight);
  });
  it("keeps schema 12 flat and rejects explicit periodic metadata before its atomic reader release", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const original = model.saveDocument();
    expect(original.version).toBe(12);
    expect(restoreSave(original)).toEqual(original);
    original.flight!.topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
    expect(restoreSave(original)).toBeNull();
  });
  it("rejects truncated, corrupt and unsupported data without throwing", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    for (const change of [
      // Whole-state validation accepts only the current save schema.
      { version: SAVE_VERSION - 1 },
      { version: SAVE_VERSION + 1 },
      { flight: {} },
      { progress: {} },
      { unlocked: [4] },
      { unlocked: [1, 7] },
      { selectedGalaxy: "1" },
      { selectedGalaxy: 7 },
    ]) {
      expect(restoreSave({ ...model.state, ...change })).toBeNull();
    }
    expect(restoreSave("{broken")).toBeNull();
    expect(relaunch(CONTENT, "{broken").state.mode).toBe("home");
  });
  it.each(
    [
      ...[
        "economy",
        "jobs",
        "tasks",
        "docked",
        "achievements",
        "started",
        "prologueSeen",
        "announceGalaxy",
        "seenConversations",
      ].map((key) => [key]),
      ...["stations", "holodisk", "opened", "donated", "charted", "revealed", "explored"].map(
        (key) => ["progress", "1", key],
      ),
      ["progress", "4"],
      ["economy", "ammo"],
      ...["levels", "ammo", "weaponSwitchFor"].map((key) => ["flight", key]),
    ].map((path) => [path.join("."), path] as const),
  )("rejects a save without %s", (_, path) => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as Record<string, unknown>;
    expect(restoreSave(saved)).not.toBeNull();
    const parent = path
      .slice(0, -1)
      .reduce((node, key) => (node as Record<string, unknown>)[key], saved as unknown);
    Reflect.deleteProperty(parent as object, path.at(-1)!);
    expect(restoreSave(saved)).toBeNull();
  });
  it("rejects a flight's single ammunition count", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as { flight: Record<string, unknown> };
    saved.flight.ammo = 7;
    expect(restoreSave(saved)).toBeNull();
  });
});

function combatSnapshot() {
  const model = new GameModel(CONTENT);
  model.startGalaxy(1);
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
          damage: 1,
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
      adaWidth: 20,
      dt: 0.5,
      initialPackSizes: snapshot.flight.combat.initialPackSizes,
      lead: 1,
      peers: [before],
      player: { x: 50, y: -10 },
      playerVelocity: { x: 0, y: 0 },
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

  it("preserves the time since a return began, and accepts a save without it", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!, { returnSeconds: 1.25, returning: true });
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
    delete snapshot.flight.objects[0]!.enemy!.returnSeconds;
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each([
    "age",
    "hp",
    "lastSeenAge",
    "phase",
    "primaryCooldown",
    "pursuitSeconds",
    "returnSeconds",
  ])("rejects nonfinite enemy %s", (field) => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!, { [field]: Infinity });
    expect(restoreSave(snapshot)).toBeNull();
  });

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
    { disabled: "true" },
    { disabled: undefined },
    { salvaged: 1 },
    { packId: 2 },
    { id: "wrong-object" },
    { lastSeen: {} },
    { pursuitSeconds: -1 },
    { returnSeconds: -1 },
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

  it("restores laid mines and ring burst bolts, rejecting malformed ones", () => {
    const snapshot = combatSnapshot();
    const flight = snapshot.flight as typeof snapshot.flight & { mines: unknown[] };
    flight.mines = [
      { age: 2.5, damage: 3, id: "mine:1", ownerId: "guard", x: 4, y: -6 },
      {
        age: 20.1,
        damage: 3,
        end: { age: 0.1, kind: "fizzle" },
        id: "mine:2",
        ownerId: "guard",
        x: 0,
        y: 0,
      },
    ];
    snapshot.flight.shots = [
      { ...snapshot.flight.shots[0]!, enemyWeapon: "ringBurst", projectile: "bolt" as const },
    ] as unknown as typeof snapshot.flight.shots;
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
    for (const mine of [
      { age: 1, damage: 0, id: "m", ownerId: "guard", x: 0, y: 0 },
      { age: 1, damage: 3, end: { age: 0, kind: "boom" }, id: "m", ownerId: "guard", x: 0, y: 0 },
      { age: 1, damage: 3, id: 7, ownerId: "guard", x: 0, y: 0 },
    ]) {
      expect(
        restoreSave(JSON.stringify({ ...snapshot, flight: { ...flight, mines: [mine] } })),
      ).toBeNull();
    }
    const playerBolt = { ...snapshot.flight.shots[0]!, enemy: false };
    expect(
      restoreSave(JSON.stringify({ ...snapshot, flight: { ...flight, shots: [playerBolt] } })),
    ).toBeNull();
  });

  it("rejects a saved heavy whose hardpoints are another position's mounts", () => {
    // Sunflower's capital carries four weapons; Phantom's carries eight.
    const snapshot = combatSnapshot();
    const enemy = snapshot.flight.objects[0]!.enemy!;
    enemy.hardpoints = createEnemy(
      enemyDefinition(6, "capital"),
      { archetype: "capital", id: enemy.id, packId: enemy.packId, phase: enemy.phase },
      enemy.position,
    ).hardpoints;
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
  ])("rejects malformed or cross-galaxy combat metadata %j", (combat) => {
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

describe("enemy behaviour save boundary", () => {
  it("roundtrips behaviour, escort, disabled and salvaged state exactly", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!.enemy!, {
      disabled: true,
      escortOf: "capital",
      salvaged: true,
      tactic: { integrity: 3, phase: "retreat", seconds: 0.4, volleys: 0 },
    });
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
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

  it("roundtrips hull facing, movement heading and weapon aims exactly", () => {
    const snapshot = oriented();
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it.each(["facing", "heading", "aim", "escortOf", "tactic"])(
    "rejects an enemy without %s",
    (key) => {
      const snapshot = oriented();
      Reflect.deleteProperty(snapshot.flight.objects[0]!.enemy!, key);
      expect(restoreSave(JSON.stringify(snapshot))).toBeNull();
    },
  );

  it("rejects a hardpoint without an aim", () => {
    const snapshot = oriented();
    Reflect.deleteProperty(snapshot.flight.objects[0]!.enemy!.hardpoints[3]!, "aim");
    expect(restoreSave(JSON.stringify(snapshot))).toBeNull();
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
  it("keeps an Art rock and rejects a rock shape outside Art's catalog", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    playOpening(model);
    const saved = JSON.parse(model.save()) as GameState;
    const base = saved.flight!.objects;
    const rock: SpaceObject = {
      asteroid: "asteroid-h2",
      hp: 16,
      id: "chunk:9,9:feature",
      kind: "rock",
      radius: 99.5,
      x: 4800,
      y: 4800,
    };
    saved.flight!.objects = [...base, rock];
    expect(restoreSave(JSON.stringify(saved))!.flight!.objects.at(-1)).toEqual(rock);
    for (const asteroid of ["placeholder-huge-1", "x"]) {
      saved.flight!.objects = [...base, { ...rock, asteroid }];
      expect(restoreSave(JSON.stringify(saved))).toBeNull();
    }
  });

  it("keeps whale debris stone shapes and resource rock classes, rejecting misplaced ones", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
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
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
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
    const model = relaunch(CONTENT, JSON.stringify(snapshot));
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

  it("accepts a disabled heavy whose hull holds but rejects an unrecorded destroyed notable", () => {
    const snapshot = notableSnapshot();
    const guard = snapshot.flight.world.notables.guard!.enemy!;
    for (const part of guard.hardpoints) {
      part.hp = 0;
    }
    guard.disabled = true;
    expect(restoreSave(snapshot)).toEqual(snapshot);
    guard.hp = 0;
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
    expect(relaunch(CONTENT, old).state.mode).toBe("home");
    expect(relaunch(CONTENT, old).state.flight).toBeNull();
    expect(old.flight).not.toHaveProperty("world");
  });
});

describe("delivery save boundary", () => {
  it("rejects a held delivery or board offer to a story place that takes none", () => {
    const model = new GameModel(CONTENT);
    model.state.unlocked = [1, 2, 3];
    model.startGalaxy(3);
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
    const other = stationsNear(ECONOMY, 3, 40_000, { x: 0, y: 0 })[1]!;
    // A delivery to a station loads as it was.
    const kept = structuredClone(saved);
    kept.tasks[3] = { ...job("job:7", other.id), carrying: true, kind: "job" };
    kept.jobs.boards[3] = { [station.id]: [job("job:8", other.id)] };
    expect(restoreSave(JSON.stringify(kept))).toEqual(kept);
    // The whale family and the whale take no deliveries.
    const held = structuredClone(saved);
    held.tasks[3] = { ...job("job:7", "family"), carrying: true, kind: "job" };
    expect(restoreSave(JSON.stringify(held))).toBeNull();
    const offered = structuredClone(saved);
    offered.jobs.boards[3] = { [station.id]: [job("job:8", "whale")] };
    expect(restoreSave(JSON.stringify(offered))).toBeNull();
  });
});

describe("a save from a newer version", () => {
  it("is never restored, so the game cannot read or replace it", () => {
    expect(restoreSave({ mode: "home", version: SAVE_VERSION + 1 })).toBeNull();
  });
});

describe("bounded retreat save state", () => {
  it.each([undefined, 2])(
    "preserves active and cooling-down retreats with endedAt %s",
    (endedAt) => {
      const snapshot = combatSnapshot();
      const enemy = snapshot.flight.objects[0]!.enemy!;
      enemy.age = 3;
      enemy.retreat = {
        away: { x: 1, y: 0 },
        kind: "morale",
        origin: { x: 10, y: 20 },
        startedAt: 1,
        ...(endedAt === undefined ? {} : { endedAt }),
      };
      expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );
  it.each([
    { kind: "other" },
    { origin: { x: Infinity, y: 0 } },
    { away: { x: 0, y: 0 } },
    { startedAt: -1 },
    { startedAt: 4 },
    { endedAt: 0 },
    { endedAt: 4 },
  ])("rejects malformed bounded retreat fields %j", (change) => {
    const snapshot = combatSnapshot();
    const enemy = snapshot.flight.objects[0]!.enemy!;
    enemy.age = 3;
    Object.assign(enemy, {
      retreat: {
        away: { x: 1, y: 0 },
        kind: "morale",
        origin: { x: 10, y: 20 },
        startedAt: 1,
        ...change,
      },
    });
    expect(restoreSave(JSON.stringify(snapshot))).toBeNull();
  });
});
