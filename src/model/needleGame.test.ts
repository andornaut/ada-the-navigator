import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { NEEDLE } from "../data/needle.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { ControlState } from "../input/state.ts";
import { restoreSave, SAVE_RESTORE } from "../saving/index.ts";
import { endArrivalGrace } from "../testing/arrivalGrace.ts";
import { readStory, relaunch, supportEntropy } from "../testing/launch.ts";
import { capitalBossActor } from "./capitalBossEncounter.ts";
import { interactionCopy } from "./conversations.ts";
import { damageEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { activeEnemyBeams, ensureStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { GameModel } from "./game.ts";
import { worldSyncFlightRegion } from "./geography.ts";
import { needleCourses } from "./needle.ts";
import { NEEDLE_CADENCE } from "./needleRuntime.ts";
import { stationsNear } from "./stations.ts";

const built = BUILT as Set<GalaxyNumber>;
const present = built.has(4);
beforeAll(() => built.add(4));
afterAll(() => {
  if (!present) {
    built.delete(4);
  }
});
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function launch(seed?: number): GameModel {
  const model = new GameModel(
    CONTENT,
    seed === undefined ? supportEntropy : () => seed,
    SAVE_RESTORE,
  );
  Object.assign(model.state, { prologueSeen: true, started: true, unlocked: [...GALAXY_NUMBERS] });
  for (const progress of Object.values(model.state.progress)) {
    progress.opened = true;
  }
  model.state.seenConversations.push(
    ...CONVERSATIONS.filter(({ trigger }) => trigger.kind === "lesson").map(({ id }) => id),
  );
  model.startGalaxy(4);
  return model;
}
function visit(model: GameModel, id: string): void {
  const flight = model.state.flight!;
  const point = flight.objects.find((object) => object.id === id) ?? flight.world.notables[id];
  expect(point, id).toBeDefined();
  flight.player = { x: point!.x, y: point!.y };
  flight.velocity = { x: 0, y: 0 };
  model.step(0.001, idle);
}
function learn(model: GameModel): void {
  visit(model, "elderLoom");
  model.dismissNotice();
  model.interact();
  const budget = CONVERSATIONS.reduce((sum, conversation) => sum + conversation.lines.length, 0);
  for (let line = 0; !model.state.dialogue && line < budget; line++) {
    expect(model.conversation).not.toBeNull();
    model.dismissConversation();
  }
  expect(model.state.dialogue?.context).toBe("needle.arrival");
  expect(interactionCopy(4, model.state.dialogue!).party).toBe("Elder Loom");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.practice");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.learning");
}

function completeEye(seed: number): GameModel {
  const model = launch(seed);
  const progress = model.state.progress[4];
  const flight = model.state.flight!;
  for (const galaxy of [1, 3] as const) {
    Object.assign(model.state.progress[galaxy], {
      holodisk: true,
      questComplete: true,
      resolved: true,
    });
  }
  Object.assign(progress.needle!, {
    approach: "independent",
    briefed: true,
    eyeLit: NEEDLE.eyeGates - 1,
    met: true,
    practiceLit: NEEDLE.practiceGates,
    practiceThanked: true,
  });
  const last = needleCourses(flight)!.eye.gates.at(-1)!;
  model.step(0.001, idle);
  expect(model.map?.places.some(({ id }) => id === NEEDLE_CADENCE.id)).toBe(false);
  expect(progress.capitalBoss).toBeUndefined();
  flight.player = {
    x: last.point.x - last.tangent.x * 0.1,
    y: last.point.y - last.tangent.y * 0.1,
  };
  flight.velocity = { x: last.tangent.x * 20, y: last.tangent.y * 20 };
  model.step(0.05, { ...idle, move: { x: last.tangent.x * 0.25, y: last.tangent.y * 0.25 } });
  expect(progress.needle?.eyeLit).toBe(NEEDLE.eyeGates);
  expect(progress.capitalBoss?.phase).toBe("active");
  expect(progress.holodisk).toBe(false);
  expect(model.flightLog).toEqual([]);
  expect(model.map?.places.find(({ id }) => id === NEEDLE_CADENCE.id)).toMatchObject({
    ...progress.capitalBoss!.site,
    label: "Crossbow",
    objective: false,
    travel: true,
  });
  endArrivalGrace(flight);
  return model;
}

function nearCrossbow(model: GameModel, distance: number) {
  const flight = model.state.flight!;
  const boss = capitalBossActor(flight, NEEDLE_CADENCE.id)!;
  const { x, y } = boss;
  flight.player = { x: x - distance, y };
  flight.velocity = { x: 0, y: 0 };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.objects).toContain(boss);
  return boss;
}

