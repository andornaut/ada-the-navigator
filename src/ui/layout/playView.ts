import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { PILL, TEXT_BUTTON } from "./controls.ts";
import { HIT_RULE, hitAround } from "./hitAreas.ts";
import { SPACING } from "./tokens.ts";

// The logical view, its scale and the safe-margin clamp (art/layout.md "Coordinates and scale"
// and "Page bounds"), and the HUD's anchors ("HUD and overlays"). The canvas draws the logical
// view at device pixels (src/game/play-camera.ts); the DOM overlay carries the same scale s as
// --ada-unit (viewScale.ts).

export interface Size {
  readonly height: number;
  readonly width: number;
}

export interface Insets {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export type Side = keyof Insets;

export const NO_INSETS: Insets = { bottom: 0, left: 0, right: 0, top: 0 };

// s: CSS px per logical px, the largest scale that fits the 720x360 base view in the CSS box.
export function viewScale(cssSize: Size): number {
  return Math.min(cssSize.width / SCREEN.width, cssSize.height / SCREEN.height);
}

// The logical view: the CSS box at s, at least 720x360, one axis wider with the aspect.
export function logicalView(cssSize: Size): Size {
  const s = viewScale(cssSize);
  return { height: cssSize.height / s, width: cssSize.width / s };
}

// The safe-area insets, in logical px, from CSS px insets at scale s.
export function safeInsets(cssInsets: Insets, s: number): Insets {
  return {
    bottom: cssInsets.bottom / s,
    left: cssInsets.left / s,
    right: cssInsets.right / s,
    top: cssInsets.top / s,
  };
}

// The shared safe-margin clamp: view with each edge moved in by max(margin, inset).
export function safeRect(insets: Insets, margin: number, view: Size): Rect {
  const left = Math.max(margin, insets.left);
  const top = Math.max(margin, insets.top);
  return {
    height: view.height - top - Math.max(margin, insets.bottom),
    width: view.width - left - Math.max(margin, insets.right),
    x: left,
    y: top,
  };
}

// HUD controls' safe-rect margin, and the gap between HUD buttons.
export const CONTROL_EDGE = 8;

// The HUD edge: from the game area's top and side edges to the drawn art (never a press area) of
// the outermost element on each top corner, the same on both sides and the top, as in Chibi.
export const HUD_EDGE = 12;

// Margins of the safe rects: the bare safe edge (the shield bar and the sticks' bottom); HUD
// controls; modals and page content.
export const SAFE_MARGIN = { edge: 0, hud: CONTROL_EDGE, page: SPACING.pageInset } as const;

// Chibi's play view, the game area: the 720x360 base view centred across the logical view, at
// its top. The camera draws only it; screens of other aspects show bands outside it, and every
// control sits inside it.
export function playView(view: Size): Rect {
  return {
    height: SCREEN.height,
    width: SCREEN.width,
    x: Math.floor((Math.floor(view.width) - SCREEN.width) / 2),
    y: 0,
  };
}

// The game area's gap from each side of the view: the left one, used for the right side too, so
// sides mirror even when the bands differ by a pixel.
export function gameAreaGap(view: Size): number {
  return playView(view).x;
}

// The side inset both sides keep clear: the larger of the two, so a one-sided notch moves both
// sides in alike.
export function mirroredSideInset(insets: Insets): number {
  return Math.max(insets.left, insets.right);
}

// How far a control sits in from each side of the view: offset from the game area's edge, or the
// mirrored side inset where that is farther, on a whole pixel.
export function mirroredSide(insets: Insets, offset: number, view: Size): number {
  return Math.ceil(Math.max(gameAreaGap(view) + offset, mirroredSideInset(insets)));
}

// The HUD rect (Chibi's topShift): the lines the HUD's drawn art meets, HUD_EDGE in from the game
// area's top and sides, each clamped by the safe inset on whole pixels, with both sides mirrored
// (mirroredSide). The top controls anchor to its top, left and right edges, so at every aspect
// they sit inside the game area, clear of the bands, curved corners and every inset.
export function hudRect(insets: Insets, view: Size): Rect {
  const side = mirroredSide(insets, HUD_EDGE, view);
  const top = Math.ceil(Math.max(HUD_EDGE, insets.top));
  const bottom = Math.min(
    SCREEN.height - HUD_EDGE,
    view.height - Math.ceil(Math.max(HUD_EDGE, insets.bottom)),
  );
  return { height: bottom - top, width: view.width - 2 * side, x: side, y: top };
}

// The pause button on the HUD rect's top-left corner: the 35 frame, its 33 disc drawn 1 inside it
// on the corner, in the press area hitAround(frame) (52.5). Relative to the corner.
const PAUSE_ART: Rect = { height: 35, width: 35, x: -1, y: -1 };
export const PAUSE_BUTTON = { art: PAUSE_ART, hit: hitAround(PAUSE_ART) } as const;

// The HUD's disc buttons (the weapons, and the start screen's Settings), Chibi's SKILL_BUTTON: a
// 48 target that is the press area, a 33 disc centred in it with a 1 ink edge (a 4 ink annulus
// when selected), and a 20 glyph centred on the disc; targets CONTROL_EDGE apart.
export const HUD_BUTTON = {
  annulus: 4,
  disc: 33,
  edge: 1,
  gap: CONTROL_EDGE,
  glyph: 20,
  target: HIT_RULE.minTarget,
} as const;

// The weapon count pill (art/layout.md "Weapon count pill"): an opaque ink pill under each
// non-Basic disc, height high with radius corners and padding at each end around the count in
// TYPE.count, centred on the disc, its top `top` below the target's top so it overlaps the disc's
// lower edge; its bottom stays clearance above the conversation box's name tab.
export const HUD_AMMO_COUNT = { clearance: 4, height: 14, padding: 4, radius: 4, top: 40 } as const;

// Where a disc and a glyph sit inside their target.
export const HUD_BUTTON_INSET = {
  disc: (HUD_BUTTON.target - HUD_BUTTON.disc) / 2,
  glyph: (HUD_BUTTON.target - HUD_BUTTON.glyph) / 2,
} as const;

// The HUD button row, from the HUD rect's top-right corner: its targets reach the disc inset past
// the corner, so the outermost disc's drawn edge and every disc's drawn top sit on the rect, and
// each disc centres on the row's centre line, the pause disc's centre. bottom is the targets'.
export const HUD_ROW = {
  bottom: HUD_BUTTON.target - HUD_BUTTON_INSET.disc,
  centre: HUD_BUTTON.disc / 2,
  reach: HUD_BUTTON_INSET.disc,
} as const;

// Storybook Skip: a compact secondary control apart from page navigation, centred on the HUD
// row's centre line, one gap left of the settings button's target when it shows, otherwise with
// its drawn right edge on the HUD rect's top-right corner. Offsets from that corner.
export const STORY_SKIP = {
  right: { besideSettings: HUD_BUTTON.target - HUD_ROW.reach + SPACING.gap, corner: 0 },
  top: HUD_ROW.centre - TEXT_BUTTON.compactHeight / 2,
} as const;

// The storybook panel's highest top: the HUD row's bottom plus a gap, from the HUD rect's top, so
// the panel never runs under Skip or the settings button.
export const STORY_PANEL_TOP = HUD_ROW.bottom + SPACING.gap;

// The target of the HUD button index places from the right (0 rightmost), relative to the HUD
// rect's top-right corner, x growing rightward: the row reaches HUD_ROW.reach past the corner.
export function hudButtonTarget(index: number): Rect {
  const { gap, target } = HUD_BUTTON;
  return {
    height: target,
    width: target,
    x: HUD_ROW.reach - target - (target + gap) * index,
    y: -HUD_ROW.reach,
  };
}

// A HUD row of count buttons' width.
export function hudRowWidth(count: number): number {
  return count > 0 ? count * HUD_BUTTON.target + (count - 1) * HUD_BUTTON.gap : 0;
}

// The status pill (art/layout.md "Status pill"): one PILL holding the shield bar and the Stardust
// count. Its left edge is a gap right of the pause press area while the pause button shows, and
// on the HUD rect's left edge (xAlone) while it is hidden, so the leftmost drawn art always sits
// HUD_EDGE in; it centres on the HUD row's centre line, relative to the HUD rect's top-left
// corner, and grows rightward with the count. Parts, left to right: the 20 shield icon, a mark gap, the 96x12 bar
// (a 1 rim, 1 ink, then the 92x8 fill area), the divider (12, 1x16, 12), the 20 Stardust icon, a
// mark gap and the count. The +N tick's line box sits a row gap below the pill.
export const STATUS_PILL = {
  bar: { fill: { height: 8, width: 92 }, height: 12, inset: 2, rim: 1, width: 96 },
  divider: { height: 16, width: 1 },
  dividerGap: 12,
  // The leading edge inside the fill's right end while the shield regenerates.
  edge: 2,
  icon: HUD_BUTTON.glyph,
  // Below this share of capacity the shield is low.
  low: 0.25,
  markGap: SPACING.markGap,
  pill: PILL,
  stardustIcon: 20,
  tick: { outline: 1, rise: 4, top: PILL.height + SPACING.rowGap },
  x: PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + SPACING.gap,
  xAlone: 0,
  y: HUD_ROW.centre - PILL.height / 2,
} as const;

// The pill's width for a countWidth count: the padding, both icons and mark gaps, the bar and the
// divider with its gaps, plus the count.
export function statusPillWidth(countWidth: number): number {
  const { bar, divider, dividerGap, icon, markGap, pill, stardustIcon } = STATUS_PILL;
  const fixed = 2 * pill.padding + icon + markGap + bar.width + 2 * dividerGap + divider.width;
  return fixed + stardustIcon + markGap + countWidth;
}
