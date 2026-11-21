import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ROUTE } from "../data/galaxies.ts";
import { storyPageView } from "../ui/storybook.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";

function returnedToRoom(): GameModel {
  const saved = new GameModel(CONTENT).saveDocument();
  saved.started = true;
  saved.prologueSeen = true;
  Object.assign(saved.progress[1], {
    holodisk: true,
    opened: true,
    questComplete: true,
    resolved: true,
  });
  const model = new GameModel(CONTENT, saved);
  model.continueGame();
  expect(model.roomPage).toBe(true);
  return model;
}

function pickerWith(count: number): GameModel {
  const model = returnedToRoom();
  for (const galaxy of ROUTE.slice(1, count)) {
    model.state.unlocked.push(galaxy);
    Object.assign(model.state.progress[galaxy], {
      holodisk: true,
      opened: true,
      questComplete: true,
      resolved: true,
    });
  }
  model.storyChoose(0);
  return model;
}

function enterReplay(model: GameModel): void {
  model.storyChoose(0);
  expect(model.storyView?.choices.map(({ label }) => label)).toEqual([CONTENT.chapters[1]!.name]);
  model.storyChoose(0);
  expect(model.storyView?.page.id).toBe("opening");
}

describe("optional Earth chapter replay", () => {
  it("replaces both Sunflower branches across Continue and leaves economy and progression intact", () => {
    const model = returnedToRoom();
    const before = structuredClone(model.state);
    expect(model.state.progress[1].earthChoices).toBeUndefined();
    enterReplay(model);
    expect(model.storyView?.page.background).toBe("grandmaGarden");
    expect(model.storyView?.run.pages.map(({ id }) => id)).not.toContain("opening:arrival:0");
    model.storyChoose(1);
    expect(model.storyView?.page.text).toBe(CONTENT.chapters[1]!.openingBranches[1]);
    model.storyNext();
    expect(model.storyView?.page.id).toBe("resolution");
    model.storyChoose(0);
    const loaded = new GameModel(CONTENT, model.save());
    loaded.continueGame();
    expect(loaded.storyView?.page.text).toBe(CONTENT.chapters[1]!.resolutionBranches[0]);
    loaded.storyPrevious();
    loaded.storyChoose(1);
    expect(loaded.storyView?.page.text).toBe(CONTENT.chapters[1]!.resolutionBranches[1]);
    for (let i = 0; !loaded.roomPage && i < 20; i++) {
      loaded.storyNext();
    }
    expect(loaded.roomPage).toBe(true);
    before.progress[1].earthChoices = {
      opening: "opening:branch:1",
      resolution: "resolution:branch:1",
    };
    expect(loaded.state).toEqual(before);
    expect(restoreSave(loaded.save())?.progress[1].earthChoices).toEqual(
      before.progress[1].earthChoices,
    );
  });

  it("skips an unanswered choice to the room without consuming waiting story", () => {
    const model = returnedToRoom();
    const room = model.storyView!;
    expect(storyPageView(room.page, room.choices, room.canGoBack, room.canSkip)).toMatchObject({
      action: CONTENT.labels.pickUpRock,
      choices: [{ label: CONTENT.labels.replayChapter }],
      next: true,
    });
    model.state.unlocked.push(3);
    enterReplay(model);
    const replay = model.storyView!;
    expect(
      storyPageView(replay.page, replay.choices, replay.canGoBack, replay.canSkip),
    ).toMatchObject({
      canSkip: true,
      next: false,
    });
    expect(model.state.progress[3].opened).toBe(false);
    model.storySkip();
    expect(model.roomPage).toBe(true);
    expect(model.state.progress[1].earthChoices).toBeUndefined();
    expect(model.state.progress[3].opened).toBe(false);

    model.storyNext();
    for (let i = 0; model.screen !== "selector" && i < 10; i++) {
      model.storyNext();
    }
    expect(model.screen).toBe("selector");
    model.leaveCockpit();
    expect(model.storyView?.page.text).toBe(CONTENT.chapters[3]!.opening);
  });

  it.each([4, 5, 6])(
    "shows all %i finished chapters together and Back returns to the room",
    (count) => {
      const model = pickerWith(count);
      const view = model.storyView!;
      expect(view.choices.map(({ label }) => label)).toEqual(
        ROUTE.slice(0, count).map((galaxy) => CONTENT.chapters[galaxy]!.name),
      );
      expect(storyPageView(view.page, view.choices, view.canGoBack, view.canSkip)).toMatchObject({
        canGoBack: true,
        canSkip: false,
        next: false,
        previousAction: CONTENT.labels.questBack,
      });
      model.storyNext();
      expect(model.storyView).toEqual(view);
      model.storyPrevious();
      expect(model.roomPage).toBe(true);
      model.storyChoose(0);
      model.storyChoose(count - 1);
      expect(model.storyView?.page.text).toBe(CONTENT.chapters[ROUTE[count - 1]!]!.opening);
    },
  );

  it("rejects a saved replay without its room origin or for a chapter no longer eligible", () => {
    const model = returnedToRoom();
    enterReplay(model);
    const missingRoom = model.saveDocument();
    missingRoom.pendingStory!.cursor = { ...missingRoom.pendingStory!.cursor, trail: [] };
    expect(restoreSave(missingRoom)).toBeNull();
    const unfinished = structuredClone(model.saveDocument());
    unfinished.progress[1].resolved = false;
    expect(restoreSave(unfinished)).toBeNull();
  });

  it("records the initial choice without a replay entry during mandatory story", () => {
    const model = new GameModel(CONTENT);
    model.start();
    CONTENT.premise.gardenArrival.forEach(() => model.storyNext());
    expect(model.storyView?.choices).toEqual(model.storyView?.page.choices);
    model.storyChoose(1);
    expect(model.state.progress[1].earthChoices).toEqual({ opening: "opening:branch:1" });
  });
});
