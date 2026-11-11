import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { StoryPage } from "./storybook.ts";
import { readStory } from "./test-launch.ts";

const summary = ({ action, background, choices, speaker, text }: StoryPage) => [
  background,
  speaker ?? "",
  text,
  action ?? (choices ? choices.map(({ label }) => label) : "Next"),
];

/** A first launch: Start, then galaxy one's opening read with choice `choice`. */
function started(choice = 0): GameModel {
  const model = new GameModel(PROTOTYPE);
  expect(model.screen).toBe("start");
  model.start();
  expect(model.storyView?.page.id).toBe("opening");
  model.storyChoose(choice);
  return model;
}

describe("prologue", () => {
  it("follows galaxy one's opening in Ada's room, then the cockpit, then galaxy selection", () => {
    const model = started();
    const pages = readStory(model);
    expect(pages.map(summary)).toEqual([
      [
        "adaRoom",
        "The Glowing Rock",
        "On a walk with Penny, Ada digs up an unusual rock. At home, she polishes it " +
          "until a faint pattern begins to glow.",
        "Touch the glow.",
      ],
      [
        "cockpit",
        "The Glowing Rock",
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
        ["How did you get to Earth?", "Can Penny come?", "How do I get home?"],
      ],
      ["cockpit", "Astra", "I don't remember. The holodisk may help.", "Next"],
      [
        "cockpit",
        "The Glowing Rock",
        "Ada sits in the pilot's chair and buckles Penny in beside her.",
        "Next",
      ],
      ["cockpit", "Astra", "Quantum jump ready.", "Let's find your holodisk."],
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

  it("answers each optional question on its own branch page, then rejoins", () => {
    for (const [choice, answer] of [
      [0, "I don't remember. The holodisk may help."],
      [1, "There are two seats. Please strap Penny in."],
      [2, "Ask me any time you're safe. I'll jump you back to the moment you left."],
    ] as const) {
      const model = started();
      const texts = readStory(model, choice).map(({ text }) => text);
      const asked = texts.findIndex((text) => text.startsWith("I was made to explore"));
      expect(texts.slice(asked + 1, asked + 3)).toEqual([
        answer,
        "Ada sits in the pilot's chair and buckles Penny in beside her.",
      ]);
    }
  });

  it("is replaced by Ada's room with the rock and the boarding lines once seen", () => {
    const model = started();
    readStory(model);
    model.leaveCockpit();
    expect(model.storyView?.page).toMatchObject({
      action: "Pick up the rock.",
      background: "adaRoom",
      text: "Penny thumps her tail. Time for another adventure?",
    });
    const pages = readStory(model);
    expect(pages.map(summary)).toEqual([
      ["adaRoom", "", "Penny thumps her tail. Time for another adventure?", "Pick up the rock."],
      ["cockpit", "The Glowing Rock", "Ada holds Penny close and touches the rock's glow.", "Next"],
      ["cockpit", "Astra", "Welcome back, Navigator.", "Next"],
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
