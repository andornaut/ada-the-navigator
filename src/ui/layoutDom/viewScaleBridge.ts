import { SCREEN } from "../../data/screen.ts";
import { VIEW_PROPERTIES } from "../layout/css.ts";
import type { Size } from "../layout/playView.ts";
import {
  type PlayLayout,
  playLayout,
  VIEW_SCALE_EVENT,
  viewProperties,
} from "../layout/viewScale.ts";

export { type PlayLayout, VIEW_SCALE_EVENT } from "../layout/viewScale.ts";

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
