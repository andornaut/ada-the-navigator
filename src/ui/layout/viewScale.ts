import { SCREEN } from "../../data/screen.ts";
import { WHOLE_PX_EDGES } from "./controls.ts";
import { HUD_SIDES, type HudSide, VIEW_PROPERTIES } from "./css.ts";
import {
  hudRect,
  type Insets,
  logicalView,
  NO_INSETS,
  playView,
  type Side,
  type Size,
  viewScale,
} from "./playView.ts";

// The view-scale bridge: gives the DOM UI the canvas's scale s, as --ada-unit on the play area,
// with full-viewport bounds and whole-pixel nine-slice edges, so DOM layout reads and writes logical
// px only. The play area is not transform-scaled: text stays crisp and hit testing native.

// Dispatched on window after the play area's view properties change, so fitted cards refit.
export const VIEW_SCALE_EVENT = "ada-view-scale";

const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

// Hardware insets are zero in logical and CSS px; normal layout margins remain separate.
export interface PlayLayout {
  readonly cssInsets: Insets;
  readonly insets: Insets;
  readonly s: number;
  readonly slices: Readonly<Record<number, number>>;
  readonly view: Size;
}

// The play layout uses the complete canvas CSS display size, including notch-covered areas.
export function playLayout(cssSize: Size): PlayLayout {
  const s = viewScale(cssSize);
  return {
    cssInsets: NO_INSETS,
    insets: NO_INSETS,
    s,
    slices: Object.fromEntries(
      WHOLE_PX_EDGES.map((edge) => [edge, Math.max(1, Math.round(edge * s))]),
    ),
    view: logicalView(cssSize),
  };
}

// The custom properties that carry layout, by name.
export function viewProperties(layout: PlayLayout): readonly (readonly [string, string])[] {
  const hud = hudRect(layout.insets, layout.view);
  const hudEdges: Readonly<Record<HudSide, number>> = {
    left: hud.x,
    right: layout.view.width - hud.x - hud.width,
    top: hud.y,
  };
  const area = playView(layout.view);
  const areaBottom = Math.max(0, layout.view.height - area.y - area.height);
  return [
    [VIEW_PROPERTIES.unit, String(layout.s)],
    ...HUD_SIDES.map(
      (side) => [VIEW_PROPERTIES.hud(side), `${hudEdges[side] * layout.s}px`] as const,
    ),
    ...SIDES.map((side) => [VIEW_PROPERTIES.safe(side), `${layout.cssInsets[side]}px`] as const),
    ...WHOLE_PX_EDGES.map(
      (edge) => [VIEW_PROPERTIES.slice(edge), `${layout.slices[edge]}px`] as const,
    ),
    [VIEW_PROPERTIES.areaBottom, `${areaBottom * layout.s}px`],
    [VIEW_PROPERTIES.areaLeft, `${area.x * layout.s}px`],
  ];
}

// The scale s in effect at element; 1 before the bridge has measured.
export function readViewUnit(element: Element): number {
  const value = parseFloat(getComputedStyle(element).getPropertyValue(VIEW_PROPERTIES.unit));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

// Keeps host's view properties current from the canvas's display size (Phaser's scale manager
// displaySize, its CSS box). update measures and applies, writing only on a change; call it
// before each frame draws. It returns the layout in effect.
export function createViewScaleBridge(
  host: HTMLElement,
  displaySize: Size,
): { readonly dispose: () => void; readonly update: () => PlayLayout } {
  let applied = "";
  let current = playLayout(SCREEN);
  const update = (): PlayLayout => {
    const size = { height: displaySize.height, width: displaySize.width };
    if (!(size.width > 0 && size.height > 0)) {
      return current;
    }
    const next = playLayout(size);
    const properties = viewProperties(next);
    const key = properties.map(([, value]) => value).join();
    current = next;
    if (key !== applied) {
      applied = key;
      for (const [name, value] of properties) {
        host.style.setProperty(name, value);
      }
      window.dispatchEvent(new Event(VIEW_SCALE_EVENT));
    }
    return current;
  };
  return { dispose: () => {}, update };
}
