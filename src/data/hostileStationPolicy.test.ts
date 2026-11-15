import { expect, it } from "vitest";

import { HOSTILE_STATION_POLICY, hostileStationReward } from "./hostileStationPolicy.ts";

it("keeps the approved named-galaxy rewards independent of numeric galaxy order", () => {
  expect([hostileStationReward(5), hostileStationReward(2), hostileStationReward(6)]).toEqual([
    100, 150, 200,
  ]);
  expect([hostileStationReward(1), hostileStationReward(3), hostileStationReward(4)]).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
  expect(HOSTILE_STATION_POLICY.defenders).toBe(2);
});
