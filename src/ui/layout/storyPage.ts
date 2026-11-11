import { SPACING } from "./tokens.ts";

// The storybook page panel (art/layout.md "Storybook page"), in logical px: centred, at most
// maxWidth wide, its bottom on the page safe rect's bottom, panel padding inside, no dim. A
// portrait is 64 in a 68 frame, a gap from the text column. Groups stack a gap apart: the text
// column (speaker then paragraph a row gap below), choices (an action stack), and the page
// controls: Skip at the inner left, Previous and Next right-aligned a gap apart, all one width.
// The panel keeps the largest size of a scene's pages.
export const STORY_PANEL = {
  anchor: "bottom",
  gap: SPACING.gap,
  maxWidth: 640,
  padding: SPACING.panelPadding,
  pageControls: ["skip", "previous", "next"],
  portrait: { frame: 68, image: 64, inset: 2 },
  speakerGap: SPACING.rowGap,
} as const;
