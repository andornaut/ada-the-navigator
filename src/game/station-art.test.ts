import { describe, expect, it } from "vitest";

import { ART_MANIFEST, GALAXY_MANIFESTS } from "../testing/public-art.ts";
import {
  readOutpostArt,
  readStationArt,
  stationDockWorld,
  type StationFrame,
  stationFrame,
} from "./station-art.ts";

const manifest = ART_MANIFEST as unknown as {
  assets: (StationFrame & { destination?: string; outpost?: string })[];
};
const art = readStationArt(manifest.assets)!;
const outposts = readOutpostArt(manifest.assets);

describe("station art", () => {
  it("reads both blink frames from Art's manifest", () => {
    expect(art.frames.map((frame) => frame.id)).toEqual(["station-a", "station-b"]);
    expect(art.frameMs).toBe(700);
  });

  it("alternates A and B every 700 ms and holds A under reduced motion", () => {
    expect(stationFrame(art, false, 0).id).toBe("station-a");
    expect(stationFrame(art, false, 699).id).toBe("station-a");
    expect(stationFrame(art, false, 700).id).toBe("station-b");
    expect(stationFrame(art, false, 1400).id).toBe("station-a");
    expect(stationFrame(art, true, 700).id).toBe("station-a");
  });

  it("has no dock: Ada enters a station by Use", () => {
    expect(art.frames.map((frame) => stationDockWorld(frame))).toEqual([undefined, undefined]);
  });

  it("draws at the destination scale, 1.5 times its earlier size", () => {
    // 180 by 150 frame px at 0.4375 times 1.5 (art/destinations.md).
    expect(art.frames[0]!.displayWidth).toBeCloseTo(118.125, 3);
    expect(art.frames[0]!.displayHeight).toBeCloseTo(98.438, 3);
  });

  it("keeps the placeholder when the station frames are missing", () => {
    expect(readStationArt([])).toBeUndefined();
  });
});

describe("outpost art", () => {
  it("reads both blink frames for each sector one outpost, keyed by its destination id", () => {
    // Only entries with an outpost field are outposts; the hub's carry destination "hub".
    const sunflower = GALAXY_MANIFESTS.get(1)!.assets as unknown as typeof manifest.assets;
    const roles = sunflower.flatMap((asset) => (asset.outpost ? [asset.outpost] : []));
    expect([...new Set(roles)].sort()).toEqual(["growers", "salvagers", "workshop"]);
    expect([...readOutpostArt(sunflower).keys()].sort()).toEqual([
      "growers",
      "salvagers",
      "workshop",
    ]);
    expect(
      manifest.assets
        .filter((asset) => asset.id.startsWith("outpost-hub-"))
        .every((asset) => asset.outpost === undefined && asset.destination === "hub"),
    ).toBe(true);
    for (const [role, blink] of outposts) {
      expect(blink.frames.map((frame) => frame.id)).toEqual([
        `outpost-${role}-a`,
        `outpost-${role}-b`,
      ]);
      expect(blink.frameMs).toBe(700);
    }
  });

  it("blinks A and B every 700 ms and holds A under reduced motion", () => {
    const growers = outposts.get("growers")!;
    expect(stationFrame(growers, false, 0).id).toBe("outpost-growers-a");
    expect(stationFrame(growers, false, 700).id).toBe("outpost-growers-b");
    expect(stationFrame(growers, true, 700).id).toBe("outpost-growers-a");
  });

  it("draws each outpost at frame * 0.4375 * 1.5 from its world-plane pivot", () => {
    const workshop = outposts.get("workshop")!.frames[0];
    // The destination scale (art/destinations.md), rounded by Art to three decimals.
    expect(workshop.displayWidth).toBeCloseTo(workshop.width * 0.4375 * 1.5, 2);
    expect(workshop.displayHeight).toBeCloseTo(workshop.height * 0.4375 * 1.5, 2);
    expect(workshop.pivot).toEqual({ x: 0.5, y: 0.675 });
  });

  it("skips an outpost missing a frame", () => {
    const single = manifest.assets.filter((asset) => asset.id !== "outpost-salvagers-b");
    expect([...readOutpostArt(single).keys()].sort()).toEqual(["growers", "workshop"]);
  });
});
