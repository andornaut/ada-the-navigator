import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  readStardustArt,
  releaseSettle,
  type StardustAsset,
  stardustDrawn,
  stardustFrame,
  stardustPhase,
  stardustShown,
} from "./stardustArt.ts";

const manifest = JSON.parse(
  readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
) as { assets: StardustAsset[] };
const art = readStardustArt(manifest.assets)!;

describe("Stardust pickup art", () => {
  it("reads the 620 ms glint loop from Art's manifest", () => {
    expect(art.loopMs).toBe(620);
    expect(art.rest).toBe(0);
  });

  it("rests 420 ms, then glints through frames 1, 2 and 3", () => {
    expect(stardustFrame(art, false, 0, 0)).toBe(0);
    expect(stardustFrame(art, false, 0, 419)).toBe(0);
    expect(stardustFrame(art, false, 0, 420)).toBe(1);
    expect(stardustFrame(art, false, 0, 480)).toBe(2);
    expect(stardustFrame(art, false, 0, 560)).toBe(3);
    expect(stardustFrame(art, false, 0, 620)).toBe(0);
  });

  it("starts each pickup at its own phase and holds the rest frame under reduced motion", () => {
    expect(stardustFrame(art, false, 200, 220)).toBe(1);
    expect(stardustFrame(art, true, 200, 220)).toBe(0);
    const phases = new Set(
      Array.from({ length: 20 }, (_, index) => stardustPhase(`stardust:${index}`, art.loopMs)),
    );
    expect(phases.size).toBeGreaterThan(10);
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(620);
    }
  });

  it("settles a released pickup from its wreck over 110 ms", () => {
    expect(releaseSettle(110, 0)).toBe(0);
    expect(releaseSettle(110, 110)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(releaseSettle(110, 1000)).toBeGreaterThan(0.999);
  });

  it("bursts a released pickup out from its wreck, but under reduced motion draws it in place", () => {
    const from = { x: 0, y: 0 };
    const point = { x: 10, y: 4 };
    expect(stardustDrawn(110, false, from, 0, point)).toEqual(from);
    expect(stardustDrawn(110, false, from, 55, point).x).toBeCloseTo(10 * releaseSettle(110, 55));
    expect(stardustDrawn(110, true, from, 0, point)).toEqual(point);
    expect(stardustDrawn(110, false, undefined, 0, point)).toEqual(point);
  });

  it("hides a released pickup until its release time, and always draws an unreleased one", () => {
    expect(stardustShown({ at: 3.24 }, 3.2)).toBe(false);
    expect(stardustShown({ at: 3.24 }, 3.24)).toBe(true);
    expect(stardustShown(undefined, 0)).toBe(true);
  });

  it("holds the rest frame under reduced motion, with no glint", () => {
    for (const time of [0, 420, 480, 560]) {
      expect(stardustFrame(art, true, 0, time)).toBe(art.rest);
    }
  });
});
