import { describe, expect, it } from "vitest";

import { SUNFLOWER_BOSS_CUES, SUNFLOWER_CAPITAL_BOSS } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/storyShips.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import { SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { playOpening, readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { worldNearestSettlerStation } from "./andromedaPlaces.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { enemyStardust } from "./drops.ts";
import { createEnemy, damageEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import {
  activateRequiredRoute,
  ensureDestination,
  ensureHuntingPacks,
  ensureRouteEncounter,
  ensureStation,
  populateFlight,
  routeBlocked,
  routeGuardPlanResult,
  syncFlightRegion,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldRecordObjectRemoval, worldSyncFlightRegion } from "./geography.ts";
import { stationPopulationObjects } from "./hostileStations.ts";
import { needleCourses } from "./needle.ts";
import { rememberRequiredSite } from "./requiredEncounterPlans.ts";
import { readRequiredRolePlan } from "./requiredRolePlans.ts";
import { flightStationContext } from "./stations.ts";
import type { FlightState } from "./types.ts";
import { collectWeapon } from "./weapons.ts";

/** Test support: admit the saved required encounter, then disable its actual noncombat-fixture guard. */
function disableStoryGuard(content: GameContent, flight: FlightState, id: string): void {
  const encounter = activateRequiredRoute(content, id, flight);
  if (encounter.status === "resolved") {
    return;
  }
  if (encounter.status !== "created" && encounter.status !== "existing") {
    throw new Error(`Expected the saved required guard for ${id}, got ${encounter.status}`);
  }
  const guard = encounter.guard;
  if (guard.routeId !== id || guard.enemy?.archetype !== "frigate") {
    throw new Error(`Expected the actual required frigate for ${id}`);
  }
  guard.enemy.disabled = true;
}

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch(model: GameModel, galaxy: GalaxyNumber = 1) {
  model.startGalaxy(galaxy);
}

it("talks and salvages within the 160 Talk range, whatever the exclusion radius", () => {
  expect(CONTENT.tuning.talkRange).toBe(160);
  // A smaller exclusion radius leaves the interaction range alone.
  const content = { ...CONTENT, tuning: { ...CONTENT.tuning, exclusionRadius: 40 } };
  const model = new GameModel(content, supportEntropy, SAVE_RESTORE);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.startGalaxy(1);
  readStory(model);
  model.state.dialogue = null;
  const flight = model.state.flight!;
  ensureDestination(content, "growers", flight);
  const growers = flight.objects.find((object) => object.id === "growers")!;
  model.state.progress[1].known.push("growers");
  flight.objects = [growers];
  flight.player = { x: growers.x + 150, y: growers.y };
  expect(model.contextLabel).toBe("Talk");
  flight.player = { x: growers.x + 170, y: growers.y };
  expect(model.contextLabel).toBeUndefined();
  const at = { x: flight.player.x + 150, y: flight.player.y };
  const enemy = createEnemy(
    enemyDefinition(1, "frigate"),
    { archetype: "frigate", id: "spared", packId: null, phase: 0 },
    at,
  );
  enemy.disabled = true;
  flight.objects.push({ ...at, enemy, hp: enemy.hp, id: enemy.id, kind: "enemy", radius: 40 });
  expect(model.contextLabel).toBe("Salvage");
});

it("offers Salvage beside a disabled heavy and salvages it on Use", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  playOpening(model);
  const flight = model.state.flight!;
  flight.objects = [];
  const at = { x: flight.player.x + 100, y: flight.player.y };
  const enemy = createEnemy(
    enemyDefinition(1, "frigate"),
    { archetype: "frigate", id: "spared", packId: null, phase: 0 },
    at,
  );
  flight.objects.push({ ...at, enemy, hp: enemy.hp, id: enemy.id, kind: "enemy", radius: 40 });
  expect(model.contextLabel).not.toBe("Salvage");
  enemy.disabled = true;
  expect(model.contextLabel).toBe("Salvage");
  model.interact();
  expect(enemy.salvaged).toBe(true);
  expect(model.contextLabel).not.toBe("Salvage");
});
function arrive(model: GameModel, id: string) {
  const f = model.state.flight!;
  if ((f.galaxy === 2 || f.galaxy === 3) && readRequiredRolePlan(f, id)) {
    const progress = model.state.progress[f.galaxy];
    f.freshDistance = Math.max(
      f.freshDistance,
      CONTENT.tuning.introFreshDistance + progress.stage * CONTENT.tuning.encounterFreshDistance,
    );
    model.step(0.001, idle);
  }
  ensureDestination(CONTENT, id, f);
  const target = f.objects.find((o) => o.id === id)!;
  f.player = { x: target.x, y: target.y };
  // Direct test travel settles the active region as production travel does.
  syncFlightRegion(CONTENT, f);
  if (f.galaxy === 2 || f.galaxy === 3) {
    const guard = stationPopulationObjects(f).find((actor) => actor.routeId === id);
    if (guard?.enemy) {
      const definition = enemyEquipmentDefinition(f.galaxy, guard.enemy);
      for (const part of definition.hardpoints.filter((part) => part.kind === "weapon")) {
        guard.enemy = damageEnemy(
          definition,
          { amount: part.hp, hardpointId: part.id },
          guard.enemy,
        );
      }
    }
  }
  if (
    f.galaxy === 1 &&
    (f.requiredPlans?.[id] || routeGuardPlanResult(f, id).status !== "unknown")
  ) {
    disableStoryGuard(CONTENT, f, id);
  }
  if (!model.state.progress[f.galaxy].known.includes(id)) {
    model.state.progress[f.galaxy].known.push(id);
  }
  model.state.dialogue = null;
  f.dangerFor = 0;
}
function talk(model: GameModel, id: string) {
  arrive(model, id);
  model.interact();
  expect(model.state.dialogue).not.toBeNull();
  model.choose("continue");
}
/** Returns home and reads the waiting scenes, taking each choice page's `choice`. */
function finishHome(model: GameModel, choice = 1) {
  for (
    let page = 0;
    model.state.dialogue?.choices.some(({ id }) => id === "continue") && page < 10;
    page++
  ) {
    model.choose("continue");
  }
  model.returnHome();
  expect(model.storyView?.page.id).toBe("resolution");
  readStory(model, choice);
}
/** Crosses the mounted practice and Eye using actual flight movement and explicit choices. */
function finishNeedle(model: GameModel): void {
  launch(model, 4);
  const visit = (id: string) => {
    const flight = model.state.flight!;
    const target = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
    expect(target).toBeTruthy();
    flight.player = { x: target!.x, y: target!.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(0.001, idle);
    model.interact();
    model.dismissNotice();
    const budget = CONVERSATIONS.reduce((sum, conversation) => sum + conversation.lines.length, 0);
    for (let line = 0; !model.state.dialogue && line < budget; line++) {
      expect(model.conversation, `conversation before ${id}`).not.toBeNull();
      model.dismissConversation();
    }
  };
  visit("elderLoom");
  expect(model.state.dialogue?.context).toBe("needle.arrival");
  model.choose("continue");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.learning");
  model.choose("independent");
  for (const kind of ["practice", "eye"] as const) {
    const course = needleCourses(model.state.flight!)![kind];
    for (const [index, gate] of course.gates.entries()) {
      const flight = model.state.flight!;
      // Ambient ships and rocks play no part in lighting a gate, so each crossing meets only the
      // region it generates and the channel's own debris.
      flight.objects = flight.objects.filter(
        (object) => object.kind !== "enemy" && object.kind !== "rock",
      );
      flight.player = {
        x: gate.point.x - gate.tangent.x * 0.1,
        y: gate.point.y - gate.tangent.y * 0.1,
      };
      flight.velocity = { x: gate.tangent.x * 20, y: gate.tangent.y * 20 };
      model.step(0.05, { ...idle, move: { x: gate.tangent.x * 0.25, y: gate.tangent.y * 0.25 } });
      expect(model.state.progress[4].needle?.[kind === "practice" ? "practiceLit" : "eyeLit"]).toBe(
        index + 1,
      );
    }
    if (kind === "practice") {
      visit("elderLoom");
      expect(model.state.dialogue?.context).toBe("needle.practiceComplete");
      model.choose("continue");
    }
  }
  visit("holodisk");
  expect(model.state.dialogue?.context).toBe("needle.collect");
  model.choose("continue");
  readStory(model);
  expect(model.state.progress[4].questComplete).toBe(true);
  expect(model.state.progress[4].holodisk).toBe(true);
  finishHome(model);
  expect(model.state.progress[4].resolved).toBe(true);
}
/** Completes Andromeda through accepted story targets and actual Use and Continue actions. */
function finishAndromeda(model: GameModel): void {
  launch(model, 5);
  const visit = (id: string) => {
    const flight = model.state.flight!;
    const target = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
    expect(target, id).toBeTruthy();
    flight.player = { x: target!.x, y: target!.y };
    flight.velocity = { x: 0, y: 0 };
    model.step(0.001, idle);
  };
  const continuePanel = (context: string) => {
    expect(model.state.dialogue?.context).toBe(`andromeda:${context}`);
    expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual(["continue"]);
    model.choose("continue");
  };
  const flight = model.state.flight!;
  const station = worldNearestSettlerStation(flightStationContext(flight), ECONOMY, flight.player);
  ensureStation(CONTENT, station.id, flight);
  visit(station.id);
  if (!model.state.dialogue) {
    model.interact();
  }
  continuePanel("arrival");
  visit("pip");
  model.interact();
  continuePanel("confession");
  visit(model.state.progress[5].andromeda!.station!);
  model.interact();
  continuePanel("ownsUp");
  visit(model.state.progress[5].andromeda!.settlement!);
  model.interact();
  continuePanel("parts");
  expect(model.state.progress[5].questItem).toBe("beaconParts");
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  visit("darkBeacon");
  model.interact();
  continuePanel("repaired");
  expect(model.state.progress[5].questComplete).toBe(true);
  visit("pip");
  model.interact();
  continuePanel("holodisk");
  readStory(model);
  expect(model.state.progress[5].holodisk).toBe(true);
  finishHome(model);
  expect(model.state.progress[5].resolved).toBe(true);
}
/** Recovers the current galaxy one or two holodisk and continues past its insertion. */
function recoverHolodisk(model: GameModel) {
  if (model.state.flight!.galaxy === 1) {
    arrive(model, "workshop");
    model.interact();
  } else {
    // Dock waits for the docking scene and its line, then the hub's shop sells the holodisk.
    const flight = model.state.flight!;
    if (flight.storyScene?.lineDue) {
      flight.storyScene.at =
        flight.time - CARTWHEEL_STORY_SHIPS.scenes[flight.storyScene.id].duration;
      model.step(0.01, idle);
      for (let line = 0; line < 10 && model.state.dialogue; line++) {
        model.choose("continue");
      }
    }
    model.state.economy.stardust += HOLODISKS.hubPrice;
    arrive(model, "hub");
    model.interact();
    expect(model.state.docked).toBe("hub");
    expect(model.buy({ kind: "holodisk" })).toEqual({ kind: "bought", price: HOLODISKS.hubPrice });
  }
  if (model.state.dialogue?.context === "holodiskHandover") {
    model.choose("continue");
  }
  // The holodisk moment's pages aboard, bounded so a page that never moves on fails.
  for (let page = 0; model.screen === "story" && page < 8; page++) {
    model.storyNext();
  }
  expect(model.state.progress[model.state.flight!.galaxy].holodisk).toBe(true);
}
function introduce(model: GameModel, id: string) {
  arrive(model, id);
  model.step(0.01, idle);
  expect(model.state.dialogue).not.toBeNull();
  model.choose("continue");
}

describe("Captain Tally in Sunflower", () => {
  const { cacheId, id, routeId } = SUNFLOWER_CAPITAL_BOSS;
  const flightOf = (model: GameModel) => model.state.flight!;
  const actorOf = (model: GameModel) => capitalBossActor(flightOf(model), id)!;
  const stardustDropped = (flight: FlightState) =>
    flight.objects
      .filter(({ role }) => role === "stardust")
      .reduce((total, object) => total + (object.amount ?? 0), 0);

  function flyTo(model: GameModel, x: number, y: number): void {
    const flight = flightOf(model);
    flight.player = { x, y };
    flight.velocity = { x: 0, y: 0 };
    worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  }

  function traded(): GameModel {
    const model = new GameModel(CONTENT, () => 173, SAVE_RESTORE);
    launch(model);
    introduce(model, "growers");
    talk(model, "workshop");
    talk(model, "salvagers");
    expect(model.state.progress[1].capitalBoss).toBeUndefined();
    talk(model, "workshop");
    model.step(0.01, idle);
    expect(model.state.progress[1].capitalBoss?.phase).toBe("active");
    expect(model.map?.places.find((place) => place.id === id)).toMatchObject({
      label: "Hammer",
      objective: false,
      travel: true,
    });
    endArrivalGrace(flightOf(model));
    return model;
  }

  function approach(model: GameModel): void {
    const boss = actorOf(model);
    flyTo(model, boss.x + 300, boss.y);
    model.step(1 / 60, idle);
  }

  it("preserves the optional patrol, named hail and wounded hull through paging, Continue and a new flight", () => {
    let model = traded();
    expect(model.bossHud()).toBeNull();
    expect(model.state.progress[1].holodisk).toBe(false);
    recoverHolodisk(model);
    expect(model.bossHud()).toBeNull();
    expect(model.state.progress[1].capitalBoss?.phase).toBe("active");

    approach(model);
    const boss = actorOf(model);
    const definition = enemyEquipmentDefinition(1, boss.enemy!);
    expect(model.bossHud()).toEqual({
      captain: "Captain Tally",
      disabled: false,
      hull: definition.hp,
      id,
      maxHull: definition.hp,
      ship: "Hammer",
    });
    expect(model.conversation).toMatchObject({
      ...SUNFLOWER_BOSS_CUES.approach,
      name: "Captain Tally",
    });
    const damagedPart = definition.hardpoints[0]!;
    boss.enemy = damageEnemy(
      definition,
      { amount: damagedPart.hp, hardpointId: damagedPart.id },
      boss.enemy!,
    );
    boss.enemy = damageEnemy(definition, { amount: 1, hardpointId: null }, boss.enemy);
    boss.hp = boss.enemy.hp;

    const home = flightOf(model).objects.find(({ id }) => id === "growers")!;
    flyTo(model, home.x, home.y);
    expect(flightOf(model).objects.some((object) => object.id === id)).toBe(false);
    expect(model.bossHud()).toBeNull();
    model = relaunch(CONTENT, model.save());
    expect(model.state.progress[1].capitalBoss?.phase).toBe("active");
    expect(actorOf(model).enemy?.hardpoints.find(({ id }) => id === damagedPart.id)?.hp).toBe(0);
    approach(model);
    expect(model.bossHud()?.hull).toBe(definition.hp - 1);
    expect(model.conversation).toMatchObject(SUNFLOWER_BOSS_CUES.hardpoint);

    flyTo(model, home.x, home.y);
    flightOf(model).dangerFor = 0;
    model.returnHome();
    expect(model.state.progress[1].capitalBoss?.phase).toBe("away");
    model = relaunch(CONTENT, model.save());
    expect(model.state.progress[1].capitalBoss?.phase).toBe("away");
    launch(model);
    endArrivalGrace(flightOf(model));
    approach(model);
    expect(model.bossHud()?.hull).toBe(definition.hp - 1);
    const flight = flightOf(model);
    expect(flight.objects.filter((object) => object.id === id)).toHaveLength(1);
    expect(flight.world.notables).not.toHaveProperty(id);
    expect(model.conversation?.text).not.toBe(SUNFLOWER_BOSS_CUES.approach.text);
    expect(model.conversation?.text).not.toBe(SUNFLOWER_BOSS_CUES.hardpoint.text);
  });

  it("salvages via Use, marks a normal-flight route and allows exactly one Ore claim across flights", () => {
    let model = traded();
    approach(model);
    const boss = actorOf(model);
    const definition = enemyEquipmentDefinition(1, boss.enemy!);
    for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
      boss.enemy = damageEnemy(definition, { amount: part.hp, hardpointId: part.id }, boss.enemy!);
    }
    expect(boss.enemy?.disabled).toBe(true);
    expect(model.bossHud()).toBeNull();
    flyTo(model, boss.x + CONTENT.tuning.talkRange - 1, boss.y);
    expect(model.contextAction).toBe("salvage");
    expect(model.bossHud()).toMatchObject({ disabled: true, id });
    const flight = flightOf(model);
    const oldStardust = stardustDropped(flight);
    model.interact();
    expect(model.bossHud()).toBeNull();
    expect(model.state.progress[1].capitalBoss).toMatchObject({
      cacheClaimed: false,
      outcome: "salvaged",
      phase: "resolved",
    });
    expect(stardustDropped(flight) - oldStardust).toBe(
      Math.floor(enemyStardust({ id, seed: flight.seed }, "capital") / 2),
    );
    model.interact();
    expect(stardustDropped(flight) - oldStardust).toBe(
      Math.floor(enemyStardust({ id, seed: flight.seed }, "capital") / 2),
    );
    model = relaunch(CONTENT, model.save());
    const waypoint = model.map!.places.find((place) => place.id === routeId)!;
    expect(waypoint).toMatchObject({ label: "Safer route and supply cache", travel: true });
    expect(model.map?.places.some((place) => place.id === id)).toBe(false);

    const home = flightOf(model).objects.find(({ id }) => id === "growers")!;
    flyTo(model, home.x, home.y);
    flightOf(model).dangerFor = 0;
    model.returnHome();
    launch(model);
    flyTo(model, waypoint.x, waypoint.y);
    const cargo = flightOf(model).cargo;
    model.step(1 / 60, idle);
    expect(model.flightEvents).toContainEqual(
      expect.objectContaining({ id: cacheId, type: "collected" }),
    );
    expect(flightOf(model).cargo).toBe(cargo + 1);
    expect(model.conversation).toMatchObject(SUNFLOWER_BOSS_CUES.resolved);
    expect(model.state.progress[1].capitalBoss).toMatchObject({ cacheClaimed: true });
    expect(model.map?.places.find((place) => place.id === routeId)?.label).toBe("Safer route");

    model = relaunch(CONTENT, model.save());
    expect(flightOf(model).cargo).toBe(cargo + 1);
    flyTo(model, home.x, home.y);
    flightOf(model).dangerFor = 0;
    model.returnHome();
    launch(model);
    flyTo(model, waypoint.x, waypoint.y);
    model.step(1 / 60, idle);
    expect(flightOf(model).cargo).toBe(cargo + 1);
    expect(capitalBossActor(flightOf(model), cacheId)).toBeUndefined();
    expect(capitalBossActor(flightOf(model), id)).toBeUndefined();
    expect(model.conversation?.text).not.toBe(SUNFLOWER_BOSS_CUES.resolved.text);
  });

  it("uses the destruction reward once and selects the resolution cue over a hardpoint beat", () => {
    const model = traded();
    approach(model);
    expect(model.conversation).toMatchObject(SUNFLOWER_BOSS_CUES.approach);
    model.dismissConversation();
    const flight = flightOf(model);
    const boss = actorOf(model);
    // Simulate the first part loss and lethal hull contact in the same step's outcome.
    const definition = enemyEquipmentDefinition(1, boss.enemy!);
    const first = definition.hardpoints[0]!;
    boss.enemy = damageEnemy(definition, { amount: first.hp, hardpointId: first.id }, boss.enemy!);
    const oldStardust = stardustDropped(flight);
    const shot = {
      damage: 1000,
      enemy: false,
      hitIds: [],
      id: "lethal-hull-hit",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
      x: boss.x,
      y: boss.y,
    };
    flight.shots.push(shot, { ...shot, hitIds: [], id: "second-ship-hit" });
    model.step(1 / 60, idle);
    expect(model.flightEvents.filter(({ type }) => type === "enemyDestroyed")).toEqual([
      { id, type: "enemyDestroyed" },
    ]);
    expect(model.state.progress[1].capitalBoss).toMatchObject({
      outcome: "defeated",
      phase: "resolved",
    });
    expect(model.bossHud()).toBeNull();
    expect(model.conversation).toMatchObject(SUNFLOWER_BOSS_CUES.resolved);
    expect(model.state.seenConversations).not.toContain(`${id}:hardpoint`);
    const wreckTiming = ECONOMY.destruction.capital;
    const released = Math.ceil(wreckTiming.durationSeconds * 60) + 1;
    for (let frame = 0; frame < released; frame++) {
      model.step(1 / 60, idle);
    }
    expect(stardustDropped(flight) - oldStardust).toBe(
      enemyStardust({ id, seed: flight.seed }, "capital"),
    );
    expect(relaunch(CONTENT, model.save()).state.progress[1].capitalBoss).toEqual(
      model.state.progress[1].capitalBoss,
    );
  });
});

describe("story and persistence", () => {
  it("preserves exact interrupted flight but regenerates after leaving, without repeating introductions", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    launch(model);
    introduce(model, "growers");
    model.state.flight!.cargo = 3;
    model.state.flight!.shield = model.shieldMax - 1;
    collectWeapon("rapidMissile", model.state.flight!);
    model.state.flight!.weapon = "rapidMissile";
    model.state.flight!.ammo.rapidMissile = 200;
    model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    expect(model.state.flight!.shots.length).toBeGreaterThan(0);
    // Continue gives no grace, so the compared flights both run without one.
    endArrivalGrace(model.state.flight!);
    const saved = model.save();
    const resumed = relaunch(CONTENT, saved);
    expect(resumed.state).toEqual(model.state);
    resumed.step(0.05, idle);
    model.step(0.05, idle);
    // A conversation showing at the save does not resume, so the next one heard, and so what
    // Penny senses, can differ.
    const heard = (state: typeof model.state) => ({
      ...state,
      achievements: { ...state.achievements, sensed: [] },
      seenConversations: [],
    });
    expect(heard(resumed.state)).toEqual(heard(model.state));
    const seed = resumed.state.flight!.seed;
    const encounterSeed = resumed.state.flight!.encounterSeed;
    const remainingOre = resumed.state.flight!.cargo;
    resumed.returnHome();
    launch(resumed);
    expect(resumed.state.flight!.seed).toBe(seed);
    expect(resumed.state.flight!.encounterSeed).not.toBe(encounterSeed);
    // Earth by choice keeps the undeposited ore for the galaxy's next flight.
    expect(resumed.state.flight!.cargo).toBe(remainingOre);
    // The equipped weapon is a purchase kept with story progress across flights.
    expect(resumed.state.flight!.weapon).toBe("rapidMissile");
    expect(resumed.state.flight!.shield).toBe(CONTENT.tuning.shieldMax);
    expect(resumed.state.progress[1].introduced).toBe(true);
    // The carried story item stays with the story across flights (rules.md "What each event keeps").
    expect(resumed.state.progress[1].questItem).toBe("food");
    expect(resumed.state.dialogue).toBeNull();
  });
  it("completes the delivery chain at the workshop and converges both responses at home", () => {
    for (const choice of [0, 1]) {
      const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
      model.startGalaxy(1);
      introduce(model, "growers");
      talk(model, "workshop");
      expect(model.state.progress[1].questItem).toBe("toolkit");
      talk(model, "salvagers");
      expect(model.state.progress[1].questItem).toBe("parts");
      expect(model.state.progress[1].questComplete).toBe(false);
      talk(model, "workshop");
      expect(model.state.progress[1].questComplete).toBe(true);
      recoverHolodisk(model);
      finishHome(model, choice);
      expect(model.state.unlocked).toEqual([1, 3]);
      expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
    }
  });
  it("counts partial deposits and requires miner, visitors and a joint approach", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.unlocked.push(2);
    launch(model, 2);
    introduce(model, "hub");
    for (let i = 0; i < 6; i++) {
      model.state.flight!.cargo = 4;
      talk(model, "hub");
    }
    expect(model.state.progress[2].deposited).toBe(24);
    expect(model.state.progress[2].questComplete).toBe(false);
    talk(model, "miner");
    talk(model, "visitors");
    model.state.flight!.cargo = 12;
    talk(model, "hub");
    expect(model.state.progress[2].questComplete).toBe(true);
    recoverHolodisk(model);
    finishHome(model);
    // Cartwheel, fifth on the route, unlocks Phantom.
    expect(model.state.unlocked).toEqual([1, 2, 6]);
    expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  });
  it("offers Use as Dock at the hub and Deposit with ore", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    model.state.unlocked.push(2);
    launch(model, 2);
    introduce(model, "hub");
    arrive(model, "hub");
    expect([model.contextAction, model.contextLabel]).toEqual(["dock", "Dock"]);
    model.state.flight!.cargo = 4;
    expect([model.contextAction, model.contextLabel]).toEqual(["deposit", "Deposit"]);
    model.state.dialogue = { context: "test" } as unknown as typeof model.state.dialogue;
    expect(model.contextAction).toBeUndefined();
    expect(model.contextLabel).toBeUndefined();
  });
  it("reports a carried story item by its display name, and nothing outside flight", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    launch(model);
    expect(model.aboard).toBeNull();
    for (const [id, name] of [
      ["food", "Food"],
      ["toolkit", "Tool kit"],
      ["parts", "Spare parts"],
    ] as const) {
      model.state.progress[1].questItem = id;
      expect(model.aboard).toEqual({ kind: "carrying", name });
    }
    model.returnHome();
    expect(model.aboard).toBeNull();
  });
  it("pauses flight during dialogue and does not advance exploration while standing still", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    launch(model);
    const distance = model.state.flight!.freshDistance;
    for (let i = 0; i < 100; i++) {
      model.step(0.01, idle);
    }
    expect(model.state.flight!.freshDistance).toBe(distance);
    introduce(model, "growers");
    talk(model, "growers");
    model.interact();
    const snapshot = model.save();
    model.step(10, { ...idle, move: { x: 1, y: 0 } });
    expect(model.save()).toBe(snapshot);
  });
  it("blocks voluntary home travel in danger, retaining the exact flight", () => {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    launch(model);
    model.state.flight!.dangerFor = 3;
    const flight = model.state.flight;
    model.returnHome();
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.state.notice).toBe(CONTENT.labels.travelUnavailable);
  });
});

