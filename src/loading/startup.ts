import {
  createLoadingAttempts,
  type LoadingAttempt,
  type LoadingAttemptState,
  type RequiredLoading,
} from "@andornaut/game-kit/runtime/load/loadingAttempts";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import type { CrashScreen } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";

import {
  type InstallationPresentation,
  observeInstallation,
} from "../pwa/installationPresentation.ts";
import { EntryReloadRequired } from "./entryRecovery.ts";
import { loadingProgress } from "./progress.ts";

export const startupFence = { crashed: false };

export interface RequiredGame {
  prepare(required: RequiredLoading, attempt: LoadingAttempt): void | Promise<void>;
  load(attempt: LoadingAttempt): Promise<void>;
  commit(): void;
  dispose(): void;
}

export type MountStartupFailure = (
  context: {
    readonly onRetry: () => Promise<void>;
    readonly subscribeRequired: (invalidate: () => void) => () => void;
  },
  root: HTMLElement,
) => {
  update(state: LoadingAttemptState): void;
  /** Revoke Retry and unsubscribe before retiring the providers. */
  retireActions(): void;
  /** Remove the frame and resize listeners after provider teardown. */
  dispose(): void;
};

/** One page owns the registry, failure presenter and existing bar through every Retry. */
export async function startLoading(
  required: RequiredLoading,
  crash: Pick<CrashScreen, "stopGameOnCrash">,
  loadGame: () => Promise<RequiredGame>,
  presentation: {
    readonly mountFailure: MountStartupFailure;
    readonly mountLoading: (root: HTMLElement) => () => void;
  },
  root: HTMLElement,
): Promise<() => void> {
  const stop = presentation.mountLoading(root);
  let game: RequiredGame | undefined;
  let installation: InstallationPresentation | undefined;
  let failure: ReturnType<MountStartupFailure>;
  try {
    failure = presentation.mountFailure(
      {
        async onRetry() {
          if (disposed || startupFence.crashed) {
            return;
          }
          try {
            const needsDocument = [moduleAttempt.state, gameAttempt.state].some(
              (state) => state.kind === "failed" && state.error instanceof EntryReloadRequired,
            );
            if (needsDocument) {
              dispose();
              root.ownerDocument.defaultView!.location.reload();
              return;
            }
            // One Retry resumes a failed first install and retries a failed required load.
            const install = installation?.state.kind === "failed" ? installation : undefined;
            if (install) {
              await install.retry();
            }
            if (!install || required.state.kind === "failed") {
              await required.retry();
            }
          } catch (error) {
            dispose();
            reportError(error);
          }
        },
        subscribeRequired: (invalidate) => required.subscribe(invalidate),
      },
      root,
    );
  } catch (error) {
    stop();
    throw error;
  }
  // Required entry and the first install have independent attempt number domains.
  let presentationRevision = 0;
  const showFailure = (state: LoadingAttemptState) => {
    failure.update({ ...state, attempt: ++presentationRevision });
  };
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
    showFailure(installation?.state.kind === "failed" ? installation.state : state);
  });
  // A failed first install shows Loading failed while the game module waits for it; its Retry
  // resumes the install.
  const stopInstallation = observeInstallation((view) => {
    installation = view;
    showFailure(view.state.kind === "failed" ? view.state : required.state);
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    failure.retireActions();
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
