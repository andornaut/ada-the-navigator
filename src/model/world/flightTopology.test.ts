import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { GALAXY_SIDE } from "../../data/world.ts";
import { restoreSave, SAVE_RESTORE, SAVE_VERSION } from "../../saving/index.ts";
import { supportEntropy } from "../../testing/launchSeeds.ts";
import { GameModel } from "../game.ts";
import type { FlightState } from "../types.ts";
import { flightWorldContext, validFlightTopology } from "./index.ts";

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

  it("revalidates mutable metadata even after making a context", () => {
    const topology = { kind: "torus" as const, side: GALAXY_SIDE, version: 1 as const };
    const flight = { topology };
    const context = flightWorldContext(flight);

    topology.side *= 2;
    expect(() => flightWorldContext(flight)).toThrow(RangeError);
    topology.side = GALAXY_SIDE;
    expect(flightWorldContext(flight)).toBe(context);

    const getter = vi.fn(() => GALAXY_SIDE);
    Object.defineProperty(topology, "side", { configurable: true, get: getter });
    expect(() => flightWorldContext(flight)).toThrow(RangeError);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects hidden extra keys and accepts plain null-prototype records", () => {
    const topology = { kind: "torus", side: GALAXY_SIDE, version: 1 };
    Object.setPrototypeOf(topology, null);
    expect(validFlightTopology(topology)).toBe(true);
    Object.defineProperty(topology, Symbol("extra"), { value: true });
    expect(validFlightTopology(topology)).toBe(false);
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

it("starts and resumes only the new canonical flight chart", () => {
  const model = new GameModel(CONTENT, supportEntropy, SAVE_RESTORE);
  model.startGalaxy(1);
  const current = model.saveDocument();
  expect(current.flight?.topology).toEqual({ kind: "torus", side: 180_000, version: 1 });
  expect(restoreSave(current)?.flight?.topology).toEqual(current.flight?.topology);
  expect(restoreSave({ ...current, version: SAVE_VERSION - 1 })).toBeNull();

  const missing = structuredClone(current);
  delete missing.flight!.topology;
  expect(restoreSave(missing)).toBeNull();

  const wrongSide = structuredClone(current);
  wrongSide.flight!.topology = { kind: "torus", side: 200_000, version: 1 };
  expect(restoreSave(wrongSide)).toBeNull();
});
