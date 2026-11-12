import { describe, expect, it } from "vitest";

import { enemyCatalog, enemyDefinition } from "../data/enemy-catalog.ts";
import { HOLODISKS } from "../data/holodisks.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { CARTWHEEL_STORY_SHIPS } from "../data/story-ships.ts";
import type { SectorId } from "../data/types.ts";
import { playOpening, readStory, relaunch } from "../testing/launch.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  ensureDestination,
  ensureRouteEncounter,
  routeBlocked,
  syncFlightRegion,
} from "./flight.ts";
import { GameModel } from "./game.ts";
import type { SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch(model: GameModel, sector: SectorId = 1) {
  model.startSector(sector);
}

it("talks within the 160 Talk range, whatever the safe radius", () => {
  expect(PROTOTYPE.tuning.talkRange).toBe(160);
  // A smaller safe radius leaves the interaction range alone.
  const content = { ...PROTOTYPE, tuning: { ...PROTOTYPE.tuning, safeRadius: 40 } };
  const model = new GameModel(content);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.startSector(1);
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
});

it("offers Salvage beside a disabled heavy and salvages it on Use", () => {
  const model = new GameModel(PROTOTYPE);
  model.startSector(1);
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
  ensureDestination(PROTOTYPE, id, f);
  const target = f.objects.find((o) => o.id === id)!;
  f.player = { x: target.x, y: target.y };
  if (!model.state.progress[f.sector].known.includes(id)) {
    model.state.progress[f.sector].known.push(id);
  }
  model.state.dialogue = null;
  f.dangerFor = 0;
}
function talk(model: GameModel, id: string) {
  arrive(model, id);
  model.interact();
  model.choose("continue");
}
/** Returns home and reads the waiting scenes, taking each choice page's `choice`. */
function finishHome(model: GameModel, choice = 1) {
  model.returnHome();
  expect(model.storyView?.page.id).toBe("resolution");
  readStory(model, choice);
}
/** Recovers the current galaxy one or two holodisk and continues past its insertion. */
function recoverHolodisk(model: GameModel) {
  if (model.state.flight!.sector === 1) {
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
  while (model.state.dialogue?.context.startsWith("holodisk")) {
    model.choose("continue");
  }
  expect(model.state.progress[model.state.flight!.sector].holodisk).toBe(true);
}
function introduce(model: GameModel, id: string) {
  arrive(model, id);
  model.step(0.01, idle);
  model.choose("continue");
}

describe("prototype story and persistence", () => {
  it("preserves exact interrupted flight but regenerates after leaving, without repeating introductions", () => {
    const model = new GameModel(PROTOTYPE);
    launch(model);
    introduce(model, "growers");
    model.state.flight!.cargo = 3;
    model.state.flight!.shield = 43;
    model.state.flight!.weapon = "rapidMissile";
    model.state.flight!.ammo.rapidMissile = 200;
    model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    expect(model.state.flight!.shots.length).toBeGreaterThan(0);
    const saved = model.save();
    const resumed = relaunch(PROTOTYPE, saved);
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
    resumed.returnHome();
    launch(resumed);
    expect(resumed.state.flight!.seed).not.toBe(seed);
    expect(resumed.state.flight!.cargo).toBe(0);
    // The equipped weapon is a purchase kept with story progress across flights.
    expect(resumed.state.flight!.weapon).toBe("rapidMissile");
    expect(resumed.state.flight!.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(resumed.state.progress[1].introduced).toBe(true);
    expect(resumed.state.progress[1].questItem).toBeNull();
    expect(resumed.state.dialogue).toBeNull();
    talk(resumed, "growers");
    expect(resumed.state.progress[1].questItem).toBe("food");
  });
  it("completes the delivery chain at the workshop and converges both responses at home", () => {
    for (const choice of [0, 1]) {
      const model = new GameModel(PROTOTYPE);
      model.startSector(1);
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
      expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
    }
  });
  it("counts partial deposits and requires miner, visitors and a joint approach", () => {
    const model = new GameModel(PROTOTYPE);
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
    // Cartwheel, fifth on the route, unlocks Black Eye.
    expect(model.state.unlocked).toEqual([1, 2, 6]);
    expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
  });
  it("offers Use as Dock at the hub and Deposit with ore", () => {
    const model = new GameModel(PROTOTYPE);
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
    const model = new GameModel(PROTOTYPE);
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
    const model = new GameModel(PROTOTYPE);
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
    const model = new GameModel(PROTOTYPE);
    launch(model);
    model.state.flight!.dangerFor = 3;
    const flight = model.state.flight;
    model.returnHome();
    expect(model.state.mode).toBe("space");
    expect(model.state.flight).toBe(flight);
    expect(model.state.notice).toBe(PROTOTYPE.labels.travelUnavailable);
  });
});

it("finishes all three chapters in route order and resumes each terminal state", () => {
  const model = new GameModel(PROTOTYPE);
  launch(model);
  introduce(model, "growers");
  talk(model, "workshop");
  talk(model, "salvagers");
  talk(model, "workshop");
  recoverHolodisk(model);
  finishHome(model);
  // Sunflower unlocks Whirlpool, next on the route.
  expect(model.state.unlocked).toEqual([1, 3]);
  expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
  launch(model, 3);
  introduce(model, "whale");
  const f = model.state.flight!;
  const stones = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  expect(stones).toHaveLength(PROTOTYPE.tuning.whaleDebris.count);
  expect(stones.map((o) => [o.asteroid, o.radius])).toEqual(
    PROTOTYPE.tuning.whaleDebris.asteroids.map((id) => [id, ASTEROID_SHAPES.get(id)!.radius]),
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
  expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
  // Whirlpool's guarded holodisk, recovered as holodisk.test.ts plays it.
  model.state.progress[3].holodisk = true;
  finishHome(model);
  // Whirlpool unlocks Needle and Andromeda, placeholders, with Cartwheel after them.
  expect(model.state.unlocked).toEqual([1, 3, 4, 5, 2]);
  expect(model.state.progress[3].resolved).toBe(true);
  expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
  launch(model, 2);
  introduce(model, "hub");
  model.state.flight!.cargo = PROTOTYPE.tuning.miningMilestones[1];
  talk(model, "hub");
  expect(model.state.flight!.storyScene?.id).toBe("blocked");
  talk(model, "miner");
  talk(model, "visitors");
  model.state.flight!.cargo =
    PROTOTYPE.tuning.miningMilestones[2] - model.state.progress[2].deposited;
  talk(model, "hub");
  expect(model.state.flight!.storyScene).toEqual({
    at: model.state.flight!.time,
    id: "docking",
    lineDue: true,
  });
  recoverHolodisk(model);
  finishHome(model);
  // Cartwheel unlocks Black Eye, last on the route.
  expect(model.state.unlocked).toEqual([1, 3, 4, 5, 2, 6]);
  expect(model.state.progress[2].resolved).toBe(true);
  expect(relaunch(PROTOTYPE, model.save()).state).toEqual(model.state);
});

it("plays each Cartwheel story scene first, then its line, at the held story destinations", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2);
  launch(model, 2);
  introduce(model, "hub");
  const f = model.state.flight!;
  f.cargo = PROTOTYPE.tuning.miningMilestones[0];
  arrive(model, "hub");
  model.interact();
  expect(model.state.progress[2].stage).toBe(2);
  expect(model.state.dialogue).toBeNull();
  expect(f.storyScene).toEqual({ at: f.time, id: "blocked", lineDue: true });
  expect(relaunch(PROTOTYPE, model.save()).state.flight!.storyScene).toEqual(f.storyScene);
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
  expect(model.state.dialogue?.text).toBe(PROTOTYPE.chapters[2]!.dialogue.firstDeposit?.text);
  expect(f.storyScene!.lineDue).toBe(false);
  // The miner and the visitors stand at their holding points beside the hub, unguarded.
  const hub = f.objects.find((o) => o.id === "hub")!;
  for (const id of ["miner", "visitors"] as const) {
    const destination = ensureDestination(PROTOTYPE, id, f);
    const offset = CARTWHEEL_STORY_SHIPS.destinations[id];
    expect(destination).toMatchObject({ x: hub.x + offset.x, y: hub.y + offset.y });
    expect(ensureRouteEncounter(PROTOTYPE, id, f)).toBeNull();
    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(PROTOTYPE.tuning.safeRadius);
  }
  const { miner, visitors } = CARTWHEEL_STORY_SHIPS.destinations;
  expect(Math.hypot(miner.x - visitors.x, miner.y - visitors.y)).toBeGreaterThanOrEqual(
    PROTOTYPE.tuning.safeRadius * 2,
  );
});

it("replays a story scene cut short by the flight's end at the hub after a reload", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2);
  launch(model, 2);
  introduce(model, "hub");
  model.state.flight!.cargo = PROTOTYPE.tuning.miningMilestones[0];
  arrive(model, "hub");
  model.interact();
  expect(model.state.flight!.storyScene).toMatchObject({ id: "blocked", lineDue: true });
  model.returnHome();
  expect(model.state.progress[2].replayScene).toBe("blocked");
  const reloaded = relaunch(PROTOTYPE, model.save());
  expect(reloaded.state.progress[2].replayScene).toBe("blocked");
  launch(reloaded, 2);
  const f = reloaded.state.flight!;
  expect(f.storyScene).toBeUndefined();
  f.objects = f.objects.filter((o) => o.kind === "destination");
  arrive(reloaded, "hub");
  reloaded.step(0.01, idle);
  expect(f.storyScene).toMatchObject({ id: "blocked", lineDue: true });
  expect(reloaded.state.progress[2].replayScene).toBeUndefined();
  for (let i = 0; i < 400 && f.storyScene!.lineDue; i++) {
    if (reloaded.state.dialogue) {
      reloaded.choose("continue");
    } else {
      reloaded.step(0.05, idle);
    }
  }
  expect(reloaded.state.dialogue?.text).toBe(PROTOTYPE.chapters[2]!.dialogue.firstDeposit?.text);
  // Spoken once: a later flight does not replay it.
  reloaded.state.dialogue = null;
  reloaded.returnHome();
  expect(reloaded.state.progress[2].replayScene).toBeUndefined();
});

it("places whale debris offscreen and preserves pre-introduction clearing", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = PROTOTYPE.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  expect(Math.hypot(whale.x - f.player.x, whale.y - f.player.y)).toBeGreaterThan(
    PROTOTYPE.tuning.chunkSize,
  );
  expect(model.state.dialogue).toBeNull();
  expect(model.state.progress[3].introduced).toBe(false);
  const debris = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  expect(debris).toHaveLength(PROTOTYPE.tuning.whaleDebris.count);
  f.objects = f.objects.filter((o) => o.kind === "destination" || o.id.startsWith("whale-debris:"));
  for (const obstruction of debris) {
    f.player = { x: obstruction.x - 300, y: obstruction.y };
    f.velocity = { x: 0, y: 0 };
    for (let i = 0; i < 400 && f.objects.some((o) => o.id === obstruction.id); i++) {
      model.step(0.05, { ...idle, aim: { x: 1, y: 0 } });
    }
    expect(f.objects.some((o) => o.id === obstruction.id)).toBe(false);
  }
  expect(model.state.progress[3].introduced).toBe(false);
  expect(model.state.progress[3].stage).toBe(2);
  const restored = relaunch(PROTOTYPE, model.save());
  expect(restored.state).toEqual(model.state);
  arrive(restored, "whale");
  restored.step(0.01, idle);
  expect(restored.state.dialogue?.text).toBe(PROTOTYPE.chapters[3]!.dialogue.freed?.text);
  expect(restored.state.progress[3].stage).toBe(3);
  expect(restored.state.flight!.objects.some((o) => o.id.startsWith("whale-debris:"))).toBe(false);
  restored.choose("continue");
  talk(restored, "family");
  talk(restored, "whale");
  expect(restored.state.progress[3].questComplete).toBe(true);
});