describe("Needle contextual Use", () => {
  it.each([
    ["needlePractice", 0, 0, "Light the practice gates."],
    ["needleEye", NEEDLE.practiceGates, 0, "Light the Eye's gates."],
    ["holodisk", NEEDLE.practiceGates, NEEDLE.eyeGates - 1, "Light the Eye's gates."],
  ] as const)(
    "answers a press at %s without bypassing the gate objectives",
    (id, practiceLit, eyeLit, objective) => {
      const model = launch(173);
      const progress = model.state.progress[4];
      Object.assign(progress.needle!, {
        approach: "independent",
        briefed: true,
        eyeLit,
        met: true,
        practiceLit,
      });
      visit(model, id);
      model.dismissNotice();
      expect(model.useTarget).toEqual({ action: "use", id });
      const before = model.useRefusals;
      const controls = new ControlState();
      controls.setUseAvailable(true);
      controls.requestUse();
      model.step(0.001, controls.sample());
      expect(model.useRefusals).toBe(before + 1);
      expect(model.state.notice).toBe(objective);
      expect(model.state.dialogue).toBeNull();
      expect(progress).toMatchObject({
        holodisk: false,
        needle: { eyeLit, practiceLit },
        questComplete: false,
      });
      model.step(0.001, controls.sample());
      expect(model.useRefusals).toBe(before + 1);
    },
  );

  it("opens collection once the last Eye gate is lit and awards the disk only on Continue", () => {
    const model = completeEye(173);
    const progress = model.state.progress[4];
    visit(model, "holodisk");
    expect(model.useTarget).toEqual({ action: "use", id: "holodisk" });
    const before = model.useRefusals;
    model.step(0.001, { ...idle, use: true });
    expect(model.state.dialogue?.context).toBe("needle.collect");
    expect(progress.holodisk).toBe(false);
    expect(model.useRefusals).toBe(before);
    model.choose("continue");
    expect(progress.holodisk).toBe(true);
    expect(model.useTarget?.id).not.toBe("holodisk");
  });
});

