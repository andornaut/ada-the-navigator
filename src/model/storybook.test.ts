import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { GALAXIES } from "../data/storybook.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { boardAndJump, readStory, relaunch } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import {
  advance,
  canGoBack,
  currentPage,
  goBack,
  type Scene,
  sceneEnd,
  shownChoices,
  storyStart,
} from "./storybook.ts";

// A choice page whose choices branch one or two pages before rejoining.
const branching: Scene = {
  id: "test",
  last: "end",
  lead: "home",
  pages: [
    { background: "park", id: "intro", next: "ask", text: "Intro" },
    {
      background: "park",
      choices: [
        { label: "First", next: "a1" },
        { label: "Second", next: "b1" },
        { label: "Third", next: "c1" },
      ],
      id: "ask",
      text: "Which?",
    },
    { background: "park", id: "a1", next: "a2", text: "A1" },
    { background: "park", id: "a2", next: "end", text: "A2" },
    { background: "park", id: "b1", next: "end", text: "B1" },
    { background: "park", id: "c1", next: "end", text: "C1" },
    { action: "Pick up the rock.", background: "adaRoom", id: "end", text: "" },
  ],
};

// An optional-question page whose answers return to it.
const asking: Scene = {
  id: "asking",
  last: "end",
  lead: "home",
  pages: [
    {
      action: "Continue",
      background: "aboard",
      id: "ask",
      next: "end",
      questions: [
        { label: "One?", next: "one" },
        { label: "Two?", next: "two" },
      ],
      text: "Ask?",
    },
    { background: "aboard", id: "one", next: "ask", text: "One." },
    { background: "aboard", id: "two", next: "ask", text: "Two." },
    { background: "aboard", id: "end", text: "End." },
  ],
};

describe("storybook pages", () => {
  it("keeps a question page's unasked questions, and Skip and Next take Continue", () => {
    let position = storyStart(asking);
    position = advance(position, 1)!;
    expect(currentPage(position).id).toBe("two");
    position = advance(position)!;
    expect(shownChoices(position).map(({ label }) => label)).toEqual(["One?"]);
    expect(currentPage(advance(position)!).id).toBe("end");
    expect(currentPage(sceneEnd(storyStart(asking))).id).toBe("end");
    // The default path leaves every optional question unasked.
    expect(sceneEnd(storyStart(asking)).asked).toEqual([]);
  });

  it("disables Previous on a run's first page and returns along the pages read", () => {
    let position = storyStart(branching);
    expect(canGoBack(position)).toBe(false);
    position = advance(position)!;
    position = advance(position, 1)!;
    expect(currentPage(position).id).toBe("b1");
    expect(canGoBack(position)).toBe(true);
    position = goBack(position);
    expect(currentPage(position).id).toBe("ask");
    position = goBack(goBack(position));
    expect(currentPage(position).id).toBe("intro");
  });

  it("branches each choice one or two pages, then rejoins", () => {
    const read = (choice: number) => {
      const ids: string[] = [];
      let position: ReturnType<typeof advance> = storyStart(branching);
      while (position) {
        ids.push(position.page);
        position = advance(position, currentPage(position).choices ? choice : undefined);
      }
      return ids;
    };
    expect(read(0)).toEqual(["intro", "ask", "a1", "a2", "end"]);
    expect(read(1)).toEqual(["intro", "ask", "b1", "end"]);
    expect(read(2)).toEqual(["intro", "ask", "c1", "end"]);
  });

  it("reaches the scene's end by the default path, the first choice", () => {
    const position = sceneEnd(storyStart(branching));
    expect(currentPage(position).id).toBe("end");
    expect(position.trail.map(({ page }) => page)).toEqual(["intro", "ask", "a1", "a2"]);
    expect(sceneEnd(position)).toBe(position);
  });
});

/** A save whose galaxy is past its space quest and holodisk, in flight. */
function questDone(galaxy: GalaxyNumber): GameModel {
  const model = new GameModel(CONTENT);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.state.unlocked = ([1, 2, 3] as const).filter((id) => id <= galaxy);
  for (const id of model.state.unlocked) {
    model.state.progress[id].opened = true;
  }
  model.startGalaxy(galaxy);
  Object.assign(model.state.progress[galaxy], {
    holodisk: true,
    introduced: true,
    questComplete: true,
    stage: galaxy === 1 ? 4 : 5,
  });
  return model;
}

