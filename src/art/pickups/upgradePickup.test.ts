import { describe, expect, it } from "vitest";

import manifest from "../../../public/art/manifest.json";
import { readUpgradePickup, upgradeFrame } from "./upgradePickup.ts";

describe("upgrade pickup art", () => {
  const art = readUpgradePickup(manifest.assets)!;

  it("reads the strip's display size, centre pivot and the climb through its frames", () => {
    expect(art.size).toEqual({ height: 17.5, width: 17.5 });
    expect(art.pivot).toEqual({ x: 0.5, y: 0.5 });
    expect(art.rest).toBe(0);
    expect(art.climb).toEqual([
      { frame: 0, ms: 900 },
      { frame: 1, ms: 120 },
      { frame: 2, ms: 120 },
    ]);
  });

  it("shows the lower then the upper lit frame after the still frame, looping every 1140 ms", () => {
    expect([0, 899, 900, 1019, 1020, 1139, 1140].map((ms) => upgradeFrame(art, false, ms))).toEqual(
      [0, 0, 1, 1, 2, 2, 0],
    );
    expect(upgradeFrame(art, false, 1140 + 950)).toBe(1);
  });

  it("holds the still frame under reduced motion", () => {
    expect(upgradeFrame(art, true, 950)).toBe(0);
    expect(upgradeFrame(art, true, 1050)).toBe(0);
  });

  it("refuses an entry without frames or a display size, or a climb naming an unknown frame", () => {
    expect(readUpgradePickup([])).toBeUndefined();
    const entry = manifest.assets.find((asset) => asset.id === "upgrade-chevron")!;
    expect(readUpgradePickup([{ ...entry, climb: [{ lit: "middle", ms: 100 }] }])).toBeUndefined();
    expect(readUpgradePickup([{ ...entry, displayWidth: 0 }])).toBeUndefined();
    expect(readUpgradePickup([{ ...entry, frames: undefined }])).toBeUndefined();
  });
});
