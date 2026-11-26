import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { ScanOutcome } from "../model/scanOutcomes.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { font, units } from "./layout/css.ts";
import { ITEM_NOTICE } from "./layout/itemNotice.ts";
import { scanFeedbackSlot } from "./layout/scanFeedback.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";
import {
  type ScanFeedbackContent,
  type ScanFeedbackContext,
  scanFeedbackParts,
  ScanFeedbackQueue,
} from "./scanFeedback.ts";
import { STATUS_COLOURS } from "./statusPill.ts";
/** Native receipt presentation shares the map glyph identity and read-only completion control. */
export function createScanFeedbackView(parent: HTMLElement, controls: HTMLElement) {
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
    left: "50%",
    padding: units(ITEM_NOTICE.padding),
    pointerEvents: "none",
    position: "absolute",
    transform: "translateX(-50%)",
    width: "max-content",
    zIndex: "1",
  });
  panel.style.setProperty("--notice-accent", STATUS_COLOURS.count);
  parent.append(panel);
  const queue = new ScanFeedbackQueue();
  let current: ScanFeedbackContent | undefined;
  let opacity = "";
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
          mask: `url('${uiIconUrl(part.glyph)}') center / contain no-repeat`,
          width: units(ITEM_NOTICE.icon),
        });
        panel.append(icon);
      }
    }
  };
  const left = Array.from(controls.querySelectorAll<HTMLElement>(".ada-pause,.ada-status"));
  const weapons = controls.querySelector<HTMLElement>(".ada-weapon-selector");
  const boss = controls.querySelector<HTMLElement>(".ada-boss-hud");
  const fit = (): void => {
    if (panel.hidden) {
      return;
    }
    const width = parent.clientWidth;
    const slot = scanFeedbackSlot({
      bossBottom: boss?.offsetHeight ? boss.offsetTop + boss.offsetHeight : 0,
      leftEnd: Math.max(
        0,
        ...left
          .filter((node) => node.offsetWidth > 0)
          .map((node) => node.offsetLeft + node.offsetWidth),
      ),
      rightStart: weapons?.offsetWidth ? weapons.offsetLeft : width,
      unit: readViewUnit(parent),
      width,
    });
    if (panel.style.maxWidth !== slot.maxWidth) {
      panel.style.maxWidth = slot.maxWidth;
    }
    if (panel.style.top !== slot.top) {
      panel.style.top = slot.top;
    }
  };
  const resize = new ResizeObserver(fit);
  for (const node of [parent, ...left, weapons, boss]) {
    if (node) {
      resize.observe(node);
    }
  }
  return {
    dispose(): void {
      resize.disconnect();
      queue.reset();
      panel.remove();
    },
    enqueue(outcomes: readonly ScanOutcome[]): void {
      queue.enqueue(outcomes);
    },
    render(context: ScanFeedbackContext, milliseconds: number): void {
      const frame = queue.frame(context, milliseconds);
      if (!frame) {
        if (!panel.hidden) {
          panel.hidden = true;
          panel.style.display = "none";
        }
        return;
      }
      content(frame.content);
      if (panel.hidden) {
        panel.hidden = false;
        panel.style.display = "flex";
        fit();
      }
      const nextOpacity = String(frame.opacity);
      if (opacity !== nextOpacity) {
        opacity = nextOpacity;
        panel.style.opacity = opacity;
      }
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
