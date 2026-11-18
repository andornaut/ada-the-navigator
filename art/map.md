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

The map is a screen, not a card: the field fills the whole logical view, under
the insets, and the header, the tools, the footer and the place panel float on
it. Like a modal it takes input exclusively; nothing of the flight HUD shows.
Every part anchors to the page rect, `safeRect(insets, SPACING.pageInset, view)`:
16 in from each view edge, or the safe inset where that is larger. At the 720
base it spans 16 to 704 across and 16 to 344 down; with phone insets (left and
right 43, bottom 19) 43 to 677 and 16 to 341.

| Part   | Anchor                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Field  | The whole logical view, in the galaxy's `background` with the fog over it                                                 |
| Header | Left and top on the page rect's top-left corner (`mapRowTop`)                                                             |
| Tools  | One row of three `HUD_BUTTON` targets, the last target's right and every target's top on the page rect's top-right corner |
| Footer | Quests, Galaxies, then Close, the last's right and every button's bottom on the page rect's bottom-right corner           |
| Panel  | Left and bottom on the page rect's bottom-left corner                                                                     |
| Fit    | The region left for the map: see [Projection and fit](#projection-and-fit)                                                |
| Quests | A modal card over the map: see [Quests modal](#quests-modal)                                                              |

### Header

One ink panel holding, left to right: the galaxy name (`TYPE.heading`, white),
a divider, then a column of one pip per landmark over "{percent}% mapped"
(`TYPE.label`, cream). Strings are Gameplay's: the galaxy names and
"{percent}% mapped" (`gameplay/player-copy.md`).

| Token                          | Value | Rule                                                                                                   |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| `MAP_SCREEN.header.height`     | 64    | The name row (`rowHeight` 36: the 28 heading line plus `2 * SPACING.rowGap`), a 20 line, `SPACING.gap` |
| `MAP_SCREEN.header.radius`     | 4     | As `PILL`                                                                                              |
| `MAP_SCREEN.header.alpha`      | 0.65  | Ink `#181425` panel, the HUD panel alpha                                                               |
| `MAP_SCREEN.header.padding`    | 16    | At each end                                                                                            |
| `MAP_SCREEN.header.nameTop`    | 10    | The name's 28 line box top, centring it in the row                                                     |
| `MAP_SCREEN.header.dividerGap` | 12    | Name, 12, a 1x16 divider `#57536e` centred on the row, 12, the column                                  |
| `MAP_SCREEN.header.stackTop`   | 9     | The column's top: `(48 - 30) / 2` for the 6 pips, the gap and the 20 line; to implement                |
| `MAP_SCREEN.header.stackGap`   | 4     | Pips to the percent's line box (`SPACING.rowGap`), which tops at 19; to implement                      |
| `MAP_SCREEN.header.labelTop`   | 14    | The percent's 20 line box top when the galaxy has no landmarks                                         |
| `MAP_SCREEN.header.pip`        | 6     | Pip diameter                                                                                           |
| `MAP_SCREEN.header.pipPitch`   | 8     | Pip centre to centre (2 apart)                                                                         |

- The pips and the percent both start at the column's left. With no
  landmarks the pip row is absent and the percent centres on the row
  (`labelTop`).
- Width: `2 * padding + name + 12 + 1 + 12 + column`, where `column` is
  `max(percent, 8 * n - 2)` for `n` landmarks. The widest is 279.8:
  "Sunflower" (116.0), "100% mapped" (106.8) and 12 pips (94).
- A charted landmark's pip is a filled cream `#ead4aa` disc. An uncharted
  landmark's pip is a 1 px `#b8b3c9` ring of the same diameter, hollow, so the
  two read apart by shape as well as colour.
- The header's width is capped at `mapHeaderCap`:
  `min(view width / 2, toolColumnLeft - SPACING.gap - page left)`, 360 at the
  720 base and with phone insets (the second term is 518 and 464). A header
  wider than the cap keeps its text widths and scales the pip row to fit
  (`containedMapHeader`).
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
  edge, 20 glyph mask in supporting `#b8b3c9`.
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

Three `TEXT_BUTTON`s in one action row on the page rect's bottom-right
corner, left to right: Quests and Galaxies (secondary), then Close (primary,
action `map-close`), the map's only primary button. Constants:
`MAP_SCREEN.hudRow`, and the rects `mapQuestsRect`, `mapGalaxiesRect` and
`mapCloseRect` in `src/ui/layout/mapScreen.ts`.

| Token                              | Value | Rule                                                                                                                                   |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `MAP_SCREEN.hudRow.height`         | 48    | `TEXT_BUTTON.height`                                                                                                                   |
| `MAP_SCREEN.hudRow.close.width`    | 98    | The wider label (`MAP_HUD_LABEL_WIDTHS`, `TYPE.label` up to the quarter pixel: Galaxies 66, Quests 54.25) plus `2 * TEXT_BUTTON.inset` |
| `MAP_SCREEN.hudRow.galaxies.width` | 98    | As Close                                                                                                                               |
| `MAP_SCREEN.hudRow.quests.width`   | 98    | As Close                                                                                                                               |
| `MAP_SCREEN.hudRow.gap`            | 16    | `BUTTON_GAP`, face to face                                                                                                             |

- Close: `x = page right - 98`, `y = page bottom - 48`. Galaxies ends
  `BUTTON_GAP` left of Close, and Quests `BUTTON_GAP` left of Galaxies.

| View, logical            | Quests     | Galaxies   | Close      | Down       |
| ------------------------ | ---------- | ---------- | ---------- | ---------- |
| 720x360                  | 378 to 476 | 492 to 590 | 606 to 704 | 296 to 344 |
| 720x360, phone insets 43 | 351 to 449 | 465 to 563 | 579 to 677 | 293 to 341 |

- Close's right is the tool row's right, so the two right-align.
- Close's label is the caller's dismissal: "Back" when the map opens from the
  Paused card (`questBack`), "Close" otherwise. It returns to the Paused card,
  as back and Escape do. The width stays 98 for either label.
- Each button is its press area (48, `HIT_RULE.minTarget`). The fit region's
  bottom is `SPACING.gap` above the footer's top.
- Quests opens the [Quests modal](#quests-modal). It is always available, in
  danger and while towing too.
- Galaxies: Gameplay's action, with no confirm. It opens the
  [galaxy selector](layout.md#galaxy-selector), from which Earth returns Ada
  to her room and Jump leaves for another galaxy. It stays available while
  towing; leaving the galaxy returns the towed craft to where it was
  stranded. In danger it shows the unavailable face
  (disabled face, focusable), activation plays the
  [refusal cue](controls.md#refusal-cue), and the panel shows the danger
  reason (below).

### Place panel

Shows while a place is selected, holds the empty note while the map has no
places, and holds the danger reason while Ada is in danger. A
`ui-settings-card` face (the card nine-slice) with no close X and no dim, its
left and bottom on the page rect's bottom-left corner.

| Token                 | Value | Rule                                                   |
| --------------------- | ----- | ------------------------------------------------------ |
| `MAP_PANEL.padding`   | 16    | `SPACING.panelPadding`, including the 2 frame          |
| `MAP_PANEL.minWidth`  | 360   | The card floor: half the 720 base width                |
| `MAP_PANEL.markGap`   | 8     | Chip to the text block, and text block to the button   |
| `MAP_PANEL.actionGap` | 16    | Text block to Travel here: an 8 margin plus `markGap`  |
| `MAP_PANEL.row`       | 48    | The row's minimum height (`TEXT_BUTTON.height`)        |
| `MAP_PANEL.textTop`   | 4     | Padding above and below the text block's 20 line pitch |
| `MAP_PANEL.reasonGap` | 8     | Row to the reason line (`SPACING.gap`)                 |

The row, left to right, every part centred on it:

1. The place's chip, 28, drawn as on the field without the selection ring or
   objective indicator.
2. The text block, one 20 line each (`TYPE.label` and `TYPE.body` line
   height): the place's name (`TYPE.label`, cream `#ead4aa`), then
   "{type} · {distance}" (`TYPE.body`, supporting `#b8b3c9`), then, when the
   place is the held job's target, "Job: {objective}" (`TYPE.body`,
   supporting). A job's own spot shows its name only.
3. Travel here: a secondary `TEXT_BUTTON`, 48 high, label width plus
   `2 * TEXT_BUTTON.inset`, at the row's right end. Only destinations and
   stations offer it (`MapPlace.travel`); a landmark, the holodisk waypoint or
   a job's own spot shows the chip and text block only.

Below the row, `reasonGap` apart, one reason line (`TYPE.body`, supporting,
left-aligned at the inner left) shows while Travel here or Galaxies is
unavailable.

- Row height: `max(row, 2 * textTop + 20 * lines)` for `lines` counting the
  name: 48 with one or two lines, 68 with the job line. Travel here and the
  chip stay centred, so in a 68 row the button's top is 10 below the row's
  top and the chip's 20.
- Height: `2 * padding + row height`, plus `reasonGap + 20` with the reason
  line: 80 or 108 with two lines, 100 or 128 with the job line.
- Width: the panel sizes to its content,
  `clamp(floor, maxWidth, 2 * padding + max(row, reason))`. `row` is
  `28 + markGap + text + 8`, plus `markGap + button` when Travel here shows;
  `text` is the widest of its lines. `reason` is the widest reason string
  while a reason shows (both share one cell), and absent otherwise. Text
  wraps inside `maxWidth` and the panel's measured height grows with it.
- `maxWidth` (`panelMaxWidth`) is `Quests left - SPACING.gap - page left`, so
  the panel always ends at least `SPACING.gap` left of the footer: 354 at the
  720 base (`378 - 8 - 16`) and 300 with phone insets (`351 - 8 - 43`).
  `floor` is `min(minWidth, maxWidth)`. Both caps are under 360, so at the 720
  base the panel is 354 wide in every state (300 with phone insets).
- Empty panel, while the map has no places: one centred `TYPE.body` supporting
  line, "No destinations mapped yet." (Gameplay), height `16 + 20 + 16` = 52,
  width `clamp(floor, maxWidth, text + 32)`.
- Reason-only panel, in danger with nothing selected: the danger line alone,
  left-aligned, height `16 + 20 + 16` = 52, width
  `clamp(floor, maxWidth, reason + 32)`. With no places it follows the empty
  note, `reasonGap` apart: 80 high.
- Travel here unavailable: the disabled face, focusable; activation plays the
  refusal cue ([Controls](controls.md#buttons)). The reason is "Unavailable
  while you are in danger." or "Unavailable while towing." (Gameplay). One
  reason shows at a time; danger wins over towing.
- In danger the danger line shows with every selection, whether or not the
  place offers Travel here, because Galaxies is unavailable too. The
  towing line shows only while a place offering Travel here is selected.
- The panel's chip and text are decorative to the pointer: a press on the panel
  outside Travel here does nothing and never reaches the field.

### Quests modal

The galaxy's current quests fill the available card area
([Layout](layout.md#modals)) titled "Quests", with the close X, over the map
under the modal dim. The dim covers the field, the header, the tools, the
footer and the panel. The header and page controls stay fixed; measured pages
retain every quest entry, description, source and destination icon and label,
reward and action without scrolling or reducing the text size. Long prose
continues on subsequent pages. Previous is hidden on the first page; Next
shows only when another page follows. The close X, an outside tap, back and
Escape close it, leaving the map's view and selection unchanged. Focus starts
on the first visible location button, or on the close X without one. The
existing `openQuests` and `closeQuests` map routes remain unchanged.
Constants: `MAP_SCREEN.quests`.

| Token                          | Value | Rule                                                                                   |
| ------------------------------ | ----- | -------------------------------------------------------------------------------------- |
| `MAP_SCREEN.quests.lineGap`    | 8     | Between lines (`SPACING.gap`), the same as `STACK_BUTTON_GAP` between two line buttons |
| `MAP_SCREEN.quests.chip`       | 28    | A line button's chip (`MAP_SYMBOL.chip`)                                               |
| `MAP_SCREEN.quests.overhang`   | 4     | The chip past the label's 20 line box, above and below, in the 44 face                 |
| `MAP_SCREEN.quests.markGap`    | 6     | Chip to label (`SPACING.markGap`)                                                      |
| `MAP_SCREEN.quests.textColumn` | 50    | Text start from the inner edge: `TEXT_BUTTON.inset + chip + markGap`                   |
| `MAP_SCREEN.quests.ring`       | 1     | The unmapped ring's width, `#b8b3c9`                                                   |

Lines, in Gameplay's order: the story objective, or "Story complete." once the
chapter is resolved; the held job or activity as "Job: {objective}"; with no
job held and a station discovered, "Station job boards have more to do.".
With no lines, the card holds the empty note "Explore to find something to
do.".

1. Mapped line, its target a place on the map: a secondary `TEXT_BUTTON`
   filling the inner width, content left-aligned: the target's chip (as in the
   place panel, without the ring or indicator), `markGap`, then the line in
   `TYPE.label` as the button label. The chip overhangs the label's line box by
   4 above and below, so a one-line button is 48; each wrapped line adds 20.
2. Plain line: `TYPE.body`, supporting `#b8b3c9`, starting on the text column,
   20 per line, wrapping as prose. A line whose
   target is not yet mapped carries a 28 hollow ring in the chip slot, the
   uncharted pip's look, centred on the text and overhanging it by 4 each way.
   "Story complete." and the job-board line carry no ring. The ring is
   decorative: the line reads as its text.
3. Empty note: one centred `TYPE.body` supporting line.

- Width: the Large family, 688 capped at the available width (634 with phone
  insets, 688 at the 720 base); a button wider than the inner width wraps.
- Height: `58 + lines + gaps + 16`. Every state fits the 325 available.

| State at 720x360, phone insets                    | Lines                           | Card      |
| ------------------------------------------------- | ------------------------------- | --------- |
| Story target mapped, no job, a station discovered | Button 48, plain 20             | 634 x 150 |
| Story and job targets mapped                      | Two buttons, 48 each            | 634 x 178 |
| Story target unmapped, job target mapped          | Ringed plain, button            | 634 x 150 |
| A job line wider than the 602 inner width         | Button 48, button wrapped to 68 | 634 x 198 |
| Story complete, no job, a station discovered      | Two plain lines                 | 634 x 122 |
| No lines                                          | Empty note                      | 634 x 94  |

- Press: a mapped line closes the modal, pans so its chip sits at the fit
  region's centre at the current scale (clamped by the pan limit), applies the
  keep-clear rule, then selects the chip; the place panel shows as for any
  selection. At 720x360 with phone insets the centre is (360, 186.5) and the
  ring's bottom 205.5: it clears the 80, 100 and 108 panels (tops 261, 241
  and 233) by at least `SPACING.gap`, and keep-clear lifts it 0.5, to
  `SPACING.gap` above the 128 panel (top 213).
- Plain lines and the empty note take no input.
- In danger the modal is unchanged: Quests and every line button stay
  available, and a selection is never refused.

## Symbols

Every place carries a symbol key (`MapPlace.symbol`, the table below), the
holodisk waypoint included; `src/model/map.test.ts` covers every key and its
type line. Each place is a round chip: a `chip` disc in the symbol's face
colour with a 1 ink edge inside it, and the symbol's 20 glyph in ink, centred. Ada is her arrow. The objective carries the flight's direction
indicator.

| Token                         | Value | Rule                                                                 |
| ----------------------------- | ----- | -------------------------------------------------------------------- |
| `MAP_SYMBOL.chip`             | 28    | Disc diameter                                                        |
| `MAP_SYMBOL.edge`             | 1     | Ink `#181425` edge inside the disc; face radius 13                   |
| `MAP_SYMBOL.glyph`            | 20    | Ink glyph mask, centred; every glyph pixel lies inside the face      |
| `MAP_SYMBOL.ring.radius`      | 17    | Selection ring centre radius: 2 outside the face, as `FOCUS_RING`    |
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
- Selected: the selection ring around the chip. Focus-visible: the shared
  focus ring, `FOCUS_RING.outset` outside the face and round with it; the two
  may overlap.
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
whole-pixel runs each, like the [weapon icons](weapon-icons.md). The tool
fails if a symbol pixel reaches past the chip's 13 face radius. The fill is
each file's default colour only (ink for symbols, cream for tools); the
runtime draws every glyph as a CSS mask in its state colour, with smooth
sampling, so it stays sharp at fractional scales. Every SVG is decorative
(`aria-hidden="true"`). The four `map-job-*` grids are the job board's row
icons, shared from `art/tools/job-glyphs.ts`. Rebuild with
`node art/tools/map-icons.ts`.

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

| SVG                    | Glyph                                                             | SHA-256                                                            |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `map-station.svg`      | Mast and dome over an elliptical ring                             | `c2a127db459dc3ee1d48a4b8a6560ac59b41c35921d4f345fca0cc1e941c6bb1` |
| `map-growers.svg`      | Sunflower head: an 8 disc in eight petals                         | `39afebe5011328317255fefb81f6a1f2ad869d4ef3514aeb034e78f208e9eb6a` |
| `map-workshop.svg`     | Wrench on the diagonal, jaw to the top right                      | `8128bbfe49ad653c57a232531f9418068704f52920c8f4a37e5f8c245c7d152c` |
| `map-salvagers.svg`    | Electromagnet: horseshoe with gapped pole tips                    | `cb6121dfddb4782d78fd18f61cb550fb31243736fdc5f57717b988dd9af00ba8` |
| `map-destination.svg`  | Swallowtail flag on a footed pole                                 | `9869982e9c42b3d88bc60e10c09fc75ef02b01253d6d5084b37b6474d2c4a922` |
| `map-holodisk.svg`     | Disc band around a spindle hole                                   | `8d40d73ea39fb43e51db27fe34a7596714b12f2e331654067313906ed3e15fd6` |
| `map-nebula.svg`       | Cloud with two stars                                              | `ea5ba9ecbcb0e0ba937cf9881b8658fb2c3d7505ca69b2708ad2951824b38594` |
| `map-wreck.svg`        | Hull split in two with debris                                     | `ce77a498d883397da78ab728e2aa8b0745744857738b2d6131bff19e3624519c` |
| `map-beacon.svg`       | Mast with a lamp and two pairs of signal arcs                     | `3666df581a95d05be737af27b8b327fd9a8b386af3c1e0591bce9b21b4e04810` |
| `map-job-survey.svg`   | Folded chart, middle panel raised, X knockout                     | `96af3a92c85b64992f8366d56ac8acd62c95aa6c99748b29111f67aa7f8518d8` |
| `map-job-delivery.svg` | Parcel: lid over the box, knocked-out label                       | `87af099b17421f9bfc05899288bab445c7eae71f86add2a46e087254f070431e` |
| `map-job-rescue.svg`   | Tow hook hanging from its eye                                     | `8d0f32e66855226136d6f518613755b480fb34b1d3706dd13e7755def0f09903` |
| `map-job-hunt.svg`     | Magnifier with a glint in the lens                                | `87b6a33ba4f42714c233f7e7eeaf67ba924a7de70c44ce024a1b3fd8e83d22d0` |
| `map-close.svg`        | X, 2 to 3 px strokes; the shared close grid, not drawn on the Map | `dfa06d6c874628b4d8234d834349f9d084329bf797483a8941cb8743a3858835` |
| `map-zoom-in.svg`      | Plus, 14 long, 2 thick                                            | `2941643dfb9821cddf4f9211799ce06a831d4f734dee00b761525faed2185d49` |
| `map-zoom-out.svg`     | Minus, 14 long, 2 thick                                           | `4f12cd67b7dec154e9b555609d22d9a5e92fe74b55f26b70ce64bf7c239fe2c7` |
| `map-recentre.svg`     | Crosshair: ring, centre dot and four ticks                        | `e37051fd500afbb0613a0844f27e96f69011dfcb283e6554ea4fc23c21c723e4` |

### Contrast per field

WCAG ratios of each mark against each galaxy's `background`
([Galaxies](galaxies.md)), truncated to two decimals. Sunflower is the light
farm-yellow field `#D8C994`; the others are dark.

| Mark                      | Colour    | Sunflower `#D8C994` | Cartwheel `#39221E` | Whirlpool `#132D33` | Phantom `#241827` |
| ------------------------- | --------- | ------------------- | ------------------- | ------------------- | ----------------- |
| Station face              | `#C4AFCC` | 1.22                | 7.28                | 7.13                | 8.38              |
| Growers face              | `#9CCC5A` | 1.13                | 7.87                | 7.71                | 9.06              |
| Workshop face             | `#F2D15A` | 1.10                | 9.87                | 9.67                | 11.37             |
| Salvagers face            | `#8F9CF0` | 1.55                | 5.75                | 5.63                | 6.62              |
| Destination face          | `#65C9BF` | 1.19                | 7.49                | 7.34                | 8.63              |
| Holodisk face             | `#E868C8` | 1.75                | 5.09                | 4.99                | 5.86              |
| Landmark face             | `#EAD4AA` | 1.14                | 10.19               | 9.99                | 11.73             |
| Job face                  | `#FEAE34` | 1.12                | 7.96                | 7.80                | 9.16              |
| Search area dash          | `#FEAE34` | 1.12                | 7.96                | 7.80                | 9.16              |
| Ada hull                  | `#ffffff` | 1.65                | 14.77               | 14.47               | 17.00             |
| Objective stroke          | `#C4AFCC` | 1.22                | 7.28                | 7.13                | 8.38              |
| Ring band                 | `#ead4aa` | 1.14                | 10.19               | 9.99                | 11.73             |
| Ink edge, keyline, fringe | `#181425` | 10.89               | 1.21                | 1.24                | 1.05              |
| Tool disc face            | `#262b44` | 8.40                | 1.06                | 1.04                | 1.22              |

- Light-field keyline rule: on a light field (`tint.light`, Sunflower) every
  face, the hull, the stroke and the band fall below 2:1, so the ink parts
  carry each mark at 10.89:1: the chip's edge, Ada's keyline, the indicator's
  ink stroke and the ring's fringes. On a dark field the colours carry it (4.99:1
  or more) and the ink parts are outlines. Every mark draws its ink parts on
  every field, so a mark has one look across galaxies; a map mark with no ink
  edge is not allowed.
- The search area's ink dash carries it on Sunflower, 10.89:1 on the field and
  8.62:1 on the fog; its orange dash carries it on the dark fields.
- Glyphs are ink on the face: 6.21:1 (holodisk) to 12.43:1 (landmarks);
  9.71:1 on the job face.
- Tool glyphs on the navy disc: supporting 6.83:1, as in flight.
  On dark fields the disc is 1.04 to 1.22:1 and its glyph carries it.
- Header, ink at 0.65 over the field: cream text 5.20:1 on Sunflower (composite
  `#5B534C`) and 11.65:1 or more on the dark fields; the white name 7.53:1 and
  16.89:1 or more; the uncharted pip ring `#b8b3c9` 3.70:1 and 8.30:1 or more.
  Over fog: cream 5.80:1 on Sunflower, 10.84:1 or more on the dark fields.
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
  `environmentDetail`, rounded half up. It steps darker than the field on
  Sunflower and lighter on the dark fields, at 1.24 to 1.30:1: quiet, and
  never the only carrier of meaning.

| Galaxy    | Fog       | Against the field |
| --------- | --------- | ----------------- |
| Sunflower | `#C2B37F` | 1.26              |
| Cartwheel | `#4C3430` | 1.29              |
| Whirlpool | `#254046` | 1.30              |
| Phantom   | `#362939` | 1.24              |

- A world circle of radius `reveal` projects to an axis-aligned ellipse with
  radii `reveal * sqrt(2) * scale` across and half that down. Draw the fog
  over the whole view, masked by the union of those ellipses at every explored
  chunk centre, every discovered place and Ada, the mask blurred by
  `sigma = max(minFeather, feather * rx)`.
- The explored record (explored chunk ids) persists per galaxy across flights
  and clears on Restart.
- Marks on fog: on Sunflower the ink edge is 8.62:1 on the fog; on the dark
  fields the faces are 3.81:1 (holodisk on Whirlpool) or more.
- Fallback: with no explored record, draw the plain field and no fog. Places,
  Ada and the header then carry all the information.

## Projection and fit

| Token                      | Value | Rule                                                                        |
| -------------------------- | ----- | --------------------------------------------------------------------------- |
| `MAP_SCREEN.fitMargin`     | 22    | Chip radius plus `SPACING.gap`: symbols keep this far inside the fit region |
| `MAP_SCREEN.minBox.width`  | 12000 | The opening box is at least this many projected units across                |
| `MAP_SCREEN.minBox.height` | 6000  | And this many down                                                          |
| `MAP_SCREEN.chartRadius`   | 25000 | `CHARTING_RADIUS` (`src/model/map.ts`): the disc `minScale` fits            |
| `MAP_SCREEN.zoomStep`      | 1.5   | One zoom step                                                               |
| `MAP_SCREEN.wheelStep`     | 100   | Wheel `deltaY` px per zoom step                                             |
| `MAP_SCREEN.dragThreshold` | 8     | `SCROLL.dragThreshold`: movement past this pans and never selects           |

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
- `maxScale = min(innerWidth / minBox.width, zoomHeight / minBox.height)`,
  where `zoomHeight` is the page rect's height less `2 * fitMargin` (284 at
  the 720 base).
- `minScale` fits the charting disc: `min(innerWidth / (2 sqrt(2) R),
innerHeight / (sqrt(2) R))` for `R = chartRadius`.
- Opening fit: the bounding box of Ada and every discovered place, projected,
  grown about its centre to at least `minBox`; `scale = clamp(min(innerWidth /
box width, innerHeight / box height), minScale, maxScale)`; the box centre at
  the inner region's centre. When `minScale` clamps it (a discovered station
  far outside the disc), pan the least distance that brings Ada inside the
  inner region.
  Nothing is selected on opening.
- Pan limit: the inner region's centre stays within the projected bounding box
  of the charting disc and every discovered place, so a far station stays
  reachable and the map never drifts into empty space.
- Stations exist outside the charting disc in every galaxy (the station
  catalog fills every cell). Once discovered, each is a place, and the opening
  fit and pan limit reach it.

| View, CSS px    | Fit region      | Inner region    | `maxScale` | `minScale` | Zoom steps between |
| --------------- | --------------- | --------------- | ---------- | ---------- | ------------------ |
| 844x390, insets | 692.31 x 196.62 | 648.31 x 152.62 | 0.04677    | 0.00432    | 5.88               |
| 720x360 (base)  | 688 x 200       | 644 x 156       | 0.04733    | 0.00441    | 5.85               |
| 1280x720        | 688 x 245       | 644 x 201       | 0.05367    | 0.00569    | 5.54               |

### Close places

A far station or a wide spread of discoveries lowers the opening scale, and
close places' chips then overlap. Two rules keep each one reachable:

1. Press rule. Each chip's press area is `hitAround(chip)`, 48 x 48 on its
   drawn centre. A press goes to `pressedArea` (`hitAreas.ts`): of the areas
   that take the press in, the chip whose drawn centre is nearest wins. Every
   chip is therefore selectable by pressing its own visible centre, however
   its area overlaps a neighbour's. Exact ties go to the chip drawn on top.
2. Scale rule. Zoom always reaches `maxScale`, where two chips stop
   overlapping once their places are 599 projected units apart at the phone
   view (522 at 1280x720). The projection shrinks a world distance by at most
   `sqrt(2)`, so places at least 1020 world units apart are always separable
   at full zoom. At `minScale` the same holds from about 9200 world units.
   Gameplay keeps every mapped place at least 1020 world units apart.

The selected chip draws above every other chip, so the place the panel names
is always fully visible. Header, tools, footer and panel sit above the field
and take presses first; a chip under them takes no press there.

## Interaction

- Open: Map on the Paused card opens the map at the opening fit. The Paused
  card and its dim hide; one screen shows at a time.
- Close: the footer's Close (labelled Back from the Paused card), back and
  Escape return to the Paused card.
- Pan: a pointer pressed on the field (on a chip or not) that moves more than
  `dragThreshold` pans the map with the pointer and selects nothing.
- Select: a press released within `dragThreshold` selects the chip that
  `pressedArea` gives; on empty field it clears the selection. Selecting the
  selected chip keeps it selected.
- Keep clear: on selection, pan the least distance that puts the chip and its
  ring (radius 19) inside the fit region and at least `SPACING.gap` above the
  panel's top. The pan is immediate.
- Pinch: two pointers zoom by the ratio of their distance, about their
  midpoint, and pan with the midpoint.
- Wheel: zoom by `zoomStep` per `wheelStep` of `deltaY` (continuous:
  `zoomStep ** (-deltaY / wheelStep)`), about the pointer. Line-mode deltas
  count 1 line as `wheelStep / 3`.
- Tools: zoom in and out by one `zoomStep` about the fit region's centre;
  recentre pans to Ada at the current scale.
- Every zoom clamps to `minScale`..`maxScale`; every pan clamps to the pan
  limit.
- Keyboard: Tab moves through the tools (zoom out, zoom in, recentre), then
  the places in reading order (drawn centre top to bottom, then left to
  right), then Travel here, then the footer (Quests, Galaxies, Close), and
  wraps at either end. Enter or Space on a place selects it; focusing a place
  pans it clear by the keep-clear rule. Focus starts on Close.
- Travel here: Gameplay's teleport. While Ada is in danger or towing it is
  unavailable, with the reason line; activation plays the refusal cue.
- Quests and Galaxies: see [Footer](#footer).

## States

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

The Paused card's actions are Map and Ship, Settings and Back to title in a
two-column grid, then Resume (primary) at the bottom ([Layout screens](layout.md#cards)). Map always opens, in danger too.
Galaxies is on the map, not on the card; in danger it and Travel here
are unavailable on the map.

## Strings

Gameplay's, from `gameplay/player-copy.md`: Map; "{percent}% mapped"; Travel
here; Galaxies; Quests; "No destinations mapped yet."; "Unavailable
while you are in danger.";
the galaxy names; "Unavailable while towing."; the tools' accessible labels;
the footer dismissal, Back from the Paused card and Close otherwise;
"Job: {objective}" (`jobObjective`, also in `gameplay/quests.md`), under the
type line of the held job's target and on the Quests modal; the Quests modal's
"Story complete.", "Station job boards have more to do." and "Explore to find
something to do."; and the type line:

- Types: Station, Outpost, Story place, Holodisk, Nebula, Wreck, Beacon.
  Outposts say "Outpost" without their name.
- Form "{type} · {distance}". The distance is the world distance from Ada
  divided by 1000, in light-years: one decimal below 10 ("0.4 light-years"),
  whole numbers from 10 ("12 light-years"), en-US grouping, and "1 light-year"
  when it rounds to 1.
