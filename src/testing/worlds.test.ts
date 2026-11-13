import { expect, it } from "vitest";

import { seedIndependentTest } from "./worlds.ts";

it.each(["src/tools/pacingSim.test.ts", "/tmp/work/src/tools/pacingSim.test.ts"])(
  "recognizes the audited seed-independent suite at %s",
  (path) => {
    expect(seedIndependentTest(path)).toBe(true);
  },
);

it.each(["src/model/game.test.ts", "/tmp/not-src/tools/pacingSim.test.ts"])(
  "retains extra worlds for an unaudited suite at %s",
  (path) => {
    expect(seedIndependentTest(path)).toBe(false);
  },
);
