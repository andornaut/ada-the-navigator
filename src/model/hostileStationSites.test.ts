import { randomStream } from "@andornaut/game-kit/runtime/random";
import { describe, expect, it } from "vitest";

import { GALAXY_SIDE } from "../data/world.ts";
import { hostileStationSites, type HostileStationSitesContext } from "./hostileStationSites.ts";
import { wrappedDistance } from "./worldGeometry.ts";

const context: HostileStationSitesContext = {
  galaxy: 5,
  geographySeed: 173,
  worldSide: GALAXY_SIDE,
};
const half = GALAXY_SIDE / 2;
const region = { height: GALAXY_SIDE, width: GALAXY_SIDE, x: -half, y: -half };
const ids = (sites: ReturnType<typeof hostileStationSites>) => sites.map(({ id }) => id).sort();

describe("hostile station geographic sites", () => {
  it("queries only Andromeda, Cartwheel and Phantom with stable galaxy-specific identities", () => {
    for (const galaxy of [1, 3, 4] as const) {
      expect(hostileStationSites({ ...context, galaxy }, region)).toEqual([]);
    }
    for (const galaxy of [2, 5, 6] as const) {
      const input = { ...context, galaxy };
      const sites = hostileStationSites(input, region);
      expect(sites.length).toBeGreaterThan(0);
      expect(hostileStationSites(input, region)).toEqual(sites);
      expect(new Set(ids(sites)).size).toBe(sites.length);
    }
    expect(ids(hostileStationSites(context, region))).not.toEqual(
      ids(hostileStationSites({ ...context, galaxy: 2 }, region)),
    );
  });

  it("preserves geography through unrelated encounter draws and does not mutate inputs", () => {
    const before = structuredClone({ context, region });
    const sites = hostileStationSites(context, region);
    const encounter = randomStream(999, "encounters");
    const reference = randomStream(999, "encounters");
    expect(encounter()).toBe(reference());
    hostileStationSites(context, region);
    expect(encounter()).toBe(reference());
    expect(hostileStationSites(context, region)).toEqual(sites);
    expect(hostileStationSites({ ...context, geographySeed: 174 }, region)).not.toEqual(sites);
    expect({ context, region }).toEqual(before);
  });

  it("partitions half-open queries at a real site without gaps or duplicate boundary identities", () => {
    const positive = { ...region, width: half, x: 0 };
    const sites = hostileStationSites(context, positive);
    const edge = sites[0]!.x;
    const left = hostileStationSites(context, { ...positive, width: edge });
    const right = hostileStationSites(context, {
      ...positive,
      width: positive.width - edge,
      x: edge,
    });
    expect(ids([...left, ...right])).toEqual(ids(sites));
    expect(new Set(ids([...left, ...right])).size).toBe(sites.length);
    expect(left.some(({ id }) => id === sites[0]!.id)).toBe(false);
    expect(right.some(({ id }) => id === sites[0]!.id)).toBe(true);
    expect(hostileStationSites(context, positive)).toEqual(sites);
  });

  it("uses shortest wrapped center distance and canonical coordinates on a non-dividing torus", () => {
    const wrapped = { ...context, worldSide: 65000 };
    const chart = { height: 65000, width: 65000, x: -32500, y: -32500 };
    const sites = hostileStationSites(wrapped, chart);
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      const distance = wrappedDistance(65000, { x: 0, y: 0 }, site);
      expect(distance).toBeGreaterThanOrEqual(10000);
      expect(distance).toBeLessThanOrEqual(100000);
      expect(site.x).toBeGreaterThanOrEqual(-32500);
      expect(site.x).toBeLessThan(32500);
      expect(site.y).toBeGreaterThanOrEqual(-32500);
      expect(site.y).toBeLessThan(32500);
    }
    expect(
      hostileStationSites(wrapped, { ...chart, x: chart.x + 65000, y: chart.y - 65000 }),
    ).toEqual(sites);
    const left = hostileStationSites(wrapped, { ...chart, width: 32500 });
    const right = hostileStationSites(wrapped, { ...chart, width: 32500, x: 0 });
    expect(ids([...left, ...right])).toEqual(ids(sites));
  });

  it("obeys both radial bounds without relying on the queried region to clip the annulus", () => {
    const sites = hostileStationSites(context, {
      height: GALAXY_SIDE,
      width: GALAXY_SIDE,
      x: -GALAXY_SIDE / 2,
      y: -GALAXY_SIDE / 2,
    });
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      expect(Math.hypot(site.x, site.y)).toBeGreaterThanOrEqual(10000);
      expect(Math.hypot(site.x, site.y)).toBeLessThanOrEqual(100000);
    }
    expect(hostileStationSites(context, { height: 1000, width: 1000, x: 110000, y: 0 })).toEqual(
      [],
    );
  });

  it("samples an expected area density with variable total and multiple sites per indexing tile", () => {
    const counts: number[] = [];
    let multipleInTile = false;
    for (let geographySeed = 0; geographySeed < 32; geographySeed++) {
      const sites = hostileStationSites({ ...context, geographySeed }, region);
      counts.push(sites.length);
      const tiles = new Set<string>();
      for (const site of sites) {
        const tile = site.id.slice(0, site.id.lastIndexOf(":"));
        multipleInTile ||= tiles.has(tile);
        tiles.add(tile);
      }
    }
    // Independent approved-area oracle, with a five-standard-deviation Poisson sampling bound.
    const expected = (32 * Math.PI * (100000 ** 2 - 10000 ** 2)) / 625000000;
    const actual = counts.reduce((sum, count) => sum + count, 0);
    expect(Math.abs(actual - expected)).toBeLessThan(5 * Math.sqrt(expected));
    expect(new Set(counts).size).toBeGreaterThan(1);
    expect(multipleInTile).toBe(true);
  });

  it("honors caller-owned protected rejection without resampling or converting any site", () => {
    const sites = hostileStationSites(context, region);
    const allowed = new Set(sites.filter(({ x }) => x >= 0).map(({ id }) => id));
    const queried = hostileStationSites(
      { ...context, placementClear: ({ id }) => allowed.has(id) },
      region,
    );
    expect(queried).toEqual(sites.filter(({ id }) => allowed.has(id)));
    expect(hostileStationSites({ ...context, placementClear: () => false }, region)).toEqual([]);
    expect(hostileStationSites(context, region)).toEqual(sites);
  });

  it("supports the existing unwrapped world context without encounter or flight dependencies", () => {
    const sites = hostileStationSites({ galaxy: 6, geographySeed: 173 }, region);
    expect(sites.length).toBeGreaterThan(0);
    expect(new Set(ids(sites)).size).toBe(sites.length);
    for (const site of sites) {
      expect(Math.hypot(site.x, site.y)).toBeGreaterThanOrEqual(10000);
      expect(Math.hypot(site.x, site.y)).toBeLessThanOrEqual(100000);
    }
  });

  it("rejects invalid seeds and unbounded or inverted regions and permits empty queries", () => {
    for (const geographySeed of [-1, 1.5, 0x100000000, NaN]) {
      expect(() => hostileStationSites({ ...context, geographySeed }, region)).toThrow(RangeError);
    }
    expect(() => hostileStationSites(context, { ...region, width: Infinity })).toThrow(RangeError);
    expect(() => hostileStationSites(context, { ...region, height: -1 })).toThrow(RangeError);
    expect(hostileStationSites(context, { ...region, width: 0 })).toEqual([]);
  });
});
