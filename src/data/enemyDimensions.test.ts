import { expect, it } from "vitest";

import { ENEMY_SIZE_RATIOS } from "./enemyDimensions.ts";

it("keeps the accepted assembled-body size targets including the seven-width hostile station", () => {
  expect(ENEMY_SIZE_RATIOS).toEqual({
    capital: 6,
    fighter: 1,
    flagship: 6,
    frigate: 5,
    hostileStation: 7,
    interceptor: 1,
    platform: 4,
    retaliator: 3,
    swarm: 0.8,
  });
});
