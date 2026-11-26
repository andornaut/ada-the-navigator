import { CONVERSATION_BOX } from "../data/layout.ts";
import { visualNoticeTiming } from "../data/noticeTiming.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { ScanOutcome } from "../model/scanOutcomes.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { font, fromHudEdge, pixels, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { ITEM_NOTICE } from "./layout/itemNotice.ts";
import { scanFeedbackSlot } from "./layout/scanFeedback.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layout/viewScale.ts";
import { TEXT_TOKENS } from "./modal.ts";
import {
  type ScanFeedbackContent,
  type ScanFeedbackContext,
  scanFeedbackParts,
  ScanFeedbackQueue,
} from "./scanFeedback.ts";
import { STATUS_COLOURS } from "./statusPill.ts";

function createShortFlightPanel(parent: HTMLElement, className: string) {
  const panel = parent.ownerDocument.createElement("div");
  panel.className = `ada-item-notice-panel ${className}`;
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
  return panel;
}

/** Native receipt presentation shares the map glyph identity and read-only completion control. */
export function createScanFeedbackView(parent: HTMLElement, controls: HTMLElement) {
  const panel = createShortFlightPanel(parent, "ada-scan-feedback");
  const equip = createShortFlightPanel(parent, "ada-weapon-equip-notice");
  const safeWidth = `100% - ${fromHudEdge("left")} - ${fromHudEdge("right")}`;
  equip.style.maxWidth = `min(${units(CONVERSATION_BOX.maxWidth)}, ${safeWidth})`;
  equip.style.overflowWrap = "anywhere";
  let equipped: { elapsed: number; shownAt?: number } | undefined;
  let lineKey: string | undefined;
  let dialogue: HTMLElement | null = null;
  let equipNeedsFit = false;
  const { fadeMs, holdMs } = visualNoticeTiming("brief", "");
  const hide = (notice: HTMLElement) => {
    if (!notice.hidden) {
      notice.hidden = true;
      notice.style.display = "none";
    }
  };
  const clearEquip = () => {
    equipped = undefined;
    if (dialogue) {
      resize.unobserve(dialogue);
      dialogue = null;
    }
    lineKey = undefined;
    hide(equip);
    equip.textContent = "";
  };
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
    if (panel.hidden && equip.hidden) {
      return;
    }
    const unit = readViewUnit(parent);
    const bossBottom = boss?.offsetHeight ? boss.offsetTop + boss.offsetHeight : 0;
    if (!panel.hidden) {
      const width = parent.clientWidth;
      const slot = scanFeedbackSlot({
        bossBottom,
        leftEnd: Math.max(
          0,
          ...left
            .filter((node) => node.offsetWidth > 0)
            .map((node) => node.offsetLeft + node.offsetWidth),
        ),
        rightStart: weapons?.offsetWidth ? weapons.offsetLeft : width,
        unit,
        width,
      });
      if (panel.style.maxWidth !== slot.maxWidth) {
        panel.style.maxWidth = slot.maxWidth;
      }
      if (panel.style.top !== slot.top) {
        panel.style.top = slot.top;
      }
    }
    if (equipped && !equip.hidden) {
      const scanBottom = panel.hidden ? 0 : panel.offsetTop + panel.offsetHeight;
      const bottom = Math.max(bossBottom, scanBottom);
      // This HUD clearance includes the weapon ammo pills below their discs.
      const rowTop = fromHudEdge("top", CONVERSATION_BOX.top);
      const top = bottom > 0 ? `max(${rowTop}, ${pixels(bottom + SPACING.gap * unit)})` : rowTop;
      if (equip.style.top !== top) {
        equip.style.top = top;
      }
      let obscured = false;
      if (lineKey !== undefined) {
        if (!dialogue) {
          dialogue = parent.querySelector(".ada-conversation");
          if (dialogue) {
            resize.observe(dialogue);
          }
        }
        if (dialogue && !dialogue.hidden) {
          const notice = equip.getBoundingClientRect();
          const box = dialogue.getBoundingClientRect();
          if (
            notice.left < box.right &&
            notice.right > box.left &&
            notice.top < box.bottom &&
            notice.bottom > box.top
          ) {
            const area = parent.getBoundingClientRect();
            const bottomInset =
              parseFloat(getComputedStyle(parent).getPropertyValue(VIEW_PROPERTIES.areaBottom)) ||
              0;
            const below = box.bottom + SPACING.gap * unit;
            obscured = below + notice.height > area.bottom - bottomInset;
            if (!obscured) {
              equip.style.top = pixels(below - area.top);
            }
          }
        }
      }
      // Retain the box's dimensions for the next fit without painting or running its clock.
      equip.style.visibility = obscured ? "hidden" : "";
      if (obscured) {
        delete equipped.shownAt;
      }
      equipNeedsFit = false;
    }
  };
  const resize = new ResizeObserver(fit);
  for (const node of [parent, ...left, weapons, boss, panel, equip]) {
    if (node) {
      resize.observe(node);
    }
  }
  const window = parent.ownerDocument.defaultView;
  const fitScaledEquip = () => {
    if (!equip.hidden) {
      fit();
    }
  };
  window?.addEventListener(VIEW_SCALE_EVENT, fitScaledEquip);
  return {
    clearEquip,
    dispose(): void {
      window?.removeEventListener(VIEW_SCALE_EVENT, fitScaledEquip);
      resize.disconnect();
      queue.reset();
      panel.remove();
      equip.remove();
    },
    enqueue(outcomes: readonly ScanOutcome[]): void {
      queue.enqueue(outcomes);
    },
    equip(name: string): void {
      equipped = { elapsed: 0 };
      equipNeedsFit = true;
      equip.textContent = name;
    },
    render(context: ScanFeedbackContext, milliseconds: number): void {
      const frame = queue.frame(context, milliseconds);
      if (!frame) {
        hide(panel);
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
    renderEquip(covered: boolean, time: number, nextLine?: string): void {
      if (!equipped) {
        return;
      }
      if (covered) {
        delete equipped.shownAt;
        hide(equip);
        return;
      }
      if (equip.hidden) {
        equip.hidden = false;
        equip.style.display = "flex";
        equipNeedsFit = true;
      }
      if (equipNeedsFit || nextLine !== lineKey) {
        lineKey = nextLine;
        fit();
      }
      if (equip.style.visibility === "hidden") {
        return;
      }
      if (equipped.shownAt !== undefined) {
        equipped.elapsed += Math.max(0, time - equipped.shownAt);
      }
      equipped.shownAt = time;
      if (equipped.elapsed >= holdMs + fadeMs) {
        clearEquip();
        return;
      }
      const nextOpacity = String(1 - Math.max(0, equipped.elapsed - holdMs) / fadeMs);
      if (equip.style.opacity !== nextOpacity) {
        equip.style.opacity = nextOpacity;
      }
    },
    reset(): void {
      queue.reset();
      clearEquip();
      panel.hidden = true;
      panel.style.display = "none";
      panel.replaceChildren();
      current = undefined;
    },
  };
}
