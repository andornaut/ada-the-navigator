import {
  createRequiredLoading,
  type LoadingAttempt,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const view = vi.hoisted(() => ({
  bindHoldAction: undefined as unknown,
  dispose: vi.fn(),
  presentation: undefined as unknown,
  retry: undefined as (() => void | PromiseLike<void>) | undefined,
  setPresentation: vi.fn(),
  style: vi.fn(),
  update: vi.fn(),
}));
const recovery = vi.hoisted(() => ({
  assertBindings: vi.fn(),
  bind: vi.fn(),
  dispose: vi.fn(),
  host: undefined as HTMLElement | undefined,
  invalidate: vi.fn(),
  options: undefined as unknown,
}));
vi.mock("../ui/actions/actionBinding.ts", () => ({
  createAdaFactoryHoldBinding: (_options: unknown, host: HTMLElement) => {
    recovery.host = host;
    return recovery.bind;
  },
}));
vi.mock("../ui/actions/holdActionsAdapter.ts", () => ({
  bindAdaRecoveryActionRoot: (options: unknown, host: HTMLElement) => {
    recovery.options = options;
    recovery.host = host;
    return recovery;
  },
}));
vi.mock("../ui/actions/pressScope.ts", () => ({ rootPressGuard: () => ({ gate: {} }) }));
const progress = vi.hoisted(() => ({
  begin: vi.fn(() => ({ finish: vi.fn(), progress: vi.fn() })),
  mount: vi.fn(() => vi.fn()),
}));
vi.mock("./progress.ts", () => ({
  loadingProgress: { begin: progress.begin },
}));
vi.mock("@andornaut/game-kit/runtime/web/progress/dom/loadingFailure", () => ({
  mountLoadingFailure: (context: {
    bindHoldAction?: unknown;
    presentation?: unknown;
    onRetry: () => void | PromiseLike<void>;
  }) => {
    view.bindHoldAction = context.bindHoldAction;
    view.presentation = context.presentation;
    view.retry = context.onRetry;
    return {
      dispose: view.dispose,
      element: { style: { setProperty: view.style } },
      setPresentation: view.setPresentation,
      update: view.update,
    };
  },
}));
import { observeInstallation, presentInstallationFailure } from "../pwa/installation/index.ts";
import { mountStartupFailure } from "../ui/loadingFailure.ts";
import { type EntryRecoveryPhase, EntryReloadRequired } from "./entryRecovery.ts";
import { type RequiredGame, startLoading, startupFence } from "./startup.ts";
const presentation = {
  mountFailure: mountStartupFailure,
  mountLoading: progress.mount,
  reloadDocument: vi.fn<(host: HTMLElement) => void>(),
};
const root = (size = { height: 360, width: 720 }) =>
  ({
    clientHeight: size.height,
    clientWidth: size.width,
    ownerDocument: Object.assign(new EventTarget(), {
      body: { append: vi.fn() },
      createElement: () => ({ className: "", remove: vi.fn(), style: {} }),
      defaultView: new EventTarget(),
    }),
    querySelector: () => ({ remove: vi.fn() }),
  }) as unknown as HTMLElement;
// Leaves the shared installation presenter out of the failed state for the next test.
async function observedRetry() {
  let latest: { retry: () => Promise<void> } | undefined;
  observeInstallation((view) => {
    latest = view;
  })();
  await latest?.retry();
}
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
it("keeps provider preparation failures on the same in-place Retry and constructs once", async () => {
  const required = createRequiredLoading(),
    entry = game();
  entry.prepare.mockRejectedValueOnce(new Error("preparation failed")).mockResolvedValue(undefined);
  const load = vi.fn().mockResolvedValue(entry);
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    load,
    presentation,
    root(),
  );
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
    presentation,
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
    presentation,
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
    presentation,
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
    presentation,
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
    presentation,
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

it("shows a failed first install while the game waits and resumes it on Retry", async () => {
  const required = createRequiredLoading(),
    entry = game();
  let release!: () => void;
  const installed = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Startup resolves once the game module loads, which waits for the install.
  const started = startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => {
      await installed;
      return entry;
    },
    presentation,
    root(),
  );
  await settle();
  expect(required.state.kind).toBe("loading");
  const retry = vi.fn(() => release());
  presentInstallationFailure({ reason: "network", retry });
  expect(view.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ error: "network", kind: "failed" }),
  );
  const priorRevision = view.update.mock.calls.at(-2)![0].attempt;
  expect(view.update.mock.calls.at(-1)![0].attempt).toBeGreaterThan(priorRevision);
  await view.retry!();
  expect(retry).toHaveBeenCalledOnce();
  const stop = await started;
  await settle();
  expect(view.update.mock.calls.at(-1)![0].kind).not.toBe("failed");
  expect(entry.load).toHaveBeenCalledOnce();
  expect(entry.commit).toHaveBeenCalledOnce();
  expect(progress.mount).toHaveBeenCalledOnce();
  // A second Retry of the same failure does nothing.
  await view.retry!();
  expect(retry).toHaveBeenCalledOnce();
  stop();
  const calls = view.update.mock.calls.length;
  presentInstallationFailure({ reason: "verification", retry });
  expect(view.update).toHaveBeenCalledTimes(calls);
  await observedRetry();
});

