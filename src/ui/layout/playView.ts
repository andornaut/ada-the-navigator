import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { PILL, TEXT_BUTTON } from "./controls.ts";
import { hitAround } from "./hitAreas.ts";
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

// The pause button on the HUD safe rect's top-left corner: the 35 frame, its 33 disc drawn 1
// inside it on the corner, in the press area hitAround(frame) (52.5). Relative to the corner.
const PAUSE_ART: Rect = { height: 35, width: 35, x: -1, y: -1 };
export const PAUSE_BUTTON = { art: PAUSE_ART, hit: hitAround(PAUSE_ART) } as const;

// The HUD's square buttons (the weapons, and the start screen's Settings): 48 faces with radius 8,
// a 2 ink border and a 24 glyph, a gap apart, right-aligned on the HUD safe rect's top-right
// corner, each in its press area hitAround(face) (72).
const HUD_FACE: Rect = { height: 48, width: 48, x: 0, y: 0 };
export const HUD_BUTTON = {
  border: 2,
  gap: SPACING.gap,
  glyph: 24,
  hit: hitAround(HUD_FACE),
  radius: 8,
  size: HUD_FACE.width,
} as const;

// The face of the HUD button index places from the right (0 rightmost), relative to the top-right
// corner, x growing rightward.
export function hudButtonFace(index: number): Rect {
  const right = index * (HUD_BUTTON.size + HUD_BUTTON.gap);
  return { height: HUD_BUTTON.size, width: HUD_BUTTON.size, x: -right - HUD_BUTTON.size, y: 0 };
}

// A HUD row of count buttons' width.
export function hudRowWidth(count: number): number {
  return count > 0 ? count * HUD_BUTTON.size + (count - 1) * HUD_BUTTON.gap : 0;
}

// The Stardust pill: a PILL with the 20 Stardust icon, a mark gap and the count as a label; its
// right edge a gap left of the leftmost of weaponCount weapons, centred on the weapon row; it grows
// leftward. Offsets from the HUD safe rect's top-right corner.
export const STARDUST_PILL = {
  icon: 20,
  markGap: SPACING.markGap,
  pill: PILL,
  top: (HUD_BUTTON.size - PILL.height) / 2,
} as const;

export function stardustPillRight(weaponCount: number): number {
  return weaponCount > 0 ? hudRowWidth(weaponCount) + SPACING.gap : 0;
}

// The shield bar: 3 high, across the shield safe rect, its bottom on that rect's bottom.
export const SHIELD_BAR = { height: 3, margin: SAFE_MARGIN.shield } as const;

// A notice: a compact strip of body text on an ink panel, compact height (growing per wrapped
// line), inset like an action, at most the story panel's measure wide; its top on the HUD safe
// rect's top, centred, clear of the pause and weapon press areas by a gap; notices stack a gap
// apart.
export const NOTICE = {
  gap: SPACING.gap,
  height: TEXT_BUTTON.compactHeight,
  inset: TEXT_BUTTON.inset,
  maxWidth: STORY_PANEL.maxWidth,
  text: TYPE.body,
} as const;

// How far a centred notice keeps in from each side of the HUD safe rect: past the pause press
// area and weaponCount weapons' press areas, plus a gap, whichever is further.
export function noticeReserve(weaponCount: number): number {
  const pause = PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width;
  const margin = -HUD_BUTTON.hit.x;
  const weapons = weaponCount > 0 ? hudRowWidth(weaponCount) + margin : 0;
  return Math.max(pause, weapons) + NOTICE.gap;
}
