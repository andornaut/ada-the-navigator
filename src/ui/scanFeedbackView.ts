import type { Rect } from "@andornaut/game-kit/runtime/rect";

import type { ScanOutcome } from "../model/scanOutcomes.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { font, fromAreaLeft, units } from "./layout/css.ts";
import { ITEM_NOTICE } from "./layout/itemNotice.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { markerFootprints } from "./markerFootprints.ts";
import { TEXT_TOKENS } from "./modal.ts";
import {
  type ScanFeedbackContent,
  type ScanFeedbackContext,
  scanFeedbackParts,
  ScanFeedbackQueue,
} from "./scanFeedback.ts";
import { STATUS_COLOURS } from "./statusPill.ts";
/** Keep canonical HUD footprints; the conversation paints over the receipt instead of displacing it. */
export function scanFeedbackFootprints(doc: Document, host: HTMLElement | null): Rect[] {
  const querySelectorAll = ((selectors: string) =>
    doc.querySelectorAll(
      selectors
        .split(",")
        .map((selector) => `${selector}:not(.ada-conversation, .ada-conversation *)`)
        .join(","),
    )) as Document["querySelectorAll"];
  return markerFootprints({ querySelectorAll }, host);
}
/** Native receipt presentation shares the map glyph identity and read-only completion control. */
export function createScanFeedbackView(parent: HTMLElement) {
  const panel = parent.ownerDocument.createElement("div");
  panel.className = "ada-item-notice-panel ada-scan-feedback";
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.setAttribute("aria-atomic", "true");
  Object.assign(panel.style, {
    alignItems: "center",
    backgroundColor: TEXT_TOKENS.buttonLabel,
    border: `${units(ITEM_NOTICE.rim)} solid var(--notice-accent)`,
    borderRadius: units(ITEM_NOTICE.radius),
    boxSizing: "border-box",
    color: STATUS_COLOURS.count,
    display: "none",
    font: font(TYPE.body),
    gap: units(SPACING.markGap),
    height: "auto",
    padding: units(ITEM_NOTICE.padding),
    pointerEvents: "none",
    position: "absolute",
    zIndex: "1",
  });
  panel.style.setProperty("--notice-accent", STATUS_COLOURS.count);
  parent.append(panel);
  const queue = new ScanFeedbackQueue();
  let current: ScanFeedbackContent | undefined;
  const content = (value: ScanFeedbackContent): void => {
    if (value === current) {
      return;
    }
    current = value;
    panel.dataset.kind = value.kind;
    panel.dataset.targetId = value.outcome.targetId;
    panel.replaceChildren();
    for (const part of scanFeedbackParts(value)) {
      if (part.kind === "checkbox") {
        panel.append(createCompletionIndicator(part.label, part.checked));
      } else if (part.kind === "text") {
        const text = parent.ownerDocument.createElement("span");
        text.textContent = part.text;
        text.style.overflowWrap = "anywhere";
        text.style.minWidth = "0";
        panel.append(text);
      } else if (part.glyph) {
        const icon = parent.ownerDocument.createElement("span");
        icon.dataset.part = part.kind;
        icon.setAttribute("aria-hidden", "true");
        Object.assign(icon.style, {
          background: "currentColor",
          flex: "none",
          height: units(ITEM_NOTICE.icon),
          mask: `url('/art/ui/icons/${part.glyph}.svg') center / contain no-repeat`,
          width: units(ITEM_NOTICE.icon),
        });
        panel.append(icon);
      }
    }
  };
  const measure = (value: ScanFeedbackContent, area: Rect) => {
    panel.style.visibility = "hidden";
    panel.hidden = false;
    content(value);
    panel.style.display = "flex";
    panel.style.width = "max-content";
    panel.style.maxWidth = units(area.width);
    panel.style.height = "auto";
    const bounds = panel.getBoundingClientRect();
    const unit = readViewUnit(parent);
    return { height: bounds.height / unit, width: bounds.width / unit };
  };
  return {
    dispose(): void {
      queue.reset();
      panel.remove();
    },
    enqueue(outcomes: readonly ScanOutcome[]): void {
      queue.enqueue(outcomes);
    },
    render(context: Omit<ScanFeedbackContext, "measure">, milliseconds: number): void {
      const frame = queue.frame(
        { ...context, measure: (value) => measure(value, context.area) },
        milliseconds,
      );
      panel.hidden = frame === null;
      panel.style.display = frame ? "flex" : "none";
      if (!frame) {
        return;
      }
      Object.assign(panel.style, {
        height: units(frame.rect.height),
        left: fromAreaLeft(frame.rect.x),
        opacity: String(frame.opacity),
        top: units(frame.rect.y),
        visibility: "visible",
        width: units(frame.rect.width),
      });
    },
    reset(): void {
      queue.reset();
      panel.hidden = true;
      panel.style.display = "none";
      panel.replaceChildren();
      current = undefined;
    },
  };
}
