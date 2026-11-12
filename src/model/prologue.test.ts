import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import { readStory } from "../testing/launch.ts";
import { GameModel } from "./game.ts";
import { restoreSave } from "./save.ts";
import type { StoryPage } from "./storybook.ts";

const summary = ({ action, background, choices, questions, speaker, text }: StoryPage) => [
  background,
  speaker ?? "",
  text,
  action ?? (choices ? choices.map(({ label }) => label) : "Next"),
  ...(questions ? [questions.map(({ label }) => label)] : []),
];

/** A first launch: Start, Grandma's garden and galaxy one's opening read with choice `choice`. */
function started(choice = 0): GameModel {
  const model = new GameModel(PROTOTYPE);
  expect(model.screen).toBe("start");
  model.start();
  const garden = PROTOTYPE.premise.gardenArrival.map(({ text }) => text);
  const arrival: string[] = [];
  while (model.storyView?.page.id !== "opening") {
    arrival.push(model.storyView!.page.text);
    model.storyNext();
  }
  expect(arrival).toEqual(garden);
  model.storyChoose(choice);
  // The choice's branch page, Grandma's farewell, then the story rejoins at the prologue.
  expect(model.storyView?.page.text).toBe(PROTOTYPE.chapters[1]!.openingBranches[choice]);
  model.storyNext();
  expect(model.storyView?.page).toMatchObject({
    background: "grandmaGarden",
    speaker: "Grandma",
    text: PROTOTYPE.premise.gardenFarewell.text,
  });
  model.storyNext();
  return model;
}

const questions = ["What's a holodisk?", "Can Penny come?", "How do I get home?"];

