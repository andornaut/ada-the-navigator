import { BUTTON_GAP, SPACING } from "./tokens.ts";

// The storybook page panel (art/layout.md "Storybook page"), in logical px: centred, at most
// maxWidth wide, its bottom on the page safe rect's bottom so the background shows above it,
// panel padding inside, no dim. A portrait is 64 in a 68 frame, a gap from the text column. Groups
// stack a gap apart: the text column (speaker then paragraph a row gap below), choices (an action
// stack), and the page controls: Previous at the inner left and Next (or the page's named action)
// at the inner right, one width, at least BUTTON_GAP apart. Each page sizes its panel to its
// content.
export const STORY_PANEL = {
  anchor: "bottom",
  controlsGap: BUTTON_GAP,
  gap: SPACING.gap,
  maxWidth: 640,
  padding: SPACING.panelPadding,
  pageControls: ["previous", "next"],
  portrait: { frame: 68, image: 64, inset: 2 },
  speakerGap: SPACING.rowGap,
} as const;

// A storybook background's canvas in logical px (art/storybook.md): drawn at this size centred on
// the view under the insets, scaled by max(1, viewW / width, viewH / height) so it always covers.
export const STORY_BACKGROUND = { height: 540, width: 960 } as const;
