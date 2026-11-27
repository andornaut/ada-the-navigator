import { describe, expect, it } from "vitest";

import { CHEAT_COPY } from "./cheatCopy.ts";
import { CONTENT } from "./content.ts";

const playerText = JSON.stringify([CONTENT.chapters, CONTENT.labels, CONTENT.premise, CHEAT_COPY]);

describe("player text", () => {
  it("calls each story area a galaxy, never a sector", () => {
    expect(playerText).not.toMatch(/sector/i);
    for (const id of [1, 2, 3] as const) {
      expect(CONTENT.chapters[id]!.objectives[0]).toBe("Explore the galaxy.");
    }
    // A placeholder galaxy's panel line is the only story-in-development string.
    expect(CONTENT.labels.deferred).toBeUndefined();
    expect(CONTENT.labels.galaxyInDevelopment).toBe("Story in development.");
    expect(Object.values(CONTENT.labels).filter((text) => /in development/i.test(text))).toEqual([
      "Story in development.",
    ]);
  });

  it("uses the approved quest handoff lines at their existing chapter steps", () => {
    for (const [galaxy, step, label] of [
      [2, 5, "Buy the holodisk in the Mining Hub’s Shop."],
      [3, 1, "Shoot the three rocks trapping Marlo."],
      [3, 5, "Defeat the guard, then collect the holodisk."],
      [4, 2, "Start at the Practice Channel’s green flag and clear its four rings."],
      [4, 3, "Start at the Eye’s green flag and clear its ten rings."],
      [5, 3, "Follow Pip to the settlers’ station."],
      [5, 4, "Follow Pip to the outpost to pick up the beacon parts."],
      [6, 4, "Destroy the flagship’s weapon hardpoints to disable it."],
      [6, 5, "Use Salvage at the flagship to recover the last holodisk."],
    ] as const) {
      expect(CONTENT.chapters[galaxy]!.objectives[step]).toBe(label);
    }
  });

  it("calls Ada's home home or Earth and never names her city", () => {
    expect(playerText).not.toMatch(/toronto/i);
  });

  it("distinguishes Gadget and Kiwi at home from Admiral Archie", () => {
    expect(CONTENT.premise.prologue[4]?.text).toBe(
      "Gadget and Kiwi watch from the bed, tails twitching.",
    );
    expect(CONTENT.labels.morningRecharge).toContain("Gadget and Kiwi");
    expect(CONTENT.premise.holodisk.memories[2]).toBe(
      "Admiral Archie. I was his navigator. I scattered my holodisks to keep them from him.",
    );
    expect(playerText).not.toContain("General Gadget");
    expect(CONTENT.labels.phantomFlagship).toBe("Archie's flagship");
    expect(CONTENT.chapters[6]!.objectives).toContain("Fly to Archie's flagship.");
    expect(
      playerText.replaceAll("Admiral Archie", "").replaceAll("Archie's flagship", ""),
    ).not.toMatch(/archie/i);
    expect(CONTENT.premise.prologue[0]?.text).toMatch(/^On the way home, Penny tugs Ada /);
  });

  it("notes on the Move and Aim controls rows that hiding a stick keeps its touch input", () => {
    expect(CONTENT.labels.controlsNote).toBe("Touch still works when hidden");
    expect(CONTENT.labels.soundNote).toBe("Controls gameplay sound effects.");
  });

  it("names the ship's mind Astra", () => {
    expect(CONTENT.labels.jumpHome).toBe(
      "Astra jumped you back to Earth to recharge. Your story progress is saved.",
    );
  });
});
