import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  readStardustArt,
  releaseSettle,
  type StardustAsset,
  stardustFrame,
  stardustPhase,
} from "./stardust-art.ts";

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
});
