import "@andornaut/game-kit/web/progress/dom/progressBar.css";

import type { ProgressBarStyle } from "@andornaut/game-kit/progress";
import { createProgressState, type ProgressHandle } from "@andornaut/game-kit/progressState";
import {
  createDomProgressBar,
  type DomProgressTiming,
} from "@andornaut/game-kit/web/progress/dom/progressBar";
import type { OfflineActivity } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";

import { SCREEN } from "../data/screen.ts";
import { VIEW_PROPERTIES } from "../ui/layout/css.ts";
import { VIEW_SCALE_EVENT } from "../ui/layout/viewScale.ts";
import { TEXT_TOKENS } from "../ui/modal.ts";
import { followLoading } from "./loadingBar.ts";

// The game's loads and the offline precache, shown as one loading bar along the top edge of the
// play area. The game's own loads (Phaser's loader: the boot preload, a galaxy's art and any
// later art) measure their share; the precache reports activity only, with no share.

/** The game's own loads, measured. */
export const loadingProgress = createProgressState();
/** The service worker's precache, of unknown total. */
export const installProgress = createProgressState();

// The bar: 2 logical px tall across the play area's whole width, the UI's cream fill on its ink
// track. The pending segment, a quarter of the track, crosses it every 1.5 s, and a measured load
// that finishes holds full for 250 ms (progressBar.css's defaults, as in Chibi).
export const LOADING_BAR = { height: 2 } as const;
export const LOADING_TIMING: DomProgressTiming = { cycleMs: 1500, fullMs: 250, segment: 0.25 };
const colour = (hex: string) => Number.parseInt(hex.slice(1), 16);
export const LOADING_STYLE: ProgressBarStyle = {
  border: 0,
  fills: [colour(TEXT_TOKENS.label)],
  frame: colour(TEXT_TOKENS.buttonLabel),
  track: colour(TEXT_TOKENS.buttonLabel),
};
const FRAME = { height: LOADING_BAR.height, width: SCREEN.width, x: 0, y: 0 };

let install: ProgressHandle | undefined;

/** offlinePlay's activity: installing or registering is precache work until it is idle again. */
export function offlineActivity(activity: OfflineActivity): void {
  if (activity === "idle") {
    install?.finish();
    install = undefined;
  } else {
    install ??= installProgress.begin();
  }
}

/**
 * Mounts the loading bar's host along the top of parent, the play area, drawn in logical px and
 * scaled to parent's width and view unit. A bar element exists only while something loads.
 * Returns the function that removes it.
 */
export function mountLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const window = document.defaultView;
  if (!window) {
    return () => undefined;
  }
  const host = document.createElement("div");
  host.className = "ada-loading";
  Object.assign(host.style, {
    height: `${FRAME.height}px`,
    left: "0",
    pointerEvents: "none",
    position: "absolute",
    top: "0",
    transformOrigin: "0 0",
    width: `${FRAME.width}px`,
    zIndex: "40",
  });
  const fit = () => {
    const unit = Number.parseFloat(getComputedStyle(parent).getPropertyValue(VIEW_PROPERTIES.unit));
    const across = parent.clientWidth / FRAME.width;
    const down = Number.isFinite(unit) && unit > 0 ? unit : across;
    host.style.transform = `scale(${across}, ${down})`;
  };
  fit();
  parent.append(host);
  window.addEventListener("resize", fit);
  window.addEventListener(VIEW_SCALE_EVENT, fit);
  const stop = followLoading(
    {
      clearTimeout: (handle) => window.clearTimeout(handle as number),
      create: () => {
        const bar = createDomProgressBar(host, LOADING_STYLE, FRAME, LOADING_TIMING);
        // Named for the game, as Chibi's is, with no string of its own.
        const name = parent.getAttribute("aria-label");
        if (name) {
          bar.element.setAttribute("aria-label", name);
        }
        return bar;
      },
      fullMs: LOADING_TIMING.fullMs,
      setTimeout: (handler, ms) => window.setTimeout(handler, ms),
    },
    { background: installProgress, foreground: loadingProgress },
  );
  return () => {
    stop();
    window.removeEventListener("resize", fit);
    window.removeEventListener(VIEW_SCALE_EVENT, fit);
    host.remove();
  };
}
