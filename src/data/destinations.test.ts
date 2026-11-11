import { describe, expect, it } from "vitest";

import { destinationDrawn, DESTINATIONS } from "./destinations.ts";
import { CARTWHEEL_STORY_SHIPS } from "./story-ships.ts";

describe("story destination data", () => {
  it("draws every destination but Cartwheel's buoy-held miner and visitors", () => {
    const undrawn = Object.entries(DESTINATIONS)
      .filter(([, { drawn }]) => !drawn)
      .map(([id]) => id);
    // The destinations held at the hub's buoys, whose buoy and moored craft stand for them.
    expect(undrawn.sort()).toEqual(Object.keys(CARTWHEEL_STORY_SHIPS.destinations).sort());
    expect(["miner", "visitors"].map(destinationDrawn)).toEqual([false, false]);
    for (const id of ["growers", "workshop", "salvagers", "hub", "whale", "family", "holodisk"]) {
      expect(destinationDrawn(id), id).toBe(true);
    }
  });
});