it("keeps remaining whale debris aligned when an unknown encounter is placed ahead again", () => {
  const model = new GameModel(PROTOTYPE);
  model.state.unlocked.push(2, 3);
  launch(model, 3);
  const f = model.state.flight!;
  f.freshDistance = PROTOTYPE.tuning.introFreshDistance;
  model.step(0.01, idle);
  const whale = f.objects.find((o) => o.id === "whale")!;
  const debris = f.objects.filter((o) => o.id.startsWith("whale-debris:"));
  const offsets = debris.map((o) => ({ x: o.x - whale.x, y: o.y - whale.y }));
  f.player = { x: whale.x + PROTOTYPE.tuning.chunkSize * 4, y: whale.y };
  f.velocity = { x: PROTOTYPE.tuning.physics.maxSpeed, y: 0 };
  const chunkSize = PROTOTYPE.tuning.chunkSize;
  f.freshChunk = `${Math.floor(f.player.x / chunkSize)},${Math.floor(f.player.y / chunkSize)}`;
  model.step(0.01, { ...idle, move: { x: 1, y: 0 } });
  const relocated = f.objects.find((o) => o.id === "whale")!;
  expect(relocated.x).not.toBe(whale.x);
  debris.forEach((o, i) => {
    expect(o.x - relocated.x).toBeCloseTo(offsets[i]!.x);
    expect(o.y - relocated.y).toBeCloseTo(offsets[i]!.y);
    expect(f.objects).toContain(o);
  });
});

