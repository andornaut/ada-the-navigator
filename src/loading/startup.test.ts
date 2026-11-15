import {
  createRequiredLoading,
  type LoadingAttempt,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const view = vi.hoisted(() => ({
  dispose: vi.fn(),
  retry: undefined as (() => void | PromiseLike<void>) | undefined,
  style: vi.fn(),
  update: vi.fn(),
}));
const progress = vi.hoisted(() => ({
  begin: vi.fn(() => ({ finish: vi.fn(), progress: vi.fn() })),
  mount: vi.fn(() => vi.fn()),
}));
vi.mock("./progress.ts", () => ({
  loadingProgress: { begin: progress.begin },
  mountLoading: progress.mount,
}));
vi.mock("@andornaut/game-kit/runtime/web/progress/dom/loadingFailure", () => ({
  mountLoadingFailure: (context: { onRetry: () => void | PromiseLike<void> }) => {
    view.retry = context.onRetry;
    return {
      dispose: view.dispose,
      element: { style: { setProperty: view.style } },
      update: view.update,
    };
  },
}));
import { presentInstallation } from "../pwa/installationPresentation.ts";
import { type RequiredGame, startLoading, startupFence } from "./startup.ts";
const root = () =>
  ({
    ownerDocument: { body: {} },
    querySelector: () => ({ remove: vi.fn() }),
  }) as unknown as HTMLElement;
async function settle() {
  for (let n = 0; n < 24; n++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}
function game() {
  return {
    commit: vi.fn(),
    dispose: vi.fn(),
    load: vi.fn<(attempt: LoadingAttempt) => Promise<void>>(async () => {}),
    prepare: vi.fn(),
  } satisfies RequiredGame;
}
beforeEach(() => {
  vi.clearAllMocks();
  startupFence.crashed = false;
});
afterEach(() => vi.unstubAllGlobals());
it("keeps the same bar/error through failed import and retries once into actual construction", async () => {
  const required = createRequiredLoading(),
    entry = game();
  const load = vi.fn().mockRejectedValueOnce(new Error("import failed")).mockResolvedValue(entry);
  const stop = await startLoading(required, { stopGameOnCrash: vi.fn() }, load, root());
  expect(required.state.kind).toBe("failed");
  expect(entry.load).not.toHaveBeenCalled();
  await Promise.all([view.retry!(), view.retry!()]);
  await settle();
  expect(load).toHaveBeenCalledTimes(2);
  expect(entry.load).toHaveBeenCalledOnce();
  expect(entry.commit).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledOnce();
  stop();
  stop();
  expect(view.dispose).toHaveBeenCalledOnce();
});
it("registers late resources before entry and retains successful preparation across resource Retry", async () => {
  const required = createRequiredLoading(),
    entry = game();
  let status: "failed" | "loading" | "ready" = "failed";
  const retry = vi.fn(() => {
    status = "ready";
    required.invalidate();
  });
  entry.prepare.mockImplementation((registry: RequiredLoading) => {
    registry.observe({ retry, status: () => status });
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    root(),
  );
  await settle();
  expect(entry.load).not.toHaveBeenCalled();
  expect(entry.commit).not.toHaveBeenCalled();
  await view.retry!();
  await settle();
  expect(entry.load).toHaveBeenCalledOnce();
  expect(entry.prepare).toHaveBeenCalledOnce();
  expect(entry.commit).toHaveBeenCalledOnce();
  await view.retry!();
  expect(entry.commit).toHaveBeenCalledOnce();
  stop();
});
it("keeps fallible construction inside load and cancels before showing the shared failure", async () => {
  const required = createRequiredLoading(),
    entry = game(),
    cancel = vi.fn();
  entry.load.mockImplementationOnce(async (attempt) => {
    attempt.onCancel(cancel);
    throw new Error("required scene failed");
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    root(),
  );
  await settle();
  expect(required.state.kind).toBe("failed");
  expect(cancel).toHaveBeenCalledOnce();
  expect(entry.commit).not.toHaveBeenCalled();
  await view.retry!();
  await settle();
  expect(entry.load).toHaveBeenCalledTimes(2);
  expect(entry.commit).toHaveBeenCalledOnce();
  stop();
});
it("disposes an active partial game and rejects late completion without committing entry", async () => {
  const required = createRequiredLoading(),
    entry = game(),
    cancel = vi.fn();
  let finish!: () => void;
  entry.load.mockImplementation(async (attempt) => {
    attempt.onCancel(cancel);
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    root(),
  );
  await settle();
  stop();
  finish();
  await settle();
  expect(cancel).toHaveBeenCalledOnce();
  expect(required.state.kind).toBe("disposed");
  expect(entry.commit).not.toHaveBeenCalled();
  expect(entry.dispose).toHaveBeenCalledOnce();
});
it("fences a crash during import and never constructs when that same import completes", async () => {
  const required = createRequiredLoading(),
    entry = game();
  let crash!: () => void, finish!: (entry: RequiredGame) => void;
  const pending = startLoading(
    required,
    {
      stopGameOnCrash: (callback) => {
        crash = callback;
      },
    },
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    root(),
  );
  await settle();
  crash();
  finish(entry);
  const stop = await pending;
  await settle();
  expect(startupFence.crashed).toBe(true);
  expect(entry.load).not.toHaveBeenCalled();
  expect(entry.commit).not.toHaveBeenCalled();
  stop();
});

it("keeps real pending progress after scene loading until a late required image is usable", async () => {
  const required = createRequiredLoading(),
    entry = game();
  let image: "loading" | "ready" = "loading";
  entry.load.mockImplementation(async () => {
    required.observe({ retry: () => {}, status: () => image });
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    root(),
  );
  await settle();
  expect(entry.load).toHaveBeenCalledOnce();
  expect(required.state.kind).toBe("loading");
  expect(entry.commit).not.toHaveBeenCalled();
  const handle = progress.begin.mock.results.at(-1)!.value;
  expect(handle.finish).not.toHaveBeenCalled();
  image = "ready";
  required.invalidate();
  await settle();
  expect(entry.commit).toHaveBeenCalledOnce();
  expect(handle.finish).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledOnce();
  stop();
});

it("retries optional offline installation through the same presenter without reentering the game", async () => {
  const required = createRequiredLoading(),
    entry = game();
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    root(),
  );
  await settle();
  const identity = { attempt: 1, operationId: "install-1", version: "build-1" };
  const retry = vi.fn(async () => {
    presentInstallation({ retry, state: { ...identity, kind: "loading", stage: "registering" } });
    presentInstallation({ retry, state: { ...identity, kind: "ready", stage: "installed" } });
  });
  presentInstallation({
    retry,
    state: { ...identity, error: new Error("503"), kind: "failed", stage: "installation" },
  });
  expect(view.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "failed", operationId: "install-1" }),
  );
  expect(required.state.kind).toBe("ready");
  const priorRevision = view.update.mock.calls.at(-2)![0].attempt;
  expect(view.update.mock.calls.at(-1)![0].attempt).toBeGreaterThan(priorRevision);
  await view.retry!();
  expect(retry).toHaveBeenCalledOnce();
  expect(entry.commit).toHaveBeenCalledOnce();
  expect(entry.load).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledOnce();
  expect(view.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "ready", stage: "installed" }),
  );
  stop();
  const calls = view.update.mock.calls.length;
  presentInstallation({
    retry,
    state: { ...identity, error: new Error("late"), kind: "failed", stage: "registration" },
  });
  expect(view.update).toHaveBeenCalledTimes(calls);
});
