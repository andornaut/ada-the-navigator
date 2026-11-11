import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import whales from "../../public/art/whales.json";
import { PROTOTYPE } from "../data/prototype.ts";
import {
  readWhaleArt,
  type WhaleFrame,
  whaleFrameAsset,
  whaleLoopFrame,
  whalePhase,
} from "./whale-art.ts";

const assets = manifest.assets as WhaleFrame[];
const art = readWhaleArt(whales, assets)!;

describe("whale art", () => {
  it("reads four kinds, each with 16 headings of an 8-frame loop", () => {
    expect([...art.kinds.keys()].sort()).toEqual(["adult", "calf", "whale", "youngCalf"]);
    for (const [kind, set] of art.kinds) {
      expect(set.frames).toHaveLength(16);
      for (const [heading, frames] of set.frames.entries()) {
        expect(frames.map((frame) => frame.id)).toEqual(
          Array.from({ length: 8 }, (_, frame) => `whale-${kind}-${heading}-${frame}`),
        );
      }
    }
  });

  it("holds each kind's stationary heading and places the family at Art's offsets", () => {
    const stationary = Object.fromEntries(
      [...art.kinds].map(([kind, set]) => [kind, set.stationaryHeading]),
    );
    expect(stationary).toEqual({ adult: 6, calf: 6, whale: 4, youngCalf: 7 });
    expect(art.family).toEqual([
      { kind: "adult", offset: { x: 0, y: 0 } },
      { kind: "calf", offset: { x: 38, y: 40 } },
      { kind: "youngCalf", offset: { x: -18, y: 58 } },
    ]);
  });

  it("clears the whale's widest footprint with the trapping debris ring", () => {
    const footprints = art.kinds.get("whale")!.footprints;
    expect(Math.min(...footprints)).toBeCloseTo(42.63, 2);
    expect(Math.max(...footprints)).toBeCloseTo(48.22, 2);
    const { radius, spacing } = PROTOTYPE.tuning.whaleDebris;
    expect(spacing).toBe(76);
    expect(spacing - radius).toBeGreaterThan(Math.max(...footprints));
  });

  it("loops idle and swimming at Art's timings from each whale's phase", () => {
    const whale = art.kinds.get("whale")!;
    const calf = art.kinds.get("calf")!;
    expect([whale.idleMs, whale.swimMs, calf.idleMs, calf.swimMs]).toEqual([300, 150, 200, 100]);
    expect(whaleLoopFrame(art, whale, false, false, 0, 299)).toBe(0);
    expect(whaleLoopFrame(art, whale, false, false, 0, 300)).toBe(1);
    expect(whaleLoopFrame(art, whale, true, false, 0, 300)).toBe(2);
    expect(whaleLoopFrame(art, calf, false, false, 0, 1600)).toBe(0);
    expect(whaleLoopFrame(art, whale, false, false, 600, 0)).toBe(2);
    expect(whalePhase("family:calf", 1600)).not.toBe(whalePhase("family:youngCalf", 1600));
  });

  it("holds frame 0 under reduced motion", () => {
    const whale = art.kinds.get("whale")!;
    for (const time of [0, 450, 1200]) {
      expect(whaleLoopFrame(art, whale, true, true, 120, time)).toBe(0);
    }
  });

  it("loads whale frames on demand, not at boot", () => {
    const frames = assets.filter(whaleFrameAsset);
    expect(frames).toHaveLength(512);
    expect(
      assets
        .filter((asset) => !whaleFrameAsset(asset))
        .some((asset) => asset.id.startsWith("whale-")),
    ).toBe(false);
  });

  it("keeps the placeholder when the data or a frame is missing", () => {
    expect(readWhaleArt(undefined, assets)).toBeUndefined();
    expect(
      readWhaleArt(
        whales,
        assets.filter((asset) => asset.id !== "whale-calf-3-5"),
      ),
    ).toBeUndefined();
  });
});