it.each([
  { height: 844, width: 390 },
  { height: 390, width: 844 },
])("keeps fixed typography and normal action fit at $width x $height", async (size) => {
  const required = createRequiredLoading(),
    entry = game();
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    presentation,
    root(size),
  );
  const unit = Math.min(size.width / 720, size.height / 360);
  expect(view.presentation).toEqual({
    action: {
      borderWidthPx: unit,
      heightPx: 48 * unit,
      highlightHeightPx: unit,
      paddingBottomPx: 4 * unit,
      paddingXPx: 16 * unit,
      shadeHeightPx: 4 * unit,
      widthPx: "content",
    },
    palette: {
      action: "#bfa06f",
      actionText: "#181425",
      border: "#181425",
      highlight: "#d2b886",
      lip: "#2f2d3d",
      panel: "#3b3850",
      shade: "#8a7148",
      shadow: "#181425",
      text: "#ead4aa",
    },
    panel: {
      bodyActionGapPx: 24,
      borderWidthPx: 1,
      lipHeightPx: 4,
      maxWidthPx: 328,
      paddingBottomPx: 16,
      paddingTopPx: 24,
      paddingXPx: 16,
      safeInsetPx: 16,
      shadowOffsetPx: 4,
      titleBodyGapPx: 16,
    },
    text: {
      action: { lineHeight: 1.2, sizePx: 18, synthesis: "weight", weight: 900 },
      body: { lineHeight: 1.45, sizePx: 18, weight: 400 },
      title: { lineHeight: 1.2, sizePx: 24, weight: 700 },
    },
  });
  expect(
    view.style.mock.calls.some(([property]) =>
      ["padding", "max-width", "max-height", "overflow"].includes(property),
    ),
  ).toBe(false);
  stop();
});

it("updates the same pending presenter on scale and removes both resize listeners", async () => {
  const required = createRequiredLoading(),
    events = new EventTarget();
  const host = root();
  Object.defineProperty(host.ownerDocument, "defaultView", { value: events });
  const load = vi.fn().mockRejectedValue(new Error("import failed"));
  const stop = await startLoading(required, { stopGameOnCrash: vi.fn() }, load, presentation, host);
  const retry = view.retry;
  Object.defineProperty(host, "clientWidth", { value: 1440 });
  Object.defineProperty(host, "clientHeight", { value: 720 });
  events.dispatchEvent(new Event("resize"));
  events.dispatchEvent(new Event("ada-view-scale"));
  expect(view.setPresentation).toHaveBeenCalledTimes(2);
  expect(view.setPresentation.mock.lastCall?.[0]).toMatchObject({
    action: { heightPx: 96, paddingXPx: 32, widthPx: "content" },
  });
  expect(view.retry).toBe(retry);
  expect(progress.mount).toHaveBeenCalledOnce();
  stop();
  events.dispatchEvent(new Event("resize"));
  expect(view.setPresentation).toHaveBeenCalledTimes(2);
});

it("retries a failed first install and a failed required load from one Retry", async () => {
  const required = createRequiredLoading(),
    entry = game();
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    presentation,
    root(),
  );
  await settle();
  let pending = true;
  const requiredRetry = vi.fn(() => {
    pending = false;
    required.invalidate();
  });
  required.observe({ retry: requiredRetry, status: () => (pending ? "failed" : "ready") });
  expect(view.update.mock.calls.at(-1)![0].kind).toBe("failed");
  const installRetry = vi.fn();
  presentInstallationFailure({ reason: "verification", retry: installRetry });
  expect(view.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ error: "verification", kind: "failed" }),
  );
  await view.retry!();
  expect(installRetry).toHaveBeenCalledOnce();
  expect(requiredRetry).toHaveBeenCalledOnce();
  expect(required.state.kind).toBe("ready");
  expect(view.update.mock.calls.at(-1)![0].kind).toBe("ready");
  stop();
});

