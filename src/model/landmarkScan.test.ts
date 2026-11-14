import { expect, it } from "vitest";

import type { LandmarkSite } from "./landmarks.ts";
import { landmarkScanTarget } from "./landmarkScan.ts";

const site = (id: string, x: number): LandmarkSite => ({
  id,
  kind: "wreck",
  name: "wreckName",
  x,
  y: 0,
});

it("selects one nearest uncharted landmark using the supplied shared interaction range", () => {
  const sites = [site("far", 161), site("edge", 160), site("near", 80)];
  const context = { charted: [], player: { x: 0, y: 0 }, range: 160 };
  expect(landmarkScanTarget(context, sites)?.id).toBe("near");
  expect(landmarkScanTarget({ ...context, charted: ["near"] }, sites)?.id).toBe("edge");
  expect(landmarkScanTarget({ ...context, charted: ["near", "edge"] }, sites)).toBeUndefined();
  expect(sites.map(({ id }) => id)).toEqual(["far", "edge", "near"]);
});

it("uses periodic distance only when the flight supplies topology", () => {
  const sites = [site("seam", -499)];
  const context = { charted: [], player: { x: 499, y: 0 }, range: 4 };
  expect(landmarkScanTarget(context, sites)).toBeUndefined();
  expect(landmarkScanTarget({ ...context, worldSide: 1000 }, sites)?.id).toBe("seam");
});