describe("home visits", () => {
  it("plays the resolution, then the next opening, and boards from Ada's room", () => {
    const model = questDone(1);
    model.returnHome();
    const pages = readStory(model, 1);
    expect(pages.map(({ background, id }) => `${id}@${background}`)).toEqual([
      "resolution@gardenLot",
      "resolution:branch:1@gardenLot",
      "closing@gardenLot",
      // Whirlpool, next on the route, opens at the front door; Mom's line rejoins it.
      "opening@frontDoor",
      "opening:branch:1@frontDoor",
      "opening:rejoin:0@frontDoorMom",
      "room@adaRoom",
      "boarding:0@adaRoom",
      "boarding:1@aboard",
    ]);
    expect(pages[1]?.text).toBe(CONTENT.chapters[1]!.resolutionBranches[1]);
    expect(pages[4]?.text).toBe(CONTENT.chapters[3]!.openingBranches[1]);
    expect(pages.slice(5, 6).map(({ speaker, text }) => [speaker ?? "", text])).toEqual(
      (CONTENT.chapters[3]!.openingRejoin ?? []).map(({ speaker, text }) => [speaker ?? "", text]),
    );
    expect(pages[6]).toMatchObject({
      action: "Pick up the rock.",
      text: "Ada's rock glows softly on her desk.",
    });
    // Narration pages have no name tab; Astra's line has hers.
    expect(pages.map(({ speaker }) => speaker ?? "")).toEqual([
      ...Array<string>(5).fill(""),
      "Mom",
      "",
      "",
      "Astra",
    ]);
    expect(pages.at(-1)?.text).toBe("Welcome back, Navigator. A new galaxy is ready.");
    expect(model.state.progress[1].resolved).toBe(true);
    expect(model.state.progress[3].opened).toBe(true);
    expect(model.screen).toBe("selector");
    model.finishRouteFlight();
    expect(model.galaxyMapSelection).toBe(3);
  });

  it("never replays old scenes: an empty visit shows Penny's line, then the rock", () => {
    const model = questDone(1);
    model.returnHome();
    boardAndJump(model, 1);
    model.returnHome();
    expect(model.storyView?.page).toMatchObject({
      action: "Pick up the rock.",
      background: "adaRoom",
      text: "Penny thumps her tail. Time for another adventure?",
    });
    expect(model.storyView?.canGoBack).toBe(false);
    expect(readStory(model).map(({ id }) => id)).toEqual(["room", "boarding:0", "boarding:1"]);
  });

  it("finishes every skipped scene's effects once when Skip passes the run", () => {
    const model = questDone(2);
    model.returnHome();
    expect(model.storyView?.page.id).toBe("resolution");
    model.storySkip();
    // The resolution passes by its default path to Ada's room. Cartwheel unlocks Phantom, a
    // placeholder with no opening to play.
    expect(model.storyView).toMatchObject({ canSkip: false, page: { id: "room" } });
    expect(model.state.progress[2].resolved).toBe(true);
    expect(model.state.progress[6].opened).toBe(false);
    expect(model.state.unlocked).toEqual([1, 2, 6]);
  });
});

