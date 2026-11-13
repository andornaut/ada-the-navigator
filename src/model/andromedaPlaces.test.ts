import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { LANDMARK_TUNING } from "../data/jobs.ts";
import {
  nearestSettlement,
  nearestSettlerStation,
  settlementById,
  settlementsNear,
} from "./andromedaPlaces.ts";
import { landmarkSites } from "./landmarks.ts";
import { stationById, stationsNear } from "./stations.ts";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("Andromeda's seeded places", () => {
  it("selects the actual nearest station from Ada's position, not a story alias", () => {
    const point = { x: 23000, y: -17000 };
    const station = nearestSettlerStation(ECONOMY, point);
    expect(stationById(ECONOMY, 5, station.id)).toEqual(station);
    const closer = stationsNear(ECONOMY, 5, distance(station, point), point);
    expect(
      closer.every((candidate) => distance(candidate, point) >= distance(station, point)),
    ).toBe(true);
    expect(nearestSettlerStation(ECONOMY, station)).toEqual(station);
  });

  it("keeps separate outposts deterministic, clear of stations and landmarks, and rebindable by id", () => {
    const station = nearestSettlerStation(ECONOMY, { x: 0, y: 0 });
    const settlement = nearestSettlement(ECONOMY, station);
    const radius = distance(station, settlement);
    const sites = settlementsNear(ECONOMY, radius, station);
    expect(sites).toContainEqual(settlement);
    expect(sites.every((candidate) => distance(candidate, station) >= radius)).toBe(true);
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      expect(settlementById(ECONOMY, site.id)).toEqual(site);
      expect(stationById(ECONOMY, 5, site.id)).toBeNull();
      expect(stationsNear(ECONOMY, 5, ECONOMY.station.destinationClearance, site)).toEqual([]);
      expect(
        landmarkSites(5).every(
          (landmark) => distance(landmark, site) >= LANDMARK_TUNING.placeClearance,
        ),
      ).toBe(true);
    }
    expect(settlementsNear(ECONOMY, radius, station)).toEqual(sites);
  });

  it("rejects noncanonical, missing and unsafe coordinate ids", () => {
    for (const id of [
      "station:1,1",
      "settlement:01,1",
      "settlement:NaN,0",
      "settlement:9007199254740992,0",
    ]) {
      expect(settlementById(ECONOMY, id)).toBeNull();
    }
  });
});
