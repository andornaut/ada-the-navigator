import { describe, expect, it } from "vitest";

import { RESOURCE_DESCRIPTIONS } from "./resourceDescriptions.ts";

describe("approved resource detail copy", () => {
  it("explains shield recharge and mining objectives without repeating ore consumption", () => {
    expect(RESOURCE_DESCRIPTIONS.ore).toBe(
      "Ore is used to recharge shields. Deposit ore at the mining hub to advance mining objectives.",
    );
  });

  it("keeps Stardust uses and persistence on returning to Earth", () => {
    expect(RESOURCE_DESCRIPTIONS.stardust).toBe(
      "Spend Stardust at stations on weapons, ammo, upgrades, paint and community projects. " +
        "You keep it when you return to Earth.",
    );
  });
});
