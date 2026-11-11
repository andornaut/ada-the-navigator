# Map

The pause card's Map opens a full-screen map of the current galaxy: Ada's
position and heading, every discovered destination and station, charted
landmarks, the objective once mapped, and how much of the galaxy is mapped
(Gameplay's rule, `gameplay/rules.md` "Pause"). Undiscovered places never
appear. Every distance and size comes from [Layout](layout.md) or the tokens
below; states and colours of shared controls are in [Controls](controls.md).

Constants: `MAP_SCREEN`, `MAP_PANEL` and `MAP_SYMBOL` in
`src/ui/layout/mapScreen.ts`, to implement. They replace the provisional
`MAP_CARD` (`mapCard.ts`) and the marker faces in `map-chart.ts`.

## Screen

The map is a screen, not a card: the field fills the whole logical view, under
the insets, and the header, the tools and the place panel float on it. Like a
modal it takes input exclusively; nothing of the flight HUD shows.

| Part   | Anchor                                                                                    |
| ------ | ----------------------------------------------------------------------------------------- |
| Field  | The whole logical view, in the galaxy's `background` with the fog over it                 |
| Header | Top-left corner on the HUD rect's top-left (`hudRect`)                                    |
| Tools  | One column of `HUD_BUTTON` targets, top on the HUD rect's top-right corner, `pitch` apart |
| Panel  | Centred in `safeRect(insets, SPACING.pageInset, view)`, bottom on that rect's bottom      |
| Fit    | The region left for the map: see [Projection and fit](#projection-and-fit)                |

### Header

One ink panel holding, left to right on its 48 row: the galaxy name
(`TYPE.heading`, white), a divider, "{percent}% mapped" (`TYPE.label`, cream)
and one pip per landmark in the galaxy. Strings are Gameplay's: the galaxy
names and "{percent}% mapped" (`gameplay/player-copy.md`).

| Token                          | Value | Rule                                                               |
| ------------------------------ | ----- | ------------------------------------------------------------------ |
| `MAP_SCREEN.header.height`     | 48    | The HUD row: `HUD_BUTTON.target`                                   |
| `MAP_SCREEN.header.radius`     | 4     | As `PILL`                                                          |
| `MAP_SCREEN.header.alpha`      | 0.65  | Ink `#181425` panel, the HUD panel alpha                           |
| `MAP_SCREEN.header.padding`    | 16    | At each end                                                        |
| `MAP_SCREEN.header.nameTop`    | 10    | The name's 28 line box top, centring it in the row                 |
| `MAP_SCREEN.header.labelTop`   | 14    | The percent's 20 line box top                                      |
| `MAP_SCREEN.header.dividerGap` | 12    | Name, 12, a 1x16 divider `#57536e` centred on the row, 12, percent |
| `MAP_SCREEN.header.pipGap`     | 8     | Percent to the first pip                                           |
| `MAP_SCREEN.header.pip`        | 6     | Pip diameter, centred on the row                                   |
| `MAP_SCREEN.header.pipPitch`   | 8     | Pip centre to centre (2 apart)                                     |

- Width: `2 * padding + name + 12 + 1 + 12 + percent`, plus `pipGap + 8 * n - 2`
  for `n` landmarks. With no landmarks the pips and their gap are absent.
- A charted landmark's pip is a filled cream `#ead4aa` disc. An uncharted
  landmark's pip is a 1 px `#b8b3c9` ring of the same diameter, hollow, so the
  two read apart by shape as well as colour.
- At the smallest view (720 logical, phone insets 43) the header may reach the
  tool column less `SPACING.pageInset`: 570 wide. "Black Eye" and "100% mapped"
  leave room for 35 pips.
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
- The column ends at HUD rect top + 216 (224 at a top of 8), at least
  `SPACING.gap` above the tallest panel's top at the 360-high view (233 with
  phone insets).
- Accessible labels are Gameplay's; none exist yet (see [Open questions](#open-questions)).

### Place panel

Shows while a place is selected, and holds the empty note while the map has no
places. A `ui-settings-card` face (the card nine-slice) with no close X and no
dim.

| Token                 | Value | Rule                                                   |
| --------------------- | ----- | ------------------------------------------------------ |
| `MAP_PANEL.padding`   | 16    | `SPACING.panelPadding`, including the 2 frame          |
| `MAP_PANEL.minWidth`  | 360   | The card floor: half the 720 base width                |
| `MAP_PANEL.markGap`   | 8     | Chip to the text block (`SPACING.gap`)                 |
| `MAP_PANEL.actionGap` | 16    | Text block to Travel here, at least                    |
| `MAP_PANEL.textTop`   | 4     | The two 20 lines' top inside the 48 row, centring them |
| `MAP_PANEL.reasonGap` | 8     | Row to the reason line (`SPACING.gap`)                 |

The row, 48 high (`TEXT_BUTTON.height`), left to right:

1. The place's chip, 28, centred on the row, drawn as on the field without the
   selection ring or objective indicator.
2. The text block: the place's name (`TYPE.label`, cream `#ead4aa`) over
   "{type} · {distance}" (`TYPE.body`, supporting `#b8b3c9`), each on a 20
   line.
3. Travel here: a primary `TEXT_BUTTON`, label width plus
   `2 * TEXT_BUTTON.inset`, at the row's right end. Only destinations and
   stations offer it (`MapPlace.travel`); a landmark or the holodisk waypoint
   shows the chip and text block only.

Below the row, `reasonGap` apart, one reason line (`TYPE.body`, supporting,
left-aligned at the inner left) shows while Travel here is unavailable.

- Width: `min(availableWidth, max(row + 32, reason + 32, minWidth))`. `row` is
  `28 + markGap + text block + actionGap + button`; `reason` is the widest
  reason string, shown or not, so the width never changes with the state.
- Height: `16 + 48 + 16` = 80, plus `reasonGap + 20` = 108 with the reason line.
- Empty panel, while the map has no places: one centred `TYPE.body` supporting
  line, "No destinations mapped yet." (Gameplay), height `16 + 20 + 16` = 52,
  width `max(text + 32, minWidth)`.
- Travel here unavailable: the disabled face, focusable; activation plays the
  refusal cue ([Controls](controls.md#buttons)). The reason is "Unavailable
  while you are in danger." (Gameplay), or "Unavailable while towing.",
  pending Gameplay. One reason shows at a time.
- The panel's chip and text are decorative to the pointer: a press on the panel
  outside Travel here does nothing and never reaches the field.

## Symbols

Every place is a round chip: a `chip` disc in the type's face colour with a 1
ink edge inside it, and the type's 20 glyph in ink, centred. Ada is her arrow.
The objective carries the flight's direction indicator.

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

| Symbol        | Place                             | Face      | Glyph                 | Type line (placeholder) |
| ------------- | --------------------------------- | --------- | --------------------- | ----------------------- |
| `station`     | A trading station                 | `#C4AFCC` | `map-station.svg`     | Station                 |
| `growers`     | The growers' outpost              | `#9CCC5A` | `map-growers.svg`     | Outpost                 |
| `workshop`    | The workshop outpost              | `#F2D15A` | `map-workshop.svg`    | Outpost                 |
| `salvagers`   | The salvagers' outpost            | `#8F9CF0` | `map-salvagers.svg`   | Outpost                 |
| `destination` | Any other story destination       | `#65C9BF` | `map-destination.svg` | Destination             |
| `holodisk`    | The holodisk waypoint, once known | `#E868C8` | `map-holodisk.svg`    | Holodisk                |
| `nebula`      | A nebula landmark                 | `#EAD4AA` | `map-nebula.svg`      | Landmark                |
| `wreck`       | A wreck landmark                  | `#EAD4AA` | `map-wreck.svg`       | Landmark                |
| `beacon`      | A beacon landmark                 | `#EAD4AA` | `map-beacon.svg`      | Landmark                |

- Faces are the in-world key colours: lavender `pointOfInterest` for
  stations, each outpost's own colour, mint `active` for destinations, the
  holodisk's pink; landmarks share cream, so their glyph tells them apart.
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
- Glyphs are ink on the face: 6.21:1 (holodisk) to 12.43:1 (landmarks).
- Tool glyphs on the navy disc: supporting 6.83:1, cream 9.59:1, as in flight.
  On dark fields the disc is 1.04 to 1.24:1 and its glyph carries it.
- Header, ink at 0.65 over the field: cream text 5.20:1 on Sunflower (composite
  `#5B534C`) and 11.65:1 or more on the dark fields; the white name 7.53:1 and
  16.89:1 or more; the uncharted pip ring `#b8b3c9` 3.70:1 and 8.30:1 or more.
  Over fog: cream 5.80:1 on Sunflower, 10.84:1 or more on the dark fields.
  The divider is decorative.
- Panel: the card face `#3b3850`; cream name 7.76:1, supporting type line and
  reason 5.53:1, Travel here as the primary button.

## Fog

Unexplored space is fog: one flat colour over the field, with a feathered edge
around what Ada has explored. It draws directly over the field, under every
symbol and the chrome.

| Token                       | Value | Rule                                                                          |
| --------------------------- | ----- | ----------------------------------------------------------------------------- |
| `MAP_SCREEN.fog.reveal`     | 1500  | World units explored around Ada's flown path, each discovered place and Ada   |
| `MAP_SCREEN.fog.sample`     | 250   | The explored record keeps Ada's position at least every 250 world units flown |
| `MAP_SCREEN.fog.feather`    | 0.16  | Gaussian edge, sigma as a share of the reveal's on-screen x radius            |
| `MAP_SCREEN.fog.minFeather` | 3     | Sigma never below 3 logical px                                                |

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
  over the whole view, masked by the union of those ellipses at every sample,
  every discovered place and Ada, the mask blurred by
  `sigma = max(minFeather, feather * rx)`.
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
  the inner region's centre. When `minScale` clamps it (a station far outside
  the disc), pan the least distance that brings Ada inside the inner region.
  Nothing is selected on opening.
- Pan limit: the inner region's centre stays within the projected bounding box
  of the charting disc and every discovered place, so a far station stays
  reachable and the map never drifts into empty space.

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
  then the places in reading order (drawn centre top to bottom, then left to
  right), then Travel here. Enter or Space on a place selects it; focusing a
  place pans it clear by the keep-clear rule. Focus starts on close.
- Travel here: Gameplay's teleport. While Ada is in danger it is unavailable,
  with the reason line; activation plays the refusal cue.

## States

| State                 | Field and symbols                               | Panel                                                           |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Nothing mapped        | Ada only, fog except around her path            | Empty note, "No destinations mapped yet."                       |
| Places, none selected | Chips; the objective's indicator once mapped    | None                                                            |
| Travel place selected | Selection ring on the chip                      | Chip, name, type line, Travel here (primary)                    |
| Other place selected  | Selection ring on the landmark or holodisk chip | Chip, name, type line; no action                                |
| In danger             | Unchanged                                       | Travel here unavailable, "Unavailable while you are in danger." |
| Towing (pending)      | Unchanged                                       | Travel here unavailable, "Unavailable while towing."            |
| Light field           | Ink parts carry every mark (keyline rule)       | Unchanged                                                       |
| No explored record    | Plain field, no fog                             | Unchanged                                                       |

## Pause card

The Paused card's action stack is Resume (primary), Map, Settings, Return home
([Layout screens](layout.md#cards)). Map always opens. While Ada is in danger,
Return home is unavailable and the card shows "Unavailable while you are in
danger." below the stack; on the map, Travel here is unavailable instead.

## Strings

Gameplay's, from `gameplay/player-copy.md`: Map; "{percent}% mapped"; Travel
here; "No destinations mapped yet."; "Unavailable while you are in danger.";
the galaxy names. Placeholders until Gameplay supplies them, drawn in the
review sheets only:

- The type line's types: Station, Outpost, Destination, Holodisk, Landmark.
- The type line's form "{type} · {distance}" and the distance "8,900 km" (the
  world distance from Ada, rounded to 100, en-US grouping, with a unit).
- "Unavailable while towing.", pending the towing decision.
- The tools' accessible labels.

## Open questions

- Gameplay: the type names and the distance's unit, rounding and separator;
  whether the type line names the outpost ("Growers outpost") or just
  "Outpost"; the towing reason; the tools' accessible labels.
- Gameplay: each landmark's kind (nebula, wreck or beacon) and the landmark
  count per galaxy (the header fits 35 pips); whether the holodisk waypoint
  shows on the map once known, as the symbol set assumes.
- Gameplay: that no two map places sit closer than 1020 world units, so every
  chip separates at full zoom.
- Gameplay and Tech: whether the explored record persists across flights,
  given that a galaxy's layout regenerates on the next flight; if it cannot be
  kept, the plain field is the fallback.
- Tech: a symbol key per `MapPlace` (the table above), and whether stations
  far outside the charting disc exist, which the opening pan and pan limit
  cover.
- Tech: this page assumes the 0.65 HUD panel alpha and Sunflower's light field
  from the light-field change; merge that first or together.
