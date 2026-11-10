import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy, stepDebris, stepEnemy } from "./enemy-ai.ts";
import { GameModel } from "./game.ts";
import { readSave, restoreSave, writeSave } from "./save.ts";

describe("save boundary", () => {
  it("roundtrips real initial and launched states without sharing mutable references", () => {
    const model = new GameModel(PROTOTYPE);
    expect(restoreSave(model.save())).toEqual(model.state);
    model.startSector(1);
    model.choose("0");
    const restored = restoreSave(model.save());
    expect(restored).toEqual(model.state);
    expect(restored?.flight).not.toBe(model.state.flight);
  });
  it("rejects truncated, corrupt and unsupported data without throwing", () => {
    const model = new GameModel(PROTOTYPE);
    model.startSector(1);
    model.choose("0");
    for (const change of [
      { version: 2 },
      { flight: {} },
      { progress: {} },
      { unlocked: [4] },
      { selectedSector: "1" },
    ]) {
      expect(restoreSave({ ...model.state, ...change })).toBeNull();
    }
    expect(restoreSave("{broken")).toBeNull();
    expect(new GameModel(PROTOTYPE, "{broken").state.mode).toBe("home");
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
  model.choose("0");
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

  it("accepts exact legacy snapshots without introducing combat fields", () => {
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

  it("rejects AI state attached to ballistic debris", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.objects[0]!, { kind: "debris" });
    expect(restoreSave(snapshot)).toBeNull();
  });

  it("accepts bolt projectiles and empty combat metadata", () => {
    const snapshot = combatSnapshot();
    Object.assign(snapshot.flight.shots[0]!, { projectile: "bolt" });
    snapshot.flight.combat = { initialPackSizes: { pack: 0 }, routeEncounters: [] };
    expect(restoreSave(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
