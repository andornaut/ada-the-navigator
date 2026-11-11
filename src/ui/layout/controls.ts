import { GALAXY_CARD } from "./galaxySelectCard.ts";
import { HIT_RULE } from "./hitAreas.ts";
import { SPACING, TYPE } from "./tokens.ts";

// Control geometry (art/layout.md "Controls and targets"), in logical px. Faces, content insets,
// nine-slice margins and press areas are separate measurements.

// Standard actions: 48 high, a 44 face over a 4 lip, pressed sinks 2; content inset 16 across
// and 12 down, so a wrapped label grows the face by one line box per line. Compact faces (row
// actions and pills) are the native 28 high nine-slice frame; the compact Install action is 72
// wide, or its label plus compactInset on each side when that is wider.
export const TEXT_BUTTON = {
  compactHeight: 28,
  compactInset: 8,
  compactWidth: 72,
  height: 48,
  inset: 16,
  lipHeight: 4,
  pressedSink: 2,
  verticalInset: 12,
} as const;

// Settings and install-step control rows: one control 48 high (growing to its text plus a row
// gap above and below), a 16 icon, a gap, the label, a gap, then the action at the right end.
export const CONTROL_ROW = {
  gap: SPACING.gap,
  height: HIT_RULE.minTarget,
  icon: 16,
  switch: { height: 16, width: 32 },
  textInset: SPACING.rowGap,
} as const;

// The button sheets' nine-slice margins (left, top, right, bottom), as the UI manifest gives them.
export const BUTTON_SLICE = { bottom: 6, left: 2, right: 2, top: 4 } as const;

// The card frame's nine-slice edge (ui-settings-card).
export const CARD_SLICE = 2;

// Every drawn edge the DOM keeps sharp: the nine-slice edges and the galaxy preview's frame. Each
// is set as whole CSS px, round(edge * s) and at least 1, so edges never blur while the body
// scales (viewScale.ts).
export const WHOLE_PX_EDGES = [
  ...new Set([
    CARD_SLICE,
    BUTTON_SLICE.bottom,
    BUTTON_SLICE.left,
    BUTTON_SLICE.top,
    GALAXY_CARD.screenshot.frame,
  ]),
].sort((a, b) => a - b);

// Art's focus ring outside the drawn face in every state: a 1 ink fringe, a 2 cream band, then
// ink out to the 4 outset. The selection ring is a 2 band 2 outside the face, under focus.
export const FOCUS_RING = {
  band: 2,
  fringe: 1,
  outset: 4,
  selectionBand: 2,
  selectionOutset: 2,
} as const;

// Price pills and the HUD Stardust pill: compact height, radius 4, 8 side padding; the count is a
// label.
export const PILL = {
  height: TEXT_BUTTON.compactHeight,
  padding: 8,
  radius: 4,
  text: TYPE.label,
} as const;