describe("prologue", () => {
  it("frames chapter one's first-launch opening with Grandma's garden", () => {
    const model = new GameModel(PROTOTYPE);
    model.start();
    const pages: StoryPage[] = [];
    while (model.storyView?.page.background === "grandmaGarden") {
      pages.push(model.storyView.page);
      if (model.storyView.page.choices) {
        model.storyChoose(0);
      } else {
        model.storyNext();
      }
    }
    expect(pages.map(summary)).toEqual([
      [
        "grandmaGarden",
        "",
        "Ada is twelve. She loves maps, old atlases and finding the way to places nobody else " +
          "bothers to go.",
        "Next",
      ],
      [
        "grandmaGarden",
        "",
        "Every Saturday, she and her dog Penny walk to Grandma's house, where the garden grows a " +
          "little wilder each year.",
        "Next",
      ],
      [
        "grandmaGarden",
        "Grandma",
        "There's my navigator. Did you two take the long way again?",
        "Next",
      ],
      ["grandmaGarden", "Ada", "Penny found a shortcut. It was mostly mud.", "Next"],
      [
        "grandmaGarden",
        "",
        PROTOTYPE.chapters[1]!.opening,
        PROTOTYPE.chapters[1]!.openingChoices.map((label) => label),
      ],
      ["grandmaGarden", "", PROTOTYPE.chapters[1]!.openingBranches[0], "Next"],
      [
        "grandmaGarden",
        "Grandma",
        "Think about it on your walk home. Good ideas like fresh air.",
        "Next",
      ],
    ]);
    expect(model.storyView?.page.background).toBe("park");
  });

  it("moves from the park to Ada's room, then the cockpit, then galaxy selection", () => {
    const model = started();
    const pages = readStory(model);
    expect(pages.map(summary)).toEqual([
      [
        "park",
        "",
        "On the way home, Penny tugs Ada off the path and sniffs hard at the roots of an old tree.",
        "Next",
      ],
      [
        "park",
        "",
        "Penny digs. Something round glints in the dirt: a rock, smoother than any Ada has ever " +
          "seen.",
        "Next",
      ],
      ["park", "Ada", "Good nose, Penny. Let's take it home.", "Next"],
      [
        "adaRoomUnpolished",
        "",
        "That evening, Ada polishes the rock at her desk. Under the dirt, thin lines appear, like " +
          "a map of somewhere far away.",
        "Next",
      ],
      ["adaRoomUnpolishedCats", "", "Archie and Kiwi watch from the bed, tails twitching.", "Next"],
      [
        "adaRoom",
        "",
        "The lines begin to glow. The pattern pulses softly, as if it is waiting for her.",
        "Touch the glow.",
      ],
      [
        "cockpit",
        "",
        "Light swirls around Ada and Penny. When it fades, they are standing in a tiny cockpit " +
          "under a blue dome. Through it, colors shimmer like nowhere at all.",
        "Next",
      ],
      [
        "cockpit",
        "",
        "Penny's tail thumps. She sniffs the two seats as if she has been here before.",
        "Next",
      ],
      ["cockpit", "Astra", "Hello. Please don't be afraid. I'm Astra.", "Next"],
      ["cockpit", "Ada", "Who said that? Where are you?", "Next"],
      [
        "cockpit",
        "Astra",
        "All around you. I'm an AI, the mind of this ship. You're standing inside me, in a way.",
        "Next",
      ],
      ["cockpit", "Astra", "What is your name, explorer?", "Next"],
      ["cockpit", "Ada", "Ada. And this is Penny.", "Next"],
      [
        "cockpit",
        "Astra",
        "Hello, Ada. Hello, Penny. The rock you found is my beacon. It waits for someone who " +
          "loves to find the way.",
        "Next",
      ],
      ["cockpit", "Ada", "Where are we?", "Next"],
      [
        "cockpit",
        "Astra",
        "Between dimensions. While you are aboard, no time passes on Earth. Your family won't " +
          "even know you left.",
        "Next",
      ],
      [
        "cockpit",
        "Astra",
        "I was made to explore and map new places. But my memory is damaged. Pieces of it are " +
          "stored on holodisks, and they were scattered across the galaxies.",
        "Next",
      ],
      [
        "cockpit",
        "Astra",
        "I can still jump, but I can't find my way alone. I need a navigator. Will you be mine?",
        "Next",
      ],
      ["cockpit", "Ada", "A real navigator? In space?", "Next"],
      [
        "cockpit",
        "Astra",
        "In space. I'll fly where you steer. You choose where we go, and tell me what you see.",
        "Continue",
        questions,
      ],
      [
        "cockpitSeated",
        "",
        "Ada sits in the pilot's chair and buckles Penny in beside her.",
        "Next",
      ],
      [
        "cockpitSeated",
        "Astra",
        "You steer, and you aim. My shield will protect us. If it ever fails, I'll jump us " +
          "straight back to Earth.",
        "Next",
      ],
      [
        "cockpitSeated",
        "Astra",
        "I remember one galaxy: Sunflower. Its holodisk is somewhere there. Quantum jump ready.",
        "Let's find your holodisk.",
      ],
    ]);
    // Fourteen standing cockpit pages, then three seated.
    expect(pages.filter(({ background }) => background === "cockpit")).toHaveLength(14);
    expect(pages.filter(({ background }) => background === "cockpitSeated")).toHaveLength(3);
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
      .map(({ action, background }) => [background, action ?? "Next"]);
    expect(earth).toEqual([
      ["park", "Next"],
      ["park", "Next"],
      ["park", "Next"],
      ["adaRoomUnpolished", "Next"],
      ["adaRoomUnpolishedCats", "Next"],
      ["adaRoom", "Touch the glow."],
    ]);
    // Every later Ada's-room page keeps the glowing room.
    model.leaveCockpit();
    expect(readStory(model).map(({ background }) => background)).toEqual([
      "adaRoom",
      "adaRoom",
      "cockpitSeated",
    ]);
  });

  it("answers the new holodisk question, then returns it to the list without it", () => {
    const model = started();
    while (!model.storyView?.page.questions) {
      model.storyNext();
    }
    const hub = model.storyView.page.id;
    expect(model.storyView.choices[0]?.label).toBe("What's a holodisk?");
    model.storyChoose(0);
    expect(model.storyView?.page).toMatchObject({
      background: "cockpit",
      speaker: "Astra",
      text:
        "A disc that holds part of my memory. Each one you find helps me remember, maybe even how " +
        "I came to Earth, and shows me new places to jump.",
    });
    model.storyNext();
    expect(model.storyView?.page.id).toBe(hub);
    expect(model.storyView?.choices.map(({ label }) => label)).toEqual(questions.slice(1));
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
      "What's a holodisk? A disc that holds part of my memory. Each one you find helps me " +
        "remember, maybe even how I came to Earth, and shows me new places to jump.",
      "How do I get home? Ask me any time you're safe. I'll jump you back to the moment you left.",
    ]);
    expect(model.storyView?.choices).toEqual([]);
    expect(model.state.prologueSeen).toBe(false);
    model.storyNext();
    expect(model.storyView?.page.text).toBe(
      "Ada sits in the pilot's chair and buckles Penny in beside her.",
    );
  });

  it("plays the garden and the prologue once, and Skip from any page but the last goes to galaxy selection", () => {
    for (let at = 0; at < 30; at++) {
      const model = new GameModel(PROTOTYPE);
      model.start();
      for (let turn = 0; turn < at && model.screen === "story"; turn++) {
        if (model.storyView?.page.choices && !model.storyView.page.questions) {
          model.storyChoose(0);
        } else {
          model.storyNext();
        }
      }
      if (model.screen !== "story") {
        break;
      }
      if (!model.storyView?.canSkip) {
        // The last page before galaxy selection: Skip would pass nothing, so Next leaves.
        model.storySkip();
        expect(model.screen).toBe("story");
        model.storyNext();
      } else {
        model.storySkip();
      }
      expect(model.screen, `Skip from page ${at}`).toBe("selector");
      expect(model.state.prologueSeen).toBe(true);
      // Seen: a later visit plays neither the garden nor the prologue.
      model.leaveCockpit();
      expect(model.storyView?.page.id).toBe("room");
    }
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
