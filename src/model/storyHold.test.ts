import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

function opening(): GameModel {
  const model = new GameModel(CONTENT);
  model.start();
  CONTENT.premise.gardenArrival.forEach(() => model.storyNext());
  expect(model.storyView?.page.id).toBe("opening");
  expect(model.storyView?.page.choices?.length).toBeGreaterThan(1);
  return model;
}

function resume(model: GameModel): GameModel {
  model.backToTitle();
  expect(model.screen).toBe("start");
  expect(model.canContinue).toBe(true);
  const loaded = new GameModel(CONTENT, model.save());
  expect(loaded.canContinue).toBe(true);
  loaded.continueGame();
  return loaded;
}

describe("Story Back to title and Continue", () => {
  it("holds the actual unanswered opening choice without starting the first flight or applying its effect", () => {
    const model = opening();
    const before = structuredClone(model.state);
    const page = model.storyView!.page;
    const loaded = resume(model);
    expect(loaded.state).toEqual(before);
    expect(loaded.state.started).toBe(false);
    expect(loaded.storyView?.page).toEqual(page);
    expect(loaded.storyView?.choices).toEqual(page.choices);
    loaded.storyChoose(1);
    expect(loaded.storyView?.page.text).toBe(CONTENT.chapters[1]!.openingBranches[1]);
    expect(loaded.state.progress[1].opened).toBe(false);
    loaded.storyPrevious();
    expect(loaded.storyView?.page).toEqual(page);
  });

  it("saves an active unanswered page with canonical references rather than authored text", () => {
    const model = opening();
    const saved = model.saveDocument();
    expect(saved.pendingStory?.cursor.current).toMatchObject({
      page: "opening",
      scene: { id: "opening:1", variant: "firstLaunch" },
    });
    expect(JSON.stringify(saved.pendingStory)).not.toContain('"text"');
    expect(JSON.stringify(saved.pendingStory)).not.toContain('"choices"');
    const loaded = new GameModel(CONTENT, saved);
    loaded.continueGame();
    expect(loaded.storyView?.page).toEqual(model.storyView?.page);
    expect(loaded.state.progress[1].opened).toBe(false);
  });

  it("retains asked questions and Previous history through title and reload", () => {
    const model = opening();
    model.storyChoose(0);
    while (model.storyView && !model.storyView.page.questions?.length) {
      model.storyNext();
    }
    const count = model.storyView!.choices.length;
    model.storyChoose(0);
    model.storyNext();
    const before = model.storyView!;
    expect(before.choices).toHaveLength(count - 1);
    const loaded = resume(model);
    expect(loaded.storyView?.page).toEqual(before.page);
    expect(loaded.storyView?.choices).toEqual(before.choices);
    expect(loaded.storyView?.canGoBack).toBe(true);
    loaded.storyPrevious();
    expect(loaded.storyView?.page.id).toContain(":answer:");
    expect(loaded.state.prologueSeen).toBe(false);
  });

  it("preserves the actual elapsed recharge interlude instead of replaying it", () => {
    const model = new GameModel(CONTENT);
    model.startGalaxy(1);
    const flight = model.state.flight!;
    flight.shield = CONTENT.tuning.hazardDamage;
    flight.objects = [{ ...flight.player, hp: 1, id: "depletion", kind: "hazard", radius: 1000 }];
    model.step(0.1, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false });
    model.storyNext();
    expect(model.storyView?.page.sleep).toBe(true);
    model.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds / 2);
    const loaded = resume(model);
    expect(loaded.storyView?.page.sleep).toBe(true);
    loaded.storyTick(OVERNIGHT_SLEEP.seconds, OVERNIGHT_SLEEP.seconds / 2);
    expect(loaded.storyView?.page.id).toBe("morning");
  });

  it("rejects a cursor for an unknown scene or an inconsistent sleep clock", () => {
    const model = opening();
    const saved = model.saveDocument();
    const unknown = structuredClone(saved);
    Object.assign(unknown.pendingStory!.cursor.current, { scene: { id: "unknown" } });
    expect(restoreSave(unknown)).toBeNull();
    const sleeping = structuredClone(saved);
    sleeping.pendingStory!.slept = OVERNIGHT_SLEEP.seconds;
    expect(restoreSave(sleeping)).toBeNull();
  });
});
