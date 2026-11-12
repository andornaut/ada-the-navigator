import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import { BUTTON_GAP, SMALL_BUTTON_GAP, STACK_BUTTON_GAP } from "@andornaut/game-kit/ui/spacing";

import { SCREEN } from "./screen.ts";

// The in-game interface's authored layout, in logical px of the 720x360 base view unless stated
// (art/layout.md). src/ui/layout derives positions, rects and measured sizes from these values and
// re-exports them under the same names.

// tokens (src/ui/layout/tokens.ts)

export const SPACING = {
  // Between columns that are not buttons.
  columnGap: 8,
  // Between card groups and row parts.
  gap: 8,
  // From an inline icon to its label inside one control or pill.
  markGap: 6,
  // Modals and page content from the view edge.
  pageInset: 16,
  // Inside cards and the story panel, including the 2 frame.
  panelPadding: MODAL_CONTENT.padding,
  // Between rows of one list that are not buttons: item rows, text rows.
  rowGap: 4,
} as const;

// Type roles: size and line box, and weight.
export const TYPE = {
  body: { lineHeight: 20, size: 16, weight: 400 },
  // The HUD weapon counts only, the one role below 16 (art/layout.md "Type").
  count: { lineHeight: 14, size: 12, weight: 700 },
  heading: { lineHeight: 28, size: 24, weight: 700 },
  label: { lineHeight: 20, size: 16, weight: 700 },
  // The storybook text column.
  story: { lineHeight: 26, size: 18, weight: 400 },
} as const;

// controls (src/ui/layout/controls.ts)

// Standard actions: 48 high, a 44 face over a 4 lip, pressed sinks 2; content inset 16 across
// and 12 down, so a wrapped label grows the face by one line box per line. Compact faces (row
// actions and pills) are the native 28 high nine-slice frame; the compact Install action is 72
// wide, or its label plus compactInset on each side when that is wider.
export const TEXT_BUTTON = {
  compactHeight: 28,
  compactInset: 8,
  compactWidth: 72,
  height: 48,
  inset: 16,
  lipHeight: 4,
  pressedSink: 2,
  verticalInset: 12,
} as const;

// Storybook choices and page controls (art/layout.md "Story action"): 36 high, a 32 face over the
// lip, the label inset 16 across and 6 down; a wrapped label grows the face by a label line box.
// The button is small, so its faces keep SMALL_BUTTON_GAP from their neighbours in every
// direction, and its press area is hitAround(face).
export const STORY_BUTTON = {
  height: 36,
  inset: 16,
  verticalInset: 6,
} as const;

// Settings and install-step control rows: one control 48 high (growing to its text plus a row
// gap above and below), a 16 icon, a gap, the label, a gap, then the action at the right end.
export const CONTROL_ROW = {
  gap: SPACING.gap,
  height: HIT_RULE.minTarget,
  icon: 16,
  switch: { height: 16, width: 32 },
  textInset: SPACING.rowGap,
} as const;

// A control's icon inline after its name in player text (art/settings-icons.md "Inline
// controls"): 16 square, its left edge 4 after the name's last glyph, centred on the 20 line box
// that TYPE.body and TYPE.label share.
export const INLINE_CONTROL = {
  gap: 4,
  icon: 16,
  inset: (TYPE.body.lineHeight - 16) / 2,
} as const;

// The button sheets' nine-slice margins (left, top, right, bottom), as the UI manifest gives them.
export const BUTTON_SLICE = { bottom: 6, left: 2, right: 2, top: 4 } as const;

// The card frame's nine-slice edge (ui-settings-card).
export const CARD_SLICE = 2;

// A 1 px drawn line: the route map's inset rules and the galaxy preview's frame.
export const FRAME_LINE = 1;

// Art's focus ring outside the drawn face in every state: a 1 ink fringe, a 2 cream band, then
// ink out to the 4 outset. The selection ring is a 2 band 2 outside the face, under focus.
export const FOCUS_RING = {
  band: 2,
  fringe: 1,
  outset: 4,
  selectionBand: 2,
  selectionOutset: 2,
} as const;