it.each(["module-import", "unavailable-retirement"] as const)(
  "reloads only on explicit Retry for %s and disposes the old attempt once",
  async (phase: EntryRecoveryPhase) => {
    const required = createRequiredLoading(),
      entry = game(),
      reload = vi.fn();
    const host = root();
    const terminal = new EntryReloadRequired(phase, new Error("original failure"));
    const load =
      phase === "module-import"
        ? vi.fn().mockRejectedValue(terminal)
        : vi.fn().mockResolvedValue(entry);
    if (phase === "unavailable-retirement") {
      entry.load.mockRejectedValue(terminal);
    }
    const stop = await startLoading(
      required,
      { stopGameOnCrash: vi.fn() },
      load,
      { ...presentation, reloadDocument: reload },
      host,
    );
    await settle();
    expect(required.state.kind).toBe("failed");
    expect(reload).not.toHaveBeenCalled();
    await view.retry!();
    expect(reload).toHaveBeenCalledExactlyOnceWith(host);
    expect(required.state.kind).toBe("disposed");
    expect(load).toHaveBeenCalledOnce();
    expect(view.dispose).toHaveBeenCalledBefore(reload);
    expect(progress.mount).toHaveBeenCalledOnce();
    await view.retry!();
    stop();
    expect(reload).toHaveBeenCalledOnce();
    expect(view.dispose).toHaveBeenCalledOnce();
  },
);

it("reports a reload error after retiring the failed document attempt", async () => {
  const required = createRequiredLoading();
  const error = new Error("reload failed");
  const report = vi.fn();
  vi.stubGlobal("reportError", report);
  const reloadDocument = vi.fn(() => {
    throw error;
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => {
      throw new EntryReloadRequired("module-import", new Error("import failed"));
    },
    { ...presentation, reloadDocument },
    root(),
  );
  await view.retry!();
  expect(view.dispose).toHaveBeenCalledBefore(reloadDocument);
  expect(report).toHaveBeenCalledExactlyOnceWith(error);
  expect(required.state.kind).toBe("disposed");
  stop();
  expect(view.dispose).toHaveBeenCalledOnce();
});

it("sizes recovery from the viewport when failed boot CSS leaves the app unlaid out", async () => {
  const required = createRequiredLoading();
  const host = root({ height: 18, width: 1264 });
  Object.defineProperty(host.ownerDocument, "defaultView", {
    value: {
      addEventListener: vi.fn(),
      innerHeight: 360,
      innerWidth: 720,
      removeEventListener: vi.fn(),
    },
  });
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => game(),
    presentation,
    host,
  );
  expect(view.presentation).toMatchObject({
    action: { heightPx: 48, paddingXPx: 16, widthPx: "content" },
  });
  stop();
});

it("owns a narrow recovery root and cancels on the same registry without fencing Retry on readiness", async () => {
  const required = createRequiredLoading();
  let status: "failed" | "ready" = "failed";
  required.observe({
    retry: () => {
      status = "ready";
      required.invalidate();
    },
    status: () => status,
  });
  const entry = game(),
    host = root();
  const stop = await startLoading(
    required,
    { stopGameOnCrash: vi.fn() },
    async () => entry,
    presentation,
    host,
  );
  expect(required.state.kind).toBe("failed");
  expect(recovery.host).not.toBe(host);
  expect(recovery.host).not.toBe(host.ownerDocument.body);
  expect(view.bindHoldAction).toBe(recovery.bind);
  expect(recovery.options).not.toHaveProperty("requiredReady");
  expect(recovery.assertBindings).toHaveBeenCalledOnce();
  await view.retry!();
  await settle();
  expect(entry.commit).toHaveBeenCalledOnce();
  expect(recovery.invalidate.mock.invocationCallOrder.at(-1)).toBeLessThan(
    view.update.mock.invocationCallOrder.at(-1)!,
  );
  stop();
  stop();
  expect(recovery.dispose).toHaveBeenCalledOnce();
  expect(entry.dispose).toHaveBeenCalledOnce();
  expect(view.dispose).toHaveBeenCalledOnce();
  expect(recovery.dispose.mock.invocationCallOrder[0]!).toBeLessThan(
    entry.dispose.mock.invocationCallOrder[0]!,
  );
  expect(entry.dispose.mock.invocationCallOrder[0]!).toBeLessThan(
    view.dispose.mock.invocationCallOrder[0]!,
  );
});
it("releases the recovery root and presenter if factory construction audit fails", async () => {
  recovery.assertBindings.mockImplementationOnce(() => {
    throw new Error("factory binding missing");
  });
  const required = createRequiredLoading();
  await expect(
    startLoading(required, { stopGameOnCrash: vi.fn() }, async () => game(), presentation, root()),
  ).rejects.toThrow("factory binding missing");
  expect(recovery.dispose).toHaveBeenCalledOnce();
  expect(view.dispose).toHaveBeenCalledOnce();
  const calls = recovery.invalidate.mock.calls.length;
  required.dispose();
  expect(recovery.invalidate).toHaveBeenCalledTimes(calls);
});
