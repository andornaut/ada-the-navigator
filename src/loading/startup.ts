import type { CrashScreen } from "@andornaut/game-kit/web/crash/dom/crashScreen";

import { loadingProgress, mountLoading } from "./progress.ts";

/** A crash during module download remains fenced when the game module later evaluates. */
export const startupFence = { crashed: false };

/** The kit bar shows real pending work before the heavy game module or its update gate runs. */
export async function startLoading(
  crash: Pick<CrashScreen, "stopGameOnCrash">,
  loadGame: () => Promise<unknown>,
  root: HTMLElement,
): Promise<() => void> {
  crash.stopGameOnCrash(() => {
    startupFence.crashed = true;
  });
  loadingProgress.begin();
  const stop = mountLoading(root);
  // Replace the pre-script bar only after the live pending bar is mounted.
  root.querySelector("#boot-progress")?.remove();
  await loadGame();
  return stop;
}
