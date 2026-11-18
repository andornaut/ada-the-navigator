import { describe, expect, it, vi } from "vitest";

import { cheatsAllowed, runCheatAction } from "./cheatActions.ts";

function host(mode: "browser" | "standalone", ios = false) {
  return {
    matchMedia: (query: string) => ({ matches: mode !== "browser" && query.includes(mode) }),
    navigator: { maxTouchPoints: 0, standalone: ios, userAgent: "fixture" },
  };
}

describe("cheat actions", () => {
  it("exist only in a browser tab, never in the installed app", () => {
    expect(cheatsAllowed(host("browser"))).toBe(true);
    expect(cheatsAllowed(host("standalone"))).toBe(false);
    expect(cheatsAllowed(host("browser", true))).toBe(false);
  });

  it("checks the installed app and availability at the action itself", () => {
    let left = 1;
    const run = vi.fn(() => left--);
    const action = { available: () => left > 0, id: "unlock", label: "Unlock", run };
    expect(runCheatAction(host("standalone"), action)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(runCheatAction(host("browser"), action)).toBe(true);
    expect(runCheatAction(host("browser"), action)).toBe(false);
    expect(run).toHaveBeenCalledOnce();
  });
});
