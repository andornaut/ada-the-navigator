import { describe, expect, it } from "vitest";

import { CHEAT_COPY } from "./cheat-copy.ts";
import { PROTOTYPE } from "./prototype.ts";

const playerText = JSON.stringify([
  PROTOTYPE.chapters,
  PROTOTYPE.labels,
  PROTOTYPE.premise,
  CHEAT_COPY,
]);

describe("player text", () => {
  it("calls each story area a galaxy, never a sector", () => {
    expect(playerText).not.toMatch(/sector/i);
    for (const id of [1, 2, 3] as const) {
      expect(PROTOTYPE.chapters[id]!.objectives[0]).toBe("Explore the galaxy.");
    }
    // A placeholder galaxy's panel line is the only story-in-development string.
    expect(PROTOTYPE.labels.deferred).toBeUndefined();
    expect(PROTOTYPE.labels.galaxyInDevelopment).toBe("Story in development.");
    expect(Object.values(PROTOTYPE.labels).filter((text) => /in development/i.test(text))).toEqual([
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
    expect(PROTOTYPE.premise.prologue[0]?.text).toMatch(/^On the way home, Penny tugs Ada /);
  });

  it("names the ship's mind Astra", () => {
    expect(PROTOTYPE.labels.jumpHome).toBe(
      "Astra jumped you back to Earth to recharge. Your story progress is saved.",
    );
  });
});
