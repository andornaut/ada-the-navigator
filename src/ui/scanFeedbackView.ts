import { CONVERSATION_BOX, SHIELD_PILL } from "../data/layout.ts";
import { visualNoticeTiming } from "../data/noticeTiming.ts";
import type { Weapon } from "../data/types.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { weaponGlyphPath } from "../data/weaponGlyphs.ts";
import type { ScanOutcome } from "../model/scanOutcomes.ts";
import { createCompletionIndicator } from "./completionIndicator.ts";
import {
  font,
  fromHudEdge,
  ITEM_NOTICE,
  pixels,
  shortNoticeWidth,
  SPACING,
  TYPE,
  units,
  VIEW_PROPERTIES,
} from "./layout/index.ts";
import { measureFrame, readViewUnit, VIEW_SCALE_EVENT } from "./layoutDom/index.ts";
import { TEXT_TOKENS } from "./modal.ts";
import {
  type ScanFeedbackContent,
  type ScanFeedbackContext,
  scanFeedbackParts,
  ScanFeedbackQueue,
} from "./scanFeedback.ts";
import { STATUS_COLOURS } from "./statusPill.ts";

const SAFE_NOTICE_WIDTH = `100% - 2 * max(${fromHudEdge("left")}, ${fromHudEdge("right")})`;

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
    maxWidth: `min(${units(CONVERSATION_BOX.maxWidth)}, ${SAFE_NOTICE_WIDTH})`,
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
  const icon = () => {
    const node = parent.ownerDocument.createElement("span");
    node.setAttribute("aria-hidden", "true");
    Object.assign(node.style, {
      background: "currentColor",
      flex: "none",
      height: units(ITEM_NOTICE.icon),
      width: units(ITEM_NOTICE.icon),
    });
    return node;
  };
  const equipIcon = icon();
  const equipLabel = parent.ownerDocument.createElement("span");
  equipLabel.style.minWidth = "0";
  equip.append(equipIcon, equipLabel);
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
    const wasVisible = !equip.hidden;
    equipped = undefined;
    if (dialogue) {
      resize.unobserve(dialogue);
      dialogue = null;
    }
    lineKey = undefined;
    hide(equip);
    equipLabel.textContent = "";
    if (wasVisible) {
      fit();
    }
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
        const glyph = icon();
        glyph.dataset.part = part.kind;
        glyph.style.mask = `url('${uiIconUrl(part.glyph)}') center / contain no-repeat`;
        panel.append(glyph);
      }
    }
  };
  const shield = controls.querySelector<HTMLElement>(".ada-shield");
  const touch = Array.from(
    controls.querySelectorAll<HTMLElement>('[data-control$="-joystick"],.ada-use'),
  );
  const fit = (): void => {
    if (panel.hidden && equip.hidden) {
      return;
    }
    const unit = readViewUnit(parent);
    const stackGap = SPACING.gap * unit;
    const { box, size: host } = measureFrame(parent);
    const style = getComputedStyle(parent);
    const inset = (property: string) => parseFloat(style.getPropertyValue(property)) || 0;
    const top =
      (host.height + inset(VIEW_PROPERTIES.areaTop) - inset(VIEW_PROPERTIES.areaBottom)) / 2;
    const shieldBox = shield && box(shield);
    const reservedTop =
      host.height - inset(VIEW_PROPERTIES.hud("bottom")) - SHIELD_PILL.pill.height * unit;
    let bottom = Math.floor(
      Math.min(reservedTop, shieldBox?.height ? shieldBox.y : reservedTop) - stackGap,
    );
    const width = shortNoticeWidth(touch.map(box), {
      bottom,
      center: host.width / 2,
      gap: SPACING.rowGap * unit,
      top,
    });
    const maxWidth = `min(${units(CONVERSATION_BOX.maxWidth)}, ${SAFE_NOTICE_WIDTH}, ${pixels(width)})`;
    for (const notice of [panel, equip]) {
      if (notice.style.maxWidth !== maxWidth) {
        notice.style.maxWidth = maxWidth;
      }
    }
    const place = (notice: HTMLElement, top: number) => {
      const value = pixels(top);
      if (notice.style.top !== value) {
        notice.style.top = value;
      }
    };
    if (equipped && !equip.hidden) {
      const size = box(equip);
      const equipTop = bottom - size.height;
      const scanSpace = panel.hidden ? 0 : stackGap + box(panel).height;
      let obscured = equipTop - scanSpace < top;
      if (lineKey !== undefined) {
        if (!dialogue) {
          dialogue = parent.querySelector(".ada-conversation");
          if (dialogue) {
            resize.observe(dialogue);
          }
        }
        if (dialogue && !dialogue.hidden) {
          // Keep the lower slot stable and let dialogue take priority where they meet.
          const line = box(dialogue);
          obscured ||= line.height > 0 && equipTop < line.y + line.height && bottom > line.y;
        }
      }
      place(equip, equipTop);
      // Retain the box's dimensions for the next fit without painting or running its clock.
      equip.style.visibility = obscured ? "hidden" : "";
      if (obscured) {
        delete equipped.shownAt;
      } else {
        bottom = equipTop - stackGap;
      }
      equipNeedsFit = false;
    }
    if (!panel.hidden) {
      place(panel, bottom - box(panel).height);
    }
  };
  const resize = new ResizeObserver(fit);
  for (const node of [parent, shield, ...touch, panel, equip]) {
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
    equip(weapon: Weapon, name: string): void {
      equipped = { elapsed: 0 };
      equipNeedsFit = true;
      equipIcon.style.mask = `url('${weaponGlyphPath(weapon)}') center / contain no-repeat`;
      equipLabel.textContent = name;
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
        const wasVisible = !equip.hidden;
        hide(equip);
        if (wasVisible) {
          fit();
        }
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
      panel.hidden = true;
      panel.style.display = "none";
      panel.replaceChildren();
      current = undefined;
      clearEquip();
    },
  };
}
