import { ITEM_NOTICE } from "../../data/layout.ts";
export { ITEM_NOTICE } from "../../data/layout.ts";

/** The chip's width for a label: padding, the icon and its mark gap, the label and padding. */
export function chipWidth(label: number): number {
  return 2 * ITEM_NOTICE.padding + ITEM_NOTICE.icon + ITEM_NOTICE.markGap + label;
}

/**
 * The chip's left edge: centred on the destination's centre across, then clamped so its left edge
 * is at least the pill's and its right edge at most `right`.
 */
export function chipLeft(centre: number, width: number, pillLeft: number, right: number): number {
  return Math.max(pillLeft, Math.min(centre - width / 2, right - width));
}

/** A point on the fly's quadratic curve from `from`, through (to.x, from.y + flyDip), to `to`. */
export function flyPoint(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  t: number,
): { readonly x: number; readonly y: number } {
  const control = { x: to.x, y: from.y + ITEM_NOTICE.flyDip };
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return {
    x: a * from.x + b * control.x + c * to.x,
    y: a * from.y + b * control.y + c * to.y,
  };
}
