import { afterEach, beforeEach, expect, it, vi } from "vitest";

const host = vi.hoisted(() => ({ register: vi.fn(), stop: undefined as (() => void) | undefined }));
vi.mock("@andornaut/game-kit/runtime/web/crash/dom/crashScreen", () => ({
  installCrashScreen: () => ({
    stopGameOnCrash(stop: () => void) {
      host.register();
      host.stop = stop;
    },
  }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("window", { location: { search: "" } });
});
afterEach(() => vi.unstubAllGlobals());

it("runs the main save fence before loading cleanup through one Kit crash registration", async () => {
  const { CRASH_SCREEN } = await import("./crashScreen.ts");
  const calls: string[] = [];
  CRASH_SCREEN.stopGameOnCrash(() => calls.push("loading"));
  CRASH_SCREEN.stopGameOnCrash(() => calls.push("save-fence"));
  host.stop!();
  expect(calls).toEqual(["save-fence", "loading"]);
  expect(host.register).toHaveBeenCalledOnce();
});

it("still releases loading resources when another page-owned crash cleanup throws", async () => {
  const { CRASH_SCREEN } = await import("./crashScreen.ts");
  const loading = vi.fn();
  CRASH_SCREEN.stopGameOnCrash(loading);
  CRASH_SCREEN.stopGameOnCrash(() => {
    throw new Error("main cleanup failed");
  });
  expect(() => host.stop!()).toThrow(AggregateError);
  expect(loading).toHaveBeenCalledOnce();
});
