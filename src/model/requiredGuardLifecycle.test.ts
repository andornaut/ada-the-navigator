import { expect, it } from "vitest";

import { WHIRLPOOL_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { FRIGATE_ESCORT_COUNT } from "../data/enemyCatalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { SIMULATION_STEP_SECONDS } from "../data/simulation.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { relaunch, supportEntropy } from "../testing/launch.ts";
import { GAME_AREA } from "./edgeMarkers.ts";
import { routeBlocked } from "./flight.ts";
import { hit } from "./flight/hitResolution.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { escortPackId, worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations/index.ts";
import { readRequiredPlan } from "./requiredEncounterPlans.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch() {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.prologueSeen = true;
  model.state.progress[1].opened = true;
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(1);
  model.state.dialogue = null;
  return model;
}

it("keeps required guards hidden and blocks story progress until hull defeat", () => {
  const model = launch();
  const flight = model.state.flight!;
  expect(flight).not.toBeNull();
  const pending = readRequiredPlan(flight, "growers")!;
  expect(pending).not.toBeNull();
  expect(pending.support).toHaveLength(0);
  expect(model.state.progress[1].known).toEqual([]);
  expect(flight.objects.some((actor) => actor.id === "growers" || actor.routeId)).toBe(false);
  const beforeQueries = structuredClone(flight.requiredPlans);
  const activeIds = flight.objects.map(({ id }) => id);
  expect(
    model.map!.places.some(({ id }) => id === pending.site.id || id === pending.leader.id),
  ).toBe(false);
  expect(
    model
      .targetMarkers(GAME_AREA)
      .some(({ id }) => id === pending.site.id || id === pending.leader.id),
  ).toBe(false);
  expect(model.quests).toEqual([]);
  expect(model.contextQuestDetails).toBeNull();
  void model.contextAction;
  expect(flight.requiredPlans).toEqual(beforeQueries);
  expect(flight.objects.map(({ id }) => id)).toEqual(activeIds);
  const originalSite = { x: pending.site.x, y: pending.site.y };
  flight.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(SIMULATION_STEP_SECONDS, idle);
  const leader = flight.objects.find((actor) => actor.id === pending.leader.id)!;
  expect(leader).toBe(pending.leader);
  expect(readRequiredPlan(flight, "growers")).toBeNull();
  expect(flight.objects.find((actor) => actor.id === "growers")).toMatchObject(originalSite);
  expect(routeBlocked("growers", flight)).toBe(true);
  flight.player = { ...originalSite };
  model.step(SIMULATION_STEP_SECONDS, idle);
  const progress = model.state.progress[1];
  expect(progress.introduced).toBe(false);
  expect(progress.known).not.toContain("growers");
  expect(progress.questItem).toBeNull();
  hit(CONTENT, leader.enemy!.hp, null, leader, flight, []);
  model.step(SIMULATION_STEP_SECONDS, idle);
  expect(progress.known).toContain("growers");
  expect(progress.introduced).toBe(false);
  expect(progress.questItem).toBeNull();
  expect(model.state.dialogue).toBeNull();
  expect(model.contextAction).toBe("talk");
  model.interact();
  expect(model.state.dialogue?.context).toBe("grower");
  expect(progress.introduced).toBe(true);
  expect(progress.stage).toBe(1);
  expect(progress.questItem).toBe("food");
  expect(progress.destroyedEnemies).toBe(0);
  model.choose("continue");
  model.step(SIMULATION_STEP_SECONDS, idle);
  expect(progress.stage).toBe(1);
  expect(stationPopulationObjects(flight).some((actor) => actor.id === leader.id)).toBe(false);
});

it("preserves hidden full states through Continue and retains site coordinates across fresh entries", () => {
  const model = launch();
  const original = model.state.flight!;
  const pending = readRequiredPlan(original, "growers")!;
  pending.leader.enemy!.hardpoints[0]!.cooldown = 0.73;
  pending.leader.enemy!.firePhasesInitialized = true;
  const plans = structuredClone(original.requiredPlans);
  const sites = structuredClone(model.state.progress[1].requiredSites);
  const resumed = relaunch(CONTENT, model.save());
  expect(resumed.state.flight).not.toBeNull();
  expect(resumed.state.flight!.requiredPlans).toEqual(plans);
  expect(resumed.state.progress[1].requiredSites).toEqual(sites);
  expect(resumed.state.progress[1].known).toEqual([]);
  const seed = resumed.state.flight!.encounterSeed;
  resumed.state.dialogue = null;
  resumed.returnHome();
  expect(resumed.state.flight).toBeNull();
  resumed.startGalaxy(1);
  const next = resumed.state.flight!;
  expect(next).not.toBeNull();
  expect(next.encounterSeed).not.toBe(seed);
  expect(resumed.state.progress[1].requiredSites).toEqual(sites);
  expect(
    Object.values(next.requiredPlans ?? {}).map(({ site }) => ({
      id: site.id,
      x: site.x,
      y: site.y,
    })),
  ).toEqual(Object.values(plans ?? {}).map(({ site }) => ({ id: site.id, x: site.x, y: site.y })));
  expect(next.combat?.emptyRoutePlans).toBeUndefined();
});

it("keeps Sounder and the disk formation outside Sunflower required-site planning", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked = [1, 3];
  model.state.prologueSeen = true;
  model.state.progress[1].holodisk = true;
  Object.assign(model.state.progress[3], {
    introduced: true,
    known: ["whale", "family"],
    opened: true,
    questComplete: true,
    stage: 5,
  });
  model.state.seenConversations.push(...CONVERSATIONS.map(({ id }) => id));
  model.startGalaxy(3);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  expect(flight.galaxy).toBe(3);
  expect(Object.keys(flight.requiredPlans ?? {})).toEqual([]);
  model.step(SIMULATION_STEP_SECONDS, idle);
  expect(flight.objects.some(({ id }) => id === "holodisk")).toBe(false);
  const site = model.state.progress[3].requiredSites!.holodisk!;
  expect(model.map?.places.find(({ id }) => id === "holodisk")).toMatchObject(site);
  const population = stationPopulationObjects(flight);
  const leader = population.find((actor) => actor.routeId === "holodisk");
  expect(leader).toMatchObject({ enemy: { archetype: "capital" }, id: WHIRLPOOL_CAPITAL_BOSS.id });
  const { id, swarmPack } = WHIRLPOOL_CAPITAL_BOSS;
  const escortPack = escortPackId(id);
  const escorts = population.filter((actor) => actor.enemy?.escortOf === id);
  expect(escorts).toHaveLength(FRIGATE_ESCORT_COUNT);
  expect(
    escorts.every(
      (actor) =>
        actor.enemy?.archetype === "fighter" &&
        actor.enemy.packId === escortPack &&
        actor.persistent,
    ),
  ).toBe(true);
  const pack = population.filter((actor) => actor.enemy?.packId === swarmPack);
  expect(pack).toHaveLength(HOLODISKS.guard.packSize);
  expect(
    pack.every((actor) => actor.enemy?.archetype === HOLODISKS.guard.pack && actor.persistent),
  ).toBe(true);
  expect(flight.combat?.initialPackSizes[swarmPack]).toBe(HOLODISKS.guard.packSize);
  expect(flight.combat?.initialPackSizes[escortPack]).toBe(FRIGATE_ESCORT_COUNT);
  flight.player = { x: site.x + 20000, y: site.y };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.objects.some((actor) => actor.id === id)).toBe(false);
  expect(flight.world.notables[id]).toBe(leader);
  expect(routeBlocked("holodisk", flight)).toBe(true);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
});