it("finishes the mounted chapters in route order and resumes each terminal state", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  launch(model);
  introduce(model, "growers");
  talk(model, "workshop");
  talk(model, "salvagers");
  talk(model, "workshop");
  recoverHolodisk(model);
  finishHome(model);
  // Sunflower unlocks Whirlpool, next on the route.
  expect(model.state.unlocked).toEqual([1, 3]);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  launch(model, 3);
  introduce(model, "whale");
  const f = model.state.flight!;
  const stones = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  expect(stones).toHaveLength(CONTENT.tuning.whaleDebris.count);
  expect(stones.map((o) => [o.asteroid, o.radius])).toEqual(
    CONTENT.tuning.whaleDebris.asteroids.map((id) => [id, ASTEROID_SHAPES.get(id)!.radius]),
  );
  // Exercise the actual projectile/event path at each obstruction, without ambient enemies.
  f.objects = f.objects.filter((o) => o.kind === "destination" || o.id.startsWith("whale-debris:"));
  for (const debris of [...f.objects.filter((o) => o.id.startsWith("whale-debris:"))]) {
    f.player = { x: debris.x - 100, y: debris.y };
    f.velocity = { x: 0, y: 0 };
    for (let i = 0; i < 400 && f.objects.some((o) => o.id === debris.id); i++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(f.objects.some((o) => o.id === debris.id)).toBe(false);
    expect(model.flightEvents).toContainEqual(
      expect.objectContaining({ asteroid: debris.asteroid, type: "asteroidDestroyed" }),
    );
  }
  expect(model.state.progress[3].stage).toBe(2);
  model.returnHome();
  launch(model, 3);
  expect(model.state.flight!.objects.some((o) => o.id.startsWith("whale-debris:"))).toBe(false);
  talk(model, "whale");
  talk(model, "family");
  talk(model, "whale");
  expect(model.state.progress[3].questComplete).toBe(true);
  expect(model.state.mode).toBe("space");
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  // Whirlpool's guarded pickup is played through in holodisk.test.ts.
  model.state.progress[3].sounder = { outcome: "defeated", phase: "resolved" };
  model.state.progress[3].holodisk = true;
  finishHome(model);
  // Each mounted chapter must finish before the next route position unlocks.
  expect(model.state.unlocked).toEqual([1, 3, 4]);
  expect(model.state.progress[3].resolved).toBe(true);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  finishNeedle(model);
  expect(model.state.unlocked).toEqual([1, 3, 4, 5]);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  finishAndromeda(model);
  expect(model.state.unlocked).toEqual([1, 3, 4, 5, 2]);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
  launch(model, 2);
  introduce(model, "hub");
  model.state.flight!.cargo = CONTENT.tuning.miningMilestones[1];
  talk(model, "hub");
  expect(model.state.flight!.storyScene?.id).toBe("blocked");
  talk(model, "miner");
  talk(model, "visitors");
  model.state.flight!.cargo =
    CONTENT.tuning.miningMilestones[2] - model.state.progress[2].deposited;
  talk(model, "hub");
  expect(model.state.flight!.storyScene).toEqual({
    at: model.state.flight!.time,
    id: "docking",
    lineDue: true,
  });
  recoverHolodisk(model);
  finishHome(model);
  // Cartwheel unlocks Phantom, last on the route.
  expect(model.state.unlocked).toEqual([1, 3, 4, 5, 2, 6]);
  expect(model.state.progress[2].resolved).toBe(true);
  expect(relaunch(CONTENT, model.save()).state).toEqual(model.state);
});

