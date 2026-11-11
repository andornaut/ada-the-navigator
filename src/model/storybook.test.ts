import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GALAXIES } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import {
  advance,
  canGoBack,
  currentPage,
  goBack,
  type Scene,
  shownChoices,
  skip,
  storyStart,
} from "./storybook.ts";
import { boardAndJump, readStory } from "./test-launch.ts";

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
      background: "cockpit",
      id: "ask",
      next: "end",
      questions: [
        { label: "One?", next: "one" },
        { label: "Two?", next: "two" },
      ],
      text: "Ask?",
    },
    { background: "cockpit", id: "one", next: "ask", text: "One." },
    { background: "cockpit", id: "two", next: "ask", text: "Two." },
    { background: "cockpit", id: "end", text: "End." },
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
    expect(currentPage(skip(storyStart(asking))!).id).toBe("end");
  });

  it("disables Previous on a scene's first page and returns along the pages read", () => {
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

  it("skips to the scene's end by the default path, the first choice", () => {
    const position = skip(storyStart(branching))!;
    expect(currentPage(position).id).toBe("end");
    expect(position.trail).toEqual(["intro", "ask", "a1", "a2"]);
    // On the last page Skip ends the scene.
    expect(skip(position)).toBeNull();
  });
});

/** A save whose galaxy is past its space quest and holodisk, in flight. */
function questDone(galaxy: SectorId): GameModel {
  const model = new GameModel(PROTOTYPE);
  Object.assign(model.state, { prologueSeen: true, started: true });
  model.state.unlocked = ([1, 2, 3] as const).filter((id) => id <= galaxy);
  for (const id of model.state.unlocked) {
    model.state.progress[id].opened = true;
  }
  model.startSector(galaxy);
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
      "opening@schoolHallway",
      "opening:branch:1@schoolHallway",
      "room@adaRoom",
      "boarding:0@adaRoom",
      "boarding:1@cockpit",
    ]);
    expect(pages[1]?.text).toBe(PROTOTYPE.chapters[1].resolutionBranches[1]);
    expect(pages[4]?.text).toBe(PROTOTYPE.chapters[2].openingBranches[1]);
    expect(pages[5]).toMatchObject({
      action: "Pick up the rock.",
      text: "Ada's rock glows softly on her desk.",
    });
    // Narration pages have no name tab; Astra's line has hers.
    expect(pages.map(({ speaker }) => speaker ?? "")).toEqual([
      ...Array<string>(7).fill(""),
      "Astra",
    ]);
    expect(pages.at(-1)?.text).toBe("Welcome back, Navigator. A new galaxy is ready.");
    expect(model.state.progress[1].resolved).toBe(true);
    expect(model.state.progress[2].opened).toBe(true);
    expect(model.screen).toBe("selector");
    expect(model.selectedGalaxy).toBe(2);
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

  it("finishes a scene's effects when Skip passes its choices", () => {
    const model = questDone(2);
    model.returnHome();
    model.storySkip();
    expect(model.storyView?.page.id).toBe("closing");
    expect(model.state.progress[2].resolved).toBe(false);
    model.storySkip();
    expect(model.state.progress[2].resolved).toBe(true);
    expect(model.storyView?.page.id).toBe("opening");
  });
});

describe("galaxy selection", () => {
  it("pages one galaxy at a time within the four galaxies", () => {
    const model = questDone(2);
    model.returnHome();
    readStory(model);
    expect(model.selectedGalaxy).toBe(3);
    model.pageGalaxy(1);
    expect(model.selectedGalaxy).toBe(4);
    model.pageGalaxy(1);
    expect(model.selectedGalaxy).toBe(4);
    model.pageGalaxy(-9);
    expect(model.selectedGalaxy).toBe(1);
    expect(GALAXIES.map(({ hue, name }) => [name, hue])).toEqual([
      ["Sunflower", "#332712"],
      ["Cartwheel", "#39221e"],
      ["Whirlpool", "#132d33"],
      ["Black Eye", "#271423"],
    ]);
  });

  it("refuses Jump to a locked galaxy and jumps to an unlocked one, replays included", () => {
    const model = questDone(1);
    model.returnHome();
    readStory(model);
    model.pageGalaxy(1);
    expect(model.selectedGalaxy).toBe(3);
    expect(model.isUnlocked(3)).toBe(false);
    expect(model.jump()).toBe(false);
    expect(model.screen).toBe("selector");
    model.pageGalaxy(-2);
    expect(model.jump()).toBe(true);
    expect(model.state.mode).toBe("space");
    expect(model.state.flight?.sector).toBe(1);
  });

  it("goes Home to Ada's room without a jump", () => {
    const model = questDone(1);
    model.returnHome();
    readStory(model);
    model.leaveCockpit();
    expect(model.state.mode).toBe("home");
    expect(model.screen).toBe("story");
    expect(model.storyView?.page.text).toBe(PROTOTYPE.premise.emptyHome);
  });
});

