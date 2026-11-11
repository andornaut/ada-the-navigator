import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import { playOpening } from "./test-launch.ts";

const panel = (model: GameModel) => {
  const dialogue = model.state.dialogue;
  return dialogue && { choices: dialogue.choices.map(({ label }) => label), title: dialogue.title };
};

function openGalaxyOne(model: GameModel): void {
  model.startSector(1);
  expect(model.state.dialogue?.context).toBe("opening");
  model.choose("0");
}

describe("prologue", () => {
  it("plays the script once after galaxy one's opening, then jumps to galaxy one", () => {
    const model = new GameModel(PROTOTYPE);
    expect(model.state.prologueSeen).toBe(false);
    openGalaxyOne(model);
    const shown: [string, string, string[]][] = [];
    for (let i = 0; i < 20 && model.state.mode === "home"; i++) {
      const { choices, title } = panel(model)!;
      shown.push([title, model.state.dialogue!.text, choices]);
      model.choose("continue");
    }
    expect(shown).toEqual([
      [
        "The Glowing Rock",
        "On a walk with Penny, Ada digs up an unusual rock. At home, she polishes it " +
          "until a faint pattern begins to glow.",
        ["Touch the glow."],
      ],
      [
        "The Glowing Rock",
        "Light swirls around Ada and Penny. They are standing in a tiny cockpit. " +
          "Outside, colors shimmer like nowhere at all.",
        ["Continue"],
      ],
      ["Astra", "Navigator detected. Hello. I am Astra, this ship's mind.", ["Continue"]],
      ["Ada", "Where are we?", ["Continue"]],
      [
        "Astra",
        "Between dimensions. While you are aboard, Earth's time waits for you.",
        ["Continue"],
      ],
      [
        "Astra",
        "My memory is damaged. I know only one galaxy. A holodisk holding part of my memory is somewhere there.",
        ["Continue"],
      ],
      [
        "Astra",
        "I was made to explore and map, but I cannot fly without a navigator. Will you be mine?",
        ["How did you get to Earth?", "Can Penny come?", "How do I get home?", "Continue"],
      ],
      [
        "The Glowing Rock",
        "Ada sits in the pilot's chair and buckles Penny in beside her.",
        ["Continue"],
      ],
      ["Astra", "Quantum jump ready.", ["Let's find your holodisk."]],
    ]);
    expect(model.state.mode).toBe("space");
    expect(model.state.flight?.sector).toBe(1);
    expect(model.state.prologueSeen).toBe(true);
  });

  it("answers each optional question and returns to Astra's request without it", () => {
    const model = new GameModel(PROTOTYPE);
    openGalaxyOne(model);
    while (!model.state.dialogue?.choices.some(({ id }) => id.startsWith("ask:"))) {
      model.choose("continue");
    }
    const answers: [string, string][] = [];
    for (const id of ["ask:1", "ask:0", "ask:2"]) {
      model.choose(id);
      answers.push([model.state.dialogue!.title, model.state.dialogue!.text]);
      expect(panel(model)!.choices).toEqual(["Continue"]);
      model.choose("continue");
      expect(model.state.dialogue!.text).toMatch(/^I was made to explore/);
    }
    expect(answers).toEqual([
      ["Astra", "There are two seats. Please strap Penny in."],
      ["Astra", "I don't remember. The holodisk may help."],
      ["Astra", "Ask me any time you're safe. I'll jump you back to the moment you left."],
    ]);
    expect(panel(model)!.choices).toEqual(["Continue"]);
    expect(model.state.prologueSeen).toBe(false);
    model.choose("continue");
    expect(model.state.dialogue!.text).toBe(
      "Ada sits in the pilot's chair and buckles Penny in beside her.",
    );
  });

  it("resumes an interrupted prologue from the saved panel", () => {
    const model = new GameModel(PROTOTYPE);
    openGalaxyOne(model);
    model.choose("continue");
    model.choose("continue");
    const resumed = new GameModel(PROTOTYPE, model.save());
    expect(resumed.state.dialogue).toEqual(model.state.dialogue);
    expect(resumed.state.prologueSeen).toBe(false);
    playOpening(resumed, "continue");
    expect(resumed.state.mode).toBe("space");
    expect(resumed.state.prologueSeen).toBe(true);
  });

  it("shows later openings Penny boarding and Astra's welcome before the jump", () => {
    const model = new GameModel(PROTOTYPE);
    openGalaxyOne(model);
    playOpening(model, "continue");
    model.returnHome();
    model.state.unlocked.push(2);
    for (const galaxy of [1, 2] as const) {
      model.startSector(galaxy);
      expect(model.state.dialogue?.context).toBe("opening");
      model.choose("1");
      expect(model.state.mode).toBe("home");
      expect(panel(model)).toEqual({ choices: ["Continue"], title: "The Glowing Rock" });
      expect(model.state.dialogue!.text).toBe("Ada holds Penny close and touches the rock's glow.");
      model.choose("continue");
      expect(model.state.mode).toBe("home");
      expect(panel(model)).toEqual({ choices: ["Continue"], title: "Astra" });
      expect(model.state.dialogue!.text).toBe("Welcome back, Navigator.");
      model.choose("continue");
      expect(model.state.mode).toBe("space");
      expect(model.state.flight?.sector).toBe(galaxy);
      model.returnHome();
    }
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
    playOpening(launched);
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
