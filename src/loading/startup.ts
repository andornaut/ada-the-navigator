import { createLoadingAttempts } from "@andornaut/game-kit/load/loadingAttempts";
import type { CrashScreen } from "@andornaut/game-kit/web/crash/dom/crashScreen";
import { mountLoadingFailure } from "@andornaut/game-kit/web/progress/dom/loadingFailure";

import { loadingProgress, mountLoading } from "./progress.ts";

/** A crash during module download remains fenced when the game module later evaluates. */
export const startupFence = { crashed: false };

/** Import retries keep the page's bar and offline controllers alive. */
export async function startLoading(
  crash: Pick<CrashScreen, "stopGameOnCrash">,
  loadGame: () => Promise<() => Promise<void>>,
  root: HTMLElement,
): Promise<() => void> {
  crash.stopGameOnCrash(() => {
    startupFence.crashed = true;
  });
  const stop = mountLoading(root);
  // Replace the pre-script bar only after the live pending bar is mounted.
  root.querySelector("#boot-progress")?.remove();
  let enter: (() => Promise<void>) | undefined;
  const failure = mountLoadingFailure(
    {
      async onRetry() {
        try {
          await attempts.retry();
        } catch (error) {
          dispose();
          // The presenter handles file failures; entry errors retain the page's crash fence.
          reportError(error);
        }
      },
    },
    root.ownerDocument.body,
  );
  const attempts = createLoadingAttempts({
    async load(attempt) {
      const entry = await loadGame();
      if (attempt.isCurrent()) {
        enter = entry;
      }
    },
    async onReady() {
      // Construction is outside the retriable import, with its existing crash fence.
      if (!startupFence.crashed) {
        await enter?.();
      }
    },
    onState(state) {
      if (state.kind === "loading") {
        loadingProgress.begin();
      }
      failure.update(state);
    },
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    attempts.dispose();
    failure.dispose();
    stop();
  };
  try {
    await attempts.start();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
