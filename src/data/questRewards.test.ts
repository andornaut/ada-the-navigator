import { describe, expect, it } from "vitest";

import { ACTIVITY_REWARDS } from "./activities.ts";
import { JOB_REWARDS } from "./jobs.ts";
import { questReward } from "./questRewards.ts";

describe("quest completion rewards", () => {
  it.each([
    [0, 0],
    [30, 75],
    [75, 150],
    [90, 200],
    [180, 375],
  ])("converts saved base %i to payout %i", (base, paid) => {
    expect(questReward(base)).toBe(paid);
  });

  it.each([
    [1, { deliveryLong: 150, deliveryShort: 100, hunt: 100, rescue: 150, survey: 75 }],
    [2, { deliveryLong: 225, deliveryShort: 125, hunt: 125, rescue: 225, survey: 100 }],
    [3, { deliveryLong: 300, deliveryShort: 200, hunt: 200, rescue: 300, survey: 125 }],
    [4, { deliveryLong: 300, deliveryShort: 200, hunt: 200, rescue: 300, survey: 125 }],
    [5, { deliveryLong: 300, deliveryShort: 200, hunt: 200, rescue: 300, survey: 125 }],
    [6, { rescue: 300, survey: 125 }],
  ] as const)("pays position %i's jobs %o", (position, paid) => {
    const bases = JOB_REWARDS[position]!;
    expect(
      Object.fromEntries(Object.entries(bases).map(([kind, base]) => [kind, questReward(base)])),
    ).toEqual(paid);
  });

  it.each([
    [2, 225],
    [3, 300],
    [4, 350],
    [5, 375],
  ] as const)("pays position %i's activity %i", (position, paid) => {
    expect(questReward(ACTIVITY_REWARDS[position]!)).toBe(paid);
  });
});
