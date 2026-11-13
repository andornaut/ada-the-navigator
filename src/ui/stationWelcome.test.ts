import { describe, expect, it } from "vitest";

import { GENERAL_NAMED } from "../data/conversations.ts";
import type { StationGreeting } from "../model/keepers.ts";
import { stationGreetingCanSkip, stationWelcome } from "./station.ts";

describe("station welcome speaker contract", () => {
  it("keeps the station title without speech or an invented speaker when no keeper exists", () => {
    expect(stationWelcome("Station", null)).toEqual({
      speaker: undefined,
      text: "",
      title: "Station",
    });
  });

  it("retains the actual keeper and greeting rather than substituting a shared speaker", () => {
    const greeting: StationGreeting = {
      count: 3,
      displayName: "Station-specific keeper",
      index: 1,
      keeper: "slate",
      line: "The current greeting.",
    };
    expect(stationWelcome("Station", greeting)).toEqual({
      speaker: { displayName: greeting.displayName, portraitName: "Slate" },
      text: greeting.line,
      title: "",
    });
    expect(greeting.index).toBe(1);
  });
  it("attributes the General greeting to the identified Admiral without changing its line", () => {
    const greeting: StationGreeting = {
      count: 1,
      displayName: GENERAL_NAMED.name,
      index: 0,
      keeper: "general",
      line: "The current greeting.",
    };
    expect(stationWelcome("Station", greeting)).toEqual({
      speaker: { displayName: GENERAL_NAMED.name, portraitName: GENERAL_NAMED.name },
      text: greeting.line,
      title: "",
    });
    expect(greeting).toEqual({
      count: 1,
      displayName: GENERAL_NAMED.name,
      index: 0,
      keeper: "general",
      line: "The current greeting.",
    });
  });
});

describe("station greeting Skip availability", () => {
  it.each([
    [3, 0, true],
    [3, 1, false],
    [3, 2, false],
    [2, 0, false],
    [2, 1, false],
    [1, 0, false],
  ])("for count %i at index %i is %s", (count, index, expected) => {
    expect(
      stationGreetingCanSkip({
        count,
        displayName: GENERAL_NAMED.name,
        index,
        keeper: "general",
        line: "The current greeting.",
      }),
    ).toBe(expected);
  });
  it("does not offer Skip for the generic station welcome", () => {
    expect(stationGreetingCanSkip(null)).toBe(false);
  });
});
