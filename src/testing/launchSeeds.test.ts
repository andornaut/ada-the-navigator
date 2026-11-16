import { expect, it } from "vitest";

import { pinnedRandomValues as legacyValues, seedLaunches as legacySeed } from "./launch.ts";
import { pinnedRandomValues, seedLaunches } from "./launchSeeds.ts";

it("shares one deterministic stream with existing launch-helper callers", () => {
  expect(legacySeed).toBe(seedLaunches);
  expect(legacyValues).toBe(pinnedRandomValues);
  legacySeed(1);
  expect(pinnedRandomValues(new Uint32Array(1))[0]).toBe(1);
  expect(legacyValues(new Uint32Array(1))[0]).toBe(1015568748);
  seedLaunches(1);
  expect(legacyValues(new Uint32Array(1))[0]).toBe(1);
});

it("writes little-endian partial words only inside the supplied typed-array view", () => {
  const buffer = new Uint8Array(9).fill(77);
  const view = new Uint8Array(buffer.buffer, 2, 5);
  seedLaunches(1);
  expect(pinnedRandomValues(view)).toBe(view);
  expect([...buffer]).toEqual([77, 77, 1, 0, 0, 0, 108, 77, 77]);
});

it("normalizes reset seeds to unsigned words and does not advance on null", () => {
  seedLaunches(-1);
  expect(pinnedRandomValues(null)).toBeNull();
  expect(pinnedRandomValues(new Uint32Array(1))[0]).toBe(4294967295);
  seedLaunches(4294967297);
  expect(pinnedRandomValues(new Uint32Array(1))[0]).toBe(1);
});
