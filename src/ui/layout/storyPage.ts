import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { SAFE_MARGIN, SPACING, STORY_BACKGROUND, STORY_PANEL } from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
import { type Insets, playView, safeRect, type Size } from "./playView.ts";
export { STORY_BACKGROUND, STORY_PANEL } from "../../data/layout.ts";

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
  const width = Math.min(available.width, SCREEN.width);
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

/** One translation for the existing canvas and every ordered layer in the upper art window. */
export function storyHalfArtOffset(
  view: Size,
  subject: SubjectBand | null,
  canvasTop: number,
  room: boolean,
): number {
  const centre = subject ? (subject.top + subject.bottom) / 2 : STORY_BACKGROUND.height / 2;
  return (
    view.height / 4 -
    canvasTop -
    storyBackgroundScale(view) * centre -
    (room ? SPACING.panelPadding : 0)
  );
}

/** Full-width paint retains text and actions inside the canonical game area's padded sides. */
export function storyContentPadding(view: Size): { readonly left: number; readonly right: number } {
  const area = playView(view);
  return {
    left: area.x + STORY_PANEL.padding,
    right: view.width - area.x - area.width + STORY_PANEL.padding,
  };
}

/** Cover the Earth art window with an existing backdrop, keeping its canonical game-area centre. */
export function storyBackdropRect(view: Size, image: Size): Rect {
  const centre = playView(view).x + SCREEN.width / 2;
  const horizontal = 2 * Math.max(centre, view.width - centre);
  const scale = Math.max(1, horizontal / image.width, view.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { height, width, x: SCREEN.width / 2 - width / 2, y: SCREEN.height / 2 - height / 2 };
}
