import { SCREEN } from "../../data/screen.ts";
import { NINE_SLICE_EDGES } from "./controls.ts";
import { VIEW_PROPERTIES } from "./css.ts";
import {
  type Insets,
  logicalView,
  NO_INSETS,
  safeInsets,
  type Side,
  type Size,
  viewScale,
} from "./playView.ts";

// The view-scale bridge: gives the DOM UI the canvas's scale s, as --ada-unit on the play area,
// with the safe insets and whole-pixel nine-slice edges, so DOM layout reads and writes logical
// px only. The play area is not transform-scaled: text stays crisp and hit testing native.

// Dispatched on window after the play area's view properties change, so fitted cards refit.
export const VIEW_SCALE_EVENT = "ada-view-scale";

const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

// What the DOM UI lays out against: s, the logical view, the safe insets in logical px and in CSS
// px, and each nine-slice edge in whole CSS px.
export interface PlayLayout {
  readonly cssInsets: Insets;
  readonly insets: Insets;
  readonly s: number;
  readonly slices: Readonly<Record<number, number>>;
  readonly view: Size;
}

// The safe-area insets still covering the play area: each frame inset less what the page frame's
// padding already keeps clear on that side, never negative.
export function uncoveredInsets(frameInsets: Insets, cleared: Insets): Insets {
  return {
    bottom: Math.max(0, frameInsets.bottom - cleared.bottom),
    left: Math.max(0, frameInsets.left - cleared.left),
    right: Math.max(0, frameInsets.right - cleared.right),
    top: Math.max(0, frameInsets.top - cleared.top),
  };
}

// The play layout for the canvas's CSS display size and the insets still covering it.
export function playLayout(cssSize: Size, cssInsets: Insets): PlayLayout {
  const s = viewScale(cssSize);
  return {
    cssInsets,
    insets: safeInsets(cssInsets, s),
    s,
    slices: Object.fromEntries(
      NINE_SLICE_EDGES.map((edge) => [edge, Math.max(1, Math.round(edge * s))]),
    ),
    view: logicalView(cssSize),
  };
}

// The custom properties that carry layout, by name.
export function viewProperties(layout: PlayLayout): readonly (readonly [string, string])[] {
  return [
    [VIEW_PROPERTIES.unit, String(layout.s)],
    ...SIDES.map((side) => [VIEW_PROPERTIES.safe(side), `${layout.cssInsets[side]}px`] as const),
    ...NINE_SLICE_EDGES.map(
      (edge) => [VIEW_PROPERTIES.slice(edge), `${layout.slices[edge]}px`] as const,
    ),
  ];
}

function paddingOf(element: Element): Insets {
  const style = getComputedStyle(element);
  return {
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
    top: parseFloat(style.paddingTop) || 0,
  };
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
  const probe = document.createElement("div");
  probe.className = "ada-safe-probe";
  probe.setAttribute("aria-hidden", "true");
  host.append(probe);
  let applied = "";
  let current = playLayout(SCREEN, NO_INSETS);
  const update = (): PlayLayout => {
    const size = { height: displaySize.height, width: displaySize.width };
    if (!(size.width > 0 && size.height > 0)) {
      return current;
    }
    const next = playLayout(size, uncoveredInsets(paddingOf(probe), paddingOf(document.body)));
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
  return { dispose: () => probe.remove(), update };
}