// Price pills and the HUD Stardust pill: compact height, radius 4, 8 side padding; the count is a
// label.
export const PILL = {
  height: TEXT_BUTTON.compactHeight,
  padding: 8,
  radius: 4,
  text: TYPE.label,
} as const;

// cardFrame (src/ui/layout/cardFrame.ts)

// The modal card's frame and header (art/layout.md "Modals"), as Chibi's
// src/ui/layout/cardFrame.ts, in logical px.
export const CARD_CONTENT = {
  closeInset: 6,
  closeSize: 24,
  // The frame's nine-slice edge, counted inside the padding; a title's top gap is measured inside
  // it.
  frameBorder: CARD_SLICE,
  gap: SPACING.gap,
  lineHeight: TYPE.body.lineHeight,
  padding: MODAL_CONTENT.padding,
  rowGap: SPACING.rowGap,
} as const;

// The close X's face, closeInset in from the card's top and right edges (x measured in from the
// right edge), and its press area: hitAround(face), which may extend past the card.
export const CARD_CLOSE_ART: Rect = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
};

// art: Liberation Sans's vertical metrics in both weights, as fractions of the font size.
export const UI_FONT_FACE = {
  ascent: 1854 / 2048,
  capHeight: 1409 / 2048,
  descent: 434 / 2048,
} as const;

// contentCard (src/ui/layout/contentCard.ts)

// The 50% width floor is half the fixed 720 base view, as in Chibi, at every logical width.
export const CARD_FLOOR_VIEW_WIDTH = SCREEN.width;

// A card's scrolling region: it reserves a 6 gap and an 8 track on its right inside the padding,
// the thumb inset 1 in the track, and keeps endPad below its last control at the scroll end. A
// pointer moving further than dragThreshold scrolls and does not activate.
export const SCROLL = {
  dragThreshold: 8,
  endPad: SPACING.panelPadding,
  gap: 6,
  thumbInset: 1,
  track: 8,
} as const;

// shopCard (src/ui/layout/shopCard.ts)

// Glyph sizes inside a well: 20 icons, the 24 upgrade composite, the 32 paint swatch. Each centres
// in the 36 well, at 8, 6 and 2.
export const SHOP_GLYPH = { icon: 20, swatch: 32, upgrade: 24 } as const;

export const SHOP_WELL = 36;

export const SHOP_ROW = {
  // The icon-shop-check mark beside Owned and In use.
  check: { height: 8, width: 12 },
  // The item grid is a control grid of button rows: columns BUTTON_GAP apart, and the rows of
  // one column (and the job board's rows) STACK_BUTTON_GAP apart.
  columnGap: BUTTON_GAP,
  glyph: SHOP_GLYPH,
  height: TEXT_BUTTON.height,
  inset: SPACING.gap,
  markGap: SPACING.markGap,
  // The name, or the name over its level line, on body line boxes.
  nameGap: SPACING.gap,
  nameLine: TYPE.body.lineHeight,
  // The paint heading: a 20 icon, a mark gap and a label, on a 20 line, a gap above the paint rows.
  paintHeading: { gap: SPACING.gap, icon: 20, line: TYPE.label.lineHeight },
  // Price pills: a PILL with the 16 icon-stardust and the price as a label.
  pill: { icon: 16, pill: PILL },
  rowGap: STACK_BUTTON_GAP,
  // The In use row's selection ring: a band, its offset outside the drawn row.
  selection: { band: FOCUS_RING.selectionBand, outset: FOCUS_RING.selectionOutset },
  // The weapon upgrade composite: the 20 weapon glyph at (0, 4), the 12 badge at (12, 0).
  upgrade: { badge: 12, badgeX: 12, weaponY: 4 },
  well: SHOP_WELL,
  // The well's ink edge; its four corner pixels are clear.
  wellEdge: 2,
} as const;

// The buy confirm: a 56 well with the glyph at 2x by nearest neighbour (40, or 48 for the upgrade
// composite) and the swatch at 48, centred; the price as a heading with the 20 Stardust icon.
export const CONFIRM_ITEM = {
  glyphScale: 2,
  price: { icon: 20, markGap: SPACING.markGap, text: TYPE.heading },
  swatch: 48,
  well: 56,
} as const;

