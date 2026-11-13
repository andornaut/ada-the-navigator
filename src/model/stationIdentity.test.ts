import { describe, expect, it } from "vitest";

import { STATION_NAME_WORDS } from "../data/stationCopy.ts";
import { stationDisplayName, stationWords } from "./stationIdentity.ts";

describe("procedural station identity labels", () => {
  it("round-trips complete identities including signs, layers and encoded lengths", () => {
    const ids = ["station:0,0", "station:-1,2", "station:1,-2", "station:infill:1,-2"];
    const names = ids.map(stationWords);
    expect(new Set(names).size).toBe(ids.length);
    for (const [index, name] of names.entries()) {
      const hex = name
        .split(" ")
        .map((word) => STATION_NAME_WORDS.findIndex((entry) => entry === word).toString(16))
        .join("");
      expect(hex[0]).toBe("1");
      const bytes = hex
        .slice(1)
        .match(/../g)!
        .map((byte) => Number.parseInt(byte, 16));
      expect(new TextDecoder().decode(new Uint8Array(bytes))).toBe(ids[index]);
    }
  });

  it("qualifies the same stable site by galaxy without exposing coordinates", () => {
    const name = stationDisplayName("Sunflower", "station:-1,2");
    expect(name).toMatch(/^Sunflower [A-Za-z ]+ Station$/);
    expect(name).not.toContain("-1,2");
    expect(stationDisplayName("Cartwheel", "station:-1,2")).not.toBe(name);
    expect(stationDisplayName("Sunflower", "station:-1,2")).toBe(name);
  });
});
