import { afterEach, beforeEach, expect, type MockInstance, vi } from "vitest";

import { pinnedRandomValues, seedLaunches } from "./testing/launch.ts";
import { seedIndependentTest } from "./testing/worlds.ts";

// Every test launches from the same seed sequence, so a flight's world, and the scenery, caches
// and drones a test meets in it, never varies between runs. ADA_LAUNCH_SEED replays another
// sequence, to find tests that depend on their world.
const BASE_SEED = Number(process.env.ADA_LAUNCH_SEED ?? 1);

let random: MockInstance | undefined;
let launchSeedUsed = false;

beforeEach(() => {
  seedLaunches(BASE_SEED);
  launchSeedUsed = false;
  random = vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    launchSeedUsed = true;
    return pinnedRandomValues(array);
  });
});

afterEach(() => {
  try {
    // Omitted world repeats remain safe only while these suites never draw a launch seed.
    if (seedIndependentTest(expect.getState().testPath ?? "")) {
      expect(launchSeedUsed, "Seed-independent suites must not consume launch seeds").toBe(false);
    }
  } finally {
    random?.mockRestore();
    random = undefined;
  }
});
