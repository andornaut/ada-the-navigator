import { CONVERSATION_BOX } from "../data/layout.ts";
import { visualNoticeTiming } from "../data/noticeTiming.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import type { ScanOutcome } from "../model/scanOutcomes.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import { font, fromHudEdge, pixels, units, VIEW_PROPERTIES } from "./layout/css.ts";
import { frameRect, turnOf } from "./layout/frameBox.ts";
import { ITEM_NOTICE } from "./layout/itemNotice.ts";
import { scanFeedbackTop } from "./layout/scanFeedback.ts";
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
  const safeWidth = `100% - 2 * max(${fromHudEdge("left")}, ${fromHudEdge("right")})`;
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
    maxWidth: `min(${units(CONVERSATION_BOX.maxWidth)}, ${safeWidth})`,
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
  const observedWeapons = new Set<HTMLElement>();
  const fit = (): void => {
    if (panel.hidden && equip.hidden) {
      return;
    }
    const unit = readViewUnit(parent);
    const hudGap = SPACING.rowGap * unit;
    const stackGap = SPACING.gap * unit;
    const host = parent.getBoundingClientRect();
    const turn = turnOf(parent);
    const box = (node: Element) => frameRect(turn, host, node.getBoundingClientRect());
    const weaponParts = new Set(
      weapons?.querySelectorAll<HTMLElement>(".ada-disc,.ada-ammo,.ada-pips"),
    );
    for (const node of observedWeapons) {
      if (!weaponParts.has(node)) {
        resize.unobserve(node);
        observedWeapons.delete(node);
      }
    }
    for (const node of weaponParts) {
      if (!observedWeapons.has(node)) {
        resize.observe(node);
        observedWeapons.add(node);
      }
    }
    const occupied = [...left, ...weaponParts]
      .map(box)
      .filter(({ height, width }) => width > 0 && height > 0)
      .sort((a, b) => a.y - b.y);
    const style = getComputedStyle(parent);
    const inset = (property: string) => parseFloat(style.getPropertyValue(property)) || 0;
    const center = (turn ? host.height : host.width) / 2;
    let minimum = Math.max(
      inset(VIEW_PROPERTIES.areaTop) + hudGap,
      inset(VIEW_PROPERTIES.safe("top")),
    );
    if (boss) {
      const bar = box(boss);
      if (bar.height > 0) {
        minimum = Math.max(minimum, bar.y + bar.height + stackGap);
      }
    }
    const place = (notice: HTMLElement, top: number) => {
      const value = pixels(top);
      if (notice.style.top !== value) {
        notice.style.top = value;
      }
    };
    if (!panel.hidden) {
      const size = box(panel);
      const top = scanFeedbackTop(occupied, hudGap, center, size, minimum);
      place(panel, top);
      minimum = top + size.height + stackGap;
    }
    if (equipped && !equip.hidden) {
      const size = box(equip);
      let top = scanFeedbackTop(occupied, hudGap, center, size, minimum);
      let obscured = false;
      if (lineKey !== undefined) {
        if (!dialogue) {
          dialogue = parent.querySelector(".ada-conversation");
          if (dialogue) {
            resize.observe(dialogue);
          }
        }
        if (dialogue && !dialogue.hidden) {
          // Dialogue owns its slot. An overlapping equip notice waits below it or pauses.
          const line = box(dialogue);
          const bottom = line.y + line.height;
          if (line.height > 0 && top < bottom && top + size.height > line.y) {
            top = scanFeedbackTop(occupied, hudGap, center, size, bottom + stackGap);
            const limit =
              (turn ? host.width : host.height) -
              Math.max(inset(VIEW_PROPERTIES.areaBottom), inset(VIEW_PROPERTIES.safe("bottom")));
            obscured = top + size.height > limit;
          }
        }
      }
      place(equip, top);
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
  window?.addEventListener(VIEW_SCALE_EVENT, fit);
  return {
    clearEquip,
    dispose(): void {
      window?.removeEventListener(VIEW_SCALE_EVENT, fit);
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
        const wasVisible = !panel.hidden;
        hide(panel);
        if (wasVisible) {
          fit();
        }
        return;
      }
      const changed = frame.content !== current;
      content(frame.content);
      if (panel.hidden) {
        panel.hidden = false;
        panel.style.display = "flex";
        fit();
      } else if (changed) {
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
