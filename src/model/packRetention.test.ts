import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { shipCatalogEntry } from "../data/enemyActors.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { relaunch } from "../testing/launch.ts";
import { createEnemy, damageEnemy } from "./enemyAi.ts";
import {
  createUnpopulatedFlight,
  ensureDestination,
  ensureRouteEncounter,
  populateFlight,
  stepFlight,
  syncFlightRegion,
} from "./flight.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { GalaxyProgress, SpaceObject, Vec } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: GalaxyProgress = {
  charted: [],
  deposited: 0,
  destroyedEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  greetings: {},
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};
function chartFlight(content: typeof CONTENT, galaxy: GalaxyNumber, seed: number) {
  const flight = createUnpopulatedFlight(content, galaxy, seed);
  flight.topology = CURRENT_FLIGHT_TOPOLOGY;
  populateFlight(content, progress, flight);
  return flight;
}

function fixture() {
  const content = structuredClone(CONTENT);
  // Enemy fire barely scratches Ada, so long fixtures never deplete her shield.
  content.tuning.flight.playerShotDamage = 1e-6;
  for (let seed = 0; seed < 64; seed++) {
    const flight = chartFlight(content, 1, seed);
    // The middle region plans fighter groups at the target of four.
    for (let x = 13000; x < 22000; x += content.tuning.chunkSize) {
      flight.player = { x, y: 0 };
      stepFlight(content, 0.001, idle, flight);
      const leader = flight.objects.find(
        (object) =>
          object.enemy?.archetype === "fighter" && object.enemy.packId?.startsWith("pack:"),
      );
      const packId = leader?.enemy?.packId;
      if (!packId) {
        continue;
      }
      const group = flight.objects.filter((object) => object.enemy?.packId === packId);
      expect(group).toHaveLength(4);
      expect(flight.combat!.initialPackSizes[packId]).toBe(4);
      const home = {
        x: group.reduce((sum, member) => sum + member.x, 0) / group.length,
        y: group.reduce((sum, member) => sum + member.y, 0) / group.length,
      };
      flight.player = { ...home };
      // Only this pack stays loaded, so its ledger is the only one the tests read.
      flight.objects = flight.objects.filter(
        (object) => !object.enemy?.packId?.startsWith("pack:") || object.enemy.packId === packId,
      );
      flight.combat = { initialPackSizes: { [packId]: 4 }, routeEncounters: [] };
      const model = new GameModel(content);
      model.state.flight = flight;
      model.state.mode = "space";
      // A flight has begun, as startGalaxy records.
      model.state.started = true;
      // Every conversation is heard: a restored model waits for Continue, so none may start.
      model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
      return { content, home, model, packId };
    }
  }
  throw new Error("No four-member fighter fixture");
}
function members(model: GameModel, packId: string): SpaceObject[] {
  return model.state.flight!.objects.filter((object) => object.enemy?.packId === packId);
}
function reposition(object: SpaceObject, x: number, y: number): void {
  object.x = x;
  object.y = y;
  object.enemy!.position = { x, y };
}
function defeat(model: GameModel, object: SpaceObject): void {
  const flight = model.state.flight!;
  const before = model.state.progress[model.state.flight!.galaxy].destroyedEnemies;
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
  expect(model.state.progress[model.state.flight!.galaxy].destroyedEnemies).toBe(before + 1);
  expect(flight.objects).not.toContain(object);
}
/** Takes Ada and the kept members far enough away to unload the pack's chunk, then home. */
function regenerate(content: typeof CONTENT, home: Vec, model: GameModel, packId: string): void {
  const flight = model.state.flight!;
  const kept = members(model, packId);
  flight.player = { x: home.x + content.tuning.chunkSize * 4, y: home.y };
  kept.forEach((object, index) =>
    reposition(object, flight.player.x + 200 + index * 100, home.y + 100),
  );
  syncFlightRegion(content, flight);
  expect(flight.chunks).not.toContain(packId.slice("pack:".length));
  flight.player = { ...home };
  kept.forEach((object, index) => reposition(object, home.x + 300 + index * 100, home.y + 100));
  model.step(0.001, idle);
}

