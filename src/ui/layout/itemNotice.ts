import { PILL } from "./controls.ts";
import { SPACING } from "./tokens.ts";

// The item notice's chip (art/layout.md "Item notice"), in logical px from the HUD rect's top-left
// corner: 24 high, its top HUD rect top + 34.5 (SPACING.rowGap below the status pill), opaque ink
// with a 1 rim inside the edge, holding the 20 icon PILL.padding in, a mark gap, then the label
// and PILL.padding. It centres across on where its gain lands, clamped between the pill's left
// edge and SPACING.pageInset left of the leftmost weapon target.
export const ITEM_NOTICE = {
  /** The appear's start offset: out from under the pill. */
  appearDrop: -8,
  /** The fly's control point lies this far below its start. */
  flyDip: 6,
  height: 24,
  icon: 20,
  markGap: SPACING.markGap,
  padding: PILL.padding,
  radius: PILL.radius,
  rim: 1,
  /** A holodisk's notice rises this far as it fades in place. */
  rise: 4,
  /** The collapsed square round the icon. */
  square: 24,
  top: 34.5,
} as const;

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
