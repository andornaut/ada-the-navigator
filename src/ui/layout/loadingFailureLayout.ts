import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";

import { FRAME_LINE, SPACING, TEXT_BUTTON, TYPE } from "../../data/layout.ts";
import { COLOURS } from "./colours.ts";
import { BUTTON_GAP } from "./tokens.ts";

const PANEL = {
  bodyActionGapPx: 24,
  borderWidthPx: FRAME_LINE,
  lipHeightPx: TEXT_BUTTON.lipHeight,
  maxWidthPx: 328,
  paddingBottomPx: SPACING.panelPadding,
  paddingTopPx: 24,
  paddingXPx: SPACING.panelPadding,
  safeInsetPx: SPACING.pageInset,
  shadowOffsetPx: 4,
  titleBodyGapPx: BUTTON_GAP,
} as const;

const TEXT = {
  action: { lineHeight: 1.2, sizePx: TEXT_BUTTON.label.size, synthesis: "weight", weight: 900 },
  body: { lineHeight: 1.45, sizePx: TYPE.story.size, weight: TYPE.body.weight },
  title: { lineHeight: 1.2, sizePx: TYPE.heading.size, weight: TYPE.heading.weight },
} as const;

/** Recovery keeps its panel and typography in CSS pixels while action geometry follows the view. */
export function loadingFailureLayout(unit: number): LoadingFailurePresentation<"content"> {
  return {
    action: {
      borderWidthPx: FRAME_LINE * unit,
      heightPx: TEXT_BUTTON.height * unit,
      highlightHeightPx: FRAME_LINE * unit,
      paddingBottomPx: TEXT_BUTTON.lipHeight * unit,
      paddingXPx: TEXT_BUTTON.inset * unit,
      shadeHeightPx: TEXT_BUTTON.lipHeight * unit,
      widthPx: "content",
    },
    palette: {
      action: COLOURS.primaryFace,
      actionText: COLOURS.ink,
      border: COLOURS.ink,
      highlight: COLOURS.primaryRim,
      lip: COLOURS.disabledFace,
      panel: COLOURS.cardFace,
      shade: COLOURS.primaryLip,
      shadow: COLOURS.ink,
      text: COLOURS.cream,
    },
    panel: PANEL,
    text: TEXT,
  };
}
