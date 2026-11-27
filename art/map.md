# Map

The pause card's Map opens a full-screen map of the current galaxy: Ada's
position and heading, every discovered destination and station, charted
landmarks, the objective once mapped, and how much of the galaxy is mapped
(Gameplay's rule, `gameplay/rules.md` "Pause"). Undiscovered places never
appear. Every distance and size comes from [Layout](layout.md) or the tokens
below; states and colours of shared controls are in [Controls](controls.md).

Constants: `MAP_SCREEN`, `MAP_PANEL`, `MAP_SYMBOL`, `MAP_FACES`, `MAP_GLYPHS`
and `MAP_TOOLS` in `src/ui/layout/mapScreen.ts`; the panel's height is
`panelHeight` in `src/ui/mapScreen.ts`.

## Screen

The Local Map is a full-screen modal (`role="dialog"`, `aria-modal="true"`).
The field fills the logical view under the insets, with the header, tools,
footer and informational Place panel over it. The Map takes input exclusively
and covers the flight HUD.

Keep a top-right X as the Map's modal dismissal, following
[Layout](layout.md#modals). It invokes the footer's existing contextual
Back or Close path exactly once and restores focus to the opener or a
logical control in the restored view. The current runtime exposes the
footer dismissal but lacks the header X.

The existing page-relative parts use `safeRect(insets, SPACING.pageInset, view)`:
16 in from each view edge, or the safe inset where that is larger. At the 720
base it spans 16 to 704 across and 16 to 344 down; with phone insets (left and
right 43, bottom 19) 43 to 677 and 16 to 341.

| Part   | Anchor                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Field  | The whole logical view, with the galaxy's `background` and fog inside the playable boundary                                   |
| Header | Top on the page rect's top; left `SPACING.gap` right of the pause press area while the pause button shows, as the status pill |
| Tools  | One row of three `HUD_BUTTON` targets, the last target's right and every target's top on the page rect's top-right corner     |
| Footer | Quests, Galaxies, then Close, the last's right and every button's bottom on the page rect's bottom-right corner               |
| Panel  | Left and bottom on the page rect's bottom-left corner                                                                         |
| Fit    | The region left for the map: see [Projection and fit](#projection-and-fit)                                                    |
| Quests | The shared [Quests screen](#shared-quests) opens over the Map                                                                 |

The approved Local Map design uses near-black `#131119` beyond the full
playable boundary, the diamond formed by projecting the wrapped galaxy square.
The boundary follows the field as it pans and zooms. Keep the dashed charting
oval as a distinct marker inside the playable field.

### Header

One ink panel in two lines. The row holds, left to right: the galaxy name
(`TYPE.heading`, white), a divider, "{percent}% mapped" (`TYPE.label`, cream),
a matching divider, then a row of ten survey pips. Under it, the survey note `mapSurveyInfo`
(`TYPE.body`, supporting `#b8b3c9`), "Mapping progress only tracks the
galactic center.". Strings are Gameplay's (`gameplay/player-copy.md`).

| Token                        | Value | Rule                                                                                                   |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `MAP_SCREEN.header.height`   | 64    | The name row (`rowHeight` 36: the 28 heading line plus `2 * SPACING.rowGap`), a 20 line, `SPACING.gap` |
| `MAP_SCREEN.header.radius`   | 4     | As `PILL`                                                                                              |
| `MAP_SCREEN.header.alpha`    | 0.65  | Ink `#181425` panel, the HUD panel alpha                                                               |
| `MAP_SCREEN.header.padding`  | 8     | The survey note's inset at each side                                                                   |
| `MAP_SCREEN.header.divider`  | 1x16  | Both dividers use supporting `#b8b3c9` and are centred on the row                                      |
| `MAP_SCREEN.header.pip`      | 8     | Pip diameter                                                                                           |
| `MAP_SCREEN.header.pipPitch` | 11    | Pip centre to centre, with a 3 px gap between discs                                                    |
| `MAP_SCREEN.header.pips`     | 10    | Pips in the row, one per tenth of the survey; the row is 107 wide (`9 * pipPitch + pip`)               |

- Left: the page rect's left, 16 at the 720 base and 43 with phone insets.
  Top: the page rect's top.
- Row: every part centred on the 36 row. One equal gap `g` spans both outer
  edges and each neighbouring pair of the five parts (name, divider, percent,
  divider, pips), for six gaps. `mapHeaderGeometry` starts at `SPACING.gap`
  and increases `g` to fit the note plus `2 * padding`. The row divides any
  difference between that width and the final card width evenly across the six
  gaps. Measure ink, not line boxes.
- Note: one line, with 8 logical px at each side. Its width plus these
  insets sets the minimum header width, about 363 logical px before gap
  rounding.
- At a viewport width of 720 CSS px or less or a height of 360 CSS px or
  less, move the header contents down 1 logical px. Top padding is 1 and
  bottom padding is 7 within the fixed 64 logical px panel.
- Each pip stands for one tenth of the survey. The first
  `floor(percent / 10)` pips are filled cream `#ead4aa` discs, where `percent`
  is the header's displayed whole percent; the rest are 1 px `#b8b3c9` rings of
  the same diameter, hollow, so the two read apart by shape as well as colour.
  0 to 9% fills none, 100% fills all ten.
- The header's width is capped at `mapHeaderCap`:
  `toolColumnLeft - SPACING.gap - header left`, 470 at the 720 base
  (`494 - 8 - 16`) and 416 with phone insets (`467 - 8 - 43`), so it
  always ends at least `SPACING.gap` left of the tools. The pips always draw
  at full size, never scaled. With the 720 × 360 reference ink widths, the
  longest galaxy name with "100% mapped" and the 107 px pip row fits within
  the phone cap at 395 logical px.
- The fit region's top is `SPACING.gap` below the header's 64.
- The header takes no input. Its accessible text is the name and the percent;
  the pips are decorative.

### Tools

Three `HUD_BUTTON` targets in the idle state, in one row, left to right: zoom
out, zoom in, recentre (`MAP_TOOLS`). The row's right and top are the page
rect's top-right corner, so target `i` (0 to 2) is at
`x = toolColumnLeft + MAP_SCREEN.tools.pitch * i`, `y = page top`, where
`toolColumnLeft = page right - MAP_SCREEN.toolRow.width`: 542 at the 720 base,
515 with phone insets.

| Token                       | Value | Rule                                                                                                           |
| --------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `MAP_SCREEN.toolRow.gap`    | 9     | `HUD_BUTTON.gap`: `SMALL_BUTTON_GAP` (24) less the 15 a target adds to its 33 disc, so the discs stay 24 apart |
| `MAP_SCREEN.toolRow.height` | 48    | `HUD_BUTTON.target`                                                                                            |
| `MAP_SCREEN.toolRow.width`  | 162   | `3 * 48 + 2 * 9`                                                                                               |
| `MAP_SCREEN.tools.pitch`    | 57    | Target to target: `HUD_BUTTON.target + HUD_BUTTON.gap`                                                         |

| Tool     | Glyph              | Glyph colour         | Action                                               |
| -------- | ------------------ | -------------------- | ---------------------------------------------------- |
| Zoom out | `map-zoom-out.svg` | Supporting `#b8b3c9` | Scale over `zoomStep` about the fit region centre    |
| Zoom in  | `map-zoom-in.svg`  | Supporting `#b8b3c9` | Scale times `zoomStep` about the fit region centre   |
| Recentre | `map-recentre.svg` | Supporting `#b8b3c9` | Pan so Ada sits at the fit region centre, same scale |

| Tool     | Target, 720 base | Disc, 720 base | Target, phone insets | Disc, phone insets |
| -------- | ---------------- | -------------- | -------------------- | ------------------ |
| Zoom out | 542 to 590       | 549.5 to 582.5 | 515 to 563           | 522.5 to 555.5     |
| Zoom in  | 599 to 647       | 606.5 to 639.5 | 572 to 620           | 579.5 to 612.5     |
| Recentre | 656 to 704       | 663.5 to 696.5 | 629 to 677           | 636.5 to 669.5     |

- Face, edge and glyph geometry are the idle `HUD_BUTTON`
  ([Controls](controls.md#top-right-hud-icon-buttons), `HUD_DISC_STATES.idle`):
  navy `#262b44` 33 disc centred in its target (7.5 in on each side), 1 ink
  edge, 20 glyph mask in supporting `#b8b3c9`. The tools are native buttons
  and share the [button state rules](controls.md#buttons) with the footer and
  Travel here. The current tool CSS still adds the shared disc focus ring
  and has no distinct held face or glyph. Map text buttons still use the
  shared exterior focus outline, with `Highlight` in forced colors. These
  states are pending migration.
- Down, at a top inset up to 16, every target spans 16 to 64 and every disc
  23.5 to 56.5. The row ends at the page rect's right (704, or 677 with phone
  insets), the recentre disc's drawn right edge 7.5 inside it (696.5, 669.5).
  The targets end 24 above the fit region's top (88).
- The footer and the place panel anchor to the page rect's bottom, so they
  never reach the tools: the tallest panel (128, the job and reason lines)
  tops at 216 (213 with phone insets), 152 (149) below the targets' end.
- At `maxScale`, zoom in plays the [refusal cue](controls.md#refusal-cue) with
  its glyph as the label and does not zoom; zoom out does the same at
  `minScale`. Neither changes face.
- Accessible labels (Gameplay's): Zoom out, Zoom in and Center on Ada.

### Footer

Three standard text actions sit at the page rect's bottom-right corner.
From left to right they are Quests and Galaxies (secondary), then the
primary dismissal (`map-close`). Its label is “Back” when the Map opens
from Paused (`questBack`) and “Close” otherwise. The top X uses the same
context-specific return and focus restoration.

Each action sizes to its label plus 16 logical px on each side, subject to
the standard button minimum. A single-line action is 48 logical px high
and its whole box is the press area. Faces are `BUTTON_GAP` (16) apart
(`MAP_SCREEN.hudRow.gap`). The footer dismissal's right edge aligns with
the top X target's right edge. The fit region stops `SPACING.gap` above
the footer.

Measured at 720x360, opened from Paused, in logical px:

| Quests           | Galaxies         | Back          | Down       |
| ---------------- | ---------------- | ------------- | ---------- |
| 397.88 to 490.91 | 506.91 to 612.97 | 628.97 to 704 | 296 to 344 |

- Quests opens [Shared Quests](#shared-quests) through the Pause controller.
  It stays available in danger and while towing. After Locate, it resumes the
  suspended quest detail.
- Galaxies: Gameplay's action, with no confirm. It opens the
  [galaxy selector](layout.md#galaxy-selector), whose one destination action
  jumps to another galaxy or home to Earth, or returns here as "Stay in
  {galaxy}", as the selector's X, Back and Escape do. It stays available while
  towing; leaving the galaxy returns the towed craft to where it was
  stranded. In danger it shows the unavailable face
  (disabled face, focusable), activation plays the
  [refusal cue](controls.md#refusal-cue), and the panel shows the danger
  reason (below).

### Place panel

The Place panel is an informational part of the Map, with no separate
modal, X or dim. It shows the selected place, the empty note when the Map has
no places, or the danger reason while Ada is in danger. Its
`ui-settings-card` nine-slice face keeps its left and bottom on the page
rect's bottom-left corner.

| Token                 | Value | Rule                                                   |
| --------------------- | ----- | ------------------------------------------------------ |
| `MAP_PANEL.padding`   | 16    | `SPACING.panelPadding`, including the 2 frame          |
| `MAP_PANEL.markGap`   | 8     | Chip to the text block                                 |
| `SPACING.gap`         | 8     | Vertical gap from the chip and text to Travel here     |
| `MAP_PANEL.row`       | 48    | Chip and text row minimum (`TEXT_BUTTON.height`)       |
| `MAP_PANEL.textTop`   | 4     | Padding above and below the text block's 20 line pitch |
| `MAP_PANEL.reasonGap` | 8     | Content block to the reason (`SPACING.gap`)            |

The first row, left to right, with both parts vertically centred:

1. The place's chip, 28, drawn as on the field without the selection ring or
   objective indicator.
2. The text block, one 20 line each (`TYPE.label` and `TYPE.body` line
   height): the place's name (`TYPE.label`, cream `#ead4aa`), then
   "{type} · {distance}" (`TYPE.body`, supporting `#b8b3c9`), then, when the
   place is the held job's target, "Job: {objective}" (`TYPE.body`,
   supporting). A job's own spot shows its name only.

Travel here is a secondary `TEXT_BUTTON`, 48 high, on its own left-aligned row
below the chip and text. The label, Stardust icon and price stay on one line,
with `TEXT_BUTTON.inset` on each side. Every named map place can offer the
action (`MapPlace.travel`). Its availability still follows the travel rules.

Below the block, `reasonGap` apart, one reason (`TYPE.body`, supporting,
left-aligned at the inner left) shows while Travel here or Galaxies is
unavailable. Inactive reasons take no space.

- With unwrapped text, the chip and text row is 48 high with one or two lines
  and 68 with the job line.
- Width: the panel takes the `max-content` width of its widest visible row,
  plus panel padding, up to `maxWidth`. The header sizes independently. Detail
  and reason text can wrap inside the cap and increase the measured height.
- `maxWidth` (`panelMaxWidth`) is `Quests left - SPACING.gap - page left`,
  using the measured footer row. The panel ends at least `SPACING.gap`
  left of the footer.
- Empty panel, while the map has no places: one centred `TYPE.body` supporting
  line, "No destinations mapped yet." (Gameplay), height `16 + 20 + 16` = 52.
- Reason-only panel, in danger with nothing selected: the danger line alone,
  left-aligned, height `16 + 20 + 16` = 52. With no places the empty note comes
  first and the danger line follows it, `reasonGap` apart, both centred: 80
  high.
- Travel here unavailable: the disabled face, focusable; activation plays the
  refusal cue ([Controls](controls.md#buttons)). The reason is "Unavailable
  while you are in danger." or "Unavailable while towing." (Gameplay). One
  reason shows at a time; danger wins over towing.
- In danger the danger line shows with every selection, whether or not the
  place offers Travel here, because Galaxies is unavailable too. The
  towing line shows only while a place offering Travel here is selected.
- The panel's chip and text are decorative to the pointer: a press on the panel
  outside Travel here does nothing and never reaches the field.

### Shared Quests

The Map footer's Quests action delegates from `src/ui/mapScreen.ts` through
`src/ui/pauseCard.ts` to the shared screen in `src/ui/questsScreen.ts`.
The list opens over the dimmed Map. Dismissing the list restores focus to
the Map's Quests button and keeps the Map's view and selection. Its footer
follows the [footer pattern](layout.md#groups), with neighbouring faces
`BUTTON_GAP` (16) apart.

The shared list groups “Story quests” before “Station jobs” and shows
`QUEST_LIST_PAGE_SIZE` (2) entries per page. Selecting a quest opens its
detail in the shared card. An empty list shows “Explore to find something
to do.”

The following geometry applies to shared list rows from every opener.
Measure from the row's left edge in logical px. The horizontal inset uses
the standard 44 px button face as its reference.

| Part                           | Value | Rule                                                                                                  |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| Chip slot inset                | 8     | Half the difference between the 44 px reference face and the 28 px slot                               |
| `MAP_SCREEN.quests.chip`       | 28    | Slot for the centred 24 px `QUEST_ICON` disc, whose drawn left edge is 10 px from the row's left edge |
| `MAP_SCREEN.quests.markGap`    | 6     | Gap from the slot to the label                                                                        |
| `MAP_SCREEN.quests.textColumn` | 42    | The 8 px inset, 28 px slot and 6 px gap added together                                                |

Quest labels wrap from the text column. Corresponding plain rows align to
that same column.

## Symbols

Every place carries a symbol key (`MapPlace.symbol`, the table below), the
holodisk waypoint included; `src/model/map.test.ts` covers every key and its
type line. Each place is a round chip: a `chip` disc in the symbol's face
colour with a 1 ink edge inside it, and the symbol's 20 glyph in ink, centred. Ada is her arrow. The objective carries the flight's direction
indicator.

Place chips are native buttons with `aria-pressed` for selection. The Map
field handles pointer selection and dragging; the chip handles keyboard and
assistive activation. Apply the [button state rules](controls.md#buttons) to
the chip's face or glyph for focus, press and selection. Use the face when
a chip has no glyph. Keep its permanent ink edge, place or job identity,
target, selected stacking and current keep-clear reservations. Decorative chips, Ada's keyline, objective marks
and search dashes keep their authored geometry.

The ring geometry below records the current runtime and spacing reservations
pending migration.

| Token                         | Value | Rule                                                                 |
| ----------------------------- | ----- | -------------------------------------------------------------------- |
| `MAP_SYMBOL.chip`             | 28    | Disc diameter                                                        |
| `MAP_SYMBOL.edge`             | 1     | Ink `#181425` edge inside the disc; face radius 13                   |
| `MAP_SYMBOL.glyph`            | 20    | Ink glyph mask, centred; every glyph pixel lies inside the face      |
| `MAP_SYMBOL.ring.radius`      | 17    | Current selection band centre radius                                 |
| `MAP_SYMBOL.ring.band`        | 2     | Cream `#ead4aa` band                                                 |
| `MAP_SYMBOL.ring.fringe`      | 1     | Ink fringe each side of the band; the ring's outer radius is 19      |
| `MAP_SYMBOL.objective.tip`    | 23    | Indicator tip above the chip centre: 2 clear of the ring and its ink |
| `MAP_SYMBOL.objective.stroke` | 2     | Lavender `#C4AFCC` (`pointOfInterest`) stroke, opaque                |
| `MAP_SYMBOL.objective.ink`    | 4     | Ink stroke under it on the same path, round joins                    |
| `MAP_SYMBOL.ada.size`         | 28    | Arrow box, centred on Ada's position                                 |
| `MAP_SYMBOL.ada.keyline`      | 1.5   | Ink keyline outside the hull (a 3 ink stroke under the fill)         |
| `MAP_SYMBOL.hit`              | 48    | Press area: `hitAround` of the chip, `HIT_RULE.minTarget`            |

| Symbol        | Place                       | Face      | Glyph                 | Type line   |
| ------------- | --------------------------- | --------- | --------------------- | ----------- |
| `station`     | A trading station           | `#C4AFCC` | `map-station.svg`     | Station     |
| `growers`     | The growers' outpost        | `#9CCC5A` | `map-growers.svg`     | Outpost     |
| `workshop`    | The workshop outpost        | `#F2D15A` | `map-workshop.svg`    | Outpost     |
| `salvagers`   | The salvagers' outpost      | `#8F9CF0` | `map-salvagers.svg`   | Outpost     |
| `destination` | Any other story destination | `#65C9BF` | `map-destination.svg` | Story place |
| `holodisk`    | Known, unrecovered holodisk | `#E868C8` | `map-holodisk.svg`    | Holodisk    |
| `nebula`      | A nebula landmark           | `#EAD4AA` | `map-nebula.svg`      | Nebula      |
| `wreck`       | A wreck landmark            | `#EAD4AA` | `map-wreck.svg`       | Wreck       |
| `beacon`      | A beacon landmark           | `#EAD4AA` | `map-beacon.svg`      | Beacon      |
| `job`         | A held job's own spot       | `#FEAE34` | `map-job-<type>.svg`  | None        |

- Faces are the in-world key colours: lavender `pointOfInterest` for
  stations, each outpost's own colour, mint `active` for destinations, the
  holodisk's pink; landmarks share cream, so their glyph tells them apart.
- Job marks, one cue for every held job: the job-orange `#FEAE34` face
  (`MAP_JOB_FACE`). A held job's target that is another place (a survey's
  landmark, a delivery's station or outpost) keeps its own symbol and glyph on
  the orange face. A job's own spot, a target that is no other place (a
  rescue's stranded craft, a hunt's search area centre), takes the `job`
  symbol: the round chip on the orange face with its job type's glyph,
  `map-job-survey`, `map-job-delivery`, `map-job-rescue` or `map-job-hunt`
  (the board row's [job icons](shop-icons.md#job-icons)). A hunt also draws its
  [search area](#search-area).
- Current selection adds the cream band and ink fringes outside the chip.
  Current keyboard focus adds a 2 px cream outline with 1 px offset, with
  the permanent inset ink edge still visible. The outlines can overlap.
  The chip currently keeps the same face and glyph colours in these
  states, with no separate pressed cue. Tech owns the replacement chip cues
  and verification of focus, contrast and reservations on each field.
- Objective indicator: the flight's arrow and circle
  (`src/game/scene.ts` `drawIndicators`, with `u` pointing down), above the
  chip at `(x, y)`: tip `(x, y - 23)` (`objective.tip`), base corners
  `(x ± 5, y - 36)`, circle radius 3 at `(x, y - 44)`. The lavender stroke
  draws over the ink stroke on every field.
- Ada uses Classic's canonical `ship-{0..31}.svg` frames, selected by the
  existing `shipHeading` helper. The 28 logical pixel wrapper stays centred
  on her map position at the frame's centre pivot, independent of map zoom.
  The frames already include the heading's projection, with no additional
  CSS rotation. All 32 frames decode eagerly and stay cached; a pending or
  failed heading retains the last decoded frame. The image alpha supplies
  the ink drop-shadow keyline using the existing `MAP_SYMBOL.ada.keyline`
  and `MAP_COLORS.ink`, without separate hull or canopy geometry.
- Ada is not a press target.

Draw order, bottom to top: field, fog, the search area, landmark chips, other chips, the
objective indicator, the selected chip and its ring, Ada, then the header,
footer, tools and panel. Within a layer, later places in the map's order draw on top.

### Glyphs

Seventeen 20 x 20 pixel grids in `art/tools/map-icons.ts`, written as one path of
whole-pixel runs each, like the [ammunition icons](weapon-icons.md#ammunition-icons). The tool
fails if a symbol pixel reaches past the chip's 13 face radius. The fill is
each file's default colour only (ink for symbols, cream for tools); the
runtime draws every glyph as a CSS mask in its state colour, with smooth
sampling, so it stays sharp at fractional scales. Every SVG is decorative
(`aria-hidden="true"`). The four `map-job-*` grids are the job board's row
icons, shared from `art/tools/job-glyphs.ts`. Rebuild with
`node art/tools/map-icons.ts`.

The hostile station's symbol, `map-hostile-station`, is a 24 px vector mask
drawn at 24 px: a hexagonal ring round a solid hexagonal core with a square
gun pod at each of its four corners
([heavies](heavies.md#hostile-station)). Its ring and core lie inside the
face; the pods' outer corners reach the face's 13 radius.

### Search area

A held hunt's search area, the circle Gameplay marks around the lost item
(`gameplay/quests.md`, 900 world units in radius), draws on the Map around the
hunt's own chip, from `mapArea` in [jobs.json](../public/art/jobs.json).

| Token               | Value   | Rule                                                                       |
| ------------------- | ------- | -------------------------------------------------------------------------- |
| Shape               | Ellipse | The world circle projected: `rx = radius * sqrt(2) * scale`, `ry = rx / 2` |
| `mapArea.width`     | 2       | Job-orange `#FEAE34` dash                                                  |
| `mapArea.ink`       | 4       | Ink `#181425` dash under it on the same path, on every field               |
| `mapArea.dash`      | 6, 4    | On, off, in logical px along the path; butt caps                           |
| `mapArea.minRadius` | 19      | Hidden while `rx` is under the selection ring's outer radius               |

- It draws over the fog and under every chip, so the hunt's chip and its
  selection ring sit on top. At `maxScale` it is about 60 x 30 at the phone
  view; at `minScale` (rx about 5.5) it hides and the chip alone marks the
  hunt.
- It takes no press: the hunt's chip is the place.
- The search area is always explored: the hunt's own spot is a discovered
  place, so the fog reveals 1500 world units around it, past the 900 radius.

| SVG                    | Glyph                                                                    | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `map-station.svg`      | Mast and dome over an elliptical ring                                    | `c37da99f168077a262e22d3ba864339700e46d7f55bf205ae0afa843a6256c24` |
| `map-growers.svg`      | Sunflower head: an 8 disc in eight petals                                | `d45d65444064a7ef623af615da73a389305ed3c55ba4071ac0058da8c6d7db6e` |
| `map-workshop.svg`     | Wrench on the diagonal, jaw to the top right                             | `44ebde453e4c2cc37b16cfb93fae76349f6ca5342e1e940293c87f22858a19a3` |
| `map-salvagers.svg`    | Electromagnet: horseshoe with gapped pole tips                           | `349287b87d73a3abc8850ac6f80472614631e30d0607679ca88f19e734d78a67` |
| `map-destination.svg`  | Swallowtail flag on a footed pole                                        | `c08853609fb79bbd8b90a9412e68de255ea8950892b3b74eede63d1edec67a25` |
| `map-holodisk.svg`     | Disc band around a spindle hole                                          | `a0af8690c6897e9fe24b0b647cc6fc9d270a74a7c664f2ff102a6374b0eac937` |
| `map-nebula.svg`       | Cloud with two stars                                                     | `17c2a676c16744df28415ebb8fce0efd91a79f3897fab95651bf3f7d963d943a` |
| `map-wreck.svg`        | Hull split in two with debris                                            | `0fa939e4cfbb6ad474d28972101070547ed7e87bee94777f1f73cf41dbf5c8ec` |
| `map-beacon.svg`       | Mast with a lamp and two pairs of signal arcs                            | `7b1ca89be87881ef4d8688f85af658f55cd5e8739a8319aadf2f074a6484ec75` |
| `map-job-survey.svg`   | Folded chart, middle panel raised, X knockout                            | `81ba78498f06a6383717a203580d3595ea6d4f0c27dcc826bce93378c7dc13a3` |
| `map-job-delivery.svg` | Parcel: lid over the box, knocked-out label                              | `6f3d862fd0088bce3a1b2fbfb4f37386b6024a58bc0d27b2ba17643acc9a8bfa` |
| `map-job-rescue.svg`   | Tow hook hanging from its eye                                            | `fb0eec4f96a028185496048e3af6e655b0b2c4037369bcdef07e70d64c7258ce` |
| `map-job-hunt.svg`     | Magnifier with a glint in the lens                                       | `9845ae0486b601b2c0394508a35cccf22d8127170137603306505ab339cb6470` |
| `map-close.svg`        | X, 2 to 3 px strokes; the shared close grid, currently unused on the Map | `a4299a5cdebef05021315beac332491023d5497befd2dc62878b305bc1f05b59` |
| `map-zoom-in.svg`      | Plus, 14 long, 2 thick                                                   | `21d936df7e0d21089102108780dbf64cf53009e5d507ca6d0beda4e1dd918600` |
| `map-zoom-out.svg`     | Minus, 14 long, 2 thick                                                  | `e95563bb5c3a9bb3526205298f32c890881fa14fdf79f602dd68d800223f34ca` |
| `map-recentre.svg`     | Crosshair: ring, centre dot and four ticks                               | `e50643fe1cd9b792a6f4ab3d56b288a29f356dc205a2ebe294332d6d2a6b2014` |

### Contrast per field

WCAG ratios of each mark against each galaxy's `background`
([Galaxies](galaxies.md)), truncated to two decimals. Sunflower, Cartwheel and
Whirlpool are light fields (`tint.light`); Phantom is dark.

| Mark                      | Colour    | Sunflower `#D8C994` | Cartwheel `#BC9D90` | Whirlpool `#B8CEC4` | Phantom `#514955` |
| ------------------------- | --------- | ------------------- | ------------------- | ------------------- | ----------------- |
| Station face              | `#C4AFCC` | 1.22                | 1.23                | 1.22                | 4.25              |
| Growers face              | `#9CCC5A` | 1.13                | 1.33                | 1.13                | 4.60              |
| Workshop face             | `#F2D15A` | 1.10                | 1.67                | 1.10                | 5.76              |
| Salvagers face            | `#8F9CF0` | 1.55                | 1.02                | 1.54                | 3.36              |
| Destination face          | `#65C9BF` | 1.19                | 1.27                | 1.18                | 4.37              |
| Holodisk face             | `#E868C8` | 1.75                | 1.15                | 1.74                | 2.97              |
| Landmark face             | `#EAD4AA` | 1.14                | 1.73                | 1.14                | 5.95              |
| Job face                  | `#FEAE34` | 1.12                | 1.35                | 1.11                | 4.64              |
| Search area dash          | `#FEAE34` | 1.12                | 1.35                | 1.11                | 4.64              |
| Ada hull                  | `#ffffff` | 1.65                | 2.51                | 1.65                | 8.62              |
| Objective stroke          | `#C4AFCC` | 1.22                | 1.23                | 1.22                | 4.25              |
| Current selection band    | `#ead4aa` | 1.14                | 1.73                | 1.14                | 5.95              |
| Ink edge, keyline, fringe | `#181425` | 10.89               | 7.17                | 10.86               | 2.08              |
| Tool disc face            | `#262b44` | 8.40                | 5.53                | 8.37                | 1.61              |

- Light-field keyline rule: on a light field (`tint.light`) every face, the
  stroke and the band fall below 2:1, and Ada's hull is 2.51:1 or less, so the
  ink parts carry each mark at 7.17:1 or more (Cartwheel; 10.89:1 on
  Sunflower): the chip's edge, Ada's keyline, the indicator's ink stroke and
  the current selection band's fringes. On Phantom the colours carry it
  (2.97:1 or more) and the ink parts are outlines. Every mark draws its ink parts on
  every field, so a mark has one look across galaxies; a map mark with no ink
  edge is not allowed.
- The search area's ink dash carries it on the light fields, 7.17:1 or more on
  the field and 4.93:1 or more on the fog (Cartwheel); its orange dash carries
  it on Phantom, 4.64:1 on the field and 3.18:1 on the fog.
- Glyphs are ink on the face: 6.21:1 (holodisk) to 12.43:1 (landmarks);
  9.71:1 on the job face.
- Tool glyphs on the navy disc: supporting 6.83:1, as in flight.
  On Phantom the disc is 1.61:1 and its glyph carries it.
- Header, ink at 0.65 over the field: on the light fields cream text 5.17:1 or
  more (Whirlpool, composite `#50555D`; Sunflower 5.20:1, `#5B534C`), the white
  name 7.50:1 or more and the uncharted pip ring `#b8b3c9` 3.69:1 or more; on
  Phantom 9.99:1, 14.47:1 and 7.12:1. Over fog: cream 5.80:1 or more on the
  light fields, 8.88:1 on Phantom.
  The divider is decorative.
- Panel: the card face `#3b3850`; cream name 7.76:1, supporting type line, job
  line and reason 5.53:1, Travel here as the secondary button.

## Fog

Unexplored space is fog: one flat colour over the field, with a feathered edge
around what Ada has explored. It draws directly over the field, under every
symbol, the [search area](#search-area) and the chrome. A held job's own spot is a
discovered place for the reveal, so a hunt's search area is never fogged.

| Token                       | Value | Rule                                                                             |
| --------------------------- | ----- | -------------------------------------------------------------------------------- |
| `MAP_SCREEN.fog.reveal`     | 1500  | World units explored around each explored chunk centre, discovered place and Ada |
| `chunkSize`                 | 512   | The centre of each 512-unit world chunk Ada has visited in this galaxy           |
| `MAP_SCREEN.fog.feather`    | 0.16  | Gaussian edge, sigma as a share of the reveal's on-screen x radius               |
| `MAP_SCREEN.fog.minFeather` | 3     | Sigma never below 3 logical px                                                   |

- Colour: the sRGB channel mean of the galaxy's `environment` and
  `environmentDetail`, rounded half up. It steps darker than the field on the
  light fields and lighter on Phantom, at 1.26 to 1.46:1: quiet, and never the
  only carrier of meaning.

| Galaxy    | Fog       | Against the field |
| --------- | --------- | ----------------- |
| Sunflower | `#C2B37F` | 1.26              |
| Cartwheel | `#9F7F73` | 1.45              |
| Whirlpool | `#9CB4AA` | 1.32              |
| Phantom   | `#6C6072` | 1.46              |

- A world circle of radius `reveal` projects to an axis-aligned ellipse with
  radii `reveal * sqrt(2) * scale` across and half that down. Draw the fog
  over the whole view, masked by the union of those ellipses at every explored
  chunk centre, every discovered place and Ada, the mask blurred by
  `sigma = max(minFeather, feather * rx)`.
- The explored record (explored chunk ids) persists per galaxy across flights
  and clears on Restart.
- Marks on fog: on the light fields the ink edge is 4.93:1 (Cartwheel) or more
  on the fog; on Phantom the faces are 2.03:1 (holodisk) or more and the ink
  edge 3.04:1.
- Fallback: with no explored record, draw the plain field and no fog. Places,
  Ada and the header then carry all the information.

## Projection and fit

| Token                       | Value | Rule                                                                         |
| --------------------------- | ----- | ---------------------------------------------------------------------------- |
| `MAP_SCREEN.fitMargin`      | 22    | Chip radius plus `SPACING.gap`: symbols keep this far inside the fit region  |
| `MAP_SCREEN.minBox.width`   | 12000 | The opening box is at least this many projected units across                 |
| `MAP_SCREEN.minBox.height`  | 6000  | And this many down                                                           |
| `MAP_SCREEN.chartRadius`    | 25000 | `CHARTING_RADIUS` (`src/model/map.ts`), the disc used for the zoom reference |
| `MAP_SCREEN.zoomStep`       | 1.5   | One zoom step                                                                |
| `MAP_SCREEN.zoomRangeShift` | 2     | Outward shift applied to the zoom-in and disc-fit references                 |
| `MAP_SCREEN.wheelStep`      | 100   | Wheel `deltaY` px per zoom step                                              |
| `MAP_SCREEN.dragThreshold`  | 8     | `SCROLL.dragThreshold`: movement past this pans and never selects            |

- Projection: the flight's own, `x - y` across and `(x + y) / 2` down
  (`chartProjection`), times the map's `scale` in logical px per projected
  unit. Up on the map is up in flight, and Ada's arrow points where her ship
  faces.
- Fit region (`fitRegion`): left and right the page rect's, top
  `page top + MAP_SCREEN.header.height + SPACING.gap` (88 at a top inset up
  to 16, below the header and the tools), bottom `Close top - SPACING.gap`
  (288 at the 720 base, 285 with phone insets, above the footer). Inset by
  `fitMargin` on every side it is the inner region. The panel floats over its
  lower part.
- Both zoom references move two steps outward by dividing their scales by
  `shift = zoomStep ** zoomRangeShift` (`1.5²`). The zoom-in bound is
  `maxScale = min(innerWidth / minBox.width, zoomHeight / minBox.height) / shift`,
  where `zoomHeight` is the page rect's height less `2 * fitMargin` (284 at
  the 720 base).
- `minScale = max(disc fit / shift, world fit)`, where disc fit is
  `min(innerWidth / (2 sqrt(2) R), innerHeight / (sqrt(2) R))` for
  `R = chartRadius`. The hard floor `world fit` is
  `max(fieldWidth / (2 side), fieldHeight / side)` for the wrap square's
  180000-unit side.
- Opening fit: the bounding box of Ada and every discovered place, at their
  canonical positions in the wrap square, projected, grown about its centre to
  at least `minBox`; `scale = clamp(min(innerWidth / box width, innerHeight /
box height), minScale, maxScale)`; the box centre at the inner region's
  centre. Near the seam the box widens, often to `minScale`. When `minScale`
  clamps it, pan the least distance to bring Ada into the inner region, then
  apply the pan limits below. Nothing is selected on opening.
- Pan limit: pan and zoom stay within one wrap period, the canonical
  180000-unit square that flight wraps into, which the map projects as a 2:1
  diamond. The inner region's centre stays inside the diamond (`|x| / 2 + |y|
<= side / 2`), and the whole map field's edge stays inside the diamond's
  bounding box (x within ±180000, y within ±90000), so up to half the view
  can show past a diagonal seam. A pan beyond the one-wrap bounds moves to
  the nearest centre within them. At maximum zoom-out only (`minScale`),
  the actual projected charting oval must overlap the map field inset by
  1 logical px on each side. Near an extreme seam, keeping that overlap can
  take priority over keeping Ada visible. At closer scales the one-wrap
  bounds keep every point reachable, including the tips. Every zoom and pan
  path applies these limits, so zooming out near an edge may re-centre the
  view. Every position draws at its canonical point in the square, so a
  place just across the seam from Ada draws at the far edge.
- Stations exist outside the charting disc in every galaxy (the station
  catalog fills every cell). Once discovered, each is a place, and the opening
  fit reaches it within the square.

| View, CSS px    | Fit region      | Inner region    | `maxScale` | `minScale` | Zoom steps between |
| --------------- | --------------- | --------------- | ---------- | ---------- | ------------------ |
| 844x390, insets | 692.31 x 196.62 | 648.31 x 152.62 | 0.02079    | 0.00216    | 5.58               |
| 720x360 (base)  | 688 x 200       | 644 x 156       | 0.02104    | 0.00200    | 5.80               |
| 1280x720        | 688 x 245       | 644 x 201       | 0.02385    | 0.00253    | 5.54               |

### Close places

A far station or a wide spread of discoveries lowers the opening scale.
Nearby places' chips can overlap even at full zoom.

1. Press rule. Each chip's press area is `hitAround(chip)`, 48 x 48 on its
   drawn centre. A press goes to `pressedArea` (`hitAreas.ts`): of the areas
   that take the press in, the chip whose drawn centre is nearest wins. Every
   chip is therefore selectable by pressing its own visible centre, however
   its area overlaps a neighbour's. Exact ties go to the chip drawn on top.
2. Scale rule. Zoom spreads the chips up to `maxScale`. When chips still
   overlap, the nearest-centre press rule applies. Gameplay keeps mapped places
   at least 1020 world units apart.

The selected chip draws above every other chip, so the place the panel names
is always fully visible. Header, tools, footer and panel sit above the field
and take presses first; a chip under them takes no press there.

## Interaction

- Open: Map on the Paused card opens the map at the opening fit. The Paused
  card and its dim hide; one screen shows at a time.
- Dismissal: the Map's X invokes the same one-layer action as the footer
  and allowed Back or Escape. From Paused, return to that card and restore
  focus to the Map opener when available.
- Pan: a pointer pressed on the field (on a chip or not) that moves more than
  `dragThreshold` pans the map with the pointer and selects nothing.
- Select: a press released within `dragThreshold` selects the chip that
  `pressedArea` gives; on empty field it clears the selection. Selecting the
  selected chip keeps it selected.
- Keep clear: on selection, pan the least distance that puts the current
  19 px radius reservation inside the fit region and at least `SPACING.gap`
  above the panel's top. The pan is immediate.
- Pinch: two pointers zoom by the ratio of their distance, about their
  midpoint, and pan with the midpoint.
- Wheel: zoom by `zoomStep` per `wheelStep` of `deltaY` (continuous:
  `zoomStep ** (-deltaY / wheelStep)`), about the pointer. Line-mode deltas
  count 1 line as `wheelStep / 3`.
- Tools: zoom in and out by one `zoomStep` about the fit region's centre;
  recentre pans to Ada at the current scale.
- Every zoom clamps to `minScale`..`maxScale`; every pan clamps to the pan
  limit.
- Current keyboard order: Tab moves through the tools (zoom out, zoom in, recentre), then
  the places in reading order (drawn centre top to bottom, then left to
  right), then Travel here, then the footer (Quests, Galaxies, Close), and
  wraps at either end. Enter or Space on a place selects it; focusing a place
  pans it clear by the keep-clear rule. Focus starts on Close.
- Travel here: Gameplay's teleport. While Ada is in danger or towing it is
  unavailable, with the reason line; activation plays the refusal cue.
- Quests and Galaxies: see [Footer](#footer).

## States

The selected rows record the current chip visuals pending button-state migration.

| State                 | Field and symbols                               | Panel                                                                           |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Nothing mapped        | Ada only, fog except around her path            | Empty note, "No destinations mapped yet."                                       |
| Places, none selected | Chips; the objective's indicator once mapped    | None; in danger, the reason-only panel                                          |
| Travel place selected | Selection ring on the chip                      | Chip, name, type line, Travel here (secondary)                                  |
| Other place selected  | Selection ring on the landmark or holodisk chip | Chip, name, type line; no action                                                |
| Job target selected   | Selection ring on the orange-faced chip         | Row grows to 68: name, type line, "Job: {objective}"; Travel here where offered |
| Job spot selected     | Selection ring on the orange job chip           | Job chip and the job's name; no action                                          |
| In danger             | Galaxies unavailable                            | Travel here unavailable, "Unavailable while you are in danger."                 |
| Towing                | Galaxies available                              | Travel here unavailable, "Unavailable while towing."                            |
| Quests open           | Under the modal dim                             | Under the modal dim                                                             |
| Light field           | Ink parts carry every mark (keyline rule)       | Unchanged                                                                       |
| No explored record    | Plain field, no fog                             | Unchanged                                                                       |

## Pause card

Map opens from the [Paused card](layout.md#cards), including while Ada is
in danger.
Galaxies is on the map, not on the card; in danger it and Travel here
are unavailable on the map.

## Strings

Gameplay's, from `gameplay/player-copy.md`: Map; "{percent}% mapped"; Travel
here; Galaxies; Quests; "No destinations mapped yet."; "Unavailable
while you are in danger.";
the galaxy names; "Unavailable while towing."; the tools' accessible labels;
the footer dismissal, Back from the Paused card and Close otherwise;
and "Job: {objective}" (`jobObjective`, also in `gameplay/quests.md`), under
the type line of the held job's target. The type line uses:

- Types: Station, Outpost, Story place, Holodisk, Nebula, Wreck, Beacon.
  Outposts say "Outpost" without their name.
- Form "{type} · {distance}". The distance is the world distance from Ada
  divided by 1000, in light-years: one decimal below 10 ("0.4 light-years"),
  whole numbers from 10 ("12 light-years"), en-US grouping, and "1 light-year"
  when it rounds to 1.
