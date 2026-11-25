// The DOM UI's colours, named by role. COLOURS holds the colours art/controls.md lists; one token
// serves every role that shares its colour. UNLISTED_COLOURS holds the colours the UI draws that
// art/controls.md does not list, at their current values.

export const COLOURS = {
  /** Ada's ship blue: the shield fill and icon, her name tab and the map's ship canopy. */
  adaBlue: "#70ace8",
  /** Astra's name tab. */
  astraTab: "#8fe0f2",
  /** The base space field, and the Rapid Missile disc face. */
  baseField: "#292734",
  /** The card and modal ground. */
  cardFace: "#3b3850",
  /** The card's upper-left edge. */
  cardRim: "#6b6685",
  /** Body text and row labels, the focus ring, the close X, card icons and HUD counts. */
  cream: "#ead4aa",
  /** Dad's name tab. */
  dadTab: "#c4a6ec",
  /** The flat unavailable face, also the card shade. */
  disabledFace: "#2f2d3d",
  /** Disabled labels and glyphs, and the shield bar's rim. */
  disabledLabel: "#9a96ad",
  /** HUD dividers, also the switch's off track. */
  divider: "#57536e",
  /** An empty weapon's glyph and a level 1 weapon's ring. */
  emptyGlyph: "#75748c",
  /** General Gadget's name tab once he is named. */
  generalTab: "#d68b72",
  /** The Heavy Missile disc face. */
  heavyMissileFace: "#332712",
  /** The holodisk notice and map chip. */
  holodisk: "#e868c8",
  /** An idle weapon's ammunition count. */
  inactiveCount: "#b8b8b8",
  /** Outlines, fringes and button labels, and the Phaser disc face. */
  ink: "#181425",
  /** The Map's job orange: carried cargo and Penny's name tab. */
  jobOrange: "#feae34",
  /** The modal dim, #101926 at alpha 0.70. */
  modalDim: "#101926b3",
  /** Mom's name tab. */
  momTab: "#9fd98a",
  /** The Multi-Laser disc face. */
  multiLaserFace: "#241827",
  /** HUD disc faces, the Laser disc face and the quest route panel. */
  navy: "#262b44",
  /** The ore +N tick. */
  oreTick: "#eaa676",
  /** A pressed or held navigation disc's face. */
  pressedFace: "#3a4466",
  primaryFace: "#bfa06f",
  primaryLip: "#8a7148",
  /** The refusal cue's red, also the low shield. */
  refusalRed: "#e4574e",
  /** Every text of an unaffordable or busy tile row. */
  rowDisabled: "#a6a2b8",
  /** A tile row's second line and Owned. */
  rowSupporting: "#c0bbd0",
  /** The Scattershot disc face. */
  scattershotFace: "#132d33",
  secondaryFace: "#9690b4",
  secondaryLip: "#5f5980",
  /** The shield's delay overlay. */
  shieldDelay: "#4f7aa6",
  /** The low shield's outer panel. */
  shieldLowPanel: "#532e35",
  /** The low shield pulse's peak. */
  shieldLowPeak: "#ff8a80",
  /** The Stardust +N tick. */
  stardustTick: "#f4d98a",
  /** Supporting text, idle glyphs and the unnamed voice's tab. */
  supporting: "#b8b3c9",
  /** A tile row's face. */
  tileFace: "#46425e",
  /** Tow steel: a towed craft's notice. */
  towSteel: "#b8bfc9",
  /** Titles, pressed glyphs, the switch knob and the shield flash. */
  white: "#ffffff",
} as const;

export const UNLISTED_COLOURS = {
  /** The controls overlay's inherited text colour. */
  controlsText: "#172335",
  /** The disabled-feature banner's face. */
  disabledBannerFace: "#FF6B6B",
  /** The galaxy map's Earth marker land. */
  earthLand: "#8ab86b",
  /** The galaxy map's Earth marker ocean. */
  earthOcean: "#65aedd",
  /** The exchange row's border. */
  exchangeRowEdge: "#49465f",
  /** The local map fog mask's opaque fill. */
  fogMask: "#000",
  /** The frame rate readout's panel. */
  fpsPanel: "#000000b3",
  /** The grower's map chip. */
  mapGrowers: "#9ccc5a",
  /** The map's point of interest lavender: the objective stroke and station chips. */
  mapPointOfInterest: "#c4afcc",
  /** The workshop's map chip. */
  mapWorkshop: "#f2d15a",
  /** The page and map field ground under the game. */
  pageBackground: "#101010",
  /** The page's inherited text colour and the frame rate readout's text. */
  pageText: "#ededed",
  /** The quest detail and exchange row ground. */
  panelFace: "#302e42",
  /** The quest detail's border and column rule. */
  questDetailEdge: "#777186",
  /** The quest route panel's border. */
  questRouteEdge: "#55516b",
  /** An unaffordable tile row's focus face and an unavailable exchange amount's face. */
  unavailableFace: "#514b68",
} as const;