it("discovers a cleared required approach after reversing away from its first location", () => {
  const content = structuredClone(PROTOTYPE);
  content.tuning.introFreshDistance = 8;
  content.tuning.flight.objectsPerChunk = 0;
  const model = new GameModel(content);
  launch(model);
  const flight = model.state.flight!;
  for (let i = 0; i < 100 && !flight.objects.some((o) => o.id === "growers"); i++) {
    model.step(0.1, { ...idle, move: { x: 1, y: 0 } });
  }
  const pending = flight.objects.find((o) => o.id === "growers");
  expect(pending).toBeDefined();
  const guard = flight.objects.find((object) => object.routeId === "growers")!;
  expect(guard.enemy).toBeDefined();
  guard.enemy!.hp = 0;
  const originalX = pending!.x;
  expect(originalX - flight.player.x).toBeGreaterThan(content.tuning.chunkSize);
  expect(model.state.progress[1].known).toEqual([]);
  expect(model.state.dialogue).toBeNull();
  for (let i = 0; i < 300 && !model.state.dialogue; i++) {
    model.step(0.1, { ...idle, move: { x: -1, y: 0 } });
  }
  const discovered = flight.objects.find((o) => o.id === "growers")!;
  expect(discovered.x).toBeLessThan(originalX);
  expect(model.state.progress[1].known).toEqual(["growers"]);
  expect(model.state.progress[1].discoveries).toBe(1);
  expect(model.state.progress[1].introduced).toBe(true);
  expect(model.state.dialogue?.text).toBe(content.chapters[1]!.dialogue.grower?.text);
  expect(model.state.dialogue?.context).toBe("grower");
});

