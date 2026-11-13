import { afterEach, beforeEach, expect, it, vi } from "vitest";

const progress = vi.hoisted(() => ({ begin: vi.fn(), mount: vi.fn(() => vi.fn()) }));
vi.mock("./progress.ts", () => ({
  loadingProgress: { begin: progress.begin },
  mountLoading: progress.mount,
}));

import { startLoading, startupFence } from "./startup.ts";

beforeEach(() => {
  vi.clearAllMocks();
  startupFence.crashed = false;
});
afterEach(() => vi.unstubAllGlobals());

it("shows pending progress and installs the crash fence while the game module is still downloading", async () => {
  let crash!: () => void;
  let release!: () => void;
  const load = new Promise<void>((resolve) => {
    release = resolve;
  });
  const removeStatic = vi.fn();
  const root = { querySelector: () => ({ remove: removeStatic }) } as unknown as HTMLElement;
  const pending = startLoading(
    {
      stopGameOnCrash: (stop) => {
        crash = stop;
      },
    },
    () => load,
    root,
  );
  expect(progress.begin).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledWith(root);
  expect(removeStatic).toHaveBeenCalledOnce();
  crash();
  expect(startupFence.crashed).toBe(true);
  release();
  await pending;
});
