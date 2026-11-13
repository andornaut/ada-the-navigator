// Reruns seed-dependent tests under further launch-seed sequences (ADA_LAUNCH_SEED, src/testSetup.ts),
// so a test that depends on the world its flight generates fails here instead of passing only
// in the default world. Arguments pass through to vitest.
import { spawnSync } from "node:child_process";

import { SEED_INDEPENDENT_TESTS } from "../src/testing/worlds.ts";

// Worlds that have exposed world-dependent tests: drones at a landmark, drones arriving at a
// hunt spot, and moving debris at a hunt spot.
export const WORLD_SEEDS = [803550167, 1343235941, 4155282460];

for (const seed of WORLD_SEEDS) {
  console.error(JSON.stringify({ event: "test-world", seed }));
  const result = spawnSync(
    "npx",
    [
      "vitest",
      "run",
      ...process.argv.slice(2),
      "--passWithNoTests",
      ...SEED_INDEPENDENT_TESTS.flatMap((file) => ["--exclude", file]),
    ],
    {
      env: { ...process.env, ADA_LAUNCH_SEED: String(seed) },
      stdio: "inherit",
    },
  );
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `vitest failed in world ${seed}: ${result.status}`);
    process.exit(result.status || 1);
  }
}