it("plays each Cartwheel story scene first, then its line, at the held story destinations", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked.push(2);
  launch(model, 2);
  introduce(model, "hub");
  const f = model.state.flight!;
  f.cargo = CONTENT.tuning.miningMilestones[0];
  arrive(model, "hub");
  model.interact();
  expect(model.state.progress[2].stage).toBe(2);
  expect(model.state.dialogue).toMatchObject({ context: "deposit", title: "Astra" });
  model.choose("continue");
  expect(f.storyScene).toEqual({ at: f.time, id: "blocked", lineDue: true });
  expect(relaunch(CONTENT, model.save()).state.flight!.storyScene).toEqual(f.storyScene);
  f.objects = f.objects.filter((o) => o.kind === "destination");
  for (let i = 0; i < 400 && f.storyScene!.lineDue; i++) {
    if (model.state.dialogue) {
      model.choose("continue");
    } else {
      model.step(0.05, idle);
    }
  }
  expect(f.time - f.storyScene!.at).toBeGreaterThanOrEqual(
    CARTWHEEL_STORY_SHIPS.scenes.blocked.duration,
  );
  expect(model.state.dialogue?.text).toBe(CONTENT.chapters[2]!.dialogue.firstDeposit?.text);
  expect(f.storyScene!.lineDue).toBe(false);
  // The miner and the visitors stand at their holding points beside the hub, unguarded.
  const hub = f.objects.find((o) => o.id === "hub")!;
  for (const id of ["miner", "visitors"] as const) {
    const destination = ensureDestination(CONTENT, id, f);
    const offset = CARTWHEEL_STORY_SHIPS.destinations[id];
    expect(destination).toMatchObject({ x: hub.x + offset.x, y: hub.y + offset.y });
    expect(ensureRouteEncounter(CONTENT, id, f)).toBeNull();
    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(CONTENT.tuning.exclusionRadius);
  }
  const { miner, visitors } = CARTWHEEL_STORY_SHIPS.destinations;
  expect(Math.hypot(miner.x - visitors.x, miner.y - visitors.y)).toBeGreaterThanOrEqual(
    CONTENT.tuning.exclusionRadius * 2,
  );
});

