import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

// Ada's spacing and type tokens (art/layout.md "Spacing tokens"), in logical px: the pixels of
// the logical view, which the canvas and the DOM overlay both scale by s (playView.ts).

export const SPACING = {
  // Between columns that are not buttons.
  columnGap: 8,
  // Between card groups and row parts.
  gap: 8,
  // From an inline icon to its label inside one control or pill.
  markGap: 6,
  // Modals and page content from the view edge.
  pageInset: 16,
  // Inside cards and the story panel, including the 2 frame.
  panelPadding: MODAL_CONTENT.padding,
  // Between rows of one list that are not buttons: item rows, text rows.
  rowGap: 4,
} as const;

// Gaps between neighbouring button faces with nothing between them (art/layout.md "Groups"):
// standard faces side by side (action rows, grid columns) BUTTON_GAP apart, standard faces stacked
// (action stacks, control rows, grid rows, line buttons) STACK_BUTTON_GAP apart, and any two faces
// SMALL_BUTTON_GAP apart in any direction when either is small, under TEXT_BUTTON.height: the HUD
// and Map discs, compact buttons and the close X. The values are game-kit's.
export { BUTTON_GAP, SMALL_BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";

// Type roles: size and line box, and weight.
export const TYPE = {
  body: { lineHeight: 20, size: 16, weight: 400 },
  // The HUD weapon counts only, the one role below 16 (art/layout.md "Type").
  count: { lineHeight: 14, size: 12, weight: 700 },
  heading: { lineHeight: 28, size: 24, weight: 700 },
  label: { lineHeight: 20, size: 16, weight: 700 },
} as const;
