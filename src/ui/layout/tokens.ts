import { COLOURS } from "./colours.ts";

export { SPACING, TYPE } from "../../data/layout.ts";

// Ada's spacing and type tokens (art/layout.md "Spacing tokens"), in logical px: the pixels of
// the logical view, which the canvas and the DOM overlay both scale by s (playView.ts).

// Gaps between neighbouring button faces with nothing between them (art/layout.md "Groups"):
// standard faces side by side (action rows, grid columns) BUTTON_GAP apart, standard faces stacked
// (action stacks, control rows, grid rows, line buttons) STACK_BUTTON_GAP apart, and any two faces
// SMALL_BUTTON_GAP apart in any direction when either is small, under TEXT_BUTTON.height: the HUD
// and Map discs, compact buttons and the close X. The values are game-kit's.
export {
  BUTTON_GAP,
  SMALL_BUTTON_GAP,
  STACK_BUTTON_GAP,
} from "@andornaut/game-kit/runtime/ui/spacing";

export const BUTTON_FACE = {
  disabled: COLOURS.disabledFace,
  primary: COLOURS.primaryFace,
  secondary: COLOURS.secondaryFace,
} as const;

// Text colours on the card face #3b3850.
export const TEXT_TOKENS = {
  buttonLabel: COLOURS.ink,
  disabledLabel: COLOURS.disabledLabel,
  label: COLOURS.cream,
  /** Every text of an unaffordable or busy tile row, on its flat #2f2d3d face (5.42:1). */
  rowDisabled: COLOURS.rowDisabled,
  /** A tile row's second line and Owned, on its #46425e face (5.11:1). */
  rowSupporting: COLOURS.rowSupporting,
  supporting: COLOURS.supporting,
  title: COLOURS.white,
} as const;

// The shared card and control styles apply in the controls overlay and on the start screen.
export const UI_SCOPE = ":is(.ada-controls,.ada-start)";
