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
import type {
  LaunchProgress,
  UpdateState,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type { RequiredUpdateState } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";

import { SCREEN } from "../data/screen.ts";
import { VIEW_SCALE_EVENT } from "../ui/layout/viewScale.ts";
import { LOADING_BAR } from "../ui/loadingBar.ts";

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

/** A background update (the kit's onUpdateState) fills the background bar while it stages. */
export function updateStateActivity(state: UpdateState): void {
  staging = state.phase === "staging" ? state.value : undefined;
  showBackground("update", state.phase === "staging");
}

/** Explicit Update now keeps the bar visible through the switch, independently of staging. */
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
  const hold = { fadeMs: BAR_TIMING.fadeMs ?? 0, fullMs: BAR_TIMING.fullMs };
  const waited = createLayeredProgress(window, hold, {
    background: installProgress,
    foreground: loadingProgress,
  });
  const layered = createLayeredProgress(window, hold, {
    background: waited,
    foreground: launchProgress,
  });
  const unsubscribe = layered.subscribe(bar.report);
  const stop = () => {
    unsubscribe();
    layered.dispose();
    waited.dispose();
    bar.remove();
  };
  return () => {
    stop();
    window.removeEventListener("resize", fit);
    window.removeEventListener(VIEW_SCALE_EVENT, fit);
    host.remove();
  };
}