describe("story runs", () => {
  /** A new game's Start: galaxy one's opening chained to the prologue. */
  function started(): GameModel {
    const model = new GameModel(CONTENT);
    model.start();
    return model;
  }
  /** Next (or the first choice) until the page with this id shows. */
  function readTo(model: GameModel, id: string): void {
    for (let turn = 0; turn < 60 && model.storyView?.page.id !== id; turn++) {
      if (model.storyView?.page.choices) {
        model.storyChoose(0);
      } else {
        model.storyNext();
      }
    }
    expect(model.storyView?.page.id).toBe(id);
  }

  it("starts on leaving the start screen: Previous is disabled only on its first page", () => {
    const model = started();
    expect(model.storyView).toMatchObject({
      canGoBack: false,
      canSkip: true,
      page: { background: "grandmaGarden", id: "opening:arrival:0" },
    });
    readTo(model, "opening");
    expect(model.storyView?.canGoBack).toBe(true);
    readTo(model, "prologue:0");
    expect(model.storyView?.canGoBack).toBe(true);
  });

  it("crosses a chained scene's boundary with Previous, leaving the ended scene's effect", () => {
    const model = started();
    readTo(model, "prologue:0");
    expect(model.state.progress[1].opened).toBe(true);
    // Back into Grandma's garden, the opening's last page, then its branch and the opening.
    model.storyPrevious();
    expect(model.storyView).toMatchObject({
      canGoBack: true,
      page: { background: "grandmaGarden", id: "opening:farewell" },
    });
    expect(model.state.progress[1].opened).toBe(true);
    model.storyPrevious();
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("opening");
    while (model.storyView?.canGoBack) {
      model.storyPrevious();
    }
    expect(model.storyView?.page.id).toBe("opening:arrival:0");
    // Reading on ends the opening again and returns to the prologue, the effect still set.
    readTo(model, "prologue:0");
    expect(model.state.progress[1].opened).toBe(true);
  });

  it("returns across boundaries to the page as shown, its asked questions kept", () => {
    const model = questDone(1);
    model.returnHome();
    readTo(model, "closing");
    model.storyNext();
    expect(model.storyView?.page.id).toBe("opening");
    expect(model.state.progress[1].resolved).toBe(true);
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("closing");
    expect(model.state.progress[1].resolved).toBe(true);
    expect(model.state.unlocked).toEqual([1, 3]);
  });

  it("starts at a flight's end and ends on Ada's room page with its named action", () => {
    const model = questDone(1);
    model.returnHome();
    expect(model.storyView?.canGoBack).toBe(false);
    readTo(model, "room");
    expect(model.storyView).toMatchObject({
      canGoBack: true,
      canSkip: false,
      page: { action: "Pick up the rock." },
    });
    // Skip does nothing on the run's end; the named action starts boarding's new run.
    model.storySkip();
    expect(model.storyView?.page.id).toBe("room");
    model.storyNext();
    expect(model.storyView).toMatchObject({
      canGoBack: true,
      canSkip: true,
      page: { id: "boarding:0" },
    });
  });

  it("counts Ada's room page as the first page of the run its named action starts", () => {
    const model = questDone(1);
    model.returnHome();
    readTo(model, "room");
    model.storyNext();
    const boarding = model.storyView!;
    expect(boarding.page.id).toBe("boarding:0");
    expect(boarding.run.pages[0]).toMatchObject({ action: "Pick up the rock.", id: "room" });
    // Previous from boarding returns to the room page, where it is disabled and Skip hides.
    model.storyPrevious();
    expect(model.storyView).toMatchObject({
      canGoBack: false,
      canSkip: false,
      page: { action: "Pick up the rock.", id: "room" },
    });
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("room");
    // The named action boards again, and Skip still stops at galaxy selection.
    model.storyNext();
    expect(model.storyView).toMatchObject({ canGoBack: true, page: { id: "boarding:0" } });
    model.storySkip();
    expect(model.screen).toBe("selector");
  });

  it("starts on leaving galaxy selection, on the run's end page itself", () => {
    const model = started();
    model.storySkip();
    expect(model.screen).toBe("selector");
    model.leaveCockpit();
    expect(model.storyView).toMatchObject({
      canGoBack: false,
      canSkip: false,
      page: { action: "Pick up the rock.", id: "room" },
    });
  });

  it("Skip passes the rest of the run and ends at galaxy selection when it leads aboard", () => {
    const model = started();
    readTo(model, "opening:branch:0");
    model.storySkip();
    expect(model.screen).toBe("selector");
    expect(model.state.progress[1].opened).toBe(true);
    expect(model.state.prologueSeen).toBe(true);
    // Boarding's run ends at selection too.
    const boarding = questDone(1);
    boarding.returnHome();
    readTo(boarding, "room");
    boarding.storyNext();
    boarding.storySkip();
    expect(boarding.screen).toBe("selector");
  });

  /** Each page's id and whether Skip shows, by Next or the first choice, to the run's end. */
  function skipShown(model: GameModel): { id: string; skip: boolean }[] {
    const pages: { id: string; skip: boolean }[] = [];
    for (let turn = 0; turn < 80 && model.storyView; turn++) {
      const view = model.storyView;
      pages.push({ id: view.page.id, skip: view.canSkip });
      if (view.page.action === "Pick up the rock.") {
        break;
      }
      if (view.page.choices && !view.page.questions) {
        model.storyChoose(0);
      } else {
        model.storyNext();
      }
    }
    return pages;
  }

  it("shows Skip on every page of a run to galaxy selection but its last", () => {
    const model = started();
    const pages = skipShown(model);
    expect(model.screen).toBe("selector");
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.slice(0, -1).every(({ skip }) => skip)).toBe(true);
    // The last page before galaxy selection: Skip would pass nothing.
    expect(pages.at(-1)!.skip).toBe(false);
  });

  it("hides Skip on Ada's room page and the page before it, and shows it earlier", () => {
    const model = questDone(1);
    model.returnHome();
    const pages = skipShown(model);
    expect(pages.at(-1)!.id).toBe("room");
    expect(pages.slice(-2).map(({ skip }) => skip)).toEqual([false, false]);
    expect(pages.slice(0, -2).every(({ skip }) => skip)).toBe(true);
    expect(pages.length).toBeGreaterThan(2);
  });

  it("does nothing on the page before Ada's room page, where Skip would pass no page", () => {
    const model = questDone(1);
    model.returnHome();
    const before = skipShown(model).at(-2)!.id;
    const again = questDone(1);
    again.returnHome();
    readTo(again, before);
    again.storySkip();
    expect(again.storyView?.page.id).toBe(before);
  });

  it("Skip stops on Ada's room page, whose Previous returns to the page Skip left", () => {
    const model = questDone(1);
    model.returnHome();
    readTo(model, "closing");
    model.storySkip();
    expect(model.storyView?.page.id).toBe("room");
    model.storyPrevious();
    expect(model.storyView?.page.id).toBe("closing");
  });

  it("starts on Continue from the start screen aboard, with Previous disabled", () => {
    const model = questDone(2);
    model.state.progress[2].questComplete = false;
    model.returnHome();
    const reloaded = relaunch(CONTENT, model.save());
    reloaded.continueGame();
    // Its one page leads straight to galaxy selection, so Skip would pass nothing.
    expect(reloaded.storyView).toMatchObject({ canGoBack: false, canSkip: false });
    reloaded.storySkip();
    expect(reloaded.screen).toBe("story");
    reloaded.storyNext();
    expect(reloaded.screen).toBe("selector");
  });
});

