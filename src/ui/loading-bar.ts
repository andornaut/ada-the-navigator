import { TEXT_TOKENS } from "./modal.ts";

// The loading bar's look, as Art sets it: along the view's top edge at full width,
// insets ignored, 3 logical px high, above every UI layer including open modals. The cream fill
// runs on the ink track at 0.6 opacity; a measured load holds full for 250 ms and then fades out
// over 150 ms before its element is removed; work of unknown total shows a segment 30% of the
// width travelling across. src/loading/progress.ts mounts it with game-kit's DOM progress bar.

export const LOADING_BAR = {
  fadeMs: 150,
  fill: TEXT_TOKENS.label,
  fullMs: 250,
  height: 3,
  segment: 0.3,
  track: TEXT_TOKENS.buttonLabel,
  trackOpacity: 0.6,
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
.ada-loading .progress-bar{
  background-color:transparent !important;
  transition:opacity ${LOADING_BAR.fadeMs}ms linear;
}
.ada-loading .progress-bar > :first-child{
  opacity:${LOADING_BAR.trackOpacity};
}
.ada-loading .progress-bar[data-fading]{
  opacity:0;
}
`;
