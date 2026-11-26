import { CONTENT } from "../data/content.ts";
import { CONVERSATION_BOX, SHIELD_PILL } from "../data/layout.ts";
import { COLOURS } from "./layout/colours.ts";
import { font, fromHudEdge, units } from "./layout/css.ts";
import { SPACING, TYPE } from "./layout/tokens.ts";

export interface BossHudView {
  readonly id: string;
  readonly ship: string;
  readonly captain: string;
  readonly hull: number;
  readonly maxHull: number;
  readonly disabled: boolean;
}

// The longest ship and captain pair still fits on one line with Disabled.
const MAX_WIDTH = 384;
// Reserve the conversation slot throughout the fight. Compact vertical padding leaves room
// above Ada's highest hull pixels in the 360-unit play area.
const TOP = CONVERSATION_BOX.top + CONVERSATION_BOX.height + SHIELD_PILL.bar.inset;

export const BOSS_HUD_STYLE = `
.ada-controls .ada-boss-hud{
  position:absolute;
  top:${fromHudEdge("top", TOP)};
  left:${fromHudEdge("left")};
  right:${fromHudEdge("right")};
  box-sizing:border-box;
  max-width:${units(MAX_WIDTH)};
  margin-inline:auto;
  padding:${units(SHIELD_PILL.bar.rim)} ${units(SPACING.gap)};
  background:${COLOURS.navy};
  color:${COLOURS.cream};
  font:${font(TYPE.label)};
  text-align:center;
  pointer-events:none
}
.ada-boss-hud-names{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  column-gap:${units(SPACING.gap)};
  overflow-wrap:anywhere
}
.ada-boss-hud-captain{
  color:${COLOURS.supporting};
  font:${font(TYPE.body)}
}
.ada-boss-hud-meter{
  height:${units(SPACING.rowGap)};
  margin-top:${units(SHIELD_PILL.bar.rim)};
  background:${COLOURS.ink}
}
.ada-boss-hud-fill{
  display:block;
  height:100%;
  background:${COLOURS.refusalRed}
}
@media (forced-colors:active){
  .ada-boss-hud-meter{
    forced-color-adjust:none;
    background:Canvas;
    box-shadow:inset 0 0 0 ${units(SHIELD_PILL.bar.rim)} CanvasText
  }
  .ada-boss-hud-fill{background:Highlight}
}
`;

function setAttribute(element: HTMLElement, name: string, value: string): void {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** Mount under the controls overlay so view scaling, modal dimming and cover are shared. */
export function createBossHud(parent: HTMLElement): {
  show(view: BossHudView | null): void;
  dispose(): void;
} {
  const document = parent.ownerDocument;
  const root = document.createElement("div");
  root.className = "ada-boss-hud";
  root.hidden = true;

  const names = document.createElement("div");
  names.className = "ada-boss-hud-names";
  const ship = document.createElement("span");
  const captain = document.createElement("span");
  captain.className = "ada-boss-hud-captain";
  const disabled = document.createElement("span");
  disabled.textContent = CONTENT.labels.disabledBanner ?? "";
  disabled.hidden = true;
  names.append(ship, captain, disabled);

  const meter = document.createElement("div");
  meter.className = "ada-boss-hud-meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", "Hull");
  meter.setAttribute("aria-valuemin", "0");
  const fill = document.createElement("span");
  fill.className = "ada-boss-hud-fill";
  fill.setAttribute("aria-hidden", "true");
  meter.append(fill);
  root.append(names, meter);
  parent.append(root);

  let disposed = false;
  let previousRatio = -1;
  return {
    dispose() {
      disposed = true;
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
      if (ship.textContent !== view.ship) {
        ship.textContent = view.ship;
      }
      if (captain.textContent !== view.captain) {
        captain.textContent = view.captain;
      }
      if (disabled.hidden === view.disabled) {
        disabled.hidden = !view.disabled;
      }
      setAttribute(meter, "aria-valuemax", String(max));
      setAttribute(meter, "aria-valuenow", String(value));
      if (ratio !== previousRatio) {
        fill.style.width = `${ratio * 100}%`;
        previousRatio = ratio;
      }
      if (root.hidden) {
        root.hidden = false;
      }
    },
  };
}