describe("galaxy selection", () => {
  it("walks the ship one open galaxy at a time in route order, stopping at either end", () => {
    const model = questDone(2);
    model.returnHome();
    readStory(model);
    // Cartwheel unlocks Phantom, the farthest position: the ship flies there from Cartwheel.
    expect(model.routeFlight).toEqual({ from: 5, opened: [6], to: 6 });
    expect([model.shipPosition, model.galaxyMapSelection]).toEqual([5, 2]);
    model.finishRouteFlight();
    expect(model.routeFlight).toBeNull();
    expect([model.selectedPosition, model.galaxyMapSelection]).toEqual([6, 6]);
    model.stepGalaxy(1);
    expect([model.selectedPosition, model.galaxyMapSelection]).toEqual([6, 6]);
    model.stepGalaxy(-1);
    expect([model.selectedPosition, model.galaxyMapSelection]).toEqual([5, 2]);
    for (let step = 0; step < 9; step++) {
      model.stepGalaxy(-1);
    }
    expect([model.selectedPosition, model.galaxyMapSelection]).toEqual([1, 1]);
    // The flight plays once: the next boarding opens with the ship at rest on the farthest.
    model.leaveCockpit();
    readStory(model);
    expect(model.screen).toBe("selector");
    expect(model.routeFlight).toBeNull();
    expect(model.shipPosition).toBe(6);
    expect(GALAXIES.map(({ id, name }) => [name, id])).toEqual([
      ["Sunflower", "sunflower"],
      ["Whirlpool", "whirlpool"],
      ["Needle", "needle"],
      ["Andromeda", "andromeda"],
      ["Cartwheel", "cartwheel"],
      ["Phantom", "phantom"],
    ]);
  });

  it("refuses Jump to a locked galaxy and jumps to an unlocked one, replays included", () => {
    const model = questDone(1);
    model.returnHome();
    readStory(model);
    model.finishRouteFlight();
    // Right from Whirlpool, the farthest open, skips the locked galaxies and stays.
    model.stepGalaxy(1);
    expect(model.shipPosition).toBe(2);
    // A tap on Needle, still locked, shows its panel while the ship stays on Whirlpool.
    model.viewGalaxy(3);
    expect([model.galaxyMapSelection, model.shipPosition]).toEqual([4, 2]);
    expect(model.isUnlocked(4)).toBe(false);
    expect(model.jump()).toBe(false);
    expect(model.screen).toBe("selector");
    // Left returns the panel to the ship's galaxy and walks on to Sunflower.
    model.stepGalaxy(-1);
    expect([model.galaxyMapSelection, model.shipPosition]).toEqual([1, 1]);
    expect(model.jump()).toBe(true);
    expect(model.state.mode).toBe("space");
    expect(model.state.flight?.galaxy).toBe(1);
  });

  it("goes Home to Ada's room without a jump", () => {
    const model = questDone(1);
    model.returnHome();
    readStory(model);
    model.leaveCockpit();
    expect(model.state.mode).toBe("home");
    expect(model.screen).toBe("story");
    expect(model.storyView?.page.text).toBe(CONTENT.premise.emptyHome);
  });
});

