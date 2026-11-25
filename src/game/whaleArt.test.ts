import { describe, expect, it } from "vitest";

import whales from "../../public/art/friendly-whales.json";
import core from "../../public/art/manifest.json";
import { CONTENT } from "../data/content.ts";
import { ASTEROID_SHAPES } from "../model/asteroids.ts";
import { ART_MANIFEST as manifest } from "../testing/publicArt.ts";
import {
  familyMembers,
  readMarloArt,
  readWhaleArt,
  type WhaleFrame,
  whaleFrameAsset,
  whaleLoopFrame,
  whalePhase,
  whaleViewBox,
} from "./whaleArt.ts";

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

  it("keeps the raw viewport separate from the intrinsic size for the same heading", () => {
    const frame = art.kinds.get("adult")!.frames[6]![0]!;
    expect([frame.displayWidth, frame.displayHeight]).toEqual([115.5, 115.5]);
    expect(whaleViewBox(art, frame)).toEqual({ height: 264, width: 264 });
    expect(whaleViewBox(art, { ...frame, kind: "calf" })).not.toEqual(whaleViewBox(art, frame));
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
    expect(Math.min(...footprints)).toBeCloseTo(51.518, 2);
    expect(Math.max(...footprints)).toBeCloseTo(58.484, 2);
    const { asteroids, spacing } = CONTENT.tuning.whaleDebris;
    const radius = Math.max(...asteroids.map((id) => ASTEROID_SHAPES.get(id)!.radius));
    expect(spacing).toBe(86);
    expect(asteroids.map((id) => ASTEROID_SHAPES.get(id)!.size)).toEqual([
      "medium",
      "medium",
      "medium",
    ]);
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

  it("reads Marlo and the adult from the fresh Phantom core and preserves Whirlpool's full-family requirement", () => {
    const frames = core.assets.filter(whaleFrameAsset) as WhaleFrame[];
    expect(readWhaleArt(whales, frames)).toBeUndefined();
    const marlo = readMarloArt(whales, frames);
    expect([...marlo!.kinds.keys()]).toEqual(["whale", "adult"]);
    expect(marlo?.family).toEqual([]);
    expect(marlo?.kinds.get("whale")).toEqual(art.kinds.get("whale"));
    expect(
      readMarloArt(
        whales,
        frames.filter(({ id }) => id !== "whale-whale-4-0"),
      ),
    ).toBeUndefined();
    const malformed = {
      ...whales,
      kinds: whales.kinds.map((entry) =>
        entry.kind === "whale" ? { ...entry, loop: { ...entry.loop, frames: 0 } } : entry,
      ),
    };
    expect(readMarloArt(malformed, frames)).toBeUndefined();
  });

  it("omits the family's calf while it is guided, keeping the others, and restores it on return", () => {
    const kinds = (away: boolean) => familyMembers(away, art.family).map(({ kind }) => kind);
    expect(art.family.map(({ kind }) => kind)).toContain("calf");
    expect(kinds(true)).not.toContain("calf");
    expect(familyMembers(true, art.family)).toEqual(
      art.family.filter(({ kind }) => kind !== "calf"),
    );
    expect(kinds(false)).toEqual(art.family.map(({ kind }) => kind));
  });
});
