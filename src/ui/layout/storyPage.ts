import { type Insets, SAFE_MARGIN, safeRect, type Size } from "./playView.ts";
import { SPACING } from "./tokens.ts";

// The storybook page panel (art/layout.md "Storybook page"), in logical px: a light spread with a
// text column and a choice column side by side, the available rect's width up to maxWidth,
// centred, its bottom on the available rect's bottom, panel padding inside, no dim. It is only as
// tall as its page needs, up to its top cap; past that only the text column scrolls. The column
// gap holds a 1 rule in the card rim, 12 from each column. The choice column takes its share of
// the inner width less the gap, within its min and max; the text column takes the rest. A
// portrait is the 32 storybook frame at 2x in a 68 frame.
export const STORY_PANEL = {
  choiceColumn: { max: 300, min: 228, share: 0.38 },
  columnGap: 25,
  maxWidth: 760,
  padding: SPACING.panelPadding,
  pageControls: ["previous", "next"],
  portrait: { frame: 68, image: 64, inset: 2 },
  rule: { colour: "#6b6685", width: 1 },
} as const;

// A storybook background's canvas in logical px (art/storybook.md), centred across the view and
// scaled by max(1, viewW / width, viewH / height) so it always covers.
export const STORY_BACKGROUND = { height: 540, width: 960 } as const;

/** A background's subject band: the canvas rows its key objects span (art/storybook.md). */
export interface SubjectBand {
  readonly bottom: number;
  readonly top: number;
}

/** A column of the panel: its left edge and width in the logical view. */
export interface StoryColumn {
  readonly width: number;
  readonly x: number;
}

/** The panel's rect across and its bottom, its columns and its rule, in the logical view. */
export interface StoryPanelLayout {
  readonly bottom: number;
  readonly choice: StoryColumn;
  readonly panel: StoryColumn;
  readonly rule: number;
  readonly text: StoryColumn;
}

/** The choice column's width for an inner width: its share of the rest past the gap, clamped. */
export function storyChoiceWidth(inner: number): number {
  const { choiceColumn, columnGap } = STORY_PANEL;
  return Math.min(
    choiceColumn.max,
    Math.max(choiceColumn.min, choiceColumn.share * (inner - columnGap)),
  );
}

/** The panel and its columns for a logical view and its logical safe insets. */
export function storyPanelLayout(insets: Insets, view: Size): StoryPanelLayout {
  const available = safeRect(insets, SAFE_MARGIN.page, view);
  const width = Math.min(available.width, STORY_PANEL.maxWidth);
  const x = available.x + (available.width - width) / 2;
  const { columnGap, padding, rule } = STORY_PANEL;
  const inner = width - 2 * padding;
  const choiceWidth = storyChoiceWidth(inner);
  const text = { width: inner - columnGap - choiceWidth, x: x + padding };
  return {
    bottom: available.y + available.height,
    choice: { width: choiceWidth, x: text.x + text.width + columnGap },
    panel: { width, x },
    rule: text.x + text.width + (columnGap - rule.width) / 2,
    text,
  };
}

/** The canvas scale: never below 1, and enough to cover the view. */
export function storyBackgroundScale(view: Size): number {
  return Math.max(1, view.width / STORY_BACKGROUND.width, view.height / STORY_BACKGROUND.height);
}

/**
 * The canvas top for a story run's background (art/layout.md "Run anchor"): the subject band's
 * centre at the centre of the strip above the panel top `stripTop`, the run's tallest page's,
 * clamped so the canvas still covers the view. A backdrop without a panel, or a background with
 * no band, centres.
 */
export function storyBackgroundTop(
  view: Size,
  subject: SubjectBand | null,
  stripTop: number | null,
): number {
  const scale = storyBackgroundScale(view);
  const lowest = view.height - STORY_BACKGROUND.height * scale;
  if (subject === null || stripTop === null) {
    return lowest / 2;
  }
  const anchored = stripTop / 2 - (scale * (subject.top + subject.bottom)) / 2;
  return Math.min(0, Math.max(lowest, anchored));
}
