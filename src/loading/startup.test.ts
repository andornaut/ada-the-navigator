import { afterEach, beforeEach, expect, it, vi } from "vitest";

const failure = vi.hoisted(() => ({
  dispose: vi.fn(),
  retry: undefined as (() => void | PromiseLike<void>) | undefined,
  update: vi.fn(),
}));
vi.mock("@andornaut/game-kit/web/progress/dom/loadingFailure", () => ({
  mountLoadingFailure: (context: { onRetry: () => void | PromiseLike<void> }) => {
    failure.retry = context.onRetry;
    return { dispose: failure.dispose, update: failure.update };
  },
}));

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
  let release!: (entry: () => Promise<void>) => void;
  const load = new Promise<() => Promise<void>>((resolve) => {
    release = resolve;
  });
  const removeStatic = vi.fn();
  const root = {
    ownerDocument: { body: {} },
    querySelector: () => ({ remove: removeStatic }),
  } as unknown as HTMLElement;
  const pending = startLoading(
    {
      stopGameOnCrash: (stop) => {
        crash = stop;
      },
    },
    () => load,
    root,
  );
  await Promise.resolve();
  expect(progress.begin).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledWith(root);
  expect(removeStatic).toHaveBeenCalledOnce();
  crash();
  expect(startupFence.crashed).toBe(true);
  const enter = vi.fn(async () => {});
  release(enter);
  await pending;
  expect(enter).not.toHaveBeenCalled();
});

it("keeps one bar through import failure, retries once per pending attempt, and enters once", async () => {
  const enter = vi.fn(async () => {});
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("import unavailable"))
    .mockResolvedValue(enter);
  const stop = await startLoading({ stopGameOnCrash: vi.fn() }, load, {
    ownerDocument: { body: {} },
    querySelector: () => null,
  } as unknown as HTMLElement);
  expect(failure.update).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "failed" }));
  expect(enter).not.toHaveBeenCalled();
  await Promise.all([failure.retry!(), failure.retry!()]);
  expect(load).toHaveBeenCalledTimes(2);
  expect(enter).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledOnce();
  expect(progress.begin).toHaveBeenCalledTimes(2);
  await failure.retry!();
  expect(enter).toHaveBeenCalledOnce();
  stop();
  stop();
  expect(failure.dispose).toHaveBeenCalledOnce();
});

it("does not treat constructor rejection as a retriable import failure", async () => {
  const error = new Error("construction failed");
  const enter = vi.fn().mockRejectedValue(error);
  const load = vi.fn().mockResolvedValue(enter);
  await expect(
    startLoading({ stopGameOnCrash: vi.fn() }, load, {
      ownerDocument: { body: {} },
      querySelector: () => null,
    } as unknown as HTMLElement),
  ).rejects.toBe(error);
  expect(failure.update.mock.calls.some(([state]) => state.kind === "failed")).toBe(false);
  expect(failure.dispose).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledOnce();
});

it("reports entry failure after a successful import Retry through the existing page error fence", async () => {
  const report = vi.fn();
  vi.stubGlobal("reportError", report);
  const error = new Error("construction failed after Retry");
  const enter = vi.fn().mockRejectedValue(error);
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("import unavailable"))
    .mockResolvedValue(enter);
  await startLoading({ stopGameOnCrash: vi.fn() }, load, {
    ownerDocument: { body: {} },
    querySelector: () => null,
  } as unknown as HTMLElement);
  await failure.retry!();
  expect(report).toHaveBeenCalledWith(error);
  expect(failure.dispose).toHaveBeenCalledOnce();
  expect(enter).toHaveBeenCalledOnce();
});
