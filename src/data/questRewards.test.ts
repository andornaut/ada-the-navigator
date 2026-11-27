import { describe, expect, it } from "vitest";

import { ACTIVITY_REWARDS } from "./activities.ts";
import { JOB_REWARDS } from "./jobs.ts";
import { questReward } from "./questRewards.ts";

describe("quest completion rewards", () => {
  it.each([
    [0, 0],
    [30, 150],
    [75, 300],
    [90, 400],
    [180, 750],
  ])("converts saved base %i to payout %i", (base, paid) => {
    expect(questReward(base)).toBe(paid);
  });

  it.each([
    [1, { deliveryLong: 300, deliveryShort: 200, hunt: 200, rescue: 300, survey: 150 }],
    [2, { deliveryLong: 450, deliveryShort: 250, hunt: 250, rescue: 450, survey: 200 }],
    [3, { deliveryLong: 600, deliveryShort: 400, hunt: 400, rescue: 600, survey: 250 }],
    [4, { deliveryLong: 600, deliveryShort: 400, hunt: 400, rescue: 600, survey: 250 }],
    [5, { deliveryLong: 600, deliveryShort: 400, hunt: 400, rescue: 600, survey: 250 }],
    [6, { rescue: 600, survey: 250 }],
  ] as const)("pays position %i's jobs %o", (position, paid) => {
    const bases = JOB_REWARDS[position]!;
    expect(
      Object.fromEntries(Object.entries(bases).map(([kind, base]) => [kind, questReward(base)])),
    ).toEqual(paid);
  });

  it.each([
    [2, 450],
    [3, 200],
    [4, 700],
    [5, 750],
  ] as const)("pays position %i's activity %i", (position, paid) => {
    expect(questReward(ACTIVITY_REWARDS[position]!)).toBe(paid);
  });
});
