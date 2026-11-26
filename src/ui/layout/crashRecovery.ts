import { BUTTON_GAP } from "@andornaut/game-kit/runtime/ui/spacing";

import { SPACING, TEXT_BUTTON } from "../../data/layout.ts";
import { UNLISTED_COLOURS } from "./colours.ts";
import { pixels } from "./css.ts";

// Fallbacks before the presenter sets the mounted panel's layout properties.
const CRASH_RECOVERY = {
  fallbackActionInset: 20,
  fallbackBodyGap: 24,
  fallbackPanelWidth: 328,
  shortViewportHeight: 400,
} as const;

export const CRASH_RECOVERY_STYLE = `
.crash > .crash-panel {
  max-width: var(--ada-crash-panel-width, ${pixels(CRASH_RECOVERY.fallbackPanelWidth)});
  min-width: 0;
}

.crash-panel > :is(.crash-body, .crash-details) {
  margin-bottom: var(--ada-crash-action-gap, ${pixels(CRASH_RECOVERY.fallbackBodyGap)});
}

.crash-panel .crash-stack {
  margin-bottom: 0;
}

/* Keep the empty live region available for the next Copy announcement. */
.crash-panel .crash-status:empty {
  min-height: 0;
  margin: 0;
}

@media (max-height: ${pixels(CRASH_RECOVERY.shortViewportHeight)}) {
  .crash > .crash-panel {
    padding-block: ${pixels(SPACING.pageInset)};
  }

  .crash-panel > :is(.crash-body, .crash-details) {
    margin-bottom: ${pixels(SPACING.gap)};
  }

  .crash-panel .crash-stack {
    box-sizing: content-box;
    max-height: 2lh;
  }
}

.crash-panel > .crash-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--ada-crash-action-gap, ${pixels(BUTTON_GAP)});
}

/* Specificity keeps the inline padding through the Kit's pressed padding shorthand. */
.crash-panel > button.crash-button,
.crash-panel > .crash-actions > button.crash-button {
  box-sizing: border-box;
  width: max-content;
  min-width: 0;
  max-width: 100%;
  min-height: var(--ada-crash-action-height, ${pixels(TEXT_BUTTON.height)});
  padding-inline: var(--ada-crash-action-inset, ${pixels(CRASH_RECOVERY.fallbackActionInset)});
  font-family: system-ui, sans-serif;
  font-size: var(--ada-crash-action-label, ${pixels(TEXT_BUTTON.label.size)});
  line-height: var(--ada-crash-action-line, normal);
  white-space: normal;
  overflow-wrap: anywhere;
}

.crash-panel > .crash-actions > .crash-button:not([data-ui-button-role="primary"]) {
  --crash-action-face: var(--ada-crash-secondary-face);
  --crash-action-text: var(--crash-ink);
  --crash-button-lip: var(--ada-crash-secondary-lip);
}

.crash-panel
  > .crash-details:not([open])
  + .crash-actions
  > .crash-button:not([data-ui-button-role="primary"]),
.crash-panel
  > .crash-actions
  > .crash-button:is([hidden], :disabled):not([data-ui-button-role="primary"]) {
  display: none;
}

.crash-panel
  .crash-button[data-ui-button-role="primary"]:is(:active, [data-ada-reload-pressed]):not(
    :disabled
  ) {
  background-color: var(--crash-text);
  color: var(--crash-ink);
}

@media (forced-colors: active) {
  .crash-panel
    .crash-button[data-ui-button-role="primary"]:is(:active, [data-ada-reload-pressed]):not(
      :disabled
    ) {
    forced-color-adjust: none;
    background-color: ButtonText;
    color: ButtonFace;
  }
}

/* Crash buttons darken on hover and draw at half opacity while disabled. */
button:hover:where(.crash-button) {
  background: ${UNLISTED_COLOURS.crashButtonHover};
}

button:disabled:where(.crash-button) {
  opacity: 0.5;
  cursor: default;
}
`;

export { CRASH_RECOVERY_STYLE as UI_STYLESHEET };