describe("start flow", () => {
  it("offers only Start until the first flight begins", () => {
    const model = new GameModel(PROTOTYPE);
    expect(model.screen).toBe("start");
    model.continueGame();
    expect(model.screen).toBe("start");
    model.start();
    readStory(model);
    model.leaveCockpit();
    const reloaded = new GameModel(PROTOTYPE, model.save());
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
    expect(new GameModel(PROTOTYPE, reloaded.save()).state.started).toBe(true);
  });

  it("continues in the cockpit with Astra's line, then the farthest unlocked galaxy", () => {
    const model = questDone(2);
    model.state.progress[2].questComplete = false;
    model.returnHome();
    const reloaded = new GameModel(PROTOTYPE, model.save());
    expect(reloaded.screen).toBe("start");
    reloaded.start();
    expect(reloaded.screen).toBe("start");
    reloaded.continueGame();
    // The room and rock are skipped, never Astra's boarding line.
    expect(
      readStory(reloaded).map(({ background, speaker, text }) => [background, speaker, text]),
    ).toEqual([["cockpit", "Astra", "Welcome back, Navigator."]]);
    expect(reloaded.screen).toBe("selector");
    expect(reloaded.selectedGalaxy).toBe(2);
  });

  it("plays a pending new galaxy announcement on Continue, once", () => {
    const model = questDone(2);
    model.state.progress[2].questComplete = false;
    model.state.announceGalaxy = true;
    model.returnHome();
    const reloaded = new GameModel(PROTOTYPE, model.save());
    reloaded.continueGame();
    expect(readStory(reloaded).map(({ text }) => text)).toEqual([
      "Welcome back, Navigator. A new galaxy is ready.",
    ]);
    expect(reloaded.state.announceGalaxy).toBe(false);
  });

  it("plays a waiting home scene before galaxy selection", () => {
    const model = questDone(1);
    const reloaded = new GameModel(PROTOTYPE, model.save());
    reloaded.returnHome();
    const home = new GameModel(PROTOTYPE, reloaded.save());
    home.continueGame();
    expect(home.storyView?.page.id).toBe("resolution");
    readStory(home);
    expect(home.selectedGalaxy).toBe(2);
  });

  it("restarts from Start, clearing story, galaxies, holodisks, Stardust and purchases", () => {
    const model = questDone(2);
    model.state.economy.stardust = 500;
    model.state.economy.ownedWeapons = ["rapidMissile"];
    model.returnHome();
    // Restart acts only from the start screen.
    model.restart();
    expect(model.state.unlocked).toEqual([1, 2]);
    const reloaded = new GameModel(PROTOTYPE, model.save());
    reloaded.restart();
    expect(reloaded.screen).toBe("start");
    expect(reloaded.state).toEqual(new GameModel(PROTOTYPE).state);
    reloaded.start();
    expect(reloaded.storyView?.page.id).toBe("opening");
    expect(readStory(reloaded).some(({ id }) => id === "prologue:park")).toBe(true);
  });
});

describe("storybook save", () => {
  it("migrates opened and started from story progress and drops old home panels", () => {
    const legacy = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete legacy.started;
    const progress = legacy.progress as Record<string, Record<string, unknown>>;
    for (const id of ["1", "2", "3"]) {
      delete progress[id]!.opened;
    }
    progress["1"]!.stage = 2;
    legacy.unlocked = [1, 2];
    legacy.dialogue = { choices: [], context: "opening", text: "x", title: "y" };
    const restored = restoreSave(legacy)!;
    expect([1, 2, 3].map((id) => restored.progress[id as SectorId].opened)).toEqual([
      true,
      false,
      false,
    ]);
    expect(restored.started).toBe(true);
    expect(restored.dialogue).toBeNull();
    const fresh = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete fresh.started;
    expect(restoreSave(fresh)?.started).toBe(false);
  });

  it("rejects malformed flags", () => {
    const state = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    expect(restoreSave({ ...state, started: "yes" })).toBeNull();
    (state.progress as Record<string, Record<string, unknown>>)["1"]!.opened = 1;
    expect(restoreSave(state)).toBeNull();
  });
});