it("replays a story scene cut short by the flight's end at the hub after a reload", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked.push(2);
  launch(model, 2);
  introduce(model, "hub");
  model.state.flight!.cargo = CONTENT.tuning.miningMilestones[0];
  arrive(model, "hub");
  model.interact();
  expect(model.state.flight!.storyScene).toMatchObject({ id: "blocked", lineDue: true });
  model.choose("continue");
  model.returnHome();
  expect(model.state.progress[2].replayScene).toBe("blocked");
  const reloaded = relaunch(CONTENT, model.save());
  expect(reloaded.state.progress[2].replayScene).toBe("blocked");
  launch(reloaded, 2);
  const f = reloaded.state.flight!;
  expect(f.storyScene).toBeUndefined();
  f.objects = f.objects.filter((o) => o.kind === "destination");
  arrive(reloaded, "hub");
  reloaded.step(0.01, idle);
  expect(f.storyScene).toMatchObject({ id: "blocked", lineDue: true });
  expect(reloaded.state.progress[2].replayScene).toBeUndefined();
  // The arrival step populated the hub's surroundings again. Keep the settled
  // chunks and destinations while the scene plays without ambient traffic.
  f.objects = f.objects.filter(
    (object) => object.kind === "destination" || object.routeId === "hub",
  );
  for (let i = 0; i < 400 && f.storyScene!.lineDue; i++) {
    if (reloaded.state.dialogue) {
      reloaded.choose("continue");
    } else {
      reloaded.step(0.05, idle);
    }
  }
  expect(f.time - f.storyScene!.at).toBeGreaterThanOrEqual(
    CARTWHEEL_STORY_SHIPS.scenes.blocked.duration,
  );
  expect(reloaded.state.dialogue?.text).toBe(CONTENT.chapters[2]!.dialogue.firstDeposit?.text);
  // Spoken once: a later flight does not replay it.
  reloaded.state.dialogue = null;
  reloaded.returnHome();
  expect(reloaded.state.progress[2].replayScene).toBeUndefined();
});