// The balance: the 20 Stardust icon, a mark gap and the amount as a label, on a 20 line.
export const BALANCE = { icon: 20, line: TYPE.label.lineHeight, markGap: SPACING.markGap } as const;

// itemNotice (src/ui/layout/itemNotice.ts)

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

// playView (src/ui/layout/playView.ts)

// HUD controls' safe-rect margin, and the gap between HUD buttons.
export const CONTROL_EDGE = 8;

// The HUD edge: from the game area's top and side edges to the drawn art (never a press area) of
// the outermost element on each top corner, the same on both sides and the top, as in Chibi.
export const HUD_EDGE = 12;

// Margins of the safe rects: the bare safe edge (the shield bar and the sticks' bottom); HUD
// controls; modals and page content.
export const SAFE_MARGIN = { edge: 0, hud: CONTROL_EDGE, page: SPACING.pageInset } as const;

// The pause button on the HUD rect's top-left corner: the 35 frame, its 33 disc drawn 1 inside it
// on the corner, in the press area hitAround(frame) (52.5). Relative to the corner.
export const PAUSE_ART: Rect = { height: 35, width: 35, x: -1, y: -1 };

// The HUD's disc buttons (the weapons, and the start screen's Settings), Chibi's SKILL_BUTTON: a
// 48 target that is the press area, a 33 disc centred in it with a 1 ink edge (a 4 ink annulus
// when selected), and a 20 glyph centred on the disc. The discs are small buttons, so neighbouring
// discs sit SMALL_BUTTON_GAP apart: targets gap (9) apart, a 57 pitch.
export const HUD_DISC = 33;

export const HUD_TARGET = HIT_RULE.minTarget;

export const HUD_BUTTON = {
  annulus: 4,
  disc: HUD_DISC,
  edge: 1,
  gap: SMALL_BUTTON_GAP - (HUD_TARGET - HUD_DISC),
  glyph: 20,
  target: HUD_TARGET,
} as const;

// The weapon count pill (art/layout.md "Weapon count pill"): an opaque ink pill under each
// non-Laser disc, height high with radius corners and padding at each end around the count in
// TYPE.count, centred on the disc, its top `top` below the target's top so it overlaps the disc's
// lower edge; the conversation box's top sits clearance below its bottom.
export const HUD_AMMO_COUNT = { clearance: 5, height: 14, padding: 4, radius: 4, top: 40 } as const;

// A weapon disc's level marks (art/controls.md "Weapon level"): at levels 2 and 3 the disc's
// HUD_BUTTON.edge takes the tier colour, with a halo `halo.spread` wide and `halo.blur` soft just
// outside it and, on a light field, an `outline` ink line under the halo. One to three pips, each
// `pip.size` across in a `pip.outline` ink outline, centres `pip.pitch` apart, the row centred
// across and `below` the disc's centre.
export const HUD_WEAPON_LEVEL = {
  below: 12,
  halo: { blur: 2, spread: 1 },
  outline: 1,
  pip: { outline: 1, pitch: 7, size: 4 },
} as const;

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
// row's centre line. Both are small buttons, so while the settings button shows Skip ends
// SMALL_BUTTON_GAP left of its disc, whose drawn right edge is on the HUD rect's top-right corner;
// otherwise Skip's drawn right edge is on that corner. Offsets from that corner.
export const STORY_SKIP = {
  right: { besideSettings: HUD_BUTTON.disc + SMALL_BUTTON_GAP, corner: 0 },
  top: HUD_ROW.centre - TEXT_BUTTON.compactHeight / 2,
} as const;

// The storybook panel's highest top: the HUD row's bottom plus a gap, from the HUD rect's top, so
// the panel never runs under Skip or the settings button.
export const STORY_PANEL_TOP = HUD_ROW.bottom + SPACING.gap;

// TYPE.label's advance, in font units, for each character a count holds (Liberation Sans Bold,
// 2048 units per em): its digits are tabular, every one 1139, as is k; m is 1821 and the point 569.
export const COUNT_ADVANCE = { ".": 569, digit: 1139, k: 1139, m: 1821 } as const;