it("wakes an inactive guard before relocating its pending destination", () => {
  const content = structuredClone(PROTOTYPE);
  content.tuning.introFreshDistance = 0;
  content.tuning.flight.objectsPerChunk = 0;
  const model = new GameModel(content);
  launch(model);
  const flight = model.state.flight!;
  flight.objects = [];
  const target = ensureDestination(content, "growers", flight);
  const guard = ensureRouteEncounter(content, "growers", flight)!;
  const shift = content.tuning.chunkSize * 20;
  target.x += shift;
  guard.x += shift;
  guard.enemy!.position.x += shift;
  guard.enemy!.home.x += shift;
  guard.enemy!.hardpoints[1]!.hp = 1;
  guard.enemy!.hardpoints[1]!.cooldown = 1.25;
  const parts = structuredClone(guard.enemy!.hardpoints);
  const previousTarget = { x: target.x, y: target.y };
  const previousGuard = { x: guard.x, y: guard.y };
  flight.objects = [target];
  flight.world.notables[guard.id] = guard;
  const resumed = relaunch(content, model.save());
  expect(resumed.state).toEqual(model.state);
  resumed.step(0.05, { ...idle, move: { x: 1, y: 0 } });
  const next = resumed.state.flight!;
  const movedTarget = next.objects.find((object) => object.id === "growers")!;
  const retained = [
    ...next.objects,
    ...Object.values(next.world.notables).filter(
      (object): object is SpaceObject => object !== null,
    ),
  ];
  const guards = retained.filter((object) => object.id === guard.id);
  expect(guards).toHaveLength(1);
  const movedGuard = guards[0]!;
  expect(movedTarget.x).toBeLessThan(previousTarget.x);
  expect(movedGuard).toBeDefined();
  expect(movedGuard.enemy!.hardpoints).toEqual(parts);
  expect(movedGuard.x - previousGuard.x).toBeCloseTo(movedTarget.x - previousTarget.x);
  expect(movedGuard.y - previousGuard.y).toBeCloseTo(movedTarget.y - previousTarget.y);
  expect(routeBlocked("growers", next)).toBe(true);
  expect(resumed.state.progress[1].introduced).toBe(false);
  expect(relaunch(content, resumed.save()).state).toEqual(resumed.state);
});