describe("Captain Cadence admission and outcome", () => {
  it("fires from the actual Crossbow and retains its clocks through Continue and a new flight", () => {
    let model = completeEye(173);
    let flight = model.state.flight!;
    const { id } = NEEDLE_CADENCE;
    const boss = nearCrossbow(model, 265);
    const definition = enemyEquipmentDefinition(4, boss.enemy!);
    boss.enemy!.facing = { x: -1, y: 0 };
    const tells = new Set<number>();
    const fired = new Set<number>();
    for (let frame = 0; frame < 400 && fired.size < 2; frame++) {
      flight.shield = model.shieldMax;
      model.step(0.02, idle);
      for (const beam of activeEnemyBeams(flight)) {
        if (beam.kind === "lance" && beam.ownerId === id) {
          (beam.fired ? fired : tells).add(beam.volley);
        }
      }
    }
    expect([...fired]).toHaveLength(2);
    expect([...fired].every((volley) => tells.has(volley))).toBe(true);
    expect(model.bossHud()).toMatchObject({
      captain: "Captain Cadence",
      hull: definition.hp,
      id,
      maxHull: definition.hp,
      ship: "Crossbow",
    });
    const clocks = structuredClone(boss.enemy!.hardpoints);
    model = relaunch(CONTENT, model.save());
    flight = model.state.flight!;
    expect(capitalBossActor(flight, id)?.enemy?.hardpoints).toEqual(clocks);
    visit(model, "holodisk");
    model.interact();
    expect(model.state.dialogue?.context).toBe("needle.collect");
    model.choose("continue");
    expect(model.state.progress[4].holodisk).toBe(true);
    expect(model.state.progress[4].capitalBoss?.phase).toBe("active");
    readStory(model);
    flight.dangerFor = 0;
    model.returnHome();
    expect(model.state.progress[4].capitalBoss?.phase).toBe("away");
    const parked = model.state.progress[4].capitalBoss;
    model = new GameModel(CONTENT, () => 301, SAVE_RESTORE, model.save());
    expect(model.state.progress[4].capitalBoss).toEqual(parked);
    model.startGalaxy(4);
    expect(model.state.progress[4].capitalBoss?.phase).toBe("active");
    expect(capitalBossActor(model.state.flight!, id)?.enemy?.hardpoints).toEqual(clocks);
    expect(model.flightLog).toEqual([]);
  });

  it.each(["salvaged", "defeated"] as const)(
    "records one %s transmission and names Archie only after the third memory",
    (outcome) => {
      let model = completeEye(1);
      const flight = model.state.flight!;
      const { id } = NEEDLE_CADENCE;
      const boss = nearCrossbow(model, outcome === "salvaged" ? CONTENT.tuning.talkRange - 1 : 300);
      const definition = enemyEquipmentDefinition(4, boss.enemy!);
      if (outcome === "salvaged") {
        for (const part of definition.hardpoints.filter(({ kind }) => kind === "weapon")) {
          boss.enemy = damageEnemy(
            definition,
            { amount: part.hp, hardpointId: part.id },
            boss.enemy!,
          );
        }
        expect(model.contextAction).toBe("salvage");
        expect(model.bossHud()).toMatchObject({ disabled: true, id });
        model.interact();
        const rewards = flight.objects.filter(({ role }) => role === "stardust");
        expect(rewards.length).toBeGreaterThan(0);
        model.interact();
        expect(flight.objects.filter(({ role }) => role === "stardust")).toEqual(rewards);
      } else {
        const shot = {
          damage: 1000,
          enemy: false,
          hitIds: flight.objects.filter((object) => object !== boss).map(({ id }) => id),
          id: "cadence-hull-hit",
          life: 1,
          piercing: false,
          velocity: { x: 0, y: 0 },
          x: boss.x,
          y: boss.y,
        };
        flight.shots.push(shot, { ...shot, id: "cadence-second-hit" });
        model.step(0.01, idle);
        expect(model.flightEvents.filter((event) => event.type === "enemyDestroyed")).toEqual([
          { id, type: "enemyDestroyed" },
        ]);
      }
      expect(model.state.progress[4].capitalBoss).toMatchObject({ outcome, phase: "resolved" });
      expect(model.bossHud()).toBeNull();
      expect(model.map?.places.some((place) => place.id === id)).toBe(false);
      const anonymous = [
        {
          id: `${id}:transmission`,
          text: "Orders from fleet command: Hold the exits. Recover every disk.",
        },
      ];
      expect(model.flightLog).toEqual(anonymous);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(anonymous);
      visit(model, "holodisk");
      model.interact();
      expect(model.state.dialogue?.context).toBe("needle.collect");
      model.choose("continue");
      expect(model.state.progress[4].holodisk).toBe(true);
      expect(model.flightLog).toEqual(anonymous);
      const legacyPendingMemory = JSON.parse(model.save()) as ReturnType<GameModel["saveDocument"]>;
      delete legacyPendingMemory.progress[4].needleMemoryRead;
      expect(relaunch(CONTENT, legacyPendingMemory).flightLog).toEqual(anonymous);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(anonymous);
      for (let page = 0; page < 8 && model.storyView?.page.id !== "holodisk:memory"; page++) {
        model.storyNext();
      }
      expect(model.storyView?.page.text).toBe(CONTENT.premise.holodisk.memories[2]);
      expect(model.flightLog).toEqual(anonymous);
      model.storyNext();
      expect(model.state.progress[4].needleMemoryRead).toBe(true);
      const revealed = [
        { ...anonymous[0]!, text: "Admiral Archie's orders: Hold the exits. Recover every disk." },
      ];
      expect(model.flightLog).toEqual(revealed);
      model = relaunch(CONTENT, model.save());
      expect(model.flightLog).toEqual(revealed);
      model.state.flight!.dangerFor = 0;
      model.returnHome();
      expect(model.state.flight).toBeNull();
      expect(model.state.progress[4].capitalBoss).toMatchObject({ outcome, phase: "resolved" });
      model.startGalaxy(4);
      expect(capitalBossActor(model.state.flight!, id)).toBeUndefined();
      expect(model.flightLog).toEqual(revealed);
    },
  );
});

