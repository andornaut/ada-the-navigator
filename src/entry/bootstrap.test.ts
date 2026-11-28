import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  app: {},
  dispose: vi.fn(),
  importGame: vi.fn(),
  mountLoading: vi.fn(),
  prepare: vi.fn(),
  requireFonts: vi.fn(),
  requireUi: vi.fn(),
  startLoading: vi.fn(),
  stopOnCrash: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("./crash.ts", () => ({}));
vi.mock("../ui/crashScreen.ts", () => ({
  CRASH_SCREEN: { stopGameOnCrash: fixture.stopOnCrash },
}));
vi.mock("../pwa/index.ts", () => ({ preparePhoneLaunch: fixture.prepare }));
vi.mock("../ui/loadingBar.ts", () => ({ mountLoading: fixture.mountLoading }));
vi.mock("../loading/required.ts", () => ({ requiredLoading: { subscribe: fixture.subscribe } }));
vi.mock("../ui/requiredFonts.ts", () => ({ requireBootFonts: fixture.requireFonts }));
vi.mock("../ui/requiredUi.ts", () => ({ requireBootUi: fixture.requireUi }));
vi.mock("../loading/startup.ts", () => ({ startLoading: fixture.startLoading }));
vi.mock("./main.ts", () => {
  fixture.importGame();
  return {
    commitGame: vi.fn(),
    disposeGame: vi.fn(),
    prepareGame: vi.fn(),
    startGame: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("document", {
    getElementById: () => fixture.app,
    querySelectorAll: () => [],
  });
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());

it("takes the unsupported branch before observing required resources or importing the game", async () => {
  fixture.prepare.mockReturnValue({ dispose: fixture.dispose, kind: "unsupported" });
  await import("./bootstrap.ts");
  const { loadingFailureChrome } = await import("../ui/loadingFailure.ts");
  expect(fixture.prepare).toHaveBeenCalledExactlyOnceWith(loadingFailureChrome, fixture.app);
  expect(fixture.startLoading).not.toHaveBeenCalled();
  expect(fixture.subscribe).not.toHaveBeenCalled();
  expect(fixture.requireFonts).not.toHaveBeenCalled();
  expect(fixture.requireUi).not.toHaveBeenCalled();
  expect(fixture.importGame).not.toHaveBeenCalled();
  expect(fixture.stopOnCrash).toHaveBeenCalledExactlyOnceWith(fixture.dispose);
  fixture.stopOnCrash.mock.calls[0]![0]();
  expect(fixture.dispose).toHaveBeenCalledOnce();
});

it("starts the original resource observer and import when the supported launch resolves", async () => {
  fixture.prepare.mockReturnValue({ kind: "supported", result: Promise.resolve("play") });
  fixture.subscribe.mockReturnValue(vi.fn());
  fixture.startLoading.mockImplementation(
    async (_required, _crash, load: () => Promise<unknown>) => {
      expect(fixture.importGame).not.toHaveBeenCalled();
      await load();
      return vi.fn();
    },
  );
  await import("./bootstrap.ts");
  expect(fixture.startLoading).toHaveBeenCalledOnce();
  const { mountStartupFailure } = await import("../ui/loadingFailure.ts");
  expect(fixture.startLoading.mock.calls[0]!.slice(3)).toEqual([
    { mountFailure: mountStartupFailure, mountLoading: fixture.mountLoading },
    fixture.app,
  ]);
  expect(fixture.subscribe).toHaveBeenCalledOnce();
  expect(fixture.requireFonts).toHaveBeenCalledOnce();
  expect(fixture.requireUi).toHaveBeenCalledOnce();
  expect(fixture.importGame).toHaveBeenCalledOnce();
});
