import { expect, it } from "vitest";

import { CORE_MANIFEST, publicJson } from "../testing/publicArt.ts";
import { ENEMY_SIZE_RATIOS, hullSizeRatio } from "./enemyDimensions.ts";

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

it("spans the Cargo Hauler 2.5 Ada widths and the other retaliator bodies the class's 3", () => {
  expect(hullSizeRatio("retaliator")).toBe(3);
  expect(hullSizeRatio("retaliator", "retaliatorMiningFreighter")).toBe(3);
  expect(hullSizeRatio("retaliator", "retaliatorCargoHauler")).toBe(2.5);
  expect(hullSizeRatio("frigate", "frigateTwin")).toBe(ENEMY_SIZE_RATIOS.frigate);
  // Art draws each body's width to its span, in the jets file the core sidecars name.
  const sidecars = CORE_MANIFEST.sidecars as Record<string, { jets: string }>;
  const width = (hull: string) =>
    (publicJson(sidecars[hull]!.jets) as { hull: { width: number } }).hull.width;
  for (const hull of ["retaliatorCargoHauler", "retaliatorMiningFreighter"]) {
    expect(width(hull) / width("retaliator")).toBeCloseTo(
      hullSizeRatio("retaliator", hull) / hullSizeRatio("retaliator"),
      3,
    );
  }
});
