import { describe, expect, it } from "vitest";

import {
  advanceStationRestock,
  newStationRestock,
  readStationStockEntry,
  setStationStockEntry,
  type StationRestockState,
} from "./stations/commerce/index.ts";

describe("station restock state", () => {
  it("round-trips active flight time and snapshots independently by galaxy, station and slot", () => {
    const first = { galaxy: 1, state: newStationRestock(), stationId: "station:1,2" } as const;
    const otherStation = { ...first, stationId: "station:3,4" };
    const otherGalaxy = { ...first, galaxy: 2 } as const;
    const entry = {
      item: { kind: "weaponUpgrade", weapon: "multiLaser" },
      purchased: { availableAfter: 300, level: { current: 2, max: 5 } },
    } as const;
    setStationStockEntry(first, "weapons:0", entry);
    expect(readStationStockEntry(first, "weapons:1")).toBeUndefined();
    expect(readStationStockEntry(otherStation, "weapons:0")).toBeUndefined();
    expect(readStationStockEntry(otherGalaxy, "weapons:0")).toBeUndefined();

    advanceStationRestock(first.state, 125);
    const saved: StationRestockState = JSON.parse(JSON.stringify(first.state));
    advanceStationRestock(saved, 175);
    expect(saved.flightSeconds).toBe(300);
    expect(readStationStockEntry({ ...first, state: saved }, "weapons:0")).toEqual(entry);
  });
});
