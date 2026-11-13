import { describe, expect, it } from "vitest";

import { GALAXY_SIDE } from "../data/world.ts";
import { flightWorldContext, validFlightTopology } from "./flightTopology.ts";
import type { FlightState } from "./types.ts";

describe("explicit flight geometry context", () => {
  it("keeps absent metadata legacy regardless of large coordinates or seed", () => {
    const flight: Pick<FlightState, "topology" | "player" | "seed"> = {
      player: { x: GALAXY_SIDE * 3, y: -GALAXY_SIDE },
      seed: 9,
    };
    expect(flightWorldContext(flight)).toEqual({});
  });

  it("supplies one immutable context from validated metadata without copying the flight", () => {
    const flight = { topology: { kind: "torus" as const, side: GALAXY_SIDE, version: 1 as const } };
    const context = flightWorldContext(flight);
    expect(context.worldSide).toBe(GALAXY_SIDE);
    expect(flightWorldContext(flight)).toBe(context);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { kind: "flat", side: GALAXY_SIDE, version: 1 },
    { kind: "torus", side: NaN, version: 1 },
    { kind: "torus", side: GALAXY_SIDE, version: 2 },
    { extra: true, kind: "torus", side: GALAXY_SIDE, version: 1 },
  ])("rejects unsupported metadata %j", (value) => {
    expect(validFlightTopology(value)).toBe(false);
  });
});
