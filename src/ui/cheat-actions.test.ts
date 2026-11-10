import { describe, expect, it, vi } from "vitest";

import { createCheatSession } from "./cheat-actions.ts";

function fixture() {
  let mode = "browser";
  let ios = false;
  let run: object | null = {};
  let ready = true;
  let mutations = 0;
  const save = vi.fn();
  const host = {
    matchMedia: (query: string) => ({ matches: mode !== "browser" && query.includes(mode) }),
    navigator: {
      maxTouchPoints: 0,
      get standalone() {
        return ios;
      },
      userAgent: "fixture",
    },
  };
  let release: (() => void) | undefined;
  const session = createCheatSession({
    actions: [
      {
        description: "Save fixture",
        execute: ({ commit }) => {
          commit(() => mutations++);
        },
        id: "save",
        label: "Save fixture",
        scope: "save",
      },
      {
        description: "Deferred fixture",
        execute: async ({ commit }) => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          commit(() => mutations++);
        },
        id: "deferred",
        label: "Deferred fixture",
        scope: "run",
      },
    ],
    canExecute: () => ready,
    host,
    onSave: save,
    run: () => run,
  });
  return {
    get mutations() {
      return mutations;
    },
    release: () => release?.(),
    save,
    session,
    setIos: (value: boolean) => {
      ios = value;
    },
    setMode: (value: string) => {
      mode = value;
    },
    setReady: (value: boolean) => {
      ready = value;
    },
    setRun: (value: object | null) => {
      run = value;
    },
  };
}

describe("browser-tab cheat eligibility", () => {
  it.each(["fullscreen", "standalone", "minimal-ui"])(
    "blocks dispatch in %s without a UI event",
    async (mode) => {
      const state = fixture();
      state.setMode(mode);
      expect(state.session.eligible()).toBe(false);
      expect(await state.session.execute("save")).toBe(false);
      expect(state.mutations).toBe(0);
      expect(state.save).not.toHaveBeenCalled();
    },
  );

  it("blocks iOS standalone, home and dialogue while a browser flight can save", async () => {
    const state = fixture();
    state.setIos(true);
    expect(await state.session.execute("save")).toBe(false);
    state.setIos(false);
    state.setRun(null);
    expect(await state.session.execute("save")).toBe(false);
    state.setRun({});
    state.setReady(false);
    expect(await state.session.execute("save")).toBe(false);
    state.setReady(true);
    expect(await state.session.execute("missing")).toBe(false);
    expect(await state.session.execute("save")).toBe(true);
    expect(state.mutations).toBe(1);
    expect(state.save).toHaveBeenCalledOnce();
  });

  it.each(["app-window", "replacement", "dispose"])(
    "rejects a deferred commit after %s",
    async (reason) => {
      const state = fixture();
      const result = state.session.execute("deferred");
      if (reason === "app-window") {
        state.setMode("standalone");
      }
      if (reason === "replacement") {
        state.setRun({});
      }
      if (reason === "dispose") {
        state.session.dispose();
      }
      state.release();
      expect(await result).toBe(false);
      expect(state.mutations).toBe(0);
      expect(state.save).not.toHaveBeenCalled();
    },
  );

  it("does not invoke the save callback for a run-scoped commit or dispatch twice while busy", async () => {
    const state = fixture();
    const result = state.session.execute("deferred");
    expect(await state.session.execute("save")).toBe(false);
    state.release();
    expect(await result).toBe(true);
    expect(state.mutations).toBe(1);
    expect(state.save).not.toHaveBeenCalled();
  });
});