describe("start flow", () => {
  it("offers only Start until the first flight begins", () => {
    const model = new GameModel(CONTENT);
    expect(model.screen).toBe("start");
    model.continueGame();
    expect(model.screen).toBe("start");
    model.start();
    readStory(model);
    model.leaveCockpit();
    const reloaded = relaunch(CONTENT, model.save());
    expect(reloaded.state.started).toBe(false);
    reloaded.start();
    // Start replays galaxy one's opening; the prologue is seen, so Ada boards from her room.
    expect(reloaded.storyView?.page.id).toBe("opening");
    expect(readStory(reloaded).map(({ id }) => id)).toEqual([
      "opening",
      "opening:branch:0",
      "room",
      "boarding:0",
      "boarding:1",
    ]);
    reloaded.jump();
    expect(relaunch(CONTENT, reloaded.save()).state.started).toBe(true);
  });

  it("continues aboard with Astra's line, then the farthest unlocked galaxy", () => {
    const model = questDone(2);
    model.state.progress[2].questComplete = false;
    model.returnHome();
    const reloaded = relaunch(CONTENT, model.save());
    expect(reloaded.screen).toBe("start");
    reloaded.start();
    expect(reloaded.screen).toBe("start");
    reloaded.continueGame();
    // The room and rock are skipped, never Astra's boarding line.
    expect(
      readStory(reloaded).map(({ background, speaker, text }) => [background, speaker, text]),
    ).toEqual([["aboard", "Astra", "Welcome back, Navigator."]]);
    expect(reloaded.screen).toBe("selector");
    expect(reloaded.galaxyMapSelection).toBe(2);
  });

  it("plays a pending new galaxy announcement on Continue, once", () => {
    const model = questDone(2);
    model.state.progress[2].questComplete = false;
    model.state.announceGalaxy = true;
    model.returnHome();
    const reloaded = relaunch(CONTENT, model.save());
    reloaded.continueGame();
    expect(readStory(reloaded).map(({ text }) => text)).toEqual([
      "Welcome back, Navigator. A new galaxy is ready.",
    ]);
    expect(reloaded.state.announceGalaxy).toBe(false);
  });

  it("plays a waiting home scene before galaxy selection", () => {
    const model = questDone(1);
    const reloaded = relaunch(CONTENT, model.save());
    reloaded.returnHome();
    const home = relaunch(CONTENT, reloaded.save());
    home.continueGame();
    expect(home.storyView?.page.id).toBe("resolution");
    readStory(home);
    home.finishRouteFlight();
    expect(home.galaxyMapSelection).toBe(3);
  });

  it("restarts from Start, clearing story, galaxies, holodisks, Stardust and purchases", () => {
    const model = questDone(2);
    model.state.economy.stardust = 500;
    model.state.economy.ownedWeapons = ["rapidMissile"];
    model.returnHome();
    // Restart acts only from the start screen.
    model.restart();
    expect(model.state.unlocked).toEqual([1, 2]);
    const reloaded = relaunch(CONTENT, model.save());
    const achievements = structuredClone(reloaded.state.achievements);
    reloaded.restart();
    expect(reloaded.screen).toBe("start");
    // Achievements and their counts are all Restart keeps.
    expect(reloaded.state).toEqual({
      ...new GameModel(CONTENT).state,
      achievements: { ...achievements, found: [], sensed: [] },
    });
    expect(achievements.unlocked).toContain("newNavigator");
    reloaded.start();
    // A restart is a first launch again: Grandma's garden, then the opening and the prologue.
    expect(reloaded.storyView?.page.id).toBe("opening:arrival:0");
    expect(readStory(reloaded).some(({ id }) => id === "prologue:0")).toBe(true);
  });
});

describe("storybook save", () => {
  it("rejects malformed flags", () => {
    const state = JSON.parse(new GameModel(CONTENT).save()) as Record<string, unknown>;
    expect(restoreSave({ ...state, started: "yes" })).toBeNull();
    (state.progress as Record<string, Record<string, unknown>>)["1"]!.opened = 1;
    expect(restoreSave(state)).toBeNull();
  });
});