it("marks an interacted destination persistent before ordinary eviction", () => {
  const model = new GameModel(PROTOTYPE);
  launch(model);
  arrive(model, "growers");
  model.interact();
  const flight = model.state.flight!;
  const npc = flight.objects.find((object) => object.id === "growers")!;
  expect(npc.persistent).toBe(true);
  flight.player = { x: 12000, y: 12000 };
  syncFlightRegion(PROTOTYPE, flight);
  expect(flight.objects).toContain(npc);
  expect(model.state.progress[1].known).toContain("growers");
});

describe("Use at an outpost", () => {
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

  // Sunflower's first flight with Ada 100 world units from the growers, inside Talk range.
  function besideGrowers() {
    const model = new GameModel(PROTOTYPE);
    Object.assign(model.state, { prologueSeen: true, started: true });
    model.startSector(1);
    readStory(model);
    model.state.dialogue = null;
    const flight = model.state.flight!;
    flight.objects = flight.objects.filter((object) => object.kind !== "enemy");
    const growers = ensureDestination(PROTOTYPE, "growers", flight);
    flight.player = { x: growers.x + 100, y: growers.y };
    flight.velocity = { x: 0, y: 0 };
    return { flight, model };
  }

  it("waits on the growers' guard while it fights", () => {
    const { flight, model } = besideGrowers();
    const guard = ensureRouteEncounter(PROTOTYPE, "growers", flight)!;
    expect(guard.enemy?.archetype).toBe("frigate");
    model.step(0.05, idle);
    expect(routeBlocked("growers", flight)).toBe(true);
    expect(model.contextAction).toBeUndefined();
  });

  it("offers Talk once the guard is disabled, its hull still standing nearby", () => {
    const { flight, model } = besideGrowers();
    const guard = ensureRouteEncounter(PROTOTYPE, "growers", flight)!;
    const required = new Set(
      enemyCatalog.frigate.hardpoints.filter((part) => part.required).map(({ id }) => id),
    );
    for (const hardpoint of guard.enemy!.hardpoints) {
      if (required.has(hardpoint.id)) {
        hardpoint.hp = 0;
      }
    }
    expect(guard.hp).toBeGreaterThan(0);
    model.step(0.05, idle);
    model.state.dialogue = null;
    expect(model.state.progress[1].known).toContain("growers");
    expect(model.contextAction).toBe("talk");
    expect(model.contextLabel).toBe(PROTOTYPE.labels.talk);
  });
});
