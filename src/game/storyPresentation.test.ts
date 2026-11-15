import { describe, expect, it } from "vitest";

import { aboardGalaxy, lastPlayedGalaxy } from "./storyPresentation.ts";

describe("ABOARD galaxy presentation", () => {
  it("uses Sunflower before launch, durable last launch after return, and an active flight first", () => {
    expect(lastPlayedGalaxy({ flight: null, selectedGalaxy: 6, started: false })).toBe(1);
    expect(lastPlayedGalaxy({ flight: null, selectedGalaxy: 5, started: true })).toBe(5);
    expect(lastPlayedGalaxy({ flight: { galaxy: 3 }, selectedGalaxy: 5, started: true })).toBe(3);
  });

  it("changes only ordinary ABOARD backgrounds without mutating launch history", () => {
    const state = { flight: null, selectedGalaxy: 4, started: true } as const;
    const before = JSON.stringify(state);
    expect(aboardGalaxy(state, { background: "aboard" })).toBe(4);
    expect(aboardGalaxy(state, { background: "aboard", holodisk: true })).toBeNull();
    expect(aboardGalaxy(state, { background: "aboardEmergency" })).toBeNull();
    expect(aboardGalaxy(state, { background: "room" })).toBeNull();
    expect(aboardGalaxy(state, null)).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });
});