it("places whale debris offscreen and preserves pre-introduction clearing", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  expect(Math.hypot(whale.x - f.player.x, whale.y - f.player.y)).toBeGreaterThan(
    CONTENT.tuning.chunkSize,
  );
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[3].introduced).toBe(false);
  const debris = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  expect(debris).toHaveLength(CONTENT.tuning.whaleDebris.count);
  f.objects = f.objects.filter((o) => o.kind === "destination" || o.id.startsWith("whale-debris:"));
  for (const obstruction of debris) {
    f.player = { x: obstruction.x - 300, y: obstruction.y };
    f.velocity = { x: 0, y: 0 };
    populateFlight(CONTENT, model.state.progress[3], f);
    ensureHuntingPacks(CONTENT, f);
    for (const actor of stationPopulationObjects(f).filter((actor) => actor.kind === "enemy")) {
      worldRecordObjectRemoval(flightWorldContext(f), CONTENT, actor, f);
    }
    f.objects = f.objects.filter(
      (object) => object.kind === "destination" || object.id.startsWith("whale-debris:"),
    );
    for (let i = 0; i < 400 && f.objects.some((o) => o.id === obstruction.id); i++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(
      f.objects.some((o) => o.id === obstruction.id),
      JSON.stringify({
        dialogue: model.state.dialogue?.context,
        hp: obstruction.hp,
        mode: model.state.mode,
        player: f.player,
        screen: model.screen,
        shield: f.shield,
        target: obstruction,
        time: f.time,
      }),
    ).toBe(false);
  }
  expect(model.state.progress[3].introduced).toBe(false);
  expect(model.state.progress[3].stage).toBe(2);
  const restored = relaunch(CONTENT, model.save());
  expect(restored.state).toEqual(model.state);
  arrive(restored, "whale");
  restored.step(0.01, idle);
  expect(restored.state.dialogue?.text).toBe(CONTENT.chapters[3]!.dialogue.freed?.text);
  expect(restored.state.progress[3].stage).toBe(3);
  expect(restored.state.flight!.objects.some((o) => o.id.startsWith("whale-debris:"))).toBe(false);
  restored.choose("continue");
  talk(restored, "family");
  talk(restored, "whale");
  expect(restored.state.progress[3].questComplete).toBe(true);
});

