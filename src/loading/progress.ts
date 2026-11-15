import "@andornaut/game-kit/runtime/web/progress/dom/progressBar.css";

import type { ProgressBarStyle } from "@andornaut/game-kit/runtime/progress";
import {
  createLayeredProgress,
  createProgressState,
  type ProgressHandle,
} from "@andornaut/game-kit/runtime/progressState";
import {
  createDomProgressBar,
  type DomProgressTiming,
} from "@andornaut/game-kit/runtime/web/progress/dom/progressBar";
import type { OfflineActivity } from "@andornaut/game-kit/runtime/web/pwa/dom/offlinePlay";
import type { DownloadProgress } from "@andornaut/game-kit/runtime/web/pwa/downloadProgress";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/updateReady";

import { SCREEN } from "../data/screen.ts";
import { VIEW_SCALE_EVENT } from "../ui/layout/viewScale.ts";
import { LOADING_BAR } from "../ui/loadingBar.ts";

// The loads the player waits for over the background work, shown as one loading bar along the
// top edge of the play area (src/ui/loadingBar.ts): known progress fills, holds and fades, work
// of unknown total travels, and nothing shows while idle.

/**
 * The loads the player waits for, which alone show the bar in the foreground: the boot preload
 * before the first screen, and a galaxy's own art as its first flight starts. On-demand art during
 * play (scenery, rocks, ship parts, paint) loads silently.
 */
export type WaitedLoad = "boot" | "galaxy";

/** The waited-for loads, each measured by the kit's loader watch (src/game/scene.ts). */
export const loadingProgress = createProgressState();
/** The background work, of unknown total: offline installation and forced updates. */
export const installProgress = createProgressState();
/** Optional galaxy transactions own a separate operation on the same background band. */
export const galaxyProgress = createProgressState();

const colour = (hex: string) => Number.parseInt(hex.slice(1), 16);
/** The kit's bar style: the frame never shows; the track at its alpha under the cream fill. */
export const BAR_STYLE: ProgressBarStyle = {
  border: 0,
  fills: [colour(LOADING_BAR.fill)],
  frame: colour(LOADING_BAR.track),
  frameAlpha: 0,
  track: colour(LOADING_BAR.track),
  trackAlpha: LOADING_BAR.trackAlpha,
};
/** The kit's bar timing: the hold and fade it draws, and the pending segment crossing every
 * 1.5 s, as in Chibi. */
export const BAR_TIMING: DomProgressTiming = {
  cycleMs: 1500,
  fadeMs: LOADING_BAR.fadeMs,
  fullMs: LOADING_BAR.fullMs,
  segment: LOADING_BAR.segment,
};
// The kit's bar, the fill and track band; the host holds it and the rule below, the whole height.
const FRAME = { height: LOADING_BAR.height, width: SCREEN.width, x: 0, y: 0 };

// Offline installation and forced updates share the bar while either still runs.
const background = new Set<"activation" | "offline" | "required">();
let install: ProgressHandle | undefined;
let download: DownloadProgress | undefined;
const retiredDownloads = new Set<string>();
const downloadKey = (value: DownloadProgress) => JSON.stringify([value.operationId, value.version]);

/** Only the kit's worker-scoped precache/update reports measure the background band. */
export function offlineDownloadProgress(snapshot: DownloadProgress): void {
  const key = downloadKey(snapshot);
  if (
    retiredDownloads.has(key) ||
    (download?.operationId === snapshot.operationId && download.version !== snapshot.version)
  ) {
    return;
  }
  if (download && downloadKey(download) !== key) {
    retiredDownloads.add(downloadKey(download));
  }
  download = snapshot;
  if (background.has("offline")) {
    install?.progress(snapshot.value);
  }
  if (snapshot.phase === "complete" || snapshot.phase === "failed") {
    retiredDownloads.add(key);
  }
}

function showBackground(reason: "activation" | "offline" | "required", shown: boolean): void {
  if (shown) {
    background.add(reason);
  } else {
    background.delete(reason);
  }
  if (background.size > 0) {
    install ??= installProgress.begin();
  } else {
    install?.finish();
    install = undefined;
  }
}

/** Offline installation uses the existing bar until precaching or updating ends. */
export function offlineActivity(activity: OfflineActivity): void {
  if (activity === "idle") {
    if (download) {
      retiredDownloads.add(downloadKey(download));
      download = undefined;
    }
    showBackground("offline", false);
    // Activation and a required update remain pending work of unobserved size.
    install?.progress(undefined);
  } else {
    showBackground("offline", true);
    if (download) {
      install?.progress(download.value);
    }
  }
}

/** Explicit Update now keeps the bar visible through activation, independently of installation. */
export function updateActivationActivity(active: boolean): void {
  showBackground("activation", active);
}

/** A forced update for a newer save: the bar travels while it downloads ("updating"). */
export function requiredUpdateActivity(state: RequiredUpdateState): void {
  showBackground("required", state === "updating");
}

/**
 * Mounts the loading bar along the top of parent, the play area: drawn in logical px, stretched to
 * parent's whole width and scaled by its view unit, insets ignored. The kit's bar stays mounted
 * and hides itself while idle. Returns the function that removes it.
 */
export function mountLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const window = document.defaultView;
  if (!window) {
    return () => undefined;
  }
  const host = document.createElement("div");
  host.className = "ada-loading";
  host.style.width = `${FRAME.width}px`;
  host.style.height = `${LOADING_BAR.height}px`;
  const fit = () => {
    const across = parent.clientWidth / FRAME.width;
    const down = Math.min(across, parent.clientHeight / SCREEN.height);
    host.style.transform = `scale(${across}, ${down})`;
  };
  fit();
  const boot = parent.querySelector("#boot-progress");
  if (boot) {
    boot.replaceWith(host);
  } else {
    parent.append(host);
  }
  window.addEventListener("resize", fit);
  window.addEventListener(VIEW_SCALE_EVENT, fit);
  const bar = createDomProgressBar(host, BAR_STYLE, FRAME, BAR_TIMING);
  // The opaque ink rule under the band: inside the kit's bar, so it fades and hides with it.
  const rule = document.createElement("div");
  rule.className = "ada-loading-rule";
  Object.assign(rule.style, {
    backgroundColor: LOADING_BAR.rule,
    height: `${LOADING_BAR.ruleHeight}px`,
    left: "0",
    position: "absolute",
    top: `${LOADING_BAR.fillHeight}px`,
    width: `${FRAME.width}px`,
  });
  bar.element.append(rule);
  // Named for the game, as Chibi's is, with no string of its own.
  const name = parent.getAttribute("aria-label");
  if (name) {
    bar.element.setAttribute("aria-label", name);
  }
  const groupedBackground = createLayeredProgress(
    window,
    { fullMs: 0 },
    { background: galaxyProgress, foreground: installProgress },
  );
  const layered = createLayeredProgress(
    window,
    { fadeMs: BAR_TIMING.fadeMs ?? 0, fullMs: BAR_TIMING.fullMs },
    { background: groupedBackground, foreground: loadingProgress },
  );
  const unsubscribe = layered.subscribe(bar.report);
  const stop = () => {
    unsubscribe();
    layered.dispose();
    groupedBackground.dispose();
    bar.remove();
  };
  return () => {
    stop();
    window.removeEventListener("resize", fit);
    window.removeEventListener(VIEW_SCALE_EVENT, fit);
    host.remove();
  };
}