export const COUNT_EM = TYPE.label.size / 2048;

// The status pill's authored parts (src/ui/layout/playView.ts STATUS_PILL adds its x): PILL's
// height and radius, padded `padding` at each end, tighter than PILL.padding; each count iconGap
// from its icon, each divider dividerGap from its neighbours.
export const STATUS_PILL_LAYOUT = {
  cargoIcon: 20,
  divider: { height: 16, width: 1 },
  dividerGap: 6,
  iconGap: SPACING.rowGap,
  // The narrowest slot: one digit, so "0" keeps its icon and gap.
  minCount: COUNT_ADVANCE.digit * COUNT_EM,
  padding: 6,
  pill: PILL,
  stardustIcon: 20,
  tick: {
    outline: 1,
    rise: 4,
    // From the count's line box top: the count's line, the pill's padding below it and a mark gap.
    top: (PILL.height + TYPE.label.lineHeight) / 2 + SPACING.markGap,
  },
  xAlone: 0,
  y: HUD_ROW.centre - PILL.height / 2,
} as const;

// The bottom controls' drawn bottom above the view's bottom, inside the bottom safe inset: the
// joysticks' rings (TOUCH_STICK.bottom) and the shield pill sit level on it (controlsBottom).
export const CONTROLS_BOTTOM = 40;

// The least gap from each stick's drawn ring, and the shield pill level with them, to the game
// area's edge (art/layout.md "Stick area margin"). Here rather than touchControls.ts, which
// imports this module, so the shield pill can read it.
export const STICK_AREA_MARGIN = 8;

// The shield pill (art/layout.md "Shield pill"): one PILL at the bottom centre holding the 20
// shield icon, a mark gap and the bar, whose length follows Shield level: 120, 180 or 240 by 12
// (a 1 rim, 1 ink, then the fill area 4 shorter by 8 at inset 2), so the pill is the bar plus 42
// wide. It centres across on the HUD rect (the view's centre, as the rect mirrors), so a longer
// bar grows both ways; its bottom sits level with the sticks' drawn bottom (controlsBottom). The
// same place on touch and desktop.
export const SHIELD_BARS = [120, 180, 240] as const;

export const SHIELD_PILL = {
  bar: { height: 12, inset: 2, rim: 1 },
  bars: SHIELD_BARS,
  bottom: CONTROLS_BOTTOM,
  // The leading edge inside the fill's right end while the shield regenerates.
  edge: 2,
  icon: HUD_BUTTON.glyph,
  // Below this share of capacity the shield is low.
  low: 0.25,
  markGap: SPACING.markGap,
  pill: PILL,
} as const;

// conversationBox (src/ui/layout/conversationBox.ts)

export const CONVERSATION_PORTRAIT_SLOT = 48;

export const CONVERSATION_FRAME_EDGE = 2;

export const CONVERSATION_FRAME = CONVERSATION_PORTRAIT_SLOT + 2 * CONVERSATION_FRAME_EDGE;

export const CONVERSATION_PADDING = 4;

export const CONVERSATION_TAB = {
  edge: 1,
  height: 20,
  inset: SPACING.gap,
  overhang: 10,
  radius: 2,
};

export const CONVERSATION_BOX = {
  height: CONVERSATION_FRAME + 2 * CONVERSATION_PADDING,
  // At most this many wrapped lines; the text never shrinks.
  lines: 2,
  maxWidth: 480,
  // The name tab's label, a mark gap inside each side of the tab.
  name: TYPE.label,
  // Notices: no portrait or tab, their lines centred a gap inside each side.
  noticeInset: SPACING.gap,
  padding: CONVERSATION_PADDING,
  // The ink panel, translucent so space shows through; text, tab and portrait stay opaque.
  panel: { alpha: 0.65, ink: "#181425" },
  // A 22 compact frame at 2x, centred in the navy slot inside the 2 ink frame edge.
  portrait: {
    art: 44,
    edge: CONVERSATION_FRAME_EDGE,
    face: "#262b44",
    frame: CONVERSATION_FRAME,
    slot: CONVERSATION_PORTRAIT_SLOT,
  },
  // Ada's ship pivots on the play view's centre; its highest drawn hull point across the 32
  // headings (heading 4) is this far above the pivot.
  ship: { hullRise: 11.83 },
  // Space kept clear between the box's bottom and the top of Ada's ship.
  shipClearance: 24,
  tab: { ...CONVERSATION_TAB, labelInset: SPACING.markGap },
  text: TYPE.body,
  // The text column's gap from the portrait frame and from the panel's far edge.
  textGap: SPACING.gap,
  // From the HUD rect's top: the weapon count pills' bottom (the targets reach HUD_ROW.reach above
  // the rect) plus HUD_AMMO_COUNT.clearance, + 51.5. The tab, overhang above it, clears the status
  // pill and its +N tick, and starts clear of every weapon column across (art/layout.md "Tab
  // clearance").
  top: -HUD_ROW.reach + HUD_AMMO_COUNT.top + HUD_AMMO_COUNT.height + HUD_AMMO_COUNT.clearance,
} as const;