it("keeps remaining whale debris aligned at its fixed required site as Ada explores", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = CONTENT.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  const debris = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  const offsets = debris.map((o) => ({ x: o.x - whale.x, y: o.y - whale.y }));
  f.player = { x: whale.x + CONTENT.tuning.chunkSize * 4, y: whale.y };
  f.velocity = { x: CONTENT.tuning.physics.maxSpeed, y: 0 };
  const chunkSize = CONTENT.tuning.chunkSize;
  f.freshChunk = `${Math.floor(f.player.x / chunkSize)},${Math.floor(f.player.y / chunkSize)}`;
  model.step(0.01, { ...idle, move: { x: 1, y: 0 } });
  const relocated = f.objects.find((o) => o.id === "whale")!;
  expect({ x: relocated.x, y: relocated.y }).toEqual(model.state.progress[3].requiredSites!.whale);
  expect(relocated).toBe(whale);
  debris.forEach((o, i) => {
    expect(o.x - relocated.x).toBeCloseTo(offsets[i]!.x);
    expect(o.y - relocated.y).toBeCloseTo(offsets[i]!.y);
    expect(f.objects).toContain(o);
  });
});

it("discovers a cleared required approach at its fixed canonical site", () => {
  const content = structuredClone(CONTENT);
  content.tuning.introFreshDistance = 8;
  content.tuning.flight.objectsPerChunk = 0;
  const model = new GameModel(content, supportEntropy, SAVE_RESTORE);
  launch(model);
  const flight = model.state.flight!;
  const pending = ensureDestination(content, "growers", flight);
  const guard = ensureRouteEncounter(content, "growers", flight);
  expect(guard?.enemy).toBeDefined();
  guard!.enemy!.disabled = true;
  const point = { x: pending.x, y: pending.y };
  expect(model.state.progress[1].requiredSites?.growers).toEqual(point);
  flight.player = { x: point.x + content.tuning.chunkSize * 2, y: point.y };
  flight.velocity = { x: 0, y: 0 };
  expect(flight.player.x - point.x).toBeGreaterThan(content.tuning.chunkSize);
  expect(model.state.progress[1].known).toEqual([]);
  expect(model.state.dialogue).toBeNull();
  for (let i = 0; i < 300 && !model.state.dialogue; i++) {
    const delta = { x: point.x - flight.player.x, y: point.y - flight.player.y };
    const gap = Math.hypot(delta.x, delta.y);
    model.step(0.1, { ...idle, move: { x: delta.x / gap, y: delta.y / gap } });
  }
  const discovered = flight.objects.find((o) => o.id === "growers")!;
  expect({ x: discovered.x, y: discovered.y }).toEqual(point);
  expect(model.state.progress[1].requiredSites?.growers).toEqual(point);
  expect(model.state.progress[1].known).toEqual(["growers"]);
  expect(model.state.progress[1].discoveries).toBe(1);
  expect(model.state.progress[1].introduced).toBe(true);
  expect(model.state.dialogue).not.toBeNull();
  expect(model.state.dialogue?.text).toBe(content.chapters[1]!.dialogue.grower?.text);
  expect(model.state.dialogue?.context).toBe("grower");
});