describe("mounted Needle interactions", () => {
  it("requires an actual learning choice and retains it through Close, save and Continue", () => {
    const model = launch();
    learn(model);
    const choice = structuredClone(model.state.dialogue);
    expect(choice?.choices.map(({ id }) => id)).toEqual(["show", "feedback", "independent"]);
    model.choose("continue");
    expect(model.state.dialogue).toEqual(choice);
    expect(model.state.progress[4].needle?.approach).toBeUndefined();
    model.closeInteraction();
    const saved = model.save();
    expect(restoreSave(saved)).not.toBeNull();
    const loaded = relaunch(CONTENT, saved);
    loaded.interact();
    expect(loaded.state.dialogue).toEqual(choice);
    expect(loaded.state.progress[4].needle?.approach).toBeUndefined();
    loaded.choose("show");
    expect(loaded.state.progress[4].needle?.approach).toBe("show");
    expect(loaded.state.flight!.needle!.guidance).toEqual(
      needleCourses(loaded.state.flight!)!.practice.gates[0]!.point,
    );
    expect(loaded.state.flight!.needle!.chatter).toHaveLength(1);
    expect(loaded.saveDocument().flight!.needle!.chatter).toEqual([]);
    expect(loaded.state.flight!.needle!.chatter).toHaveLength(1);
    loaded.step(0.001, idle);
    expect(loaded.state.flight!.needle!.chatter).toEqual([]);
    expect(relaunch(CONTENT, loaded.save()).state.progress[4].needle?.approach).toBe("show");
  });

  it("allows travel to the discovered disk but commits Collect only after all eight Eye gates", () => {
    const model = launch();
    learn(model);
    model.choose("independent");
    visit(model, "holodisk");
    expect(model.state.progress[4].known).toContain("holodisk");
    const marker = model.map!.places.find(({ id }) => id === "holodisk")!;
    expect(marker.travel).toBe(true);
    model.interact();
    expect(model.state.progress[4].holodisk).toBe(false);
    model.state.flight!.player = { x: marker.x + CONTENT.tuning.talkRange * 2, y: marker.y };
    model.state.economy.stardust = 50;
    expect(model.canTeleport("holodisk")).toBe(true);
    expect(model.teleport("holodisk")).toBe(true);
    expect(model.state.flight!.player).toEqual({ x: marker.x, y: marker.y });
    expect(model.state.economy.stardust).toBe(0);
    expect(model.state.progress[4]).toMatchObject({ holodisk: false, questComplete: false });
    expect(model.state.dialogue).toBeNull();
    model.interact();
    expect(model.state.progress[4].holodisk).toBe(false);
    Object.assign(model.state.progress[4].needle!, {
      eyeLit: 8,
      practiceLit: 3,
      practiceThanked: true,
    });
    model.interact();
    expect(model.state.dialogue?.context).toBe("needle.collect");
    const copy = interactionCopy(4, model.state.dialogue!);
    expect(copy.party).toBe("Astra");
    expect(model.state.progress[4]).toMatchObject({ holodisk: false, questComplete: false });
    model.closeInteraction();
    const loaded = relaunch(CONTENT, model.save());
    loaded.interact();
    expect(loaded.state.dialogue?.context).toBe("needle.collect");
    const stardust = loaded.state.economy.stardust;
    loaded.choose("continue");
    expect(loaded.state.progress[4]).toMatchObject({ holodisk: true, questComplete: true });
    expect(loaded.state.dialogue?.context).toBe("holodiskMoment");
    loaded.choose("continue");
    expect(loaded.state.economy.stardust).toBe(stardust);
    readStory(loaded);
    visit(loaded, "elderLoom");
    expect(loaded.inDanger).toBe(false);
    loaded.returnHome();
    const resolution = readStory(loaded);
    expect(
      resolution.some(
        ({ speaker, text }) => speaker === "Dad" && text === "Sounding better every day.",
      ),
    ).toBe(true);
    expect(loaded.state.progress[4].resolved).toBe(true);
  });

  it("offers the real repeatable task and optional help without forcing a different approach", () => {
    const model = launch();
    learn(model);
    model.choose("feedback");
    Object.assign(model.state.progress[4], { holodisk: true, questComplete: true, resolved: true });
    Object.assign(model.state.progress[4].needle!, {
      eyeLit: 8,
      practiceLit: 3,
      practiceThanked: true,
    });
    visit(model, "elderLoom");
    model.interact();
    expect(model.state.dialogue?.context).toBe("activity:elderLoom");
    expect(model.state.dialogue?.choices.map(({ id }) => id)).toEqual([
      "take",
      "skip",
      "changeApproach",
    ]);
    model.choose("changeApproach");
    expect(model.state.dialogue?.context).toBe("needle.learningChange");
    expect(model.state.tasks[4]).toBeUndefined();
    expect(model.state.progress[4].needle!.approach).toBe("feedback");
    model.choose("independent");
    expect(model.state.progress[4].needle!.approach).toBe("independent");
    model.interact();
    model.choose("take");
    expect(model.state.tasks[4]).toMatchObject({ id: "threadNeedle", kind: "activity", lit: 0 });
    const progress = structuredClone(model.state.progress[4].needle);
    model.interact();
    expect(model.state.dialogue?.context).toBe("activityActive:elderLoom");
    model.choose("drop");
    expect(model.state.dialogue?.context).toBe("activityDrop");
    expect(model.state.tasks[4]).toBeDefined();
    model.choose("confirmDrop");
    expect(model.state.tasks[4]).toBeUndefined();
    expect(model.state.progress[4].needle).toEqual(progress);
  });

  it("rejects invented Needle namespaces and preserves ordinary station Dock", () => {
    const model = launch();
    const saved = JSON.parse(model.save()) as { progress: Record<number, Record<string, unknown>> };
    saved.progress[1]!.needle = saved.progress[4]!.needle;
    expect(restoreSave(saved)).toBeNull();
    delete saved.progress[1]!.needle;
    (saved.progress[4]!.needle as { eyeLit: number }).eyeLit = 9;
    expect(restoreSave(saved)).toBeNull();
    const station = stationsNear(ECONOMY, 4, 40000, model.state.flight!.player)[0]!;
    ensureStation(CONTENT, station.id, model.state.flight!);
    visit(model, station.id);
    expect(model.contextAction).toBe("dock");
    model.interact();
    expect(model.state.docked).toBe(station.id);
  });
});
