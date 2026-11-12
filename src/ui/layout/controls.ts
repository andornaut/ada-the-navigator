import { BUTTON_SLICE, CARD_SLICE, FRAME_LINE } from "../../data/layout.ts";

export {
  BUTTON_SLICE,
  CARD_SLICE,
  CONTROL_ROW,
  FOCUS_RING,
  FRAME_LINE,
  INLINE_CONTROL,
  PILL,
  STORY_BUTTON,
  TEXT_BUTTON,
} from "../../data/layout.ts";

// Control geometry (art/layout.md "Controls and targets"), in logical px. Faces, content insets,
// nine-slice margins and press areas are separate measurements.

// Every drawn edge the DOM keeps sharp: the nine-slice edges and the 1 px lines. Each
// is set as whole CSS px, round(edge * s) and at least 1, so edges never blur while the body
// scales (viewScale.ts).
export const WHOLE_PX_EDGES = [
  ...new Set([CARD_SLICE, BUTTON_SLICE.bottom, BUTTON_SLICE.left, BUTTON_SLICE.top, FRAME_LINE]),
].sort((a, b) => a - b);
