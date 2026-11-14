import { describe, expect, it } from "vitest";

import { questReward } from "./questRewards.ts";

describe("quest completion rewards", () => {
  it.each([
    [0, 0],
    [30, 100],
    [75, 225],
    [90, 275],
    [180, 550],
  ])("converts saved base %i to payout %i", (base, paid) => {
    expect(questReward(base)).toBe(paid);
  });
});
