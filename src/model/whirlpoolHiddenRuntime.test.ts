import { expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { supportEntropy } from "../testing/launchSeeds.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { ensureDestination, routeBlocked } from "./flight.ts";
import { GameModel } from "./game.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.state.progress[3].opened = true;
  model.startGalaxy(3);
  model.state.dialogue = null;
  return model;
}

it("reserves authored G3 capitals and holodisk fullstates before optional population without revealing them", () => {
  const model = launch();
  const flight = model.state.flight!;
  const whale = readRequiredRolePlan(flight, "whale")!;
  const family = readRequiredRolePlan(flight, "family")!;
  const disk = readRequiredRolePlan(flight, "holodisk")!;
  expect(whale.actors.map((actor) => actor.enemy!.archetype)).toEqual(["capital"]);
  expect(family.actors.map((actor) => actor.enemy!.archetype)).toEqual(["capital"]);
  expect(disk.actors[0]!.enemy!.archetype).toBe("capital");
  expect(
    disk.actors.filter((actor) => actor.enemy?.packId === WHIRLPOOL_CAPITAL_BOSS.swarmPack),
  ).toHaveLength(HOLODISKS.guard.packSize);
  expect(
    disk.actors.filter((actor) => actor.enemy?.escortOf === WHIRLPOOL_CAPITAL_BOSS.id),
  ).toHaveLength(2);
  expect(
    stationPopulationObjects(flight).some(
      (actor) => ["whale", "family", "holodisk"].includes(actor.id) || actor.routeId,
    ),
  ).toBe(false);
  const before = structuredClone(model.state);
  expect(model.map!.places.some(({ id }) => ["whale", "family", "holodisk"].includes(id))).toBe(
    false,
  );
  expect(
    model.targetMarkers(GAME_AREA).some(({ id }) => ["whale", "family", "holodisk"].includes(id)),
  ).toBe(false);
  void model.quests;
  void model.contextQuestDetails;
  expect(ensureDestination(CONTENT, "family", flight)).toBe(family.site);
  expect(model.state).toEqual(before);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
});

it("activates the saved capital only at the authored distance gate with stable site and exact actor identity", () => {
  const model = launch();
  const flight = model.state.flight!;
  const plan = readRequiredRolePlan(flight, "whale")!;
  const leader = plan.actors[0]!;
  const snapshot = structuredClone(leader);
  flight.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(0.001, idle);
  expect(readRequiredRolePlan(flight, "whale")).toBeNull();
  const active = stationPopulationObjects(flight).find(({ id }) => id === leader.id)!;
  expect(active).toBe(leader);
  expect(active).toEqual(snapshot);
  expect(routeBlocked("whale", flight)).toBe(true);
  expect(readRequiredRolePlan(flight, "family")).not.toBeNull();
  expect(readRequiredRolePlan(flight, "holodisk")).not.toBeNull();
  const beforeQueries = structuredClone(flight);
  void model.map;
  expect(flight).toEqual(beforeQueries);
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(flight);
});

it("materializes the authored family capital when that story stage becomes eligible", () => {
  const model = launch();
  const flight = model.state.flight!;
  const family = readRequiredRolePlan(flight, "family")!;
  const leader = family.actors[0]!;
  const expected = structuredClone(leader);
  const progress = model.state.progress[3];
  Object.assign(progress, { introduced: true, known: ["whale"], stage: 3 });
  const limit = CONTENT.tuning.introFreshDistance + 3 * CONTENT.tuning.encounterFreshDistance;
  flight.freshDistance = limit - 1;
  model.step(0.001, idle);
  expect(readRequiredRolePlan(flight, "family")?.actors[0]).toBe(leader);
  flight.freshDistance = limit;
  model.step(0.001, idle);
  expect(readRequiredRolePlan(flight, "family")).toBeNull();
  expect(stationPopulationObjects(flight).find(({ id }) => id === leader.id)).toBe(leader);
  expect(leader).toEqual(expected);
  expect(leader.enemy?.archetype).toBe("capital");
  expect(routeBlocked("family", flight)).toBe(true);
});

it("preserves hidden sites on fresh entry while resetting encounter identity and initialized clocks", () => {
  const model = launch();
  const old = model.state.flight!;
  const sites = structuredClone(model.state.progress[3].requiredSites);
  const actor = readRequiredRolePlan(old, "family")!.actors[0]!;
  actor.enemy!.age = 5;
  actor.enemy!.hardpoints[0]!.cooldown = 0.25;
  const resumed = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE, model.save());
  resumed.continueGame();
  expect(resumed.state.flight).toEqual(old);
  model.returnHome();
  expect(model.state.flight).toBeNull();
  model.startGalaxy(3);
  const fresh = model.state.flight!;
  expect(fresh.seed).toBe(old.seed);
  expect(fresh.encounterSeed).not.toBe(old.encounterSeed);
  expect(model.state.progress[3].requiredSites).toEqual(sites);
  const next = readRequiredRolePlan(fresh, "family")!.actors[0]!;
  expect(next.id).toBe(actor.id);
  expect(next).not.toBe(actor);
  expect(next.enemy!.age).toBe(0);
  expect(next.enemy!.hardpoints[0]!.cooldown).toBe(0);
});