// storyPage (src/ui/layout/storyPage.ts)

// The storybook page panel (art/layout.md "Storybook page"), in logical px: a light spread with a
// text column and a choice column side by side, the available rect's width up to maxWidth,
// centred, its bottom on the available rect's bottom, panel padding inside, no dim. It is only as
// tall as its page needs, up to its top cap; past that only the text column scrolls. The column
// gap holds a 1 rule in the card rim, 12 from each column. The choice column takes its share of
// the inner width less the gap, within its min and max; the text column takes the rest. A
// portrait is the 32 storybook frame at 2x in a 68 frame.
export const STORY_PANEL = {
  choiceColumn: { max: 300, min: 228, share: 0.38 },
  columnGap: 25,
  maxWidth: 760,
  padding: SPACING.panelPadding,
  pageControls: ["previous", "next"],
  portrait: { frame: 68, image: 64, inset: 2 },
  rule: { colour: "#6b6685", width: 1 },
} as const;

// A storybook background's canvas in logical px (art/storybook.md), centred across the view and
// scaled by max(1, viewW / width, viewH / height) so it always covers.
export const STORY_BACKGROUND = { height: 540, width: 960 } as const;

// startScreen (src/ui/layout/startScreen.ts)

export const START_CENTRE = SCREEN.width / 2;

export const START_BUTTON_WIDTH = 192;

export const START_WORDMARK = { height: 102, width: 270 } as const;

export const START_WORDMARK_TOP = 148;

// The action row sits 14 below the wordmark, as Chibi's row sits 15 under its logo.
export const START_ACTIONS_TOP = START_WORDMARK_TOP + START_WORDMARK.height + 14;

export const START_SCREEN = {
  actions: {
    height: TEXT_BUTTON.height,
    // Restart left and Continue right of the centre, BUTTON_GAP apart; Start alone on the centre.
    left: {
      continue: START_CENTRE + BUTTON_GAP / 2,
      restart: START_CENTRE - START_BUTTON_WIDTH - BUTTON_GAP / 2,
      start: START_CENTRE - START_BUTTON_WIDTH / 2,
    },
    top: START_ACTIONS_TOP,
    width: START_BUTTON_WIDTH,
  },
  // One body line box, a gap below the action row, centred on the game area.
  note: {
    centre: START_CENTRE,
    height: TYPE.body.lineHeight,
    top: START_ACTIONS_TOP + TEXT_BUTTON.height + SPACING.gap,
  },
  // The selected paint's ship-26, its 96 frame drawn 280 square on this centre; its speed jets
  // draw behind it at the same scale.
  ship: { centre: { x: 378, y: 84 }, frame: 96, size: 280 },
  wordmark: {
    ...START_WORDMARK,
    left: START_CENTRE - START_WORDMARK.width / 2,
    top: START_WORDMARK_TOP,
  },
} as const;

// touchControls (src/ui/layout/touchControls.ts)

// The touch chrome's frames (src/ui/touchChrome.ts): the 75 ring and Use frame, the 11 knob.
export const TOUCH_CHROME_FRAME = 75;
export const TOUCH_KNOB_FRAME = 11;

