import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";

// Ada's spacing and type tokens (art/layout.md "Spacing tokens"), in logical px: the pixels of
// the logical view, which the canvas and the DOM overlay both scale by s (playView.ts).

export const SPACING = {
  // Between columns of controls (shop item columns).
  columnGap: 8,
  // Between card groups, buttons in an action row or stack, and row parts.
  gap: 8,
  // From an inline icon to its label inside one control or pill.
  markGap: 6,
  // Modals and page content from the view edge.
  pageInset: 16,
  // Inside cards and the story panel, including the 2 frame.
  panelPadding: MODAL_CONTENT.padding,
  // Between rows of one list: control rows, item rows, text rows.
  rowGap: 4,
} as const;

// Type roles: size and line box, and weight.
export const TYPE = {
  body: { lineHeight: 20, size: 16, weight: 400 },
  // The HUD weapon counts only, the one role below 16 (art/layout.md "Type").
  count: { lineHeight: 14, size: 12, weight: 700 },
  heading: { lineHeight: 28, size: 24, weight: 700 },
  label: { lineHeight: 20, size: 16, weight: 700 },
} as const;
