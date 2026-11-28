import { FRAME_LINE } from "./layout/dom.ts";
import { COLOURS, units } from "./layout/index.ts";
import { UI_SCOPE } from "./modal.ts";
import { STATUS_COLOURS } from "./statusPill.ts";

export const COMPLETION_INDICATOR = {
  complete: STATUS_COLOURS.tick,
  incomplete: STATUS_COLOURS.shield,
  size: 16,
} as const;

export const COMPLETION_INDICATOR_STYLE = `
${UI_SCOPE} .ada-completion{
  display:inline-grid;
  place-items:center;
  box-sizing:border-box;
  flex:none;
  width:${units(COMPLETION_INDICATOR.size)};
  height:${units(COMPLETION_INDICATOR.size)};
  border:${units(FRAME_LINE)} solid ${COMPLETION_INDICATOR.incomplete};
  background:transparent;
  color:${COLOURS.ink};
  font:bold ${units(COMPLETION_INDICATOR.size)} / 1 sans-serif
}
${UI_SCOPE} .ada-completion[aria-checked=true]{
  border-color:${COMPLETION_INDICATOR.complete};
  background:${COMPLETION_INDICATOR.complete}
}
`;

/** Read-only completion, distinct from an interactive switch or selection control. */
export function createCompletionIndicator(label: string, complete: boolean): HTMLElement {
  const indicator = document.createElement("span");
  indicator.className = "ada-completion";
  indicator.setAttribute("role", "checkbox");
  indicator.setAttribute("aria-label", label);
  indicator.setAttribute("aria-checked", String(complete));
  indicator.setAttribute("aria-disabled", "true");
  indicator.textContent = complete ? "✓" : "";
  return indicator;
}
