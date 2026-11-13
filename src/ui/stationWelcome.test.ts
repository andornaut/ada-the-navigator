import { describe, expect, it } from "vitest";

import type { StationGreeting } from "../model/keepers.ts";
import { stationWelcome } from "./station.ts";

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
      index: 1,
      keeper: "slate",
      line: "The current greeting.",
    };
    expect(stationWelcome("Station", greeting)).toEqual({
      speaker: "Slate",
      text: greeting.line,
      title: "",
    });
    expect(greeting.index).toBe(1);
  });
});
