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

  it("calls Ada's home home or Earth and never names her city", () => {
    expect(playerText).not.toMatch(/toronto/i);
  });

  it("names Ada's dog Penny, and Archie only as her cat beside Kiwi, never the sibling game", () => {
    // The cats appear together, as "Archie and Kiwi"; any other Archie would name the sibling game.
    expect(playerText).toContain("Archie and Kiwi");
    expect(playerText.replaceAll("Archie and Kiwi", "")).not.toMatch(/archie/i);
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
