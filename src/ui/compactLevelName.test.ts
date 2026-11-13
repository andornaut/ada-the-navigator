import { expect, it } from "vitest";

import { compactLevelName } from "./compactLevelName.ts";

it.each([
  [undefined, "Laser"],
  [1, "Laser"],
  [2, "Laser [2]"],
  [3, "Laser [3]"],
] as const)("names actual level %s without adding a base or preview suffix", (level, expected) => {
  expect(compactLevelName(level, "Laser")).toBe(expected);
});