// The on-screen joysticks (art/layout.md "HUD and overlays", Sticks), in logical canvas px: 75
// frames, each ring's drawn edge side (60) in from the screen's left (move) or right (aim) edge
// and bottom (40, level with the shield pill) above its bottom, inside the safe insets, then
// clamped STICK_AREA_MARGIN inside the game area; the drawn knob moves at most knobReach from the
// ring's centre. Move input reaches full speed moveReach from the touch-down point, past a
// moveDeadZone.
export const TOUCH_STICK = {
  bottom: CONTROLS_BOTTOM,
  frame: TOUCH_CHROME_FRAME,
  knobReach: 12,
  moveDeadZone: 2.4,
  moveReach: 40,
  side: 60,
} as const;

// Art draws each ring 1 inside its frame, so a frame's centre pixel is this far from the drawn
// edge on each side.
export const STICK_DRAWN_HALF = (TOUCH_STICK.frame - 1) / 2 - 1;

// The Use disc (art/layout.md "HUD and overlays", Use), Chibi's touch Use button: a 75 frame
// whose centre pixel is the aim ring's rest centre plus fromAim, as Chibi places Use from Jump.
// Its press area is a circle of radius TOUCH_CIRCLE_RADIUS (63) plus the 37 hint radius about the
// centre, cut on the line midway to the aim ring's centre, so the aim stick keeps its reach.
export const USE_DISC = {
  frame: TOUCH_CHROME_FRAME,
  fromAim: { x: -77, y: -100 },
  radius: 63 + 37,
} as const;

// stationCard (src/ui/layout/stationCard.ts)

export const KEEPER_PIP = { count: 3, disc: 6, gap: 4, ring: 1 };

export const KEEPER_PIPS_WIDTH =
  KEEPER_PIP.count * KEEPER_PIP.disc + (KEEPER_PIP.count - 1) * KEEPER_PIP.gap;

// mapScreen (src/ui/layout/mapScreen.ts)

/**
 * The local map's HUD row labels' TYPE.label widths, up to the quarter pixel (art/map.md "Quests
 * and Galaxies"): both buttons take the wider plus TEXT_BUTTON.inset each side.
 */
export const MAP_HUD_LABEL_WIDTHS = { galaxies: 66, quests: 54.25 } as const;

export const MAP_PANEL = {
  /** Text block to Travel here, at least. */
  actionGap: 16,
  /** Chip to the text block (SPACING.gap). */
  markGap: SPACING.gap,
  /** The card floor: half the 720 base width. */
  minWidth: 360,
  /** SPACING.panelPadding, including the 2 frame. */
  padding: SPACING.panelPadding,
  /** Row to the reason line (SPACING.gap). */
  reasonGap: SPACING.gap,
  /** The panel's row, TEXT_BUTTON.height. */
  row: 48,
  /** The two 20 lines' top inside the 48 row. */
  textTop: 4,
} as const;

export const MAP_SYMBOL = {
  ada: {
    /** Ink keyline outside the hull: a 3 ink stroke under the fill. */
    keyline: 1.5,
    /** Arrow box, centred on Ada's position. */
    size: 28,
  },
  /** Disc diameter. */
  chip: 28,
  /** Ink edge inside the disc. */
  edge: 1,
  /** Ink glyph mask, centred. */
  glyph: 20,
  /** Press area: hitAround of the chip, HIT_RULE.minTarget. */
  hit: 48,
  objective: {
    /** The indicator's drawing box around the chip centre: across, down, and its top above it. */
    box: { height: 28, top: 48, width: 16 },
    /** Ink stroke under the lavender one. */
    ink: 4,
    stroke: 2,
    /** Indicator tip above the chip centre. */
    tip: 23,
  },
  ring: {
    band: 2,
    fringe: 1,
    /** Selection ring centre radius: 2 outside the face. */
    radius: 17,
  },
} as const;

