import {
  createLoadingAttempts,
  type LoadingAttempt,
  type LoadingAttemptState,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { CrashScreen } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import { mountLoadingFailure } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import {
  type InstallationPresentation,
  observeInstallation,
} from "../pwa/installationPresentation.ts";
import { LOADING_LAYER } from "../ui/loadingBar.ts";
import { loadingProgress, mountLoading } from "./progress.ts";

export const startupFence = { crashed: false };

export interface RequiredGame {
  prepare(required: RequiredLoading, attempt: LoadingAttempt): void | Promise<void>;
  load(attempt: LoadingAttempt): Promise<void>;
  commit(): void;
  dispose(): void;
}

/** One page owns the registry, failure presenter and existing bar through every Retry. */
export async function startLoading(
  required: RequiredLoading,
  crash: Pick<CrashScreen, "stopGameOnCrash">,
  loadGame: () => Promise<RequiredGame>,
  root: HTMLElement,
): Promise<() => void> {
  const stop = mountLoading(root);
  let game: RequiredGame | undefined;
  let installation: InstallationPresentation | undefined;
  const failure = mountLoadingFailure(
    {
      async onRetry() {
        try {
          if (required.state.kind === "ready" && installation?.state.kind === "failed") {
            await installation.retry();
          } else {
            await required.retry();
          }
        } catch (error) {
          dispose();
          reportError(error);
        }
      },
    },
    root.ownerDocument.body,
  );
  // Required entry and offline installation have independent attempt number domains.
  let presentationRevision = 0;
  const showFailure = (state: LoadingAttemptState) => {
    failure.update({ ...state, attempt: ++presentationRevision });
  };
  for (const [property, value] of Object.entries({
    left: "50%",
    "max-height": "calc(100vh - 2rem)",
    "max-width": "calc(100vw - 2rem)",
    overflow: "auto",
    padding: "1rem",
    position: "fixed",
    top: "50%",
    transform: "translate(-50%, -50%)",
    "z-index": String(LOADING_LAYER - 1),
  })) {
    failure.element.style.setProperty(property, value, "important");
  }
  const moduleAttempt = createLoadingAttempts({
    async load(attempt) {
      const loaded = await loadGame();
      if (!attempt.isCurrent() || startupFence.crashed) {
        return;
      }
      game = loaded;
      await loaded.prepare(required, attempt);
    },
    onState() {
      required.invalidate();
    },
  });
  const gameAttempt = createLoadingAttempts({
    async load(attempt) {
      if (!startupFence.crashed) {
        await game!.load(attempt);
      }
    },
    onState() {
      required.invalidate();
    },
  });
  const unobserveModule = required.observe({
    retry: () => moduleAttempt.retry(),
    status: () =>
      moduleAttempt.state.kind === "ready"
        ? "ready"
        : moduleAttempt.state.kind === "failed"
          ? "failed"
          : "loading",
  });
  let unobserveGame: (() => void) | undefined;
  const stopPrepare = required.wait(() => {
    if (startupFence.crashed) {
      return;
    }
    // The public registry rechecks readiness between waiters after this late registration.
    unobserveGame = required.observe({
      retry: () => gameAttempt.retry(),
      status: () =>
        gameAttempt.state.kind === "ready"
          ? "ready"
          : gameAttempt.state.kind === "failed"
            ? "failed"
            : "loading",
    });
    void gameAttempt.start().catch((error) => {
      dispose();
      reportError(error);
    });
  });
  const stopCommit = required.wait(() => {
    if (!startupFence.crashed) {
      game!.commit();
    }
  });
  let pending: ProgressHandle | undefined;
  const unsubscribe = required.subscribe((state) => {
    if (state.kind === "loading") {
      pending ??= loadingProgress.begin();
    } else {
      pending?.finish();
      pending = undefined;
    }
    showFailure(state.kind === "ready" && installation !== undefined ? installation.state : state);
  });
  const stopInstallation = observeInstallation((view) => {
    installation = view;
    if (required.state.kind === "ready") {
      showFailure(view.state);
    }
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    stopPrepare();
    stopCommit();
    unsubscribe();
    stopInstallation();
    moduleAttempt.dispose();
    gameAttempt.dispose();
    game?.dispose();
    required.dispose();
    unobserveModule();
    unobserveGame?.();
    pending?.finish();
    failure.dispose();
    stop();
  };
  crash.stopGameOnCrash(() => {
    startupFence.crashed = true;
    dispose();
  });
  try {
    await moduleAttempt.start();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
