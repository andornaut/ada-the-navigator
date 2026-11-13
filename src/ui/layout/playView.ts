import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";

import {
  CONTROLS_BOTTOM,
  COUNT_ADVANCE,
  COUNT_EM,
  HUD_BUTTON,
  HUD_EDGE,
  HUD_ROW,
  PAUSE_ART,
  PILL,
  SAFE_MARGIN,
  SHIELD_BARS,
  SHIELD_PILL,
  SPACING,
  STATUS_PILL_LAYOUT,
  STICK_AREA_MARGIN,
} from "../../data/layout.ts";
import { SCREEN } from "../../data/screen.ts";
export {
  CONTROL_EDGE,
  CONTROLS_BOTTOM,
  HUD_AMMO_COUNT,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  HUD_EDGE,
  HUD_ROW,
  HUD_WEAPON_LEVEL,
  SAFE_MARGIN,
  SHIELD_PILL,
  STICK_AREA_MARGIN,
  STORY_PANEL_TOP,
  STORY_SKIP,
} from "../../data/layout.ts";

// The logical view, its scale and the safe-margin clamp (art/layout.md "Coordinates and scale"
// and "Page bounds"), and the HUD's anchors ("HUD and overlays"). The canvas draws the logical
// view at device pixels (src/game/playCamera.ts); the DOM overlay carries the same scale s as
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

