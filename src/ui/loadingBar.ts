import type { ProgressBarStyle } from "@andornaut/game-kit/runtime/progress";
import {
  createDomProgressBar,
  type DomProgressTiming,
} from "@andornaut/game-kit/runtime/web/progress/dom/progressBar";

import { LOADING_LAYER } from "../data/layout.ts";
import { SCREEN } from "../data/screen.ts";
import { subscribeLoadingProgress } from "../loading/progress.ts";
import { pixels } from "./layout/css.ts";
import { VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";

// The loading bar's look (art/layout.md "Loading bar"), its whole spec in LOADING_BAR: along the
// view's top edge at full width, insets ignored, 3 logical px high, above every UI layer
// including open modals. The cream fill runs on the ink track at 0.6 alpha, 2 high, with no frame
// showing, over an opaque ink rule 1 high that keeps a full bar visible on every galaxy's field.
// A measured load holds full for 250 ms and then fades out over 150 ms before its element is
// removed; work of unknown total shows a segment 30% of the width travelling across.
// Game Kit draws the alphas, hold and fade. The ink rule is inside its bar, so both fade together.

export const LOADING_BAR = {
  fadeMs: 150,
  fill: TEXT_TOKENS.label,
  // The fill and track, y 0 to 2.
  fillHeight: 2,
  fullMs: 250,
  height: 3,
  rule: TEXT_TOKENS.buttonLabel,
  // The rule, y 2 to 3.
  ruleHeight: 1,
  segment: 0.3,
  track: TEXT_TOKENS.buttonLabel,
  trackAlpha: 0.6,
} as const;

// The host spans the view's width in logical px, scaled to the play area; the kit's bar draws in it.
export const LOADING_STYLE = `
.ada-loading{
  position:absolute;
  top:0;
  left:0;
  pointer-events:none;
  transform-origin:0 0;
  z-index:${LOADING_LAYER};
}
`;

const colour = (hex: string) => Number.parseInt(hex.slice(1), 16);
/** The kit's bar style: the frame never shows; the track at its alpha under the cream fill. */
const BAR_STYLE: ProgressBarStyle = {
  border: 0,
  fills: [colour(LOADING_BAR.fill)],
  frame: colour(LOADING_BAR.track),
  frameAlpha: 0,
  track: colour(LOADING_BAR.track),
  trackAlpha: LOADING_BAR.trackAlpha,
};
/** The kit's bar timing: the hold and fade it draws, and the pending segment crossing every
 * 1.5 s, as in Chibi. */
const BAR_TIMING: DomProgressTiming = {
  cycleMs: 1500,
  fadeMs: LOADING_BAR.fadeMs,
  fullMs: LOADING_BAR.fullMs,
  segment: LOADING_BAR.segment,
};
// The kit's bar, the fill and track band; the host holds it and the rule below, the whole height.
const FRAME = { height: LOADING_BAR.height, width: SCREEN.width, x: 0, y: 0 };

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
  host.style.width = pixels(FRAME.width);
  host.style.height = pixels(LOADING_BAR.height);
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
  const bar = createDomProgressBar({ frame: FRAME, style: BAR_STYLE, timing: BAR_TIMING }, host);
  // The opaque ink rule under the band: inside the kit's bar, so it fades and hides with it.
  const rule = document.createElement("div");
  rule.className = "ada-loading-rule";
  Object.assign(rule.style, {
    backgroundColor: LOADING_BAR.rule,
    height: pixels(LOADING_BAR.ruleHeight),
    left: "0",
    position: "absolute",
    top: pixels(LOADING_BAR.fillHeight),
    width: pixels(FRAME.width),
  });
  bar.element.append(rule);
  // Named for the game, as Chibi's is, with no string of its own.
  const name = parent.getAttribute("aria-label");
  if (name) {
    bar.element.setAttribute("aria-label", name);
  }
  const stopProgress = subscribeLoadingProgress(
    window,
    { fadeMs: BAR_TIMING.fadeMs ?? 0, fullMs: BAR_TIMING.fullMs },
    bar.report,
  );
  return () => {
    stopProgress();
    bar.remove();
    window.removeEventListener("resize", fit);
    window.removeEventListener(VIEW_SCALE_EVENT, fit);
    host.remove();
  };
}
