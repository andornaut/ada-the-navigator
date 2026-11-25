import { afterEach, beforeEach, type MockInstance, vi } from "vitest";

import { pinnedRandomValues, seedLaunches } from "./testing/launchSeeds.ts";

// Every test launches from the same seed sequence, so a flight's world, and the scenery, caches
// and drones a test meets in it, never varies between runs. ADA_LAUNCH_SEED replays another
// sequence on demand.
const BASE_SEED = Number(process.env.ADA_LAUNCH_SEED ?? 1);

let random: MockInstance | undefined;

beforeEach(() => {
  seedLaunches(BASE_SEED);
  random = vi
    .spyOn(globalThis.crypto, "getRandomValues")
    .mockImplementation((array) => pinnedRandomValues(array));
});

afterEach(() => {
  random?.mockRestore();
  random = undefined;
});
