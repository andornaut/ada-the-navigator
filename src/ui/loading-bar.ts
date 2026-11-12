import { TEXT_TOKENS } from "./modal.ts";

// The loading bar's look (art/layout.md "Loading bar"), its whole spec in LOADING_BAR: along the
// view's top edge at full width, insets ignored, 3 logical px high, above every UI layer
// including open modals. The cream fill runs on the ink track at 0.6 alpha, 2 high, with no frame
// showing, over an opaque ink rule 1 high that keeps a full bar visible on every galaxy's field.
// A measured load holds full for 250 ms and then fades out over 150 ms before its element is
// removed; work of unknown total shows a segment 30% of the width travelling across.
// src/loading/progress.ts mounts it with game-kit's DOM progress bar, which draws the alphas, the
// hold and the fade; the rule is a child of the kit's bar, so it fades and goes with it.

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

// Above every page layer and the modal layer (modal.test.ts "modal stacking").
export const LOADING_LAYER = 40;

// The host spans the view's width in logical px, scaled by progress.ts; the kit's bar draws in it.
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
