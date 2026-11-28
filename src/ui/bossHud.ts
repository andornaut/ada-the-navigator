import type { CapitalBossHud } from "../data/capitalBosses.ts";
import { CONTENT } from "../data/content.ts";
import { CONVERSATION_BOX, SHIELD_PILL } from "../data/layout.ts";
import { TAB_COLOURS } from "./dialoguePortraits.ts";
import {
  COLOURS,
  font,
  fromHudEdge,
  hudCentreX,
  pixels,
  SPACING,
  TYPE,
  units,
} from "./layout/index.ts";
import { readViewUnit, VIEW_SCALE_EVENT } from "./layoutDom/index.ts";
import { STATUS_COLOURS } from "./statusPill.ts";

const { bar, bars } = SHIELD_PILL;
const { name, panel, tab } = CONVERSATION_BOX;
const SURRENDERED = "Surrendered";

export const BOSS_HUD_STYLE = `
.ada-controls .ada-boss-hud{
  position:absolute;
  top:${fromHudEdge("top")};
  --ada-boss-start:max(${fromHudEdge("left")},var(--ada-boss-left,0px));
  --ada-boss-end:max(${fromHudEdge("right")},var(--ada-boss-right,0px));
  --ada-boss-width:clamp(0px,100% - var(--ada-boss-start) - var(--ada-boss-end),${units(bars[2])});
  left:clamp(var(--ada-boss-start),${hudCentreX()} - var(--ada-boss-width) / 2,
    100% - var(--ada-boss-end) - var(--ada-boss-width));
  width:var(--ada-boss-width);
  pointer-events:none
}
.ada-controls .ada-boss-hud-heading{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:${units(SPACING.markGap)}
}
.ada-controls .ada-boss-hud-badge{
  position:relative;
  z-index:1;
  display:block;
  width:max-content;
  min-width:0;
  max-width:100%;
  box-sizing:border-box;
  height:${units(tab.height)};
  margin-bottom:${units(-tab.edge)};
  padding:0 ${units(tab.labelInset - tab.edge)};
  border:${units(tab.edge)} solid ${panel.ink};
  border-radius:${units(tab.radius)};
  background:${TAB_COLOURS.captainTally};
  color:${panel.ink};
  font:${font(name)};
  line-height:${units(tab.height - 2 * tab.edge)};
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis
}
.ada-controls .ada-boss-hud[data-compact] .ada-boss-hud-badge{
  font-size:${units(TYPE.count.size)}
}
.ada-controls .ada-boss-hud-status{
  font:${font(TYPE.count)};
  color:${COLOURS.cream};
  background:${COLOURS.ink};
  border-radius:${units(tab.radius)};
  padding-inline:${units(SPACING.markGap)};
  white-space:nowrap
}
.ada-controls .ada-boss-hud-meter{
  --shield-bar:100%;
  --shield-rim:${STATUS_COLOURS.rim};
  outline:${units(bar.rim)} solid ${COLOURS.ink}
}
.ada-controls .ada-boss-hud-track{
  position:absolute;
  inset:${units(bar.inset)}
}
.ada-controls .ada-boss-hud-fill{
  display:block;
  height:100%;
  background:${STATUS_COLOURS.low}
}
@media (forced-colors:active){
  .ada-controls .ada-boss-hud-meter{
    forced-color-adjust:none;
    --shield-rim:CanvasText;
    outline-color:CanvasText;
    background:Canvas
  }
  .ada-controls .ada-boss-hud-fill{background:Highlight}
}
`;

function setAttribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** Mount under the controls overlay so view scaling, modal dimming and cover are shared. */
export function createBossHud(parent: HTMLElement): {
  show(view: CapitalBossHud | null): void;
  dispose(): void;
} {
  const document = parent.ownerDocument;
  const root = document.createElement("div");
  root.className = "ada-boss-hud";
  root.hidden = true;

  const heading = document.createElement("div");
  heading.className = "ada-boss-hud-heading";
  const badge = document.createElement("span");
  badge.className = "ada-boss-hud-badge";
  const status = document.createElement("span");
  status.className = "ada-boss-hud-status";
  status.hidden = true;
  status.textContent = SURRENDERED;
  status.setAttribute("aria-hidden", "true");
  heading.append(badge, status);

  const meter = document.createElement("div");
  meter.className = "ada-status-bar ada-boss-hud-meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", "Hull");
  meter.setAttribute("aria-valuemin", "0");
  const fill = document.createElement("span");
  fill.className = "ada-boss-hud-fill";
  fill.setAttribute("aria-hidden", "true");
  const track = document.createElement("div");
  track.className = "ada-boss-hud-track";
  track.append(fill);
  meter.append(track);
  root.append(heading, meter);
  parent.append(root);

  const left = Array.from(parent.querySelectorAll<HTMLElement>(".ada-pause,.ada-status"));
  const weapons = parent.querySelector<HTMLElement>(".ada-weapon-selector");
  const fit = () => {
    if (root.hidden) {
      return;
    }
    const unit = readViewUnit(parent);
    const gap = SPACING.gap * unit;
    const width = parent.clientWidth;
    const leftEdge = Math.max(
      0,
      ...left
        .filter((node) => node.offsetWidth > 0)
        .map((node) => node.offsetLeft + node.offsetWidth + gap),
    );
    const rightEdge = weapons?.offsetWidth ? width - weapons.offsetLeft + gap : 0;
    root.toggleAttribute("data-compact", width - leftEdge - rightEdge < bars[1] * unit);
    root.style.setProperty("--ada-boss-left", pixels(leftEdge));
    root.style.setProperty("--ada-boss-right", pixels(rightEdge));
  };
  // Sibling sizes change when resources or owned weapons change. Hull updates keep the same slot.
  const size = new ResizeObserver(fit);
  for (const node of [parent, ...left, ...(weapons ? [weapons] : [])]) {
    size.observe(node);
  }
  const window = document.defaultView;
  window?.addEventListener(VIEW_SCALE_EVENT, fit);

  let disposed = false;
  let previousRatio = -1;
  return {
    dispose() {
      disposed = true;
      window?.removeEventListener(VIEW_SCALE_EVENT, fit);
      size.disconnect();
      root.remove();
    },
    show(view) {
      if (disposed) {
        return;
      }
      if (!view) {
        if (!root.hidden) {
          root.hidden = true;
          root.removeAttribute("data-boss-id");
        }
        return;
      }

      const max = Number.isFinite(view.maxHull) && view.maxHull > 0 ? view.maxHull : 1;
      const value = Number.isFinite(view.hull) ? Math.max(0, Math.min(max, view.hull)) : 0;
      const ratio = value / max;
      setAttribute(root, "data-boss-id", view.id);
      const label = view.captain || view.ship;
      if (badge.textContent !== label) {
        badge.textContent = label;
      }
      const surrendered = view.surrendered === true;
      status.hidden = !surrendered;
      const valueText = surrendered ? SURRENDERED : view.disabled && CONTENT.labels.disabledBanner;
      if (valueText) {
        setAttribute(meter, "aria-valuetext", valueText);
      } else if (meter.hasAttribute("aria-valuetext")) {
        meter.removeAttribute("aria-valuetext");
      }
      setAttribute(meter, "aria-valuemax", String(max));
      setAttribute(meter, "aria-valuenow", String(value));
      if (ratio !== previousRatio) {
        fill.style.width = `${ratio * 100}%`;
        previousRatio = ratio;
      }
      if (root.hidden) {
        root.hidden = false;
        fit();
      }
    },
  };
}
