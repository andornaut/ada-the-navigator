import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterQuiet } from "../data/enemyCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  explorationRenewal,
  explorationRenewalReady,
  stepExplorationRenewal,
} from "./explorationRenewal.ts";

// Keep the existing exact-pitch synthetic renewal cases.
const context = { chunkSize: 512, galaxy: 1 as const, worldSide: 1_152_000 };

describe("ordinary exploration renewal", () => {
  it("retains a defeated footprint through nearby cells and a seam lap", () => {
    const edge = context.worldSide / 2;
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

  it.each(["x", "y"] as const)("keeps renewal local across the 240000-unit %s seam", (axis) => {
    const chart = { ...context, chunkSize: CONTENT.tuning.chunkSize, worldSide: GALAXY_SIDE };
    const half = GALAXY_SIDE / 2;
    const pitch = GALAXY_SIDE / 468;
    const at = (coordinate: number) =>
      axis === "x" ? { x: coordinate, y: 0 } : { x: 0, y: coordinate };
    let position = at(half - 1);
    const state = explorationRenewal(chart, position);
    expect(state.footprint).toEqual(at(233));

    const stepTo = (next: ReturnType<typeof at>, seconds: number) => {
      stepExplorationRenewal(chart, { from: position, seconds, to: next }, state);
      position = next;
    };
    for (const cell of [0, 1, 2]) {
      stepTo(at(-half + 1 + cell * pitch), 100);
      expect(state).toMatchObject({ departed: false, distance: 0, seconds: 0 });
      expect(explorationRenewalReady(chart, state)).toBe(false);
    }
    stepTo(at(-half + 1 + 3 * pitch), 100);
    expect(state).toMatchObject({ departed: true, distance: 0, seconds: 0 });
    stepTo(at(-half + 1), 1);
    const distanceBeforeSeam = state.distance;
    stepTo(at(half - 2), 2);
    expect(state.distance).toBe(distanceBeforeSeam + 3);
    expect(state.seconds).toBe(3);
  });

  it("keeps unbounded cells and linear distance when a context has no chart side", () => {
    const linear = { chunkSize: CONTENT.tuning.chunkSize, galaxy: 1 as const };
    const east = { x: 119999, y: 0 };
    const west = { x: -119999, y: 0 };
    const state = explorationRenewal(linear, east);
    expect(state.footprint).toEqual({ x: 234, y: 0 });
    stepExplorationRenewal(linear, { from: east, seconds: 1, to: west }, state);
    expect(state).toMatchObject({ departed: true, distance: 0, seconds: 0 });
    stepExplorationRenewal(linear, { from: west, seconds: 1, to: east }, state);
    expect(state).toMatchObject({ departed: true, distance: 239998, seconds: 1 });
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