describe("casualty-preserving pack retention", () => {
  it("keeps a prior casualty at 25% through two survivor unloads, exact resume and bounded regeneration", () => {
    const { content, home, model, packId } = fixture();
    defeat(model, members(model, packId)[0]!);
    expect(members(model, packId)).toHaveLength(3);
    const flight = model.state.flight!;
    const departing = members(model, packId).slice(0, 2);
    departing.forEach((object, index) =>
      reposition(object, home.x + 5000 + index * 1000, home.y + 100),
    );
    syncFlightRegion(content, flight);
    expect(members(model, packId)).toHaveLength(1);
    expect(flight.combat!.initialPackSizes[packId]).toBe(4);
    expect(flight.combat!.unloadedPackMembers).toEqual({ [packId]: 2 });
    expect(model.state.progress[model.state.flight!.galaxy].destroyedEnemies).toBe(1);
    // The survivor fights inside the play view, so the exact resume covers its fire clocks.
    reposition(members(model, packId)[0]!, flight.player.x + 150, flight.player.y + 100);
    model.step(0.001, idle);
    expect(members(model, packId)[0]!.enemy!.fleeing).toBe(false);
    const resumed = relaunch(content, model.save());
    expect(resumed.state).toEqual(model.state);
    model.step(0.001, idle);
    resumed.step(0.001, idle);
    expect(resumed.state).toEqual(model.state);
    expect(members(resumed, packId)[0]!.enemy!.fleeing).toBe(false);

    regenerate(content, home, resumed, packId);
    const restored = resumed.state.flight!;
    expect(members(resumed, packId)).toHaveLength(3);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(members(resumed, packId).every((object) => !object.enemy!.fleeing)).toBe(true);
    resumed.step(0.001, idle);
    expect(members(resumed, packId)).toHaveLength(3);
    expect(new Set(restored.objects.map((object) => object.id)).size).toBe(restored.objects.length);

    reposition(members(resumed, packId)[0]!, home.x + 6000, home.y + 100);
    syncFlightRegion(content, restored);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBe(1);
    regenerate(content, home, resumed, packId);
    expect(members(resumed, packId)).toHaveLength(3);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(members(resumed, packId).every((object) => !object.enemy!.fleeing)).toBe(true);

    defeat(resumed, members(resumed, packId)[0]!);
    resumed.step(0.001, idle);
    expect(members(resumed, packId)).toHaveLength(2);
    expect(members(resumed, packId).every((object) => object.enemy!.fleeing)).toBe(true);
    expect(restored.combat!.initialPackSizes[packId]).toBe(4);
    members(resumed, packId).forEach((object, index) =>
      reposition(object, home.x + 7000 + index * 1000, home.y + 100),
    );
    syncFlightRegion(content, restored);
    expect(restored.combat!.initialPackSizes).not.toHaveProperty(packId);
    expect(restored.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(restored.world.notables).toEqual({});
    expect(restoreSave(resumed.save())).toEqual(resumed.state);
  });

  it.each(["destination", "guard"] as const)(
    "preserves a prior casualty fraction through %s placement",
    (clearance) => {
      const { content, home, model, packId } = fixture();
      defeat(model, members(model, packId)[0]!);
      const flight = model.state.flight!;
      const survivors = members(model, packId);
      // A destination lands two chunks ahead of Ada; a guard's station sits beside its site.
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
      survivors.forEach((object, index) =>
        reposition(object, home.x + points[index]!.x, home.y + points[index]!.y),
      );
      const expectedSurvivors = structuredClone(survivors);
      if (clearance === "destination") {
        ensureDestination(content, "growers", flight);
      } else {
        flight.objects.push({
          hp: 1,
          id: "growers",
          kind: "destination",
          radius: 30,
          x: home.x + 1000,
          y: home.y,
        });
        ensureRouteEncounter(content, "growers", flight);
        expect(flight.combat!.emptyRoutePlans).toBeUndefined();
        expect(members(model, packId)).toEqual(expectedSurvivors);
      }
      expect(members(model, packId)).toHaveLength(clearance === "destination" ? 1 : 3);
      expect(flight.combat!.initialPackSizes[packId]).toBe(4);
      expect(flight.combat!.unloadedPackMembers?.[packId]).toBe(
        clearance === "destination" ? 2 : undefined,
      );
      model.step(0.001, idle);
      expect(members(model, packId)[0]!.enemy!.fleeing).toBe(false);
      expect(model.state.progress[model.state.flight!.galaxy].destroyedEnemies).toBe(1);
      expect(restoreSave(model.save())).toEqual(model.state);
    },
  );

  it("prunes a completely cleared ordinary pack before an interaction can serialize it", () => {
    const { content, home, model, packId } = fixture();
    const flight = model.state.flight!;
    members(model, packId).forEach((object, index) =>
      reposition(object, home.x + index * 30, home.y - 1024),
    );
    ensureDestination(content, "growers", flight);
    expect(members(model, packId)).toHaveLength(0);
    expect(flight.combat!.initialPackSizes).not.toHaveProperty(packId);
    expect(flight.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(restoreSave(model.save())).toEqual(model.state);
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
    const resumed = relaunch(content, model.save());
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

describe("per-role encounter restore", () => {
  /** Launches into Andromeda's middle region where a capital battle loads, then resumes. */
  function battle() {
    const content = structuredClone(CONTENT);
    // Enemy fire barely scratches Ada, so long fixtures never deplete her shield.
    content.tuning.flight.playerShotDamage = 1e-6;
    let flight = chartFlight(content, 5, 25);
    let capital: SpaceObject | undefined;
    for (let x = 12000; !capital && x < 60000; x += content.tuning.chunkSize) {
      flight = chartFlight(content, 5, 25);
      flight.player = { x, y: 12000 };
      stepFlight(content, 0.001, idle, flight);
      capital = flight.objects.find(
        (object) =>
          object.enemy?.archetype === "capital" && object.enemy.packId?.startsWith("pack:"),
      );
    }
    expect(capital).toBeDefined();
    const model = new GameModel(content);
    Object.assign(model.state, {
      flight,
      mode: "space",
      selectedGalaxy: 5,
      started: true,
      unlocked: [1, 5],
    });
    const packId = capital!.enemy!.packId!;
    const leader = `${packId}:0`;
    const escorts = `${packId}:escorts`;
    const resumed = relaunch(content, model.save());
    expect(restoreSave(model.save())?.flight).toEqual(model.state.flight);
    expect(members(resumed, packId).map(({ id }) => id)).toEqual([leader]);
    expect(resumed.state.flight!.combat!.profiledPacks?.[packId]).toBe("capital");
    expect(members(resumed, packId)[0]!.enemy!.hullProfile).toBeUndefined();
    expect(members(resumed, escorts)).toHaveLength(4);
    return { content, escorts, leader, model: resumed, packId };
  }
  const destroy = (model: GameModel, object: SpaceObject) => {
    const definition = shipCatalogEntry(object.enemy!.archetype)!;
    for (const part of definition.hardpoints) {
      object.enemy = damageEnemy(definition, { amount: 99, hardpointId: part.id }, object.enemy!);
    }
    object.enemy = damageEnemy(definition, { amount: 99, hardpointId: null }, object.enemy!);
    const before = model.state.progress[model.state.flight!.galaxy].destroyedEnemies;
    model.step(0.001, idle);
    expect(model.state.progress[model.state.flight!.galaxy].destroyedEnemies).toBe(before + 1);
  };
  /** Takes Ada and the kept ships far enough away to unload the battle's cell, then back. */
  function revisit(
    content: typeof CONTENT,
    model: GameModel,
    kept: SpaceObject[],
    check?: () => void,
  ): void {
    const flight = model.state.flight!;
    const start = { ...flight.player };
    const away = content.tuning.chunkSize * 12;
    flight.player = { x: start.x + away, y: start.y };
    kept.forEach((object, index) =>
      reposition(object, start.x + away + 200 + index * 100, start.y + 100),
    );
    syncFlightRegion(content, flight);
    check?.();
    flight.player = start;
    kept.forEach((object, index) => reposition(object, start.x - 600 - index * 100, start.y));
    model.step(0.001, idle);
  }

  it("keeps a destroyed capital destroyed while its escorts return as escorts", () => {
    const { content, escorts, leader, model, packId } = battle();
    const capital = members(model, packId)[0]!;
    expect(capital.id).toBe(leader);
    destroy(model, capital);
    expect(members(model, packId)).toHaveLength(0);
    const guards = members(model, escorts);
    expect(guards).toHaveLength(4);
    revisit(content, model, guards);
    const flight = model.state.flight!;
    expect(members(model, packId)).toHaveLength(0);
    expect(flight.objects.some((object) => object.enemy?.archetype === "capital")).toBe(false);
    expect(members(model, escorts)).toHaveLength(4);
    expect(
      members(model, escorts).every(
        (object) => object.enemy?.archetype === "fighter" && object.enemy.escortOf === leader,
      ),
    ).toBe(true);
    expect(flight.combat!.initialPackSizes).toMatchObject({ [escorts]: 4, [packId]: 1 });
  });

  it("restores an unloaded capital as the capital while lost escorts stay lost", () => {
    const { content, escorts, leader, model, packId } = battle();
    const guards = members(model, escorts);
    destroy(model, guards[0]!);
    destroy(model, guards[1]!);
    const survivors = members(model, escorts);
    expect(survivors).toHaveLength(2);
    revisit(content, model, survivors, () => {
      const flight = model.state.flight!;
      // The capital unloaded alive; its loaded escorts keep the encounter represented.
      expect(members(model, packId)).toHaveLength(0);
      expect(flight.combat!.unloadedPackMembers).toEqual({ [packId]: 1 });
      expect(restoreSave(model.save())).toEqual(model.state);
    });
    const flight = model.state.flight!;
    const restored = members(model, packId);
    expect(restored.map((object) => [object.id, object.enemy?.archetype])).toEqual([
      [leader, "capital"],
    ]);
    expect(members(model, escorts)).toHaveLength(2);
    expect(flight.combat!.unloadedPackMembers?.[packId]).toBeUndefined();
    expect(flight.combat!.initialPackSizes).toMatchObject({ [escorts]: 4, [packId]: 1 });
  });
});
