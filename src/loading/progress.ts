import type { Timer } from "@andornaut/game-kit/runtime/clock/timer";
import {
  createLayeredProgress,
  createProgressState,
  type ProgressHandle,
  type ProgressHold,
  type ProgressSnapshot,
} from "@andornaut/game-kit/runtime/progressState";
import type { LaunchProgress } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type {
  RequiredUpdateState,
  UpdateProgress,
} from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

// The one loading bar along the top edge of the play area (src/ui/loadingBar.ts): the launch's
// first install and boot in front, then the loads the player waits for, over the background work.
// Known progress fills, holds and fades, work of unknown total travels, and nothing shows while
// idle.

/**
 * The loads the player waits for, which alone show the bar in the foreground: the boot preload
 * before the first screen, and a galaxy's own art as its first flight starts. On-demand art during
 * play (scenery, rocks, ship parts, paint) loads silently.
 */
export type WaitedLoad = "boot" | "galaxy";

/** The launch: one determinate value over the first install's download and the boot reads. */
export const launchProgress = createProgressState();
/** The waited-for loads, each measured by the kit's loader watch (src/game/scene.ts). */
export const loadingProgress = createProgressState();
/** The background work: a staging update, Update now's switch and forced updates. */
export const installProgress = createProgressState();

// The boot reads' share, reported to the launch as the boot preload settles (reportBoot).
let bootReport: ((value: number) => void) | undefined;

/** Hears each settled share of the waited-for loads; the launch counts the first, the boot. */
export function reportBoot(listener: ((value: number) => void) | undefined): void {
  bootReport = listener;
}

/**
 * The loader watch's progress (src/game/scene.ts): the waited-for loads, each share also told to
 * reportBoot's listener, which the launch ignores once it has booted.
 */
export const waitedProgress = {
  begin(): ProgressHandle {
    const handle = loadingProgress.begin();
    return {
      finish: () => handle.finish(),
      progress(value) {
        handle.progress(value);
        if (value !== undefined) {
          bootReport?.(value);
        }
      },
    };
  },
};

let launch: ProgressHandle | undefined;

/** The launch's progress (the kit's onProgress) fills the bar in front of every other load. */
export function launchProgressReport(progress: LaunchProgress): void {
  launch ??= launchProgress.begin();
  launch.progress(progress.value);
  if (progress.phase === "ready") {
    launch.finish();
  }
}

// A staging update, Update now's switch and a forced update share the background bar while any
// still runs.
const background = new Set<"activation" | "required" | "update">();
let install: ProgressHandle | undefined;
let staging: number | undefined;

function showBackground(reason: "activation" | "required" | "update", shown: boolean): void {
  if (shown) {
    background.add(reason);
  } else {
    background.delete(reason);
  }
  if (background.size > 0) {
    install ??= installProgress.begin();
    install.progress(background.size === 1 && background.has("update") ? staging : undefined);
  } else {
    install?.finish();
    install = undefined;
  }
}

/** Kit owns update timing across staging, the switch, and the next document's boot. */
export function updateProgressActivity(progress: UpdateProgress): void {
  switch (progress.phase) {
    case "preparing":
    case "verifying":
      staging = undefined;
      showBackground("update", true);
      break;
    case "transferring":
      // The final byte can arrive before the kit verifies and stages the build.
      staging =
        Number.isFinite(progress.totalBytes) &&
        progress.totalBytes > 0 &&
        progress.receivedBytes < progress.totalBytes
          ? progress.receivedBytes / progress.totalBytes
          : undefined;
      showBackground("update", true);
      break;
    case "idle":
    case "failed":
    case "ready":
      // An interrupted transfer must clear its measurement before finish can hold a full bar.
      if (progress.phase !== "ready" && background.has("update")) {
        install?.progress(undefined);
      }
      staging = undefined;
      showBackground("update", false);
      break;
    case "applying":
    case "booting":
      showBackground("activation", true);
      break;
    case "applied":
    case "applyFailed":
      showBackground("activation", false);
      break;
  }
}

/** A forced update for a newer save: the bar travels while it downloads ("updating"). */
export function requiredUpdateActivity(state: RequiredUpdateState): void {
  showBackground("required", state === "updating");
}

/** Subscribe to launch over waited loads over updates for one mounted bar. */
export function subscribeLoadingProgress(
  timer: Timer,
  hold: ProgressHold,
  report: (snapshot: ProgressSnapshot) => void,
): () => void {
  const waited = createLayeredProgress(timer, hold, {
    background: installProgress,
    foreground: loadingProgress,
  });
  const layered = createLayeredProgress(timer, hold, {
    background: waited,
    foreground: launchProgress,
  });
  const unsubscribe = layered.subscribe(report);
  return () => {
    unsubscribe();
    layered.dispose();
    waited.dispose();
  };
}