it("retains the full inactive formation at its canonical site through Continue and a visit", () => {
  const content = structuredClone(CONTENT);
  content.tuning.introFreshDistance = 0;
  content.tuning.flight.objectsPerChunk = 0;
  const model = new GameModel(content, supportEntropy, SAVE_RESTORE);
  const point = { x: content.tuning.chunkSize * 20, y: 0 };
  rememberRequiredSite(model.state.progress[1], "growers", point);
  launch(model);
  const flight = model.state.flight!;
  const target = ensureDestination(content, "growers", flight);
  const guard = ensureRouteEncounter(content, "growers", flight)!;
  expect(guard?.enemy).toBeDefined();
  expect({ x: target.x, y: target.y }).toEqual(point);
  guard.enemy!.hardpoints[1]!.hp = 1;
  guard.enemy!.hardpoints[1]!.cooldown = 1.25;
  const formation = flight.objects.filter(
    (actor) => actor.id === guard.id || actor.enemy?.escortOf === guard.id,
  );
  expect(formation.length).toBeGreaterThanOrEqual(1);
  expect(formation.length).toBeLessThanOrEqual(3);
  const before = structuredClone(formation);
  syncFlightRegion(content, flight);
  expect(flight.objects).not.toContain(guard);
  expect(flight.world.notables[guard.id]).toEqual(before.find((actor) => actor.id === guard.id));
  const resumed = relaunch(content, model.save());
  expect(resumed.state).toEqual(model.state);
  const next = resumed.state.flight!;
  expect(resumed.state.progress[1].requiredSites?.growers).toEqual(point);
  next.player = { ...point };
  syncFlightRegion(content, next);
  const restored = before.map(({ id }) => next.objects.find((actor) => actor.id === id));
  expect(restored).toEqual(before);
  expect(next.objects.filter((actor) => actor.id === guard.id)).toHaveLength(1);
  const currentTarget = next.objects.find((actor) => actor.id === "growers")!;
  expect({ x: currentTarget.x, y: currentTarget.y }).toEqual(point);
  expect(routeBlocked("growers", next)).toBe(true);
  expect(resumed.state.progress[1].introduced).toBe(false);
  resumed.step(0.05, idle);
  expect(resumed.state.progress[1].requiredSites?.growers).toEqual(point);
  expect(routeBlocked("growers", next)).toBe(true);
  expect(resumed.state.progress[1].introduced).toBe(false);
  expect(relaunch(content, resumed.save()).state).toEqual(resumed.state);
});

