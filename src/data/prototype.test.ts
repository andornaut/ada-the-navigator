import { describe, expect, it } from "vitest";

import { CHEAT_COPY } from "./cheat-copy.ts";
import { PROTOTYPE } from "./prototype.ts";

const playerText = JSON.stringify([PROTOTYPE.chapters, PROTOTYPE.labels, CHEAT_COPY]);

describe("player text", () => {
  it("calls each story area a galaxy, never a sector", () => {
    expect(playerText).not.toMatch(/sector/i);
    for (const id of [1, 2, 3] as const) {
      expect(PROTOTYPE.chapters[id].objectives[0]).toBe("Explore the galaxy.");
    }
    expect(PROTOTYPE.labels.deferred).toBe("Galaxy four: story in development");
  });

  it("calls Ada's home home or Earth and never names her city", () => {
    expect(playerText).not.toMatch(/toronto/i);
  });

  it("names the ship's mind Astra", () => {
    expect(PROTOTYPE.labels.jumpHome).toBe(
      "Astra jumped you home to recharge. Your story progress is saved.",
    );
  });
});
