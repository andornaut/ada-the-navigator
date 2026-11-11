import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { StoryPage } from "./storybook.ts";
import { readStory } from "./test-launch.ts";

const summary = ({ action, background, choices, questions, speaker, text }: StoryPage) => [
  background,
  speaker ?? "",
  text,
  action ?? (choices ? choices.map(({ label }) => label) : "Next"),
  ...(questions ? [questions.map(({ label }) => label)] : []),
];

/** A first launch: Start, then galaxy one's opening read with choice `choice`. */
function started(choice = 0): GameModel {
  const model = new GameModel(PROTOTYPE);
  expect(model.screen).toBe("start");
  model.start();
  expect(model.storyView?.page.id).toBe("opening");
  model.storyChoose(choice);
  // The choice's branch page, then the story rejoins at the prologue.
  expect(model.storyView?.page.text).toBe(PROTOTYPE.chapters[1].openingBranches[choice]);
  model.storyNext();
  return model;
}

const questions = ["How did you get to Earth?", "Can Penny come?", "How do I get home?"];

describe("prologue", () => {
  it("moves from the park to Ada's room, then the cockpit, then galaxy selection", () => {
    const model = started();
    const pages = readStory(model);
    expect(pages.map(summary)).toEqual([
      ["park", "", "On a walk with Penny, Ada digs up an unusual rock.", "Next"],
      [
        "adaRoomUnpolished",
        "",
        "At home, she polishes it until a faint pattern begins to glow.",
        "Next",
      ],
      ["adaRoom", "", "The pattern pulses softly, as if it is waiting for her.", "Touch the glow."],
      [
        "cockpit",
        "",
        "Light swirls around Ada and Penny. They are standing in a tiny cockpit. " +
          "Outside, colors shimmer like nowhere at all.",
        "Next",
      ],
      ["cockpit", "Astra", "Navigator detected. Hello. I am Astra, this ship's mind.", "Next"],
      ["cockpit", "Ada", "Where are we?", "Next"],
      [
        "cockpit",
        "Astra",
        "Between dimensions. While you are aboard, Earth's time waits for you.",
        "Next",
      ],
      [
        "cockpit",
        "Astra",
        "My memory is damaged. I know only one galaxy. A holodisk holding part of my memory " +
          "is somewhere there.",
        "Next",
      ],
      [
        "cockpit",
        "Astra",
        "I was made to explore and map, but I can no longer fly without a navigator. " +
          "Will you be mine?",
        "Continue",
        questions,
      ],
      [
        "cockpitSeated",
        "",
        "Ada sits in the pilot's chair and buckles Penny in beside her.",
        "Next",
      ],
      ["cockpitSeated", "Astra", "Quantum jump ready.", "Let's find your holodisk."],
    ]);
    expect(model.screen).toBe("selector");
    expect(model.selectedGalaxy).toBe(1);
    expect(model.state.prologueSeen).toBe(true);
    expect(model.state.progress[1].opened).toBe(true);
    // The prologue is home; the first flight begins only with Jump.
    expect(model.state.started).toBe(false);
    expect(model.jump()).toBe(true);
    expect(model.state.started).toBe(true);
  });

  it("splits its opening across the park, the unpolished room and the glowing room", () => {
    const model = started();
    const earth = readStory(model)
      .filter(({ background }) => !background.startsWith("cockpit"))
      .map(({ action, background, text }) => [background, text, action ?? "Next"]);
    expect(earth).toEqual([
      ["park", "On a walk with Penny, Ada digs up an unusual rock.", "Next"],
      [
        "adaRoomUnpolished",
        "At home, she polishes it until a faint pattern begins to glow.",
        "Next",
      ],
      ["adaRoom", "The pattern pulses softly, as if it is waiting for her.", "Touch the glow."],
    ]);
    // Every later Ada's-room page keeps the glowing room.
    model.leaveCockpit();
    expect(readStory(model).map(({ background }) => background)).toEqual([
      "adaRoom",
      "adaRoom",
      "cockpitSeated",
    ]);
  });

  it("returns each answer to the question list without that question, until Continue", () => {
    const model = started();
    while (!model.storyView?.page.questions) {
      model.storyNext();
    }
    const hub = model.storyView.page.id;
    const answers: string[] = [];
    for (const index of [1, 0, 0]) {
      const remaining = model.storyView!.choices.map(({ label }) => label);
      model.storyChoose(index);
      answers.push(`${remaining[index]} ${model.storyView!.page.text}`);
      // Ada and Penny still stand while Astra answers.
      expect(model.storyView?.page.background).toBe("cockpit");
      model.storyNext();
      expect(model.storyView?.page.id).toBe(hub);
      expect(model.storyView?.choices.map(({ label }) => label)).not.toContain(remaining[index]);
    }
    expect(answers).toEqual([
      "Can Penny come? There are two seats. Please strap Penny in.",
      "How did you get to Earth? I don't remember. The holodisk may help.",
      "How do I get home? Ask me any time you're safe. I'll jump you back to the moment you left.",
    ]);
    expect(model.storyView?.choices).toEqual([]);
    expect(model.state.prologueSeen).toBe(false);
    model.storyNext();
    expect(model.storyView?.page.text).toBe(
      "Ada sits in the pilot's chair and buckles Penny in beside her.",
    );
  });

  it("is replaced by Ada's room with the rock and the boarding lines once seen", () => {
    const model = started();
    readStory(model);
    model.leaveCockpit();
    const pages = readStory(model);
    expect(pages.map(summary)).toEqual([
      ["adaRoom", "", "Penny thumps her tail. Time for another adventure?", "Pick up the rock."],
      ["adaRoom", "", "Ada holds Penny close and touches the rock's glow.", "Next"],
      ["cockpitSeated", "Astra", "Welcome back, Navigator.", "Next"],
    ]);
    expect(model.screen).toBe("selector");
  });
});

describe("prologue save flag", () => {
  const legacy = (change: (state: Record<string, unknown>) => void = () => {}) => {
    const state = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    delete state.prologueSeen;
    change(state);
    return restoreSave(state);
  };

  it("round-trips", () => {
    const model = new GameModel(PROTOTYPE);
    model.state.prologueSeen = true;
    expect(restoreSave(model.save())?.prologueSeen).toBe(true);
  });

  it("plays the prologue for a save that has not started", () => {
    expect(legacy()?.prologueSeen).toBe(false);
  });

  it("skips it for a save past the start", () => {
    const launched = new GameModel(PROTOTYPE);
    launched.startSector(1);
    const flying = JSON.parse(launched.save()) as Record<string, unknown>;
    delete flying.prologueSeen;
    expect(restoreSave(flying)?.prologueSeen).toBe(true);
    expect(legacy((state) => (state.unlocked = [1, 2]))?.prologueSeen).toBe(true);
    expect(
      legacy((state) => ((state.progress as Record<string, { stage: number }>)[1]!.stage = 1))
        ?.prologueSeen,
    ).toBe(true);
  });

  it("rejects a malformed flag", () => {
    const state = JSON.parse(new GameModel(PROTOTYPE).save()) as Record<string, unknown>;
    state.prologueSeen = "yes";
    expect(restoreSave(state)).toBeNull();
  });
});
