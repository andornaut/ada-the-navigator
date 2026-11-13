import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GameModel } from "./game.ts";

// One speaker a panel (gameplay/player-copy.md): a space panel that hands on to another speaker's
// shows it on Continue, narration under the chapter's panel title, and the last one closes.

/** The panels Continue walks through from a chapter's dialogue key, as [title, text]. */
function walk(galaxy: GalaxyNumber, key: string): (readonly [string, string])[] {
  const model = new GameModel(CONTENT);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 2, 3];
  model.startGalaxy(galaxy);
  expect(model.state.selectedGalaxy).toBe(galaxy);
  const entry = CONTENT.chapters[galaxy]!.dialogue[key]!;
  model.state.dialogue = {
    choices: [{ id: "continue", label: "Continue" }],
    context: key,
    text: entry.text,
    title: entry.speaker ?? CONTENT.chapters[galaxy]!.name,
  };
  const panels: (readonly [string, string])[] = [];
  for (let turn = 0; turn < 5 && model.state.dialogue; turn++) {
    panels.push([model.state.dialogue.title, model.state.dialogue.text]);
    model.choose("continue");
  }
  expect(model.state.dialogue).toBeNull();
  return panels;
}

describe("space dialogue panels", () => {
  it("shows the whale's thanks, the narration of its leaving, then the family's holodisk lead", () => {
    expect(walk(3, "reunion")).toEqual([
      ["Whale", "You found my family! Now I know where to go. Thank you for listening."],
      [
        CONTENT.chapters[3]!.name,
        "The whale swims off, and soon the family is traveling together again.",
      ],
      ["Whale family", "You listened when we needed help. Now listen to us."],
      [
        "Whale family",
        "A shining disk drifts on the current ahead. Drones guard it. Follow our song.",
      ],
    ]);
  });

  it("shows the regular visitor, the narration of the docking, then the miner's thanks", () => {
    expect(walk(2, "approach")).toEqual([
      ["Regular visitor", "There's room for everyone here. Let them dock. We are staying."],
      [CONTENT.chapters[2]!.name, "The miner flies in with company, docks and unloads."],
      ["Miner", "Thank you for staying. See you next trip."],
    ]);
  });

  it("closes a panel that hands on to none", () => {
    expect(walk(3, "family")).toHaveLength(1);
  });
});
