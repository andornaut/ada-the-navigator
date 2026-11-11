import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../../data/prototype.ts";
import { GALAXY_CARD } from "./galaxySelectCard.ts";

describe("the galaxy selector card", () => {
  it("lays out Previous, Home, Jump and Next with Jump the only primary", () => {
    expect(GALAXY_CARD.actions).toEqual([
      { id: "previous", role: "secondary" },
      { id: "home", role: "secondary" },
      { id: "jump", role: "primary" },
      { id: "next", role: "secondary" },
    ]);
  });

  it("labels Home with Gameplay's Home string", () => {
    expect(PROTOTYPE.labels.homeButton).toBe("Home");
  });
});
