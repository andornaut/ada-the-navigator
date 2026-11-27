import { expect, it } from "vitest";

import { hasHostileStationSites } from "./hostileStationPlacement.ts";
import { HOSTILE_STATION_POLICY } from "./hostileStationPolicy.ts";

it("limits sites to the approved galaxies and keeps two defenders per station", () => {
  expect(([5, 2, 6] as const).map(hasHostileStationSites)).toEqual([true, true, true]);
  expect(([1, 3, 4] as const).map(hasHostileStationSites)).toEqual([false, false, false]);
  expect(HOSTILE_STATION_POLICY.defenders).toBe(2);
});
