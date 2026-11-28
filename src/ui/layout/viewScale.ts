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
    bottom: layout.view.height - hud.y - hud.height,
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
    [VIEW_PROPERTIES.areaTop, `${area.y * layout.s}px`],
  ];
}
