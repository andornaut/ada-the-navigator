import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { PILL } from "./controls.ts";
import { HIT_RULE, hitAround } from "./hitAreas.ts";
import { SPACING } from "./tokens.ts";

// The logical view, its scale and the safe-margin clamp (art/layout.md "Coordinates and scale"
// and "Page bounds"), and the HUD's anchors ("HUD and overlays"). Phaser's EXPAND mode draws the
// logical view; the DOM overlay carries the same scale s as --ada-unit (viewScale.ts).

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

// HUD controls' safe-rect margin.
export const CONTROL_EDGE = 8;

// Margins of the safe rects: the bare safe edge (the shield bar and the sticks' bottom); HUD
// controls; modals and page content.
export const SAFE_MARGIN = { edge: 0, hud: CONTROL_EDGE, page: SPACING.pageInset } as const;

// Chibi's play view: the 720x360 base view centred across the logical view, at its top.
export function playView(view: Size): Rect {
  return {
    height: SCREEN.height,
    width: SCREEN.width,
    x: Math.floor((Math.floor(view.width) - SCREEN.width) / 2),
    y: 0,
  };
}

// The HUD rect (Chibi's topShift): the play view inset by CONTROL_EDGE, intersected with the HUD
// safe rect. The top controls anchor to its top, left and right edges, so on screens wider than
// 2:1 they sit inside the centred base view, clear of curved corners and every inset.
export function hudRect(insets: Insets, view: Size): Rect {
  const play = playView(view);
  const safe = safeRect(insets, CONTROL_EDGE, view);
  const left = Math.max(play.x + CONTROL_EDGE, safe.x);
  const top = Math.max(play.y + CONTROL_EDGE, safe.y);
  const right = Math.min(play.x + play.width - CONTROL_EDGE, safe.x + safe.width);
  const bottom = Math.min(play.y + play.height - CONTROL_EDGE, safe.y + safe.height);
  return { height: bottom - top, width: right - left, x: left, y: top };
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

// Where a disc and a glyph sit inside their target.
// Storybook Skip: a compact secondary control apart from page navigation, in the top-right HUD
// row centred on the row's 48 targets, one gap left of the settings button's target when it
// shows, otherwise on the HUD rect's top-right corner. Offsets from that corner.
export const STORY_SKIP = {
  right: { besideSettings: HUD_BUTTON.target + SPACING.gap, corner: 0 },
  top: (HUD_BUTTON.target - TEXT_BUTTON.compactHeight) / 2,
} as const;

// The storybook panel's highest top: the HUD row's bottom plus a gap, from the HUD rect's top, so
// the panel never runs under Skip or the settings button.
export const STORY_PANEL_TOP = HUD_BUTTON.target + SPACING.gap;

export const HUD_BUTTON_INSET = {
  disc: (HUD_BUTTON.target - HUD_BUTTON.disc) / 2,
  glyph: (HUD_BUTTON.target - HUD_BUTTON.glyph) / 2,
} as const;

// The target of the HUD button index places from the right (0 rightmost), relative to the HUD
// rect's top-right corner, x growing rightward.
export function hudButtonTarget(index: number): Rect {
  const { gap, target } = HUD_BUTTON;
  return { height: target, width: target, x: -target - (target + gap) * index, y: 0 };
}

// A HUD row of count buttons' width.
export function hudRowWidth(count: number): number {
  return count > 0 ? count * HUD_BUTTON.target + (count - 1) * HUD_BUTTON.gap : 0;
}

// The status pill (art/layout.md "Status pill"): one PILL holding the shield bar and the Stardust
// count. Its left edge is a gap right of the pause press area and it centres on the pause disc,
// relative to the HUD rect's top-left corner, whether or not the pause button shows; it grows
// rightward with the count. Parts, left to right: the 20 shield icon, a mark gap, the 96x12 bar
// (a 1 rim, 1 ink, then the 92x8 fill area), the divider (12, 1x16, 12), the 20 Stardust icon, a
// mark gap and the count. The +N tick's line box sits a row gap below the pill.
const PAUSE_DISC_CENTRE = PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2;
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
  y: PAUSE_DISC_CENTRE - PILL.height / 2,
} as const;

// The pill's width for a countWidth count: the padding, both icons and mark gaps, the bar and the
// divider with its gaps, plus the count.
export function statusPillWidth(countWidth: number): number {
  const { bar, divider, dividerGap, icon, markGap, pill, stardustIcon } = STATUS_PILL;
  const fixed = 2 * pill.padding + icon + markGap + bar.width + 2 * dividerGap + divider.width;
  return fixed + stardustIcon + markGap + countWidth;
}
