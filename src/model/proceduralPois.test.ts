import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { LANDMARK_KINDS, LANDMARK_TUNING } from "../data/jobs.ts";
import { PROCEDURAL_POIS as T } from "../data/proceduralPois.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { landmarkSites } from "./landmarks.ts";
import { chartedProceduralPois, proceduralPoiById, proceduralPoisNear } from "./proceduralPois.ts";
import { nearestImage, wrappedDistance } from "./worldGeometry.ts";

const context = { worldSide: GALAXY_SIDE };
const far = { x: 300000, y: -200000 };
const corner = { x: GALAXY_SIDE / 2 - 1, y: GALAXY_SIDE / 2 - 1 };

describe("additional procedural POIs", () => {
  it("does not activate new places for an explicitly legacy flight", () => {
    expect(proceduralPoisNear({}, 1, 42, 25000, far)).toEqual([]);
    expect(proceduralPoiById({}, 1, 42, "poi:1:0,0:0")).toBeUndefined();
    expect(chartedProceduralPois({}, 1, 42, new Set(["poi:1:0,0:0"]), 25000, far)).toEqual([]);
  });
  it.each([1, 2, 3, 4, 5, 6] as const)(
    "places stable nonstory galaxy %s points beyond the survey area",
    (galaxy) => {
      const sites = proceduralPoisNear(context, galaxy, 42, 25000, far);
      expect(sites.length).toBeGreaterThan(0);
      expect(sites).toEqual(proceduralPoisNear(context, galaxy, 42, 25000, far));
      expect(sites.every((site) => Math.hypot(site.x, site.y) > LANDMARK_TUNING.radius)).toBe(true);
      for (const site of sites) {
        expect(site.id).toMatch(new RegExp(`^poi:${galaxy}:-?\\d+,-?\\d+:0$`));
        expect(LANDMARK_KINDS).toContain(site.kind);
        expect(CONTENT.labels[site.name]).toBeDefined();
        expect(site.name).not.toMatch(/^landmark\d/);
        expect(proceduralPoiById(context, galaxy, 42, site.id)).toEqual(site);
      }
    },
  );
  it("returns one canonical identity and category across axis laps and both seam images", () => {
    const sites = proceduralPoisNear(context, 6, 187, 25000, corner);
    expect(sites.length).toBeGreaterThan(0);
    expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
    for (const laps of [
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -3, y: 4 },
    ]) {
      const point = { x: corner.x + laps.x * GALAXY_SIDE, y: corner.y + laps.y * GALAXY_SIDE };
      expect(proceduralPoisNear(context, 6, 187, 25000, point)).toEqual(sites);
      for (const site of sites) {
        expect(site.x).toBeGreaterThanOrEqual(-GALAXY_SIDE / 2);
        expect(site.x).toBeLessThan(GALAXY_SIDE / 2);
        expect(site.y).toBeGreaterThanOrEqual(-GALAXY_SIDE / 2);
        expect(site.y).toBeLessThan(GALAXY_SIDE / 2);
        const image = nearestImage(GALAXY_SIDE, point, site);
        expect(Math.hypot(image.point.x - point.x, image.point.y - point.y)).toBeLessThanOrEqual(
          25000,
        );
      }
    }
  });
  it("preserves minimum two-dimensional spacing across corners as well as interior cells", () => {
    for (const point of [far, corner, { x: 0, y: 0 }]) {
      const sites = proceduralPoisNear(context, 4, 997, 25000, point);
      for (let index = 0; index < sites.length; index++) {
        for (const other of sites.slice(index + 1)) {
          expect(wrappedDistance(GALAXY_SIDE, sites[index]!, other)).toBeGreaterThanOrEqual(
            T.spacing,
          );
        }
      }
    }
  });
  it("excludes protected footprints through a wrapped corner and uses the existing clearance", () => {
    const sites = proceduralPoisNear(context, 2, 51, 25000, corner);
    expect(sites.length).toBeGreaterThan(0);
    const site = sites[0]!;
    const protectedPlace = {
      radius: 100,
      x: site.x + GALAXY_SIDE + T.placeClearance,
      y: site.y - GALAXY_SIDE,
    };
    const protectedContext = { ...context, protectedPlaces: [protectedPlace] };
    const allowed = proceduralPoisNear(protectedContext, 2, 51, 25000, corner);
    expect(allowed.some((other) => other.id === site.id)).toBe(false);
    expect(proceduralPoiById(protectedContext, 2, 51, site.id)).toBeUndefined();
    for (const other of allowed) {
      expect(wrappedDistance(GALAXY_SIDE, protectedPlace, other)).toBeGreaterThanOrEqual(
        T.placeClearance + 100,
      );
    }
    const clearances: number[] = [];
    const blocked = proceduralPoisNear(
      {
        ...context,
        isProtected: (_point, clearance) => {
          clearances.push(clearance);
          return true;
        },
      },
      2,
      51,
      25000,
      corner,
    );
    expect(blocked).toEqual([]);
    expect(clearances.length).toBeGreaterThan(0);
    expect(clearances.every((value) => value === LANDMARK_TUNING.placeClearance)).toBe(true);
  });
  it("retains all twelve authored identities and positions without cloning them", () => {
    for (const galaxy of [1, 2, 3, 4, 5, 6] as GalaxyNumber[]) {
      const before = structuredClone(landmarkSites(galaxy));
      expect(before).toHaveLength(12);
      const sites = proceduralPoisNear(context, galaxy, 55, 25000, { x: 0, y: 0 });
      expect(landmarkSites(galaxy)).toEqual(before);
      for (const site of sites) {
        expect(before.some((old) => old.id === site.id || old.name === site.name)).toBe(false);
        for (const old of before) {
          expect(wrappedDistance(GALAXY_SIDE, old, site)).toBeGreaterThanOrEqual(
            LANDMARK_TUNING.spacing,
          );
        }
      }
    }
    expect(LANDMARK_TUNING.count).toBe(12);
    expect(LANDMARK_TUNING.radius).toBe(25000);
  });
  it("feeds only known procedural identities without adding survey credit or changing discovery state", () => {
    const sites = proceduralPoisNear(context, 3, 42, 25000, far);
    expect(sites.length).toBeGreaterThan(2);
    const known = new Set([sites[0]!.id, sites[1]!.id, "landmark:3:0", "poi:3:invalid:0"]);
    const before = [...known];
    expect(chartedProceduralPois(context, 3, 42, known, 25000, far)).toEqual(sites.slice(0, 2));
    expect([...known]).toEqual(before);
    expect(chartedProceduralPois(context, 3, 42, new Set(), 25000, far)).toEqual([]);
  });
  it("rejects alternate alias spellings instead of treating them as another saved identity", () => {
    const site = proceduralPoisNear(context, 1, 42, 25000, far)[0]!;
    const parts = /^poi:1:(-?\d+),(-?\d+):0$/.exec(site.id)!;
    const period = GALAXY_SIDE / T.cellSize;
    expect(
      proceduralPoiById(context, 1, 42, `poi:1:${Number(parts[1]) + period},${parts[2]}:0`),
    ).toBeUndefined();
    for (const id of [
      "poi:1:-0,0:0",
      "poi:1:00,0:0",
      "poi:2:0,0:0",
      "landmark:1:0",
      "poi:1:0,0:1",
    ]) {
      expect(proceduralPoiById(context, 1, 42, id)).toBeUndefined();
    }
  });
  it("bounds local population independently of total world area and rejects unbounded query requests", () => {
    const maximumCells = (Math.ceil((2 * T.maxQueryRadius) / T.cellSize) + 1) ** 2;
    for (const point of [far, corner, { x: 0, y: 0 }]) {
      expect(
        proceduralPoisNear(context, 5, 13, T.maxQueryRadius, point).length,
      ).toBeLessThanOrEqual(maximumCells);
    }
    const site = proceduralPoisNear(context, 5, 13, T.maxQueryRadius, far)[0]!;
    expect(proceduralPoisNear(context, 5, 13, 0, site)).toEqual([site]);
    for (const range of [-1, Infinity, NaN, T.maxQueryRadius + 1]) {
      expect(() => proceduralPoisNear(context, 5, 13, range, far)).toThrow(RangeError);
    }
    expect(() => proceduralPoisNear({ worldSide: 12001 }, 5, 13, 1, far)).toThrow(RangeError);
  });
});
