import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import {
  nameLabelled,
  readStationArt,
  stationDockWorld,
  type StationFrame,
  stationFrame,
} from "./station-art.ts";

const manifest = JSON.parse(
  readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
) as { assets: StationFrame[] };
const art = readStationArt(manifest.assets)!;

describe("station art", () => {
  it("reads both blink frames from Art's manifest", () => {
    expect(art.frames.map((frame) => frame.id)).toEqual(["station-a", "station-b"]);
    expect(art.frameMs).toBe(700);
  });

  it("alternates A and B every 700 ms and holds A under reduced motion", () => {
    expect(stationFrame(art, false, 0).id).toBe("station-a");
    expect(stationFrame(art, false, 699).id).toBe("station-a");
    expect(stationFrame(art, false, 700).id).toBe("station-b");
    expect(stationFrame(art, false, 1400).id).toBe("station-a");
    expect(stationFrame(art, true, 700).id).toBe("station-a");
  });

  it("places the model's dock at Art's dock entrance", () => {
    const dock = stationDockWorld(art.frames[0])!;
    // 62.225 frame px below the pivot, 27.2 display px, is straight down the screen.
    expect(dock.offset.x).toBeCloseTo(ECONOMY.station.dockOffset.x, 2);
    expect(dock.offset.y).toBeCloseTo(ECONOMY.station.dockOffset.y, 2);
    expect(dock.outward.x).toBeCloseTo(ECONOMY.station.dockOutward.x, 9);
    expect(dock.outward.y).toBeCloseTo(ECONOMY.station.dockOutward.y, 9);
  });

  it("derives the dock's mouth circle from Art's drawn mouth width", () => {
    const dock = stationDockWorld(art.frames[0])!;
    // 37.967 frame px is 16.61 display px across; a world circle draws 2 sqrt 2 radii wide.
    expect(dock.mouthRadius).toBeCloseTo((37.967 * 0.4375) / (2 * Math.SQRT2), 9);
    expect(dock.mouthRadius).toBeCloseTo(ECONOMY.station.dockMouthRadius, 3);
  });

  it("draws no in-world name label on a station", () => {
    expect(nameLabelled("station")).toBe(false);
    expect(nameLabelled("destination")).toBe(true);
  });

  it("keeps the placeholder when the station frames are missing", () => {
    expect(readStationArt([])).toBeUndefined();
  });
});
