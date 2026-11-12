import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import type { SectorId } from "../data/types.ts";
import { GameModel } from "./game.ts";

// One speaker a panel (gameplay/player-copy.md): a space panel that hands on to another speaker's
// shows it on Continue, narration under the chapter's panel title, and the last one closes.

/** The panels Continue walks through from a chapter's dialogue key, as [title, text]. */
function walk(sector: SectorId, key: string): (readonly [string, string])[] {
  const model = new GameModel(PROTOTYPE);
  model.state.prologueSeen = true;
  model.state.unlocked = [1, 2, 3];
  model.startSector(sector);
  expect(model.state.selectedSector).toBe(sector);
  const entry = PROTOTYPE.chapters[sector]!.dialogue[key]!;
  model.state.dialogue = {
    choices: [{ id: "continue", label: "Continue" }],
    context: key,
    text: entry.text,
    title: entry.speaker ?? PROTOTYPE.chapters[sector]!.name,
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
        PROTOTYPE.chapters[3]!.name,
        "The whale swims off, and soon the family is traveling together again.",
      ],
      ["Whale family", "You listened when nobody else did. Now listen to us."],
      [
        "Whale family",
        "A shining disk drifts on the current ahead. Drones guard it. Follow our song.",
      ],
    ]);
  });

  it("shows the regular visitor, the narration of the docking, then the miner's thanks", () => {
    expect(walk(2, "approach")).toEqual([
      ["Regular visitor", "There's room for everyone here. Let them dock. We are staying."],
      [PROTOTYPE.chapters[2]!.name, "The miner flies in with company, docks and unloads."],
      ["Miner", "Thank you for staying. See you next trip."],
    ]);
  });

  it("closes a panel that hands on to none", () => {
    expect(walk(3, "family")).toHaveLength(1);
  });
});
