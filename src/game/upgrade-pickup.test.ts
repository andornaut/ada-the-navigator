import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { litChevron, readUpgradePickup } from "./upgrade-pickup.ts";

describe("upgrade pickup art", () => {
  const art = readUpgradePickup(manifest.assets)!;

  it("reads the two 12 by 8 chevrons at (0, 2.4) and (0, -2.4) and the climb from the manifest", () => {
    expect(art.size).toEqual({ height: 8, width: 12 });
    expect(art.chevrons).toEqual([
      { name: "lower", offset: { x: 0, y: 2.4 } },
      { name: "upper", offset: { x: 0, y: -2.4 } },
    ]);
    expect(art.climb).toEqual([
      { lit: null, ms: 900 },
      { lit: "lower", ms: 120 },
      { lit: "upper", ms: 120 },
    ]);
  });

  it("lights the lower then the upper chevron after the still frame, looping every 1140 ms", () => {
    expect([0, 899, 900, 1019, 1020, 1139, 1140].map((ms) => litChevron(art, false, ms))).toEqual([
      null,
      null,
      "lower",
      "lower",
      "upper",
      "upper",
      null,
    ]);
    expect(litChevron(art, false, 1140 + 950)).toBe("lower");
  });

  it("holds the still frame under reduced motion", () => {
    expect(litChevron(art, true, 950)).toBeNull();
    expect(litChevron(art, true, 1050)).toBeNull();
  });

  it("refuses an entry without chevrons or a display size, or a climb lighting an unknown chevron", () => {
    expect(readUpgradePickup([])).toBeUndefined();
    const entry = manifest.assets.find((asset) => asset.id === "upgrade-chevron")!;
    expect(readUpgradePickup([{ ...entry, climb: [{ lit: "middle", ms: 100 }] }])).toBeUndefined();
    expect(readUpgradePickup([{ ...entry, displayWidth: 0 }])).toBeUndefined();
  });
});
