import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  syncFlightRegion,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { SectorProgress, SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: SectorProgress = {
  deposited: 0,
  disabledEnemies: 0,
  discoveries: 0,
  introduced: false,
  known: [],
  questComplete: false,
  questItem: null,
  resolved: false,
  stage: 0,
};
function fixture() {
  const content = structuredClone(PROTOTYPE);
  content.tuning.flight.objectsPerChunk = 0;
  content.tuning.enemyDamage = 0;
  for (let seed = 0; seed < 256; seed++) {
    const flight = createFlight(content, 1, seed, progress);
    const members = flight.objects.filter((object) => object.enemy?.archetype === "swarm");
    if (members.length === 4 && members[0]?.enemy?.packId) {
      const model = new GameModel(content);
      model.state.flight = flight;
      model.state.mode = "space";
      return { content, model, packId: members[0].enemy.packId };
    }
  }
  throw new Error("No four-member swarm fixture");
}
function members(model: GameModel, packId: string): SpaceObject[] {
  return model.state.flight!.objects.filter((object) => object.enemy?.packId === packId);
}
function reposition(object: SpaceObject, x: number, y = 100): void {
  object.x = x;
  object.y = y;
  object.enemy!.position = { x, y };
}
function defeat(model: GameModel, object: SpaceObject): void {
  const flight = model.state.flight!;
  const before = model.state.progress[1].disabledEnemies;
  flight.shots.push({
    damage: object.enemy!.hp,
    enemy: false,
    hitIds: [],
    id: `proof:${flight.nextId++}`,
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: object.x,
    y: object.y,
  });
  model.step(0.001, idle);
  expect(model.state.progress[1].disabledEnemies).toBe(before + 1);
  expect(flight.objects).not.toContain(object);
}
function regenerate(content: typeof PROTOTYPE, model: GameModel, packId: string): void {
  const flight = model.state.flight!;
  const kept = members(model, packId);
  flight.player = { x: content.tuning.chunkSize * 4, y: 0 };
  kept.forEach((object, index) => reposition(object, flight.player.x + 200 + index * 100));
  syncFlightRegion(content, flight);
  expect(flight.chunks).not.toContain("0,0");
  flight.player = { x: 0, y: 0 };
  kept.forEach((object, index) => reposition(object, 300 + index * 100));
  model.step(0.001, idle);
}

describe("casualty-preserving pack retention", () => {
  it("keeps a prior casualty at 25% through two survivor unloads, exact resume and bounded regeneration", () => {
    const { content, model, packId } = fixture();
    defeat(model, members(model, packId)[0]!);
    expect(members(model, packId)).toHaveLength(3);
    const flight = model.state.flight!;
    const departing = members(model, packId).slice(0, 2);
    departing.forEach((object, index) => reposition(object, 5000 + index * 1000));
    syncFlightRegion(content, flight);
    expect(members(model, packId)).toHaveLength(1);
    expect(flight.combat!.initialPackSizes[packId]).toBe(4);
    expect(flight.combat!.unloadedPackMembers).toEqual({ [packId]: 2 });
    expect(model.state.progress[1].disabledEnemies).toBe(1);
    model.step(0.001, idle);
    expect(members(model, packId)[0]!.enemy!.fleeing).toBe(false);
    const resumed = new GameModel(content, model.save());
    expect(resumed.state).toEqual(model.state);
    model.step(0.001, idle);
    resumed.step(0.001, idle);
    expect(resumed.state).toEqual(model.state);
    expect(members(resumed, packId)[0]!.enemy!.fleeing).toBe(false);

    regenerate(content, resumed, packId);
    const restored = resumed.state.flight!;
    expect(members(resumed, packId)).toHaveLength(3);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(members(resumed, packId).every((object) => !object.enemy!.fleeing)).toBe(true);
    resumed.step(0.001, idle);
    expect(members(resumed, packId)).toHaveLength(3);
    expect(new Set(restored.objects.map((object) => object.id)).size).toBe(restored.objects.length);

    reposition(members(resumed, packId)[0]!, 6000);
    syncFlightRegion(content, restored);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBe(1);
    regenerate(content, resumed, packId);
    expect(members(resumed, packId)).toHaveLength(3);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(members(resumed, packId).every((object) => !object.enemy!.fleeing)).toBe(true);

    defeat(resumed, members(resumed, packId)[0]!);
    resumed.step(0.001, idle);
    expect(members(resumed, packId)).toHaveLength(2);
    expect(members(resumed, packId).every((object) => object.enemy!.fleeing)).toBe(true);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    members(resumed, packId).forEach((object, index) => reposition(object, 7000 + index * 1000));
    syncFlightRegion(content, restored);
    expect(restored.combat!.initialPackSizes).not.toHaveProperty(packId);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(restored.world.notables).toEqual({});
    expect(restoreSave(resumed.save())).toEqual(resumed.state);
  });

  it.each(["destination", "guard"] as const)(
    "preserves a prior casualty fraction through %s layout clearance",
    (clearance) => {
      const { content, model, packId } = fixture();
      defeat(model, members(model, packId)[0]!);
      const flight = model.state.flight!;
      const survivors = members(model, packId);
      const points =
        clearance === "destination"
          ? [
              { x: 0, y: -1024 },
              { x: 50, y: -1024 },
              { x: 400, y: -1024 },
            ]
          : [
              { x: 690, y: 0 },
              { x: 700, y: 0 },
              { x: 1100, y: 0 },
            ];
      survivors.forEach((object, index) => reposition(object, points[index]!.x, points[index]!.y));
      if (clearance === "destination") {
        ensureDestination(content, "growers", flight);
      } else {
        flight.objects.push({
          hp: 1,
          id: "growers",
          kind: "destination",
          radius: 30,
          x: 1000,
          y: 0,
        });
        ensureRouteEncounter(content, "growers", flight);
      }
      expect(members(model, packId)).toHaveLength(1);
      expect(flight.combat!.initialPackSizes[packId]).toBe(4);
      expect(flight.combat!.unloadedPackMembers?.[packId]).toBe(2);
      model.step(0.001, idle);
      expect(members(model, packId)[0]!.enemy!.fleeing).toBe(false);
      expect(model.state.progress[1].disabledEnemies).toBe(1);
      expect(restoreSave(model.save())).toEqual(model.state);
    },
  );

  it("regenerates every survivor of a saved pack larger than its sector one roll", () => {
    const content = structuredClone(PROTOTYPE);
    content.tuning.flight.objectsPerChunk = 0;
    content.tuning.enemyDamage = 0;
    let found: { flight: ReturnType<typeof createFlight>; packId: string } | undefined;
    for (let seed = 0; seed < 512 && !found; seed++) {
      const flight = createFlight(content, 1, seed, progress);
      const solo = flight.objects.find(
        (object) =>
          (object.enemy?.archetype === "interceptor" || object.enemy?.archetype === "retaliator") &&
          object.enemy.packId?.startsWith("pack:"),
      );
      if (solo?.enemy?.packId) {
        found = { flight, packId: solo.enemy.packId };
      }
    }
    if (!found) {
      throw new Error("No sector one solo fixture");
    }
    const { flight, packId } = found;
    const model = new GameModel(content);
    model.state.flight = flight;
    model.state.mode = "space";
    expect(members(model, packId)).toHaveLength(1);
    // A save from the earlier shared roster: four members, one lost, two unloaded.
    flight.combat!.initialPackSizes[packId] = 4;
    flight.combat!.unloadedPackMembers = { [packId]: 2 };
    const resumed = new GameModel(content, model.save());
    expect(resumed.state).toEqual(model.state);

    regenerate(content, resumed, packId);
    const restored = resumed.state.flight!;
    expect(members(resumed, packId)).toHaveLength(3);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(resumed.state.progress[1].disabledEnemies).toBe(0);
    expect(members(resumed, packId).every((object) => !object.enemy!.fleeing)).toBe(true);
    expect(new Set(restored.objects.map((object) => object.id)).size).toBe(restored.objects.length);
    expect(restoreSave(resumed.save())).toEqual(resumed.state);
  });

  it("prunes a completely cleared ordinary pack before an interaction can serialize it", () => {
    const { content, model, packId } = fixture();
    const flight = model.state.flight!;
    members(model, packId).forEach((object, index) => reposition(object, index * 30, -1024));
    ensureDestination(content, "growers", flight);
    expect(members(model, packId)).toHaveLength(0);
    expect(flight.combat!.initialPackSizes).not.toHaveProperty(packId);
    expect(flight.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(restoreSave(model.save())).toEqual(model.state);
  });

  it("consumes only successfully admitted regenerated survivors when a safezone rejects other slots", () => {
    const { content, model, packId } = fixture();
    defeat(model, members(model, packId).at(-1)!);
    const flight = model.state.flight!;
    members(model, packId)
      .slice(1)
      .forEach((object, index) => reposition(object, 5000 + index * 1000));
    syncFlightRegion(content, flight);
    const friendly: SpaceObject = {
      hp: 1,
      id: "growers",
      kind: "destination",
      radius: 30,
      x: 511,
      y: 256,
    };
    flight.objects.push(friendly);
    model.state.progress[1].known.push("growers");
    regenerate(content, model, packId);
    expect(members(model, packId)).toHaveLength(2);
    expect(flight.combat!.initialPackSizes[packId]).toBe(4);
    expect(flight.combat!.unloadedPackMembers?.[packId]).toBe(1);
    expect(members(model, packId).every((object) => !object.enemy!.fleeing)).toBe(true);
    friendly.x = 30000;
    friendly.y = 30000;
    regenerate(content, model, packId);
    expect(members(model, packId)).toHaveLength(3);
    expect(flight.combat!.initialPackSizes[packId]).toBe(4);
    expect(flight.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
  });

  it("merges important inactive survivors once with unloaded ordinary survivors", () => {
    const { content, model, packId } = fixture();
    const flight = model.state.flight!;
    const active = members(model, packId)[0]!;
    flight.objects = [active];
    flight.combat = {
      initialPackSizes: { [packId]: 4 },
      routeEncounters: [],
      unloadedPackMembers: { [packId]: 1 },
    };
    const point = { x: 9000, y: 100 };
    const state = createEnemy(
      enemyCatalog.frigate,
      { archetype: "frigate", id: "support", packId, phase: 0.2 },
      point,
    );
    flight.world = {
      notables: {
        support: { ...point, enemy: state, hp: 10, id: "support", kind: "enemy", radius: 30 },
      },
      version: 1,
    };
    expect(restoreSave(model.save())).toEqual(model.state);
    model.step(0.001, idle);
    expect(active.enemy!.fleeing).toBe(false);
    const resumed = new GameModel(content, model.save());
    resumed.step(0.001, idle);
    expect(members(resumed, packId)[0]!.enemy!.fleeing).toBe(false);
    expect(resumed.state.flight!.combat!.unloadedPackMembers?.[packId]).toBe(1);
  });

  it.each([undefined, {}])(
    "bounds active and inactive pack totals with unloaded ledger %j",
    (unloadedPackMembers) => {
      const { model, packId } = fixture();
      const flight = model.state.flight!;
      flight.objects = members(model, packId).slice(0, 1);
      const point = { x: 9000, y: 100 };
      const state = createEnemy(
        enemyCatalog.frigate,
        { archetype: "frigate", id: "support", packId, phase: 0.2 },
        point,
      );
      flight.world = {
        notables: {
          support: { ...point, enemy: state, hp: 10, id: "support", kind: "enemy", radius: 30 },
        },
        version: 1,
      };
      flight.combat = {
        initialPackSizes: { [packId]: 2 },
        routeEncounters: [],
        ...(unloadedPackMembers === undefined ? {} : { unloadedPackMembers }),
      };
      expect(restoreSave(model.save())).toEqual(model.state);
      flight.combat.initialPackSizes[packId] = 1;
      expect(restoreSave(model.save())).toBeNull();
      flight.world.notables = {};
      expect(restoreSave(model.save())).toEqual(model.state);
      flight.combat.initialPackSizes[packId] = 0;
      expect(restoreSave(model.save())).toBeNull();
    },
  );

  it("rejects invalid or unrepresented unloaded ledgers without accepting phantom survivors", () => {
    const { model, packId } = fixture();
    const flight = model.state.flight!;
    flight.objects = members(model, packId).slice(0, 1);
    flight.combat = {
      initialPackSizes: { [packId]: 4 },
      routeEncounters: [],
      unloadedPackMembers: { [packId]: 2 },
    };
    expect(restoreSave(model.save())).toEqual(model.state);
    for (const unloadedPackMembers of [
      null,
      [],
      { [packId]: 0 },
      { [packId]: -1 },
      { [packId]: 1.5 },
      { [packId]: 4 },
      { [packId]: Infinity },
      { ghost: 1 },
    ]) {
      const snapshot = JSON.parse(model.save()) as {
        flight: { combat: { unloadedPackMembers: unknown } };
      };
      snapshot.flight.combat.unloadedPackMembers = unloadedPackMembers;
      expect(restoreSave(snapshot)).toBeNull();
    }
    const snapshot = JSON.parse(model.save()) as { flight: { objects: SpaceObject[] } };
    snapshot.flight.objects = [];
    expect(restoreSave(snapshot)).toBeNull();
  });
});