// MAP_SCREEN's authored parts; src/ui/layout/mapScreen.ts adds chartRadius, hudRow.
export const MAP_SCREEN_LAYOUT = {
  /** Movement past this pans and never selects (SCROLL.dragThreshold). */
  dragThreshold: SCROLL.dragThreshold,
  /** Chip radius plus SPACING.gap: symbols keep this far inside the fit region. */
  fitMargin: 22,
  fog: {
    /** Gaussian edge sigma as a share of the reveal's on-screen x radius. */
    feather: 0.16,
    /** Sigma never below this. */
    minFeather: 3,
    /** World units explored around each explored point, each discovered place and Ada. */
    reveal: 1500,
    /** Most world units flown between explored points. */
    sample: 250,
  },
  header: {
    /** Ink panel alpha, the HUD panel's. */
    alpha: 0.65,
    /** The divider between the name and the percent. */
    divider: { height: 16, width: 1 },
    /** Name, this gap, the divider, this gap, the column of the pips over the percent. */
    dividerGap: 12,
    /** The HUD row: HUD_BUTTON.target. */
    height: HUD_BUTTON.target,
    /** The percent's 20 line box top when the galaxy has no landmarks. */
    labelTop: 14,
    /** The name's 28 line box top. */
    nameTop: 10,
    padding: 16,
    /** Pip diameter. */
    pip: 6,
    /** Pip centre to centre. */
    pipPitch: 8,
    /** An uncharted pip's ring. */
    pipRing: 1,
    radius: 4,
    /** The pips to the percent's line box (SPACING.rowGap). */
    stackGap: SPACING.rowGap,
    /** The column's top: (48 - 30) / 2 for the 6 pips, the gap and the 20 line. */
    stackTop: 9,
  },
  /** The opening box is at least this many projected units across and down. */
  minBox: { height: 6000, width: 12000 },
  /**
   * The Quests modal's lines (art/map.md "Quests modal"): a mapped line's chip (MAP_SYMBOL.chip)
   * overhanging its label's 20 line box by 4 each way, markGap to the label, lines lineGap apart,
   * plain text from textColumn, and an unmapped line's hollow ring.
   */
  quests: {
    chip: 28,
    lineGap: SPACING.gap,
    markGap: SPACING.markGap,
    overhang: 4,
    ring: 1,
    textColumn: TEXT_BUTTON.inset + 28 + SPACING.markGap,
  },
  tools: {
    /** Tool targets top to top: HUD_BUTTON.target + HUD_BUTTON.gap, so the small discs keep
     * SMALL_BUTTON_GAP apart. */
    pitch: HUD_BUTTON.target + HUD_BUTTON.gap,
  },
  /** Wheel deltaY px per zoom step. */
  wheelStep: 100,
  /** One zoom step. */
  zoomStep: 1.5,
} as const;

// galaxyMap (src/ui/layout/galaxyMap.ts)

/**
 * The arc the markers sit on (art/layout.md "Marker centres"): the circle through route
 * positions 1 and 6 whose top is `top`, its radius (half chord² + rise²) / (2 rise) about the
 * point that far below the top, and the six centres at equal angles off vertical across it.
 */
export const GALAXY_MAP_ARC_POINTS = {
  first: { x: 96, y: 122 },
  last: { x: 624, y: 122 },
  top: { x: 360, y: 46 },
};

export const GALAXY_MAP_CREAM = "#EAD4AA";

export const GALAXY_MAP_INK = "#181425";

export const GALAXY_MAP_GREY = "#B8B3C9";

// The route sky (top-centre on the play view's top-centre) and ground (bottom on the view's
// bottom), at 2 image px per logical px; the figures on the ground at their canvas points.
export const GALAXY_MAP_SKY = {
  ground: { height: 120, width: 960 },
  sky: { height: 540, width: 960 },
  // Past the sky, the view shows its top colour.
  top: "#1F1A38",
} as const;

/** The sky and ground's left edge in play-view px: centred on the play view. */
export const GALAXY_MAP_SKY_LEFT = (SCREEN.width - GALAXY_MAP_SKY.sky.width) / 2;

export const GALAXY_MAP_CAPTURE = { frame: FRAME_LINE, height: 90, width: 180 } as const;

export const GALAXY_MAP_PANEL_PADDING = SPACING.gap;

export const GALAXY_MAP_CAPTURE_GAP = 12;

