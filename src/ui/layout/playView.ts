import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { PILL, TEXT_BUTTON } from "./controls.ts";
import { HIT_RULE, hitAround } from "./hitAreas.ts";
import { STORY_PANEL } from "./storyPage.ts";
import { SPACING, TYPE } from "./tokens.ts";

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

// HUD controls' safe-rect margin, and the canvas-drawn sticks' bottom margin.
export const CONTROL_EDGE = 8;

// Margins of the three safe rects: HUD controls; modals and page content; the shield bar.
export const SAFE_MARGIN = { hud: CONTROL_EDGE, page: SPACING.pageInset, shield: 0 } as const;

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

// The Stardust pill: a PILL with the 20 Stardust icon, a mark gap and the count as a label; its
// right edge a gap left of the leftmost of weaponCount weapon targets (on the HUD rect's right
// without weapons), centred on the row; it grows leftward. Offsets from the HUD rect's top-right
// corner.
export const STARDUST_PILL = {
  icon: 20,
  markGap: SPACING.markGap,
  pill: PILL,
  top: (HUD_BUTTON.target - PILL.height) / 2,
} as const;

export function stardustPillRight(weaponCount: number): number {
  return weaponCount > 0 ? hudRowWidth(weaponCount) + SPACING.gap : 0;
}

// The shield bar: 3 high, across the shield safe rect, its bottom on that rect's bottom.
export const SHIELD_BAR = { height: 3, margin: SAFE_MARGIN.shield } as const;

// A notice: a compact strip of body text on an ink panel, compact height (growing per wrapped
// line), inset like an action, at most the story panel's measure wide; its top on the HUD rect's
// top, centred on it, clear of the pause and weapon press areas and the Stardust pill by a gap;
// notices stack a gap apart.
export const NOTICE = {
  gap: SPACING.gap,
  height: TEXT_BUTTON.compactHeight,
  inset: TEXT_BUTTON.inset,
  maxWidth: STORY_PANEL.maxWidth,
  text: TYPE.body,
} as const;

// How far a centred notice keeps in from each side of the HUD rect: past the pause press area,
// and past weaponCount weapon targets and a pillWidth Stardust pill (0 when hidden), plus a gap,
// whichever is further.
export function noticeReserve(weaponCount: number, pillWidth = 0): number {
  const pause = PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width;
  const right =
    pillWidth > 0 ? stardustPillRight(weaponCount) + pillWidth : hudRowWidth(weaponCount);
  return Math.max(pause, right) + NOTICE.gap;
}
