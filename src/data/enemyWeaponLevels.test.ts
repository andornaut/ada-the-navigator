import { expect, it } from "vitest";

import { ENEMY_WEAPON_LEVEL_WEIGHTS, selectEnemyWeaponLevel } from "./enemyWeaponLevels.ts";
import type { RoutePosition } from "./galaxies.ts";

it("keeps the confirmed level distributions in route order", () => {
  expect(ENEMY_WEAPON_LEVEL_WEIGHTS).toEqual({
    1: [100, 0, 0],
    2: [75, 25, 0],
    3: [50, 50, 0],
    4: [25, 75, 0],
    5: [0, 75, 25],
    6: [0, 50, 50],
  });
});

it("uses the confirmed CDF boundaries without selecting zero-weight levels", () => {
  const positions: readonly RoutePosition[] = [1, 2, 3, 4, 5, 6];
  for (const [draw, expected] of [
    [0, [1, 1, 1, 1, 2, 2]],
    [0.25 - Number.EPSILON, [1, 1, 1, 1, 2, 2]],
    [0.25, [1, 1, 1, 2, 2, 2]],
    [0.5 - Number.EPSILON, [1, 1, 1, 2, 2, 2]],
    [0.5, [1, 1, 2, 2, 2, 3]],
    [0.75 - Number.EPSILON, [1, 1, 2, 2, 2, 3]],
    [0.75, [1, 2, 2, 2, 3, 3]],
    [1 - Number.EPSILON, [1, 2, 2, 2, 3, 3]],
  ] as const) {
    expect(positions.map((position) => selectEnemyWeaponLevel(position, draw))).toEqual(expected);
  }
});

it("rejects invalid draws instead of silently changing the distribution", () => {
  for (const draw of [-1, 1, NaN, Infinity]) {
    expect(() => selectEnemyWeaponLevel(3, draw)).toThrow(RangeError);
  }
});