// The safe game area in game-area px: the play view clamped by safeRect(insets, SAFE_MARGIN.edge,
// view), each edge moved in by its own inset, then measured from the play view's corner. Edge
// markers sit inside it (art/layout.md "Edge markers").
export function safeGameArea(insets: Insets, view: Size): Rect {
  const area = playView(view);
  const safe = safeRect(insets, SAFE_MARGIN.edge, view);
  const left = Math.max(area.x, safe.x);
  const top = Math.max(area.y, safe.y);
  const right = Math.min(area.x + area.width, safe.x + safe.width);
  const bottom = Math.min(area.y + area.height, safe.y + safe.height);
  return { height: bottom - top, width: right - left, x: left - area.x, y: top - area.y };
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

export const PAUSE_BUTTON = { art: PAUSE_ART, hit: hitAround(HIT_RULE, PAUSE_ART) } as const;

// On Ada's room page, the pause button's press area's bottom plus a gap, from the HUD rect's top.
export const STORY_ROOM_PANEL_TOP = PAUSE_BUTTON.hit.y + PAUSE_BUTTON.hit.height + SPACING.gap;

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

export type StartNavButton = "achievements" | "exit" | "settings";

// The start screen's HUD discs from the right (hudButtonTarget's index): Exit at the far top right
// where it shows (exitShown), then Settings, then Achievements, which close up without it.
export function startNavOrder(exit: boolean): readonly StartNavButton[] {
  return exit ? ["exit", "settings", "achievements"] : ["settings", "achievements"];
}

// A HUD row of count buttons' width.
export function hudRowWidth(count: number): number {
  return count > 0 ? count * HUD_BUTTON.target + (count - 1) * HUD_BUTTON.gap : 0;
}

// The status pill (art/layout.md "Status pill"): one PILL holding the Stardust count. Its left
// edge is a gap right of the pause press area while the pause button shows, and on the HUD rect's
// left edge (xAlone) while it is hidden, so the leftmost drawn art always sits HUD_EDGE in; it
// centres on the HUD row's centre line, relative to the HUD rect's top-left corner. Parts, left
// to right: the 20 Stardust icon, an icon gap and the count in its slot; while Ada carries ore, a
// divider (6, 1x16, 6), the 20 ore icon, an icon gap and its count in another; while she carries
// a job or story item or tows a craft, a divider and its 20 icon last. Each slot is as wide as its
// count's rendered width (countSlot), so the left edge stays put and the right edge follows the
// counts and the segments shown, snapping in the frame they change. A +N tick sits under its
// count, centred across on its slot, its 20 line box top tick.top below the count's (HUD rect top
// + 33.5, over the item notice's row).
export const STATUS_PILL = {
  ...STATUS_PILL_LAYOUT,
  x: PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + SPACING.gap,
} as const;

/** A count's rendered width in TYPE.label: the sum of its characters' advances. */
export function countWidth(text: string): number {
  let units = 0;
  for (const character of text) {
    const advance = /\d/u.test(character)
      ? COUNT_ADVANCE.digit
      : COUNT_ADVANCE[character as keyof typeof COUNT_ADVANCE];
    if (advance === undefined) {
      throw new Error(`No count advance for ${JSON.stringify(character)}`);
    }
    units += advance;
  }
  return units * COUNT_EM;
}

/** A count's slot: its rendered width, at least STATUS_PILL.minCount. */
export function countSlot(text: string): number {
  return Math.max(STATUS_PILL.minCount, countWidth(text));
}

/** The counts the pill shows: the Stardust count, and the ore count while Ada carries ore. */
export interface StatusCounts {
  readonly ore: string | null;
  readonly stardust: string;
}

// The Stardust segment before its slot (padding, icon, icon gap), and the ore segment before its
// slot (a divider with its gaps, the ore icon, an icon gap).
const STARDUST_LEAD = STATUS_PILL.padding + STATUS_PILL.stardustIcon + STATUS_PILL.iconGap;
const DIVIDED = 2 * STATUS_PILL.dividerGap + STATUS_PILL.divider.width + STATUS_PILL.cargoIcon;
const ORE_LEAD = DIVIDED + STATUS_PILL.iconGap;

// The pill's width for the counts and segments shown: the padding, the Stardust icon, its icon gap
// and count slot; ore adds a divider with its gaps, the ore icon, an icon gap and its count slot,
// and something aboard a divider with its gaps and its icon.
export function statusPillWidth(counts: StatusCounts, aboard: boolean): number {
  return (
    STARDUST_LEAD +
    countSlot(counts.stardust) +
    STATUS_PILL.padding +
    (counts.ore === null ? 0 : ORE_LEAD + countSlot(counts.ore)) +
    (aboard ? DIVIDED : 0)
  );
}

/** The cargo icon's centre in from the pill's right edge: the right padding and half the icon. */
export const STATUS_CARGO_INSET = STATUS_PILL.padding + STATUS_PILL.cargoIcon / 2;

/** Each shown count's +N tick centre across, from the pill's left edge. */
export function statusTickCentres(counts: StatusCounts): { ore: number | null; stardust: number } {
  const stardust = countSlot(counts.stardust);
  return {
    ore:
      counts.ore === null ? null : STARDUST_LEAD + stardust + ORE_LEAD + countSlot(counts.ore) / 2,
    stardust: STARDUST_LEAD + stardust / 2,
  };
}

/**
 * The bottom controls' drawn bottom in a logical view view big with insets: CONTROLS_BOTTOM above
 * the view's bottom inside the bottom safe inset, as in Chibi, clamped STICK_AREA_MARGIN above the
 * game area's bottom.
 */
export function controlsBottom(insets: Insets, view: Size): number {
  const area = playView(view);
  return Math.min(
    view.height - insets.bottom - CONTROLS_BOTTOM,
    area.y + area.height - STICK_AREA_MARGIN,
  );
}

/** The shield bar's length at Shield level `level`, 1 to 3 (outside that, the nearest). */
export function shieldBarWidth(level: number): number {
  return SHIELD_BARS[Math.min(SHIELD_BARS.length, Math.max(1, Math.round(level))) - 1]!;
}

/** The shield bar's fill area width at Shield level `level`: the bar less its inset each end. */
export function shieldFillWidth(level: number): number {
  return shieldBarWidth(level) - 2 * SHIELD_PILL.bar.inset;
}

/**
 * The recharge-delay strip at Shield level `level` and fill `fraction` (art/layout.md "Shield
 * pill"), each rect relative to the bar's top-left: the strip on the fill area's bottom rows from
 * its left, its full length the fill area's, and its ink edge on the row above, the same length.
 */
export function shieldDelayStrip(level: number, fraction: number): { edge: Rect; strip: Rect } {
  const { bar, delayStrip } = SHIELD_PILL;
  const width = shieldFillWidth(level) * Math.max(0, Math.min(1, fraction));
  const y = bar.height - bar.inset - delayStrip.height;
  return {
    edge: { height: delayStrip.edge, width, x: bar.inset, y: y - delayStrip.edge },
    strip: { height: delayStrip.height, width, x: bar.inset, y },
  };
}

/** The shield pill's width at Shield level `level`: padding, the icon, an icon gap and the bar. */
export function shieldPillWidth(level: number): number {
  const { icon, iconGap, padding } = SHIELD_PILL;
  return padding.left + icon + iconGap + shieldBarWidth(level) + padding.right;
}

/** The shield pill's rect in a logical view view big with insets, at Shield level `level`. */
export function shieldPillRect(insets: Insets, view: Size, level = 1): Rect {
  const hud = hudRect(insets, view);
  const bottom = controlsBottom(insets, view);
  const width = shieldPillWidth(level);
  return {
    height: PILL.height,
    width,
    x: hud.x + hud.width / 2 - width / 2,
    y: bottom - PILL.height,
  };
}

/**
 * The shield pill's icon centre in HUD rect px at Shield level `level` (the pill's left + 15, on
 * its centre line), where an item notice for a Shield level lands.
 */
export function shieldIconCentre(insets: Insets, view: Size, level = 1): { x: number; y: number } {
  const hud = hudRect(insets, view);
  const pill = shieldPillRect(insets, view, level);
  return {
    x: pill.x - hud.x + SHIELD_PILL.padding.left + SHIELD_PILL.icon / 2,
    y: pill.y - hud.y + PILL.height / 2,
  };
}
