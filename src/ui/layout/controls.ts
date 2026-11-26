import type { ButtonMetrics } from "@andornaut/game-kit/runtime/ui/buttonLayout";
import { buttonSkinProperty } from "@andornaut/game-kit/runtime/web/ui/dom/buttonSkin";

import { BUTTON_SLICE, CARD_SLICE, FRAME_LINE, TEXT_BUTTON } from "../../data/layout.ts";

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

export type ButtonTag = "disabled" | "normal" | "pressed";
export const BUTTON_SHEETS = ["ui-button", "ui-button-primary", "ui-button-tile"] as const;

// The custom property a sheet's tag sets.
export function buttonProperty(sheet: (typeof BUTTON_SHEETS)[number], tag: ButtonTag): string {
  return buttonSkinProperty(sheet, tag);
}

// Control geometry (art/layout.md "Controls and targets"), in logical px. Faces, content insets,
// nine-slice margins and press areas are separate measurements.

// Every drawn edge the DOM keeps sharp: the nine-slice edges and the 1 px lines. Each
// is set as whole CSS px, round(edge * s) and at least 1, so edges never blur while the body
// scales (viewScale.ts).
export const WHOLE_PX_EDGES = [
  ...new Set([CARD_SLICE, BUTTON_SLICE.bottom, BUTTON_SLICE.left, BUTTON_SLICE.top, FRAME_LINE]),
].sort((a, b) => a - b);

/** Square currency glyph in the Cheats grant actions. */
export const CHEAT_GRANT_ICON = 20;

/** Named control metrics shared by actual buttons and typed layout ports. */
export const BUTTON_METRICS: Readonly<Record<"ordinary" | "compact", ButtonMetrics>> = {
  compact: {
    height: TEXT_BUTTON.compactHeight,
    minWidth: TEXT_BUTTON.compactWidth,
    paddingX: TEXT_BUTTON.compactInset,
    paddingY: 0,
  },
  ordinary: {
    height: TEXT_BUTTON.height,
    minWidth: TEXT_BUTTON.height,
    paddingX: TEXT_BUTTON.inset,
    paddingY: TEXT_BUTTON.verticalInset,
  },
};
