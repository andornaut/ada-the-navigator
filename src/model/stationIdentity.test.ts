import { describe, expect, it } from "vitest";

import { stationDisplayName, stationWords } from "./stationIdentity.ts";

describe("procedural station identity labels", () => {
  it.each([
    ["station:0,0", "Amber"],
    ["station:-1,2", "Beacon Haven Meadow"],
    ["station:infill:-1,2", "Beacon Kite Glimmer"],
  ])("gives %s its compact stable label", (id, expected) => {
    expect(stationWords(id)).toBe(expected);
  });

  it("keeps signed cells and placement namespaces distinct", () => {
    const ids: string[] = [];
    for (let x = -12; x <= 12; x++) {
      for (let y = -12; y <= 12; y++) {
        ids.push(`station:${x},${y}`, `station:infill:${x},${y}`);
      }
    }
    ids.push("station:future:0,0", "station:-0,0", "station:00,0", "");
    expect(new Set(ids.map(stationWords)).size).toBe(ids.length);
  });

  it("qualifies the same stable site by galaxy without exposing coordinates", () => {
    const name = stationDisplayName("Sunflower", "station:-1,2");
    expect(name).toBe("Sunflower Beacon Haven Meadow Station");
    expect(stationDisplayName("Cartwheel", "station:-1,2")).not.toBe(name);
    expect(stationDisplayName("Sunflower", "station:-1,2")).toBe(name);
  });
});
