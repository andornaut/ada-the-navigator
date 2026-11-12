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
import { LOADING_BAR, LOADING_STYLE } from "../ui/loading-bar.ts";
import { followLoading } from "./loadingBar.ts";

// The game's loads and the offline precache, shown as one loading bar along the top edge of the
// play area (src/ui/loading-bar.ts). The game's own loads (Phaser's loader: the boot preload, a
// galaxy's art and any later art) measure their share; the precache reports activity only.

/** The game's own loads, measured. */
export const loadingProgress = createProgressState();
/** The service worker's precache, of unknown total. */
export const installProgress = createProgressState();

const colour = (hex: string) => Number.parseInt(hex.slice(1), 16);
const STYLE: ProgressBarStyle = {
  border: 0,
  fills: [colour(LOADING_BAR.fill)],
  frame: colour(LOADING_BAR.track),
  track: colour(LOADING_BAR.track),
};
// The kit's complete state hides the bar after its full hold; here that is the hold and the fade,
// so the bar stays visible while it fades and is removed as it hides. The pending segment crosses
// the track every 1.5 s, as in Chibi.
const TIMING: DomProgressTiming = {
  cycleMs: 1500,
  fullMs: LOADING_BAR.fullMs + LOADING_BAR.fadeMs,
  segment: LOADING_BAR.segment,
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
 * Mounts the loading bar's host along the top of parent, the play area: drawn in logical px,
 * stretched to parent's whole width and scaled by its view unit, insets ignored. A bar element
 * exists only while something loads. Returns the function that removes it.
 */
export function mountLoading(parent: HTMLElement): () => void {
  const document = parent.ownerDocument;
  const window = document.defaultView;
  if (!window) {
    return () => undefined;
  }
  const sheet = document.createElement("style");
  sheet.textContent = LOADING_STYLE;
  document.head.append(sheet);
  const host = document.createElement("div");
  host.className = "ada-loading";
  host.style.width = `${FRAME.width}px`;
  host.style.height = `${FRAME.height}px`;
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
        const bar = createDomProgressBar(host, STYLE, FRAME, TIMING);
        // Named for the game, as Chibi's is, with no string of its own.
        const name = parent.getAttribute("aria-label");
        if (name) {
          bar.element.setAttribute("aria-label", name);
        }
        return {
          fade: (fading) => {
            bar.element.toggleAttribute("data-fading", fading);
          },
          remove: bar.remove,
          report: bar.report,
        };
      },
      fadeMs: LOADING_BAR.fadeMs,
      fullMs: LOADING_BAR.fullMs,
      setTimeout: (handler, ms) => window.setTimeout(handler, ms),
    },
    { background: installProgress, foreground: loadingProgress },
  );
  return () => {
    stop();
    window.removeEventListener("resize", fit);
    window.removeEventListener(VIEW_SCALE_EVENT, fit);
    host.remove();
    sheet.remove();
  };
}
