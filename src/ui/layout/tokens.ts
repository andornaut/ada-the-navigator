export { SPACING, TYPE } from "../../data/layout.ts";

// Ada's spacing and type tokens (art/layout.md "Spacing tokens"), in logical px: the pixels of
// the logical view, which the canvas and the DOM overlay both scale by s (playView.ts).

// Gaps between neighbouring button faces with nothing between them (art/layout.md "Groups"):
// standard faces side by side (action rows, grid columns) BUTTON_GAP apart, standard faces stacked
// (action stacks, control rows, grid rows, line buttons) STACK_BUTTON_GAP apart, and any two faces
// SMALL_BUTTON_GAP apart in any direction when either is small, under TEXT_BUTTON.height: the HUD
// and Map discs, compact buttons and the close X. The values are game-kit's.
export { BUTTON_GAP, SMALL_BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";