export const GALAXY_MAP_PANEL = {
  capture: { ...GALAXY_MAP_CAPTURE, frameColor: GALAXY_MAP_INK },
  // The supporting colour for "Galaxy {number}", locked text and the development line.
  colors: {
    development: GALAXY_MAP_GREY,
    flavor: GALAXY_MAP_CREAM,
    name: "#FFFFFF",
    number: GALAXY_MAP_GREY,
  },
  height: 112,
  // SPACING.gap with the 2 px frame inside it (art/layout.md "Exceptions").
  padding: GALAXY_MAP_PANEL_PADDING,
  rowGap: SPACING.rowGap,
  text: {
    left:
      GALAXY_MAP_PANEL_PADDING +
      GALAXY_MAP_CAPTURE.width +
      2 * GALAXY_MAP_CAPTURE.frame +
      GALAXY_MAP_CAPTURE_GAP,
    width: 404,
  },
  width: 614,
} as const;

export const GALAXY_MAP_ACTION_WIDTH = 192;

export const GALAXY_MAP_CENTRE = SCREEN.width / 2;

export const GALAXY_MAP_ACTIONS = {
  // Earth secondary left, Jump primary right, BUTTON_GAP apart about the play view's centre.
  earth: GALAXY_MAP_CENTRE - BUTTON_GAP / 2 - GALAXY_MAP_ACTION_WIDTH,
  height: TEXT_BUTTON.height,
  jump: GALAXY_MAP_CENTRE + BUTTON_GAP / 2,
  width: GALAXY_MAP_ACTION_WIDTH,
} as const;

export const GALAXY_MAP_MOVE = {
  // The unlock's arrival: the selected ring fades in, the panel crossfades.
  arrival: { panel: 160, ring: 120 },
  // A reduced-motion unlock: the ship fades out, the markers switch, the ship fades in.
  reduced: { fade: 150 },
  // A selection move: 360 px/s along the legs, clamped, easeInOutSine on arc length.
  selection: { max: 0.9, min: 0.3, speed: 360 },
  // The unlock: the markers crossfade and their legs draw over 300 ms, a ring pulses in the
  // farthest new marker's hue over 400 ms, then the ship flies to it at 180 px/s, clamped so
  // the whole unlock takes at most 2.4 s (gameplay/rules.md).
  unlock: {
    depart: 0.4,
    fade: 0.3,
    max: 2.4,
    min: 0.8,
    pulse: { alpha: 0.8, from: 13, to: 26, width: 2 },
    speed: 180,
  },
} as const;

// GALAXY_MAP's authored parts; src/ui/layout/galaxyMap.ts adds centres.
export const GALAXY_MAP_LAYOUT = {
  colors: { cream: GALAXY_MAP_CREAM, grey: GALAXY_MAP_GREY, ink: GALAXY_MAP_INK },
  // Each name on an ink pill: 20 high, the label plus 12 wide, its top 19 below the centre.
  label: { alpha: 0.85, height: 20, padding: 6, radius: 4, top: 19 },
  // The 36 frame: a radius 12 disc with a 1.5 ink edge over an ink backing disc, radius 15 at
  // 0.85; the cream selected ring at radius 17 (band 16 to 18).
  marker: {
    backing: { alpha: 0.85, radius: 15 },
    disc: 12,
    edge: 1.5,
    frame: 36,
    ring: { color: GALAXY_MAP_CREAM, radius: 17, width: 2 },
  },
  // The arc between consecutive markers, stamped every 0.5, stopping 15 from each centre; its
  // look is its destination's.
  path: {
    locked: { color: GALAXY_MAP_GREY, kind: "dashes", off: 4, on: 6, width: 2 },
    open: { color: GALAXY_MAP_CREAM, kind: "solid", width: 4 },
    step: 0.5,
    trim: 15,
  },
  // A 48 press area and the 44 focus ring centred on each marker.
  press: 48,
  // The available rect's inset rules: 1 px, the inner 3 inside the outer.
  rules: { inner: "#4A4660", inset: 3, outer: "#6B6685", width: FRAME_LINE },
  // The ship frame drawn 42, the game area's in-flight size, on (centre x, centre y - 33).
  ship: { lift: 33, size: 42 },
} as const;
