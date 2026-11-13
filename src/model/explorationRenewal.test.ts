import { describe, expect, it } from "vitest";

import { encounterQuiet } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  explorationRenewal,
  explorationRenewalReady,
  stepExplorationRenewal,
} from "./explorationRenewal.ts";

const context = { chunkSize: 512, galaxy: 1 as const, worldSide: GALAXY_SIDE };

describe("ordinary exploration renewal", () => {
  it("retains a defeated footprint through nearby cells and a seam lap", () => {
    const edge = GALAXY_SIDE / 2;
    const state = explorationRenewal(context, { x: edge - 1, y: 0 });
    for (const x of [-edge, -edge + 512, -edge + 1024]) {
      stepExplorationRenewal(context, { from: { x, y: 0 }, seconds: 100, to: { x, y: 0 } }, state);
      expect(state.departed).toBe(false);
      expect(explorationRenewalReady(context, state)).toBe(false);
    }
    stepExplorationRenewal(
      context,
      { from: { x: -edge + 1024, y: 0 }, seconds: 100, to: { x: -edge + 1536, y: 0 } },
      state,
    );
    expect(state).toMatchObject({ departed: true, distance: 0, seconds: 0 });
  });

  it("requires both quiet time and actual travel after departure, allowing a revisit", () => {
    const quiet = encounterQuiet(1);
    const state = explorationRenewal(context, { x: 0, y: 0 });
    const outside = { x: 2048, y: 0 };
    stepExplorationRenewal(context, { from: { x: 0, y: 0 }, seconds: 1, to: outside }, state);
    stepExplorationRenewal(context, { from: outside, seconds: quiet.seconds, to: outside }, state);
    expect(explorationRenewalReady(context, state)).toBe(false);
    stepExplorationRenewal(context, { from: outside, seconds: 1, to: { x: 0, y: 0 } }, state);
    expect(explorationRenewalReady(context, state)).toBe(true);
  });

  it("does not substitute distance for time or count invalid inactive samples", () => {
    const state = explorationRenewal(context, { x: 0, y: 0 });
    state.departed = true;
    stepExplorationRenewal(
      context,
      { from: { x: 0, y: 0 }, seconds: 1, to: { x: 5000, y: 0 } },
      state,
    );
    expect(explorationRenewalReady(context, state)).toBe(false);
    const before = structuredClone(state);
    for (const seconds of [0, -1, NaN, Infinity]) {
      stepExplorationRenewal(
        context,
        { from: { x: 0, y: 0 }, seconds, to: { x: 5000, y: 0 } },
        state,
      );
    }
    expect(state).toEqual(before);
  });
});
