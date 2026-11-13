import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { CONVERSATIONS } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { readStory, relaunch } from "../testing/launch.ts";
import { interactionCopy } from "./conversations.ts";
import { ensureStation } from "./flight.ts";
import { GameModel } from "./game.ts";
import { needleCourses } from "./needle.ts";
import { restoreSave } from "./save.ts";
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
function launch(): GameModel {
  const model = new GameModel(CONTENT);
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
    model.advanceConversation();
  }
  expect(model.state.dialogue?.context).toBe("needle.arrival");
  expect(interactionCopy(4, model.state.dialogue!).party).toBe("Elder Loom");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.practice");
  model.choose("continue");
  expect(model.state.dialogue?.context).toBe("needle.learning");
}

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

  it("keeps the discovered disk non-travelable and commits Collect only after all eight Eye gates", () => {
    const model = launch();
    learn(model);
    model.choose("independent");
    visit(model, "holodisk");
    expect(model.state.progress[4].known).toContain("holodisk");
    expect(model.map?.places.find(({ id }) => id === "holodisk")?.travel).toBe(false);
    model.interact();
    expect(model.state.progress[4].holodisk).toBe(false);
    const before = { ...model.state.flight!.player };
    model.teleport("holodisk");
    expect(model.state.flight!.player).toEqual(before);
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
