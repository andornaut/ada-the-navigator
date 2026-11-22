import { expect, it, vi } from "vitest";

import { runCheatAction } from "./cheatActions.ts";

it("rechecks gameplay eligibility at the action itself", () => {
  let left = 1;
  const run = vi.fn(() => left--);
  const action = { available: () => left > 0, id: "unlock", label: "Unlock", run };
  expect(runCheatAction(action)).toBe(true);
  expect(runCheatAction(action)).toBe(false);
  expect(run).toHaveBeenCalledOnce();
});
