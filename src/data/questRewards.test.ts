import { describe, expect, it } from "vitest";

import { questReward } from "./questRewards.ts";

describe("quest completion rewards", () => {
  it.each([
    [0, 0],
    [30, 100],
    [45, 150],
    [60, 200],
    [75, 225],
    [90, 275],
    [105, 325],
    [150, 450],
    [165, 500],
    [180, 550],
    [73, 225],
  ])("converts saved base %i to payout %i", (base, paid) => {
    expect(questReward(base)).toBe(paid);
  });
});
