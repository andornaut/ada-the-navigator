import { describe, expect, it } from "vitest";

import {
  deliveryDestination,
  destinationDrawn,
  DESTINATIONS,
  STATION_SENTENCE,
} from "./destinations.ts";
import { CARTWHEEL_STORY_SHIPS } from "./storyShips.ts";

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

  it("names every place a sentence can name, with its article, and marks the rest as none", () => {
    // Delivery targets, activity places and story lines: the outposts, the hub, the whale and
    // the family. The miner, the visitors and the holodisk are never named in a sentence.
    const named = Object.entries(DESTINATIONS)
      .filter(([, { sentence }]) => sentence !== null)
      .map(([id]) => id);
    expect(named.sort()).toEqual(
      ["family", "growers", "hub", "salvagers", "whale", "workshop"].sort(),
    );
    for (const [id, data] of Object.entries(DESTINATIONS)) {
      // Every entry states its sentence name, so none is missing by accident.
      expect(Object.hasOwn(data, "sentence"), id).toBe(true);
      if (data.sentence !== null) {
        expect(data.sentence, id).toMatch(/^the /);
      }
    }
    expect(DESTINATIONS.growers!.sentence).toBe("the growers' outpost");
    expect(DESTINATIONS.salvagers!.sentence).toBe("the salvagers' yard");
    expect(DESTINATIONS.hub!.sentence).toBe("the mining hub");
    expect(STATION_SENTENCE).toBe("the station");
    // Every delivery destination has a sentence name for its job title.
    for (const id of Object.keys(DESTINATIONS).filter(deliveryDestination)) {
      expect(DESTINATIONS[id]!.sentence, id).not.toBeNull();
    }
  });

  it("takes deliveries at the outposts and the station-kind hub only", () => {
    expect(Object.keys(DESTINATIONS).filter(deliveryDestination).sort()).toEqual(
      ["growers", "hub", "salvagers", "workshop"].sort(),
    );
  });
});
