import { describe, expect, it } from "vitest";

import { newGameState } from "./game.ts";
import { SAVE_VERSION } from "./save.ts";
import { inspectAdaSave, preV1SaveResetAllowed } from "./saveIntegrity.ts";

describe("Ada save integrity policy", () => {
  it("limits reset permission to explicit pre-v1 application versions", () => {
    expect(preV1SaveResetAllowed()).toBe(true);
    expect(preV1SaveResetAllowed("0.9.1-rc.2")).toBe(true);
    for (const version of ["1.0.0", "13", "0", "unknown", "0.01.2"]) {
      expect(preV1SaveResetAllowed(version)).toBe(false);
    }
  });
  it("preserves a valid home save and distinguishes first visit from corrupt data", () => {
    const state = newGameState();
    const raw = JSON.stringify(state);
    expect(inspectAdaSave(null)).toEqual({ status: "new" });
    expect(inspectAdaSave(raw)).toEqual({ save: state, status: "valid" });
    expect(JSON.stringify(state)).toBe(raw);
    for (const invalid of [
      "",
      "{broken",
      "null",
      "{}",
      JSON.stringify({ ...state, version: SAVE_VERSION + 1 }),
    ]) {
      expect(inspectAdaSave(invalid)).toEqual({ problem: "invalid-save", status: "issue" });
    }
  });
});
