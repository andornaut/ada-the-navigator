# Map

The pause card's Map opens a full-screen map of the current galaxy: Ada's
position and heading, every discovered destination and station, charted
landmarks, the objective once mapped, and how much of the galaxy is mapped
(Gameplay's rule, `gameplay/rules.md` "Pause"). Undiscovered places never
appear. Every distance and size comes from [Layout](layout.md) or the tokens
below; states and colours of shared controls are in [Controls](controls.md).

Constants: `MAP_SCREEN`, `MAP_PANEL`, `MAP_SYMBOL`, `MAP_FACES` and
`MAP_GLYPHS` in `src/ui/layout/mapScreen.ts`; the panel's height is
`panelHeight` in `src/ui/map-screen.ts`.

## Screen

The map is a screen, not a card: the field fills the whole logical view, under
the insets, and the header, the tools and the place panel float on it. Like a
modal it takes input exclusively; nothing of the flight HUD shows.

| Part   | Anchor                                                                                     |
| ------ | ------------------------------------------------------------------------------------------ |
| Field  | The whole logical view, in the galaxy's `background` with the fog over it                  |
| Header | Top-left corner on the HUD rect's top-left (`hudRect`)                                     |
| Tools  | One column of `HUD_BUTTON` targets, top on the HUD rect's top-right corner, `pitch` apart  |
| Row    | Quests, then Return to Earth, on the HUD row, ending `SPACING.pageInset` left of the tools |
| Panel  | Centred in `safeRect(insets, SPACING.pageInset, view)`, bottom on that rect's bottom       |
| Fit    | The region left for the map: see [Projection and fit](#projection-and-fit)                 |
| Quests | A modal card over the map: see [Quests modal](#quests-modal)                               |

### Header

One ink panel on its 48 row holding, left to right: the galaxy name
(`TYPE.heading`, white), a divider, then a column of one pip per landmark over
"{percent}% mapped" (`TYPE.label`, cream). Strings are Gameplay's: the galaxy
names and "{percent}% mapped" (`gameplay/player-copy.md`).

| Token                          | Value | Rule                                                                                    |
| ------------------------------ | ----- | --------------------------------------------------------------------------------------- |
| `MAP_SCREEN.header.height`     | 48    | The HUD row: `HUD_BUTTON.target`                                                        |
| `MAP_SCREEN.header.radius`     | 4     | As `PILL`                                                                               |
| `MAP_SCREEN.header.alpha`      | 0.65  | Ink `#181425` panel, the HUD panel alpha                                                |
| `MAP_SCREEN.header.padding`    | 16    | At each end                                                                             |
| `MAP_SCREEN.header.nameTop`    | 10    | The name's 28 line box top, centring it in the row                                      |
| `MAP_SCREEN.header.dividerGap` | 12    | Name, 12, a 1x16 divider `#57536e` centred on the row, 12, the column                   |
| `MAP_SCREEN.header.stackTop`   | 9     | The column's top: `(48 - 30) / 2` for the 6 pips, the gap and the 20 line; to implement |
| `MAP_SCREEN.header.stackGap`   | 4     | Pips to the percent's line box (`SPACING.rowGap`), which tops at 19; to implement       |
| `MAP_SCREEN.header.labelTop`   | 14    | The percent's 20 line box top when the galaxy has no landmarks                          |
| `MAP_SCREEN.header.pip`        | 6     | Pip diameter                                                                            |
| `MAP_SCREEN.header.pipPitch`   | 8     | Pip centre to centre (2 apart)                                                          |

- The pips and the percent both start at the column's left. With no
  landmarks the pip row is absent and the percent centres on the row
  (`labelTop`).
- Width: `2 * padding + name + 12 + 1 + 12 + column`, where `column` is
  `max(percent, 8 * n - 2)` for `n` landmarks. The widest is 279.8:
  "Sunflower" (116.0), "100% mapped" (106.8) and 12 pips (94).
- A charted landmark's pip is a filled cream `#ead4aa` disc. An uncharted
  landmark's pip is a 1 px `#b8b3c9` ring of the same diameter, hollow, so the
  two read apart by shape as well as colour.
- The header may reach Quests less `SPACING.gap`: 319.3 wide at the smallest
  view (720 logical, phone insets 43), 389.3 at the 720 base. At 319.3 the
  column may be 146.3 wide, room for 18 pips; each galaxy has 12 landmarks, 4
  of each kind.
- The header keeps the 48 row, so the fit region's top, `maxScale` and the
  1020 separation are unchanged.
- The header takes no input. Its accessible text is the name and the percent;
  the pips are decorative.

### Tools

Four `HUD_BUTTON` targets in the idle state, top to bottom from the HUD rect's
top-right corner: close, zoom in, zoom out, recentre. Target `i` is at
`x = hudRect.right - 48`, `y = hudRect.top + MAP_SCREEN.tools.pitch * i`.

| Token                    | Value | Rule                                 |
| ------------------------ | ----- | ------------------------------------ |
| `MAP_SCREEN.tools.pitch` | 56    | `HUD_BUTTON.target + HUD_BUTTON.gap` |

| Tool     | Glyph              | Glyph colour         | Action                                               |
| -------- | ------------------ | -------------------- | ---------------------------------------------------- |
| Close    | `map-close.svg`    | Cream `#ead4aa`      | Back to the Paused card, as back and Escape do       |
| Zoom in  | `map-zoom-in.svg`  | Supporting `#b8b3c9` | Scale times `zoomStep` about the fit region centre   |
| Zoom out | `map-zoom-out.svg` | Supporting `#b8b3c9` | Scale over `zoomStep` about the fit region centre    |
| Recentre | `map-recentre.svg` | Supporting `#b8b3c9` | Pan so Ada sits at the fit region centre, same scale |

- Face, edge and glyph geometry are the idle `HUD_BUTTON`
  ([Controls](controls.md#top-right-hud-icon-buttons)): navy `#262b44` 33 disc,
  1 ink edge, 20 glyph mask. Close takes the card close X's cream.
- At `maxScale`, zoom in plays the [refusal cue](controls.md#refusal-cue) with
  its glyph as the label and does not zoom; zoom out does the same at
  `minScale`. Neither changes face.
- The column ends at HUD rect top + 216 (224 at a top of 8). At the 360-high
  view a two-line panel with the reason line (108) tops at 236 (233 with phone
  insets), at least `SPACING.gap` below it. The three-line panel with the
  reason line (128) tops at 216 (213), level with the column, so the two stay
  apart only across. The panel's width is capped at
  `2 * (column left - SPACING.gap - view centre)`, 592 at the 720 base
  (`2 * (664 - 8 - 360)`), so it always clears the column.
- Accessible labels (Gameplay's): Zoom in, Zoom out and Center on Ada.

### Quests and Return to Earth

Two secondary `TEXT_BUTTON`s on the HUD row of every galaxy's Map, left to
right: "Quests", then "Return to Earth" (Gameplay). Constant:
`MAP_SCREEN.hudRow`, to implement.

- Geometry: 48 high, top on the HUD rect's top. Each is its own label plus
  `2 * TEXT_BUTTON.inset` wide: Quests 54.3 + 32 = 86.3, Return to Earth
  116.5 + 32 = 148.5. They are separate controls, not an action row: one
  shared width (148.5 each) would reach 592.9 of the 570 available with phone
  insets.
- Return to Earth's right edge is the tool column's left (`toolColumnLeft`)
  less `SPACING.pageInset`; Quests ends `SPACING.gap` left of Return to Earth.
  Neither moves with the header's width.

| View, logical            | Header, up to | Quests         | Return to Earth | Tool column left |
| ------------------------ | ------------- | -------------- | --------------- | ---------------- |
| 720x360                  | 8 to 397.3    | 405.3 to 491.5 | 499.5 to 648    | 664              |
| 720x360, phone insets 43 | 43 to 362.3   | 370.3 to 456.5 | 464.5 to 613    | 629              |

- Each button is its press area (48, `HIT_RULE.minTarget`). The fit region,
  the tool column and the place panel are unchanged: the row sits above the
  fit region's top.
- Quests opens the [Quests modal](#quests-modal). It is always available, in
  danger and while towing too.
- Return to Earth: Gameplay's action, with no confirm. It ends the flight and
  takes Ada to her room. It stays available while towing; the towed craft
  returns to where it was stranded. In danger it shows the unavailable face
  (disabled face, focusable), activation plays the
  [refusal cue](controls.md#refusal-cue), and the panel shows the danger
  reason (below).

### Place panel

Shows while a place is selected, holds the empty note while the map has no
places, and holds the danger reason while Ada is in danger. A
`ui-settings-card` face (the card nine-slice) with no close X and no dim.

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
3. Travel here: a primary `TEXT_BUTTON`, 48 high, label width plus
   `2 * TEXT_BUTTON.inset`, at the row's right end. Only destinations and
   stations offer it (`MapPlace.travel`); a landmark, the holodisk waypoint or
   a job's own spot shows the chip and text block only.

Below the row, `reasonGap` apart, one reason line (`TYPE.body`, supporting,
left-aligned at the inner left) shows while Travel here or Return to Earth is
unavailable.

- Row height: `max(row, 2 * textTop + 20 * lines)` for `lines` counting the
  name: 48 with one or two lines, 68 with the job line. Travel here and the
  chip stay centred, so in a 68 row the button's top is 10 below the row's
  top and the chip's 20.
- Height: `2 * padding + row height`, plus `reasonGap + 20` with the reason
  line: 80 or 108 with two lines, 100 or 128 with the job line.
- Width: the panel sizes to its content,
  `clamp(minWidth, maxWidth, 2 * padding + max(row, reason))`. `row` is
  `28 + markGap + text + 8`, plus `markGap + button` when Travel here shows;
  `text` is the widest of its lines. `reason` is the widest reason string
  while a reason shows (both share one cell), and absent otherwise. `maxWidth`
  is `min(safe width, column cap)`: the width of
  `safeRect(insets, SPACING.pageInset, view)` and the column cap above. Text
  wraps inside it and the panel's measured height grows with it.
- Empty panel, while the map has no places: one centred `TYPE.body` supporting
  line, "No destinations mapped yet." (Gameplay), height `16 + 20 + 16` = 52,
  width `clamp(minWidth, maxWidth, text + 32)`.
- Reason-only panel, in danger with nothing selected: the danger line alone,
  left-aligned, height `16 + 20 + 16` = 52, width
  `clamp(minWidth, maxWidth, reason + 32)` = 360. With no places it follows
  the empty note, `reasonGap` apart: 80 high.
- Travel here unavailable: the disabled face, focusable; activation plays the
  refusal cue ([Controls](controls.md#buttons)). The reason is "Unavailable
  while you are in danger." or "Unavailable while towing." (Gameplay). One
  reason shows at a time; danger wins over towing.
- In danger the danger line shows with every selection, whether or not the
  place offers Travel here, because Return to Earth is unavailable too. The
  towing line shows only while a place offering Travel here is selected.
- The panel's chip and text are decorative to the pointer: a press on the panel
  outside Travel here does nothing and never reaches the field.

### Quests modal

The galaxy's current quests on a standard content-fitted card
([Layout](layout.md#modals)) titled "Quests", with the close X, over the map
under the modal dim. The dim covers the field, the header, the HUD row, the
tools and the panel. The close X, an outside tap, back and Escape close it,
leaving the map's view and selection unchanged. Focus starts on the first line
button, or on the close X without one. Constants: `MAP_SCREEN.quests`, to
implement.

| Token                          | Value | Rule                                                                   |
| ------------------------------ | ----- | ---------------------------------------------------------------------- |
| `MAP_SCREEN.quests.lineGap`    | 8     | Between lines (`SPACING.gap`)                                          |
| `MAP_SCREEN.quests.chip`       | 28    | A line button's chip (`MAP_SYMBOL.chip`)                               |
| `MAP_SCREEN.quests.overhang`   | 4     | The chip past the label's 20 line box, above and below, in the 44 face |
| `MAP_SCREEN.quests.markGap`    | 6     | Chip to label (`SPACING.markGap`)                                      |
| `MAP_SCREEN.quests.textColumn` | 50    | Text start from the inner edge: `TEXT_BUTTON.inset + chip + markGap`   |
| `MAP_SCREEN.quests.ring`       | 1     | The unmapped ring's width, `#b8b3c9`                                   |

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
   The button counts at its full width and widens the card.
2. Plain line: `TYPE.body`, supporting `#b8b3c9`, starting on the text column,
   20 per line, wrapping as prose (it never widens the card). A line whose
   target is not yet mapped carries a 28 hollow ring in the chip slot, the
   uncharted pip's look, centred on the text and overhanging it by 4 each way.
   "Story complete." and the job-board line carry no ring. The ring is
   decorative: the line reads as its text.
3. Empty note: one centred `TYPE.body` supporting line.

- Width: `cardWidth` from the widest line button,
  `16 + 28 + 6 + label + 16`, floor 360, capped at the available width (634
  with phone insets, 688 at the 720 base); a button wider than the inner width
  wraps.
- Height: `58 + lines + gaps + 16`. Every state fits the 325 available.

| State at 720x360, phone insets                    | Lines                              | Card        |
| ------------------------------------------------- | ---------------------------------- | ----------- |
| Story target mapped, no job, a station discovered | Button 48, plain 20                | 439.9 x 150 |
| Story and job targets mapped                      | Two buttons, 48 each               | 439.9 x 178 |
| Story target unmapped, job target mapped          | Ringed plain wrapped to 40, button | 360 x 170   |
| A job line wider than the 602 inner width         | Button 48, button wrapped to 68    | 634 x 198   |
| Story complete, no job, a station discovered      | Two plain lines                    | 360 x 122   |
| No lines                                          | Empty note                         | 360 x 94    |

The 439.9 width is "Take food from the growers to the workshop." in a button.

- Press: a mapped line closes the modal, pans so its chip sits at the fit
  region's centre at the current scale (clamped by the pan limit), applies the
  keep-clear rule, then selects the chip; the place panel shows as for any
  selection. At 720x360 with phone insets the centre is (332, 202.5) and the
  ring's bottom 221.5: it clears the 80, 100 and 108 panels (tops 261, 241 and 233) by at least `SPACING.gap`, and keep-clear lifts it 16.5 above the 128
  panel (top 213).
- Plain lines and the empty note take no input.
- In danger the modal is unchanged: Quests and every line button stay
  available, and a selection is never refused.

## Symbols

Every place carries a symbol key (`MapPlace.symbol`, the table below), the
holodisk waypoint included; `src/model/map.test.ts` covers every key and its
type line. Each place but a job's own spot is a round chip: a `chip` disc in
the symbol's face colour with a 1 ink edge inside it, and the symbol's 20 glyph
in ink, centred. Ada is her arrow. The objective carries the flight's direction
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
| `job`         | A held job's own spot       | `#FEAE34` | None                  | None        |

- Faces are the in-world key colours: lavender `pointOfInterest` for
  stations, each outpost's own colour, mint `active` for destinations, the
  holodisk's pink; landmarks share cream, so their glyph tells them apart.
- Job marks: the current marks from main's jobs code, which Art's job board
  art will replace. The held job's target keeps its own symbol and glyph on an
  orange `#FEAE34` face (`MAP_JOB_FACE`). A job's own spot, a target that is
  no other place, takes the `job` symbol: an orange diamond, the chip square
  rotated 45 degrees at 0.78 scale, with the ink edge and no glyph.
- Selected: the selection ring around the chip. Focus-visible: the shared
  focus ring, `FOCUS_RING.outset` outside the face and round with it; the two
  may overlap.
- Objective indicator: the flight's arrow and circle
  (`src/game/scene.ts` `drawIndicators`, with `u` pointing down), above the
  chip at `(x, y)`: tip `(x, y - 23)` (`objective.tip`), base corners
  `(x ± 5, y - 36)`, circle radius 3 at `(x, y - 44)`. The lavender stroke
  draws over the ink stroke on every field.
- Ada's arrow, in a 28 box with its nose toward +x: hull
  `M24.5 14 L5.5 4.2 L9.6 14 L5.5 23.8 Z` in white `#ffffff` over its ink
  keyline, and a canopy ellipse at (15.2, 14), radii 4.2 and 2.7, in
  `shipHardpoint` `#70ACE8` with a 0.8 ink stroke. It rotates about the box
  centre to her heading on the map, continuously (not snapped to the ship's
  32 headings): the screen angle of her projected facing,
  `atan2((fx + fy) / 2, fx - fy)`.
- Ada is not a press target.

Draw order, bottom to top: field, fog, landmark chips, other chips, the
objective indicator, the selected chip and its ring, Ada, then the header,
tools and panel. Within a layer, later places in the map's order draw on top.

### Glyphs

Thirteen 20 x 20 pixel grids in `art/tools/map-icons.ts`, written as one path of
whole-pixel runs each, like the [weapon icons](weapon-icons.md). The tool
fails if a symbol pixel reaches past the chip's 13 face radius. The fill is
each file's default colour only (ink for symbols, cream for tools); the
runtime draws every glyph as a CSS mask in its state colour, with smooth
sampling, so it stays sharp at fractional scales. Every SVG is decorative
(`aria-hidden="true"`). Rebuild with `node art/tools/map-icons.ts`.

| SVG                   | Glyph                                          | SHA-256                                                            |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `map-station.svg`     | Mast and dome over an elliptical ring          | `c2a127db459dc3ee1d48a4b8a6560ac59b41c35921d4f345fca0cc1e941c6bb1` |
| `map-growers.svg`     | Sunflower head: an 8 disc in eight petals      | `39afebe5011328317255fefb81f6a1f2ad869d4ef3514aeb034e78f208e9eb6a` |
| `map-workshop.svg`    | Wrench on the diagonal, jaw to the top right   | `8128bbfe49ad653c57a232531f9418068704f52920c8f4a37e5f8c245c7d152c` |
| `map-salvagers.svg`   | Electromagnet: horseshoe with gapped pole tips | `cb6121dfddb4782d78fd18f61cb550fb31243736fdc5f57717b988dd9af00ba8` |
| `map-destination.svg` | Swallowtail flag on a footed pole              | `9869982e9c42b3d88bc60e10c09fc75ef02b01253d6d5084b37b6474d2c4a922` |
| `map-holodisk.svg`    | Disc band around a spindle hole                | `8d40d73ea39fb43e51db27fe34a7596714b12f2e331654067313906ed3e15fd6` |
| `map-nebula.svg`      | Cloud with two stars                           | `ea5ba9ecbcb0e0ba937cf9881b8658fb2c3d7505ca69b2708ad2951824b38594` |
| `map-wreck.svg`       | Hull split in two with debris                  | `ce77a498d883397da78ab728e2aa8b0745744857738b2d6131bff19e3624519c` |
| `map-beacon.svg`      | Mast with a lamp and two pairs of signal arcs  | `3666df581a95d05be737af27b8b327fd9a8b386af3c1e0591bce9b21b4e04810` |
| `map-close.svg`       | X, 2 to 3 px strokes                           | `dfa06d6c874628b4d8234d834349f9d084329bf797483a8941cb8743a3858835` |
| `map-zoom-in.svg`     | Plus, 14 long, 2 thick                         | `2941643dfb9821cddf4f9211799ce06a831d4f734dee00b761525faed2185d49` |
| `map-zoom-out.svg`    | Minus, 14 long, 2 thick                        | `4f12cd67b7dec154e9b555609d22d9a5e92fe74b55f26b70ce64bf7c239fe2c7` |
| `map-recentre.svg`    | Crosshair: ring, centre dot and four ticks     | `e37051fd500afbb0613a0844f27e96f69011dfcb283e6554ea4fc23c21c723e4` |

### Contrast per field

WCAG ratios of each mark against each galaxy's `background`
([Galaxies](galaxies.md)), truncated to two decimals. Sunflower is the light
farm-yellow field `#D8C994`; the others are dark.

| Mark                      | Colour    | Sunflower `#D8C994` | Cartwheel `#39221E` | Whirlpool `#132D33` | Black Eye `#271423` |
| ------------------------- | --------- | ------------------- | ------------------- | ------------------- | ------------------- |
| Station face              | `#C4AFCC` | 1.22                | 7.28                | 7.13                | 8.55                |
| Growers face              | `#9CCC5A` | 1.13                | 7.87                | 7.71                | 9.25                |
| Workshop face             | `#F2D15A` | 1.10                | 9.87                | 9.67                | 11.60               |
| Salvagers face            | `#8F9CF0` | 1.55                | 5.75                | 5.63                | 6.75                |
| Destination face          | `#65C9BF` | 1.19                | 7.49                | 7.34                | 8.80                |
| Holodisk face             | `#E868C8` | 1.75                | 5.09                | 4.99                | 5.98                |
| Landmark face             | `#EAD4AA` | 1.14                | 10.19               | 9.99                | 11.97               |
| Job face                  | `#FEAE34` | 1.12                | 7.96                | 7.80                | 9.34                |
| Ada hull                  | `#ffffff` | 1.65                | 14.77               | 14.47               | 17.34               |
| Objective stroke          | `#C4AFCC` | 1.22                | 7.28                | 7.13                | 8.55                |
| Ring band                 | `#ead4aa` | 1.14                | 10.19               | 9.99                | 11.97               |
| Ink edge, keyline, fringe | `#181425` | 10.89               | 1.21                | 1.24                | 1.03                |
| Tool disc face            | `#262b44` | 8.40                | 1.06                | 1.04                | 1.24                |

- Light-field keyline rule: on a light field (`tint.light`, Sunflower) every
  face, the hull, the stroke and the band fall below 2:1, so the ink parts
  carry each mark at 10.89:1: the chip's edge, Ada's keyline, the indicator's
  ink stroke and the ring's fringes. On a dark field the colours carry it (4.99:1
  or more) and the ink parts are outlines. Every mark draws its ink parts on
  every field, so a mark has one look across galaxies; a map mark with no ink
  edge is not allowed.
- Glyphs are ink on the face: 6.21:1 (holodisk) to 12.43:1 (landmarks);
  9.71:1 on the job face.
- Tool glyphs on the navy disc: supporting 6.83:1, cream 9.59:1, as in flight.
  On dark fields the disc is 1.04 to 1.24:1 and its glyph carries it.
- Header, ink at 0.65 over the field: cream text 5.20:1 on Sunflower (composite
  `#5B534C`) and 11.65:1 or more on the dark fields; the white name 7.53:1 and
  16.89:1 or more; the uncharted pip ring `#b8b3c9` 3.70:1 and 8.30:1 or more.
  Over fog: cream 5.80:1 on Sunflower, 10.84:1 or more on the dark fields.
  The divider is decorative.
- Panel: the card face `#3b3850`; cream name 7.76:1, supporting type line, job
  line and reason 5.53:1, Travel here as the primary button.

## Fog

Unexplored space is fog: one flat colour over the field, with a feathered edge
around what Ada has explored. It draws directly over the field, under every
symbol and the chrome.

| Token                       | Value | Rule                                                                             |
| --------------------------- | ----- | -------------------------------------------------------------------------------- |
| `MAP_SCREEN.fog.reveal`     | 1500  | World units explored around each explored chunk centre, discovered place and Ada |
| `chunkSize`                 | 512   | The centre of each 512-unit world chunk Ada has visited in this galaxy           |
| `MAP_SCREEN.fog.feather`    | 0.16  | Gaussian edge, sigma as a share of the reveal's on-screen x radius               |
| `MAP_SCREEN.fog.minFeather` | 3     | Sigma never below 3 logical px                                                   |

- Colour: the sRGB channel mean of the galaxy's `environment` and
  `environmentDetail`, rounded half up. It steps darker than the field on
  Sunflower and lighter on the dark fields, at 1.23 to 1.30:1: quiet, and
  never the only carrier of meaning.

| Galaxy    | Fog       | Against the field |
| --------- | --------- | ----------------- |
| Sunflower | `#C2B37F` | 1.26              |
| Cartwheel | `#4C3430` | 1.29              |
| Whirlpool | `#254046` | 1.30              |
| Black Eye | `#392535` | 1.23              |

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
- Fit region: left `safeRect(16).left`, top `hudRect.top + 48 + SPACING.gap`
  (below the header row), right `hudRect.right - 48 - SPACING.gap` (left of the
  tool column), bottom `safeRect(16).bottom`. Inset by `fitMargin` on every
  side it is the inner region. The panel floats over its lower part.
- `maxScale = min(innerWidth / minBox.width, innerHeight / minBox.height)`.
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

| View, CSS px    | Fit region   | Inner region | `maxScale` | `minScale` | Zoom steps between |
| --------------- | ------------ | ------------ | ---------- | ---------- | ------------------ |
| 844x390, insets | 637.08 x 277 | 593.08 x 233 | 0.03883    | 0.00659    | 4.37               |
| 720x360 (base)  | 640 x 280    | 596 x 236    | 0.03933    | 0.00668    | 4.37               |
| 1280x720        | 640 x 325    | 596 x 281    | 0.04683    | 0.00795    | 4.37               |

### Close places

A far station or a wide spread of discoveries lowers the opening scale, and
close places' chips then overlap. Two rules keep each one reachable:

1. Press rule. Each chip's press area is `hitAround(chip)`, 48 x 48 on its
   drawn centre. A press goes to `pressedArea` (`hitAreas.ts`): of the areas
   that take the press in, the chip whose drawn centre is nearest wins. Every
   chip is therefore selectable by pressing its own visible centre, however
   its area overlaps a neighbour's. Exact ties go to the chip drawn on top.
2. Scale rule. Zoom always reaches `maxScale`, where two chips stop
   overlapping once their places are 721 projected units apart at the phone
   view (598 at 1280x720). The projection shrinks a world distance by at most
   `sqrt(2)`, so places at least 1020 world units apart are always separable
   at full zoom. At `minScale` the same holds from about 6000 world units.
   Gameplay keeps every mapped place at least 1020 world units apart.

The selected chip draws above every other chip, so the place the panel names
is always fully visible. Header, tools and panel sit above the field and take
presses first; a chip under them takes no press there.

## Interaction

- Open: Map on the Paused card opens the map at the opening fit. The Paused
  card and its dim hide; one screen shows at a time.
- Close: the close tool, back and Escape return to the Paused card.
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
- Keyboard: Tab moves through the tools (close, zoom in, zoom out, recentre),
  then Quests and Return to Earth, then the places in reading order (drawn centre top to
  bottom, then left to right), then Travel here. Enter or Space on a place selects it; focusing a
  place pans it clear by the keep-clear rule. Focus starts on close.
- Travel here: Gameplay's teleport. While Ada is in danger or towing it is
  unavailable, with the reason line; activation plays the refusal cue.
- Quests and Return to Earth: see
  [Quests and Return to Earth](#quests-and-return-to-earth).

## States

| State                 | Field and symbols                               | Panel                                                                           |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Nothing mapped        | Ada only, fog except around her path            | Empty note, "No destinations mapped yet."                                       |
| Places, none selected | Chips; the objective's indicator once mapped    | None; in danger, the reason-only panel                                          |
| Travel place selected | Selection ring on the chip                      | Chip, name, type line, Travel here (primary)                                    |
| Other place selected  | Selection ring on the landmark or holodisk chip | Chip, name, type line; no action                                                |
| Job target selected   | Selection ring on the orange-faced chip         | Row grows to 68: name, type line, "Job: {objective}"; Travel here where offered |
| Job spot selected     | Selection ring on the orange diamond            | Diamond and the job's name; no action                                           |
| In danger             | Return to Earth unavailable                     | Travel here unavailable, "Unavailable while you are in danger."                 |
| Towing                | Return to Earth available                       | Travel here unavailable, "Unavailable while towing."                            |
| Quests open           | Under the modal dim                             | Under the modal dim                                                             |
| Light field           | Ink parts carry every mark (keyline rule)       | Unchanged                                                                       |
| No explored record    | Plain field, no fog                             | Unchanged                                                                       |

## Pause card

The Paused card's action stack is Resume (primary), Map, Settings and Back to
title ([Layout screens](layout.md#cards)). Map always opens, in danger too.
Return to Earth is on the map, not on the card; in danger it and Travel here
are unavailable on the map.

## Strings

Gameplay's, from `gameplay/player-copy.md`: Map; "{percent}% mapped"; Travel
here; Return to Earth; Quests; "No destinations mapped yet."; "Unavailable
while you are in danger.";
the galaxy names; "Unavailable while towing."; the tools' accessible labels;
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