it("marks an interacted destination persistent before ordinary eviction", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  launch(model);
  arrive(model, "growers");
  model.interact();
  const flight = model.state.flight!;
  const npc = flight.objects.find((object) => object.id === "growers")!;
  expect(npc.persistent).toBe(true);
  flight.player = { x: 12000, y: 12000 };
  syncFlightRegion(CONTENT, flight);
  expect(flight.objects).toContain(npc);
  expect(model.state.progress[1].known).toContain("growers");
});

describe("Use at an outpost", () => {
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

  // Sunflower's first flight with Ada 100 world units from the growers, inside Talk range.
  function besideGrowers() {
    const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
    Object.assign(model.state, { prologueSeen: true, started: true });
    model.startGalaxy(1);
    readStory(model);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const growers = ensureDestination(CONTENT, "growers", flight);
    flight.player = { x: growers.x + 100, y: growers.y };
    flight.velocity = { x: 0, y: 0 };
    return { flight, model };
  }

  it("waits on the growers' guard while it fights", () => {
    const { flight, model } = besideGrowers();
    const guard = ensureRouteEncounter(CONTENT, "growers", flight)!;
    expect(guard.enemy?.archetype).toBe("frigate");
    model.step(0.05, idle);
    expect(routeBlocked("growers", flight)).toBe(true);
    expect(model.contextAction).toBeUndefined();
  });

  it("offers Talk once the guard is disabled, its hull still standing nearby", () => {
    const { flight, model } = besideGrowers();
    const guard = ensureRouteEncounter(CONTENT, "growers", flight)!;
    // Its weapons go: every weapon hardpoint destroyed disables it.
    const weapons = new Set(
      enemyCatalog.frigate.hardpoints.filter((part) => part.kind === "weapon").map(({ id }) => id),
    );
    for (const hardpoint of guard.enemy!.hardpoints) {
      if (weapons.has(hardpoint.id)) {
        hardpoint.hp = 0;
      }
    }
    guard.enemy!.disabled = true;
    expect(guard.hp).toBeGreaterThan(0);
    model.step(0.05, idle);
    model.state.dialogue = null;
    expect(model.state.progress[1].known).toContain("growers");
    expect(model.contextAction).toBe("talk");
    expect(model.contextLabel).toBe(CONTENT.labels.talk);
  });
});
