import { describe, expect, it } from "vitest";

import { CURRENTS } from "../data/galaxy-features.ts";
import { PROJECTS } from "../data/projects.ts";
import { currentsNear, nearestOnCurrent } from "../model/currents.ts";
import { GALAXY_MANIFESTS, publicJson } from "../testing/public-art.ts";
import {
  buoyFrame,
  buoyPlaces,
  frameBounds,
  nurseryFrame,
  poolRings,
  type ProjectFrame,
  readWhirlpoolProjects,
  whalesCurrent,
} from "./whirlpool-projects.ts";

const FILE = publicJson("/art/whirlpool/projects.json") as {
  projects: Record<string, Record<string, unknown>>;
};
const assets = GALAXY_MANIFESTS.get(3)!.assets as unknown as ProjectFrame[];
const art = readWhirlpoolProjects(assets, FILE)!;
const beacon = art.nurseryBeacon!;
const buoys = art.currentBuoys!;
const straight = {
  length: 1000,
  points: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ],
  stations: [0, 1000],
  width: 200,
};

describe("Whirlpool's project world changes", () => {
  it("reads Art's nursery beacon and current-map buoys at their projects' sites", () => {
    const sites = new Map(PROJECTS[3]!.map(({ id, site }) => [id, site]));
    expect(sites.get("nurseryBeacon")).toBe("family");
    expect(sites.get("currentBuoys")).toBe("whalesCurrent");
    expect(art.reducedFrame).toBe(0);
    expect(beacon.frames.map(({ id }) => id)).toEqual([
      "whirlpool-nursery-beacon-a",
      "whirlpool-nursery-beacon-b",
    ]);
    expect(beacon).toMatchObject({ frameMs: 1400, offset: { x: -54, y: 58 } });
    expect(beacon.pool).toEqual({
      alpha: [0.07, 0.05],
      centre: { x: -6, y: 54 },
      color: "#ffe9b8",
      radii: [72, 56, 40, 24],
    });
    expect(buoys.frames.map(({ id }) => id)).toEqual([
      "whirlpool-current-buoy-a",
      "whirlpool-current-buoy-b",
    ]);
    expect(buoys).toMatchObject({
      chase: { stepMs: 300, steps: 4 },
      edge: 20,
      sides: [1, -1],
      spacing: 128,
      start: 64,
    });
    const bounds = frameBounds(beacon.frames[0]);
    expect(
      [bounds.left, bounds.top, bounds.right, bounds.bottom].map((v) => Number(v.toFixed(6))),
    ).toEqual([-17.5, -39.2, 17.5, 9.8]);
  });

  it("drops a malformed project and refuses a file of another version", () => {
    const broken = structuredClone(FILE);
    broken.projects.currentBuoys!.site = "family";
    const read = readWhirlpoolProjects(assets, broken)!;
    expect(read.currentBuoys).toBeUndefined();
    expect(read.nurseryBeacon).toBeDefined();
    expect(readWhirlpoolProjects(assets, { ...FILE, version: 2 })).toBeUndefined();
    expect(readWhirlpoolProjects([], FILE)).toEqual({ reducedFrame: 0 });
  });

  it("breathes the beacon A then B every 1400 ms, and holds A under reduced motion", () => {
    expect([0, 1399, 1400, 2799, 2800].map((t) => nurseryFrame(art, beacon, false, t))).toEqual([
      0, 0, 1, 1, 0,
    ]);
    expect(nurseryFrame(art, beacon, true, 1400)).toBe(0);
  });

  it("rings the pool around the family at the frame's alpha", () => {
    const family = { x: 1000, y: -500 };
    expect(poolRings(beacon, family, 1)).toEqual(
      [72, 56, 40, 24].map((radius) => ({ alpha: 0.05, centre: { x: 994, y: -446 }, radius })),
    );
  });

  it("places buoys every 128 along both edges, 20 outside, while they stay 64 short of the end", () => {
    const places = buoyPlaces(buoys, straight);
    // s = 64 + 128 k <= 936: k from 0 to 6.
    expect(places.map(({ k, side }) => [k, side])).toEqual(
      [0, 1, 2, 3, 4, 5, 6].flatMap((k) => [
        [k, 1],
        [k, -1],
      ]),
    );
    expect(places.slice(0, 2).map(({ point }) => point)).toEqual([
      { x: 64, y: 120 },
      { x: 64, y: -120 },
    ]);
    expect(places.at(-1)!.point).toEqual({ x: 832, y: -120 });
  });

  it("runs one lit pair downstream per four 300 ms steps, and holds A under reduced motion", () => {
    const lit = (t: number) =>
      [0, 1, 2, 3, 4, 5].filter((k) => buoyFrame(art, buoys, k, false, t) === 0);
    expect(lit(0)).toEqual([0, 4]);
    expect(lit(300)).toEqual([1, 5]);
    expect(lit(899)).toEqual([2]);
    expect(lit(900)).toEqual([3]);
    expect(lit(1200)).toEqual([0, 4]);
    expect([0, 1, 2, 3].every((k) => buoyFrame(art, buoys, k, true, 300) === 0)).toBe(true);
  });

  it("takes the whales' current as the current passing nearest the family", () => {
    const family = { x: 3 * CURRENTS.cellSize, y: -2 * CURRENTS.cellSize };
    const found = whalesCurrent(3, family)!;
    expect(found).not.toBeNull();
    const distance = nearestOnCurrent(found, family).distance;
    for (const current of currentsNear(3, 8 * CURRENTS.cellSize, family)) {
      expect(nearestOnCurrent(current, family).distance).toBeGreaterThanOrEqual(distance);
    }
  });
});
