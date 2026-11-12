import { describe, expect, it } from "vitest";

import { HUNT_GLINT } from "../model/pickup-body.ts";
import { CORE_MANIFEST, publicJson } from "../testing/public-art.ts";
import {
  beaconLandmarkFrame,
  dashes,
  glintFrame,
  glintPing,
  type JobFrame,
  nebulaTint,
  readJobArt,
  readMapArea,
} from "./job-art.ts";
import { LIGHT_FIELD } from "./light-field.ts";

const FILE = publicJson("/art/jobs.json") as Record<string, unknown>;
const assets = CORE_MANIFEST.assets as unknown as JobFrame[];
const art = readJobArt(assets, FILE)!;

describe("the station jobs' art in flight", () => {
  it("layers the nebula as its outer mass, core and stars, and tints the masses per galaxy", () => {
    expect(art.nebula!.map(({ frame, keyline, tint }) => [frame.id, tint, keyline])).toEqual([
      ["landmark-nebula-outer", "nebulaOuter", undefined],
      ["landmark-nebula-core", "nebulaCore", undefined],
      ["landmark-nebula-stars", undefined, "nebulaStars"],
    ]);
    expect(nebulaTint(art, 1, "nebulaOuter")).toBe(0xbaab77);
    expect(nebulaTint(art, 3, "nebulaCore")).toBe(0x5f6a78);
    // A galaxy without its own tint takes the base one.
    expect(nebulaTint(art, 4, "nebulaOuter")).toBe(0x555161);
    expect(art.wreck!.map(({ frame, keyline }) => [frame.id, keyline])).toEqual([
      ["landmark-wreck", "wreck"],
    ]);
  });

  it("keylines the wreck, the beacon, the nebula's stars and the glint on a light field", () => {
    for (const kind of ["wreck", "beacon", "nebulaStars", "huntGlint"]) {
      expect(LIGHT_FIELD.keylined, kind).toContain(kind);
    }
    expect(art.beacon!.keyline).toBe("beacon");
    expect(art.glint!.keyline).toBe("huntGlint");
  });

  it("alternates the beacon's arcs every 700 ms and holds frame A under reduced motion", () => {
    const beacon = art.beacon!;
    expect(beacon.frames.map(({ id }) => id)).toEqual(["landmark-beacon-a", "landmark-beacon-b"]);
    expect([0, 699, 700, 1399, 1400].map((t) => beaconLandmarkFrame(beacon, false, t))).toEqual([
      0, 0, 1, 1, 0,
    ]);
    expect(beaconLandmarkFrame(beacon, true, 700)).toBe(0);
  });

  it("plays the glint's sheet loop, rest under reduced motion", () => {
    const glint = art.glint!;
    expect(glint.loopMs).toBe(420 + 60 + 80 + 60);
    expect([0, 419, 420, 480, 560, 619].map((t) => glintFrame(glint, false, t))).toEqual([
      0, 0, 1, 2, 3, 3,
    ]);
    expect(glintFrame(glint, true, 480)).toBe(glint.rest);
  });

  it("grows the ping from 8 to 28 across over 1200 ms at half its width, fading out; none reduced", () => {
    const glint = art.glint!;
    expect(glintPing(glint, false, 0)).toEqual({ alpha: 0.9, height: 4, width: 8 });
    const half = glintPing(glint, false, 600)!;
    expect(half.width).toBeCloseTo(18);
    expect(half.height).toBeCloseTo(9);
    expect(half.alpha).toBeCloseTo(0.45);
    expect(glintPing(glint, true, 600)).toBeNull();
  });

  it("rims the search area in 12 on and 8 off dashes, with the ink underlay for a light field", () => {
    expect(art.searchArea).toEqual({
      alpha: 0.8,
      dash: [12, 8],
      lightInk: { alpha: 0.8, width: 4 },
      width: 2,
    });
    const square = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const runs = dashes(square, [12, 8]);
    // 160 around, a dash every 20: eight dashes, each 12 long.
    expect(runs).toHaveLength(8);
    const length = (run: { x: number; y: number }[]) =>
      run.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - run[i]!.x, p.y - run[i]!.y), 0);
    for (const run of runs) {
      expect(length(run)).toBeCloseTo(12);
    }
    // The third dash turns the first corner.
    expect(runs[2]).toEqual([
      { x: 40, y: 0 },
      { x: 40, y: 12 },
    ]);
    expect(runs[1]).toEqual([
      { x: 20, y: 0 },
      { x: 32, y: 0 },
    ]);
  });

  it("reads the Map's search area tokens", () => {
    expect(readMapArea(FILE)).toEqual({
      colour: "#feae34",
      dash: [6, 4],
      ink: 4,
      minRadius: 19,
      width: 2,
    });
  });

  it("collects the lost item where its glint's core is drawn, every frame alike", () => {
    expect(HUNT_GLINT).toBeDefined();
    const xs = HUNT_GLINT!.flat().map(({ x }) => x);
    // The core's traced parts lie inside the 15 frame, centred on the pivot.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-7.5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(7.5);
  });

  it("keeps a part's placeholder when its frames are missing", () => {
    const bare = readJobArt([], FILE)!;
    expect(bare.nebula).toBeUndefined();
    expect(bare.beacon).toBeUndefined();
    expect(bare.glint).toBeUndefined();
    expect(bare.searchArea).toBeDefined();
    expect(readJobArt(assets, { ...FILE, version: 2 })).toBeUndefined();
  });
});
