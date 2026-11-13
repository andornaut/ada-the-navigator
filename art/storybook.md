# Storybook art

- Rebuild with `node art/tools/storybook.ts` (optionally one background id)
  inside the isolated art container. It writes environment-only Earth
  backgrounds, the overnight rock-glow overlay and the galaxy map's Ada/Penny
  sprites to `public/art/story/`,
  their `story-` root manifest entries, `story-transition.json` and
  `story-overnight.json`. `art/tools/diorama.ts` holds the solids, painter,
  lights and treatment. `node art/tools/route-sky.ts` writes the environment
  sky and ground and their manifest entries.
- Story backgrounds and overlays contain no human or animal figures. The
  galaxy map is the exception: its established Ada and Penny sprites remain
  on the route ground, with their existing placement and scale. Established
  portraits appear in the story panel for the existing speakers; narration
  has no added portrait. Story copy, speaker identities and props remain
  unchanged. Astra and the rock's glow retain their existing effects.
- Output is deterministic: the same source writes byte-identical PNGs.

## Canvas

Every storybook background, like the aboard backdrop, is a 960 by 540 logical px canvas
at 2x: a 1920 by 1080 opaque PNG with `displayWidth` 960 and `displayHeight` 540
and the pivot at the centre. Draw it at display size under the insets, centred
across and offset down by the [run anchor](layout.md#storybook-page), which
places its [subject band](#subject-bands) in the strip above the story panel;
a backdrop without a panel stays centred. It covers every view up to 960 by 540
(a 720 by 540 4:3 view, an 800 by 360 21:9 phone); scale it up to cover only
past that.

Scenes are composed on the 844 by 390 design frame, the 779 by 360 logical view
of an 844 by 390 phone, which sits at the canvas centre (logical x 90.5 to
869.5, y 90 to 450). Taller views reveal more backdrop above and floor or lot
edge below; wider views reveal more backdrop at the sides.

## Style

- Isometric dioramas in the game's projection (`projectAt`, view direction
  (1, 1, 1), +z up): rooms as two back walls on a floor slab, outdoor scenes as
  a 24-unit square lot floating on the backdrop.
- Convex solids are flat-shaded in Oklab: a face loses 0.07 L by its +x normal
  and 0.13 L by its +y normal; the top keeps the material colour. Decals (doors,
  windows, tiles, paths) paint over their face unshaded.
- Painter's order: floor, back walls, then props by depth key. Rendered at 2x
  supersampling and box-downsampled.
- Backdrop: a vertical two-colour ramp down the design frame, held past it.

## Treatment d

Applied after rendering, in order:

1. Gaussian blur, sigma 1.2 design px (2.2 canvas px), as three extended box
   passes per axis.
2. Desaturate 25% toward ITU-R 601 luma.
3. Haze `#efe8ef` composited with alpha `0.18 + 0.45 t^2`, `t` running 0 to 1
   from the design frame's top to its bottom and held past it: 18% at the top,
   63% at the bottom.

Night scenes (`story-ada-room-night` and the sleep overlays) use the night haze
`#585c8c` with the same blur, desaturation and haze alphas, so the panel band
stays dark blue instead of a pale wash.

The haze is thickest under the story panel, so prose sits on the lightest band
and the scene's subject stays clearest above it.

## Locations

| Id                               | Scene                                                 | Backdrop              | Key colours                                                               |
| -------------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `story-park`                     | Park: pond, bench, three trees, the dig spot and rock | `#cfe4e8` → `#dfeadb` | grass `#8cc777`, path `#e8d3a2`, pond `#8fc8de`, rock `#93877e`           |
| `story-ada-room-unpolished`      | Ada's room, the rock on the desk as dug up            | `#d9d2e6` → `#cfc5de` | wall `#e6d6ea`, floor `#d9b98f`, blanket `#8fb0e2`, rock `#93877e`        |
| `story-ada-room`                 | Ada's room, the polished rock's faint glowing pattern | `#d9d2e6` → `#cfc5de` | as above, glow line `#53d1c2`, glow `#96ecde`                             |
| `story-grandma-garden`           | Grandma's house, fence, raised beds in bloom, tree    | `#bfe0e8` → `#d9ecd6` | grass `#86c46f`, wall `#f0d7a8`, roof `#d06a55`, blooms `#ef7f8f`         |
| `story-community-garden`         | Fenced lot: shed, one sprouting and two empty beds    | `#d3dfe6` → `#dfe6dc` | ground `#cfae82`, patches `#a9c98b`, shed `#b49ad6`, bin `#6f9a7a`        |
| `story-schoolyard`               | School, hopscotch, play structure and slide, tree     | `#cfe0ea` → `#dde6e4` | asphalt `#b6aebf`, brick `#d48f7e`, slide `#f2c95c`, bars `#ea8f84`       |
| `story-school-hallway`           | Lockers, notice board, two doors, bench               | `#c7d3e6` → `#a9b8d2` | wall `#f1e3c6`, lockers `#5fb3a6`, floor `#d8c29c`, bench `#7d8fc0`       |
| `story-kitchen`                  | Kitchen at home: round table set for supper, counter  | `#e9dccb` → `#e1d2c2` | wall `#f6e2b8`, cabinets `#93c2b0`, cloth `#ef9b84`, tiles `#d9b487`      |
| `story-front-door`               | Front door, coats and lead, shoe rack, dog's bowl     | `#e6dccd` → `#dcd0c0` | door `#a98bc4`, floor `#d6b48e`, coats `#f0c95e` and `#86ade0`            |
| `story-ada-room-recorder`        | `story-ada-room` with the recorder on a song sheet    | `#d9d2e6` → `#cfc5de` | as `story-ada-room`, recorder `#7a4a32`, rings `#efe4c8`                  |
| `story-concert-hall`             | Corner stage, curtains, piano, spotlight, chair rows  | `#d8cde0` → `#cbbfd2` | wall `#efe2cf`, floor `#d7ad7c`, curtain `#c95a66`, chairs `#6f93cf`      |
| `story-grandma-garden-spilled`   | `story-grandma-garden` with the tray spilled          | `#bfe0e8` → `#d9ecd6` | as `story-grandma-garden`, tray `#4f6a5a`, pots `#d9825b`, soil `#6e4a30` |
| `story-grandma-garden-replanted` | `story-grandma-garden` with the tray replanted        | `#bfe0e8` → `#d9ecd6` | as above, seedlings `#7cc95a`, trowel `#9aa6b4`, sack `#c9a978`           |
| `story-ada-room-night`           | Ada's room at night: moon and stars, lamp off         | `#1d2452` → `#2a2f5e` | wall `#445487`, floor `#414c64`, blanket `#1d4484`, glass `#16245e`       |
| `story-ada-room-morning`         | Morning: empty bed, sunlight and the rock        | `#f6d9b4` → `#efcfb4` | wall `#ffd5cb`, floor `#f3b65f`, blanket `#a6b3cb`, glass `#fad98a`       |

Full palettes are in the generator. Colours are before treatment d.

- Needle opens and resolves in `story-ada-room-recorder`: the recorder lies on
  its song sheet at the desk's free left end, left of the rock, so the rock
  stays the brightest point. It closes in `story-concert-hall`, the stage seen
  from the hall, with the spotlight on the empty stage. The recorder room draws Ada's
  room 7 rows higher and the concert hall rises 7 rows too, so both subjects end
  by row 293.
- Andromeda opens, resolves and closes in Grandma's garden with a potting table
  on the lawn by the house and a green tray of eight terracotta pots on it.
  `story-grandma-garden-spilled` (the opening, its branch pages and the
  resolution) has the front-row pots pushed back crooked, three seedlings out
  (two on the table, one on the grass) and loose soil on the table and the
  grass; `story-grandma-garden-replanted` (the closing) has every pot upright
  with its seedling, the soil swept up, a trowel on the table and a potting-soil
  sack beside it.
- The new backgrounds add their props to the scenes of `story-ada-room` and
  `story-grandma-garden`, which draw without them; the garden's table stands
  clear of its beds.
- Every Ada's room background (unpolished, the room and its glow frames, the
  recorder room and its glow frames, night, morning and the sleep overlays) has
  a doorway in the left wall beside the bed's head (y 4.05 to 6.25, 6 units
  high), open onto the landing: its frame in the palette's desk wood, the
  landing in the lamp shade's colour (lit by day, `#6c6a72` at night) and its
  floor in drawer wood, so each background's grade carries over. The rock shelf
  sits between the corner and the doorway (y 1.0 to 5.0).
- Cartwheel's dinner is in `story-kitchen`, a room of the same size and
  projection raised 88 rows so the table's near edge ends on row 293: sage
  cabinets with the hob, a pot and the sink under a dusk window along the right
  wall; a round clock, a shelf of jars and the fridge with Ada's drawing on the
  left; checked tiles, two cat bowls, and supper on a cloth-covered round table
  under a warm lamp glow (`#ffe2a0`, radius 3.4, peak 70). The chairs remain
  unoccupied.

The game names each page's location by a background key
(`Background` in `src/data/storybook.ts`):

| Key                      | Asset id                                              |
| ------------------------ | ----------------------------------------------------- |
| `grandmaGarden`          | `story-grandma-garden`                                |
| `gardenLot`              | `story-community-garden`                              |
| `schoolHallway`          | `story-school-hallway`                                |
| `kitchen`                | `story-kitchen` (key to add)                          |
| `schoolyard`             | `story-schoolyard`                                    |
| `frontDoor`              | `story-front-door`                                    |
| `park`                   | `story-park`                                          |
| `adaRoom`                | `story-ada-room`                                      |
| `adaRoomUnpolished`      | `story-ada-room-unpolished` (the rock as dug up)      |
| `adaRoomNight`           | `story-ada-room-night`                                |
| `adaRoomSleep`           | `story-ada-room-sleep` (the unoccupied night room)       |
| `adaRoomMorning`         | `story-ada-room-morning`                              |
| `adaRoomRecorder`        | `story-ada-room-recorder` (key to add)                |
| `concertHall`            | `story-concert-hall` (key to add)                     |
| `grandmaGardenSpilled`   | `story-grandma-garden-spilled` (key to add)           |
| `grandmaGardenReplanted` | `story-grandma-garden-replanted` (key to add)         |
| `frontDoorMom`           | `story-front-door-mom` (key to add)                   |
| `adaRoomRecorderDad`     | `story-ada-room-recorder-dad` (key to add)            |
| `adaRoomUnpolishedCats`  | `story-ada-room-unpolished-cats` (key to add)         |
| `adaRoomMorningCats`     | `story-ada-room-morning-cats` (key to add)            |
| `aboard`                 | `aboard` ([aboard](aboard.md)) (key to add)           |
| `aboardEmergency`        | `aboard-emergency` ([aboard](aboard.md)) (key to add) |

`aboard` is Ada's ship from outside, behind every page aboard: the prologue's
aboard pages, standing and seated alike, Astra's boarding line and the
holodisk moment. The text carries where Ada and Penny are. `aboardEmergency`
is the jump-home page before the sleep scene. The galaxy selector draws over
its own [route sky](route-sky.md). Gameplay owns the page marks.

On an aboard page whose speaker is Astra, she speaks with her dialogue
portrait; the background stays still. See
[Astra speaking](aboard.md#astra-speaking).

## Pages

Gameplay owns the page sequence and copy. Each page names one background; the
[storybook page layout](layout.md#storybook-page) places the panel over it:
bottom-anchored on the available rect, only as tall as the page needs, no dim.
The strip above it shows the scene's subject band. The
background never moves or scales between pages of a scene. Choice pages reuse
their scene's background (Grandma's choice uses `story-grandma-garden`).

## Subject bands

Each background's manifest entry carries `subject: { top, bottom }`, the canvas
rows (logical px) its key objects span, written by its generator
(`art/tools/storybook.ts`, `art/tools/aboard.ts`). The story page offsets the
background so the band centres in the strip above the tallest panel in the
story run ([run anchor](layout.md#storybook-page)). At a 360-high view the canvas can
rise at most 180 (90 past centred), so a band's bottom shows only while it is
at most the panel top + 180; at 720x405 the limit is the panel top + 135.

| Id                               | Band     | Key objects                                            |
| -------------------------------- | -------- | ------------------------------------------------------ |
| `story-park`                     | 220..285 | The dig spot and rock, the bench and the pond          |
| `story-ada-room-unpolished`      | 255..300 | The rock on the desk                                   |
| `story-ada-room`                 | 255..300 | The rock on the desk; the glow frames share it         |
| `story-grandma-garden`           | 199..285 | The raised beds in bloom beside the house              |
| `story-community-garden`         | 180..290 | The sprouting bed, the empty beds, the shed            |
| `story-schoolyard`               | 168..278 | The play structure beside the school's door            |
| `story-school-hallway`           | 184..290 | The notice board beside the near door                  |
| `story-kitchen`                  | 146..293 | The dinner setting and table to its near edge           |
| `story-front-door`               | 175..280 | The coats and Penny's lead on their hooks by the door  |
| `story-ada-room-night`           | 250..300 | The rock's glow on the desk; the sleep scene shares it |
| `story-ada-room-morning`         | 255..348 | The empty bed and the rock on the desk   |
| `aboard`                         | 172..256 | The ship's canopy and the hull round it                |
| `aboard-emergency`               | 172..256 | The ship's canopy and the hull round it                |
| `story-ada-room-recorder`        | 248..293 | The rock and the recorder on the desk                  |
| `story-concert-hall`             | 188..293 | The stage, piano and spotlight          |
| `story-grandma-garden-spilled`   | 176..285 | The seedling tray on the potting table and the beds    |
| `story-grandma-garden-replanted` | 176..285 | The seedling tray on the potting table and the beds    |

Placement per story run and background: canvas top `y`, then the band's view
rows and the tallest panel's top, at 720x360 with insets 43/43/0/19, 844x390
with the same insets, and 1280x720 (720x405). A star marks a clamped
placement. Runs: the first launch (chapter one's opening, then the prologue),
a visit (a waiting chapter scene, Ada's room, boarding), the empty visit, the
jump home (the jump-home page, night, morning, then the visit) and the holodisk
moment (its narration, Astra's "Memory restored." and her memory line). Aboard
runs follow Gameplay's aboard page list; boarding anchors on Astra's line, the
longer "Welcome back, Navigator. A new galaxy is ready." after an unlock, and
the holodisk moment on its longest memory line, the fourth (a run with a
shorter line anchors on its own tallest page). The four new backgrounds have
no pages yet; their rows assume a chapter page at Gameplay's limit (220
characters, the heading and two choices).

| Background, runs                                                    | 720x360, insets                 | 844x390, insets                 | 1280x720                        |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `story-grandma-garden`, first launch                                | y -180*: 19..105, top 113       | y -180*: 19..105, top 113       | y -135*: 64..150, top 161       |
| `story-park`, first launch                                          | y -138: 82..147, top 229        | y -134: 86..151, top 237        | y -110: 110..175, top 285       |
| `story-ada-room-unpolished`, first launch                           | y -162: 93..138, top 231        | y -162: 93..138, top 231        | y -135*: 120..165, top 279      |
| `story-ada-room`, every visit, first launch, empty visit, jump home | y -171: 84..129, top 213        | y -171: 84..129, top 213        | y -135*: 120..165, top 261      |
| `aboard`, first launch (standing, questions, seated)                | y -167.5: 4.5..88.5, top 93     | y -167.5: 4.5..88.5, top 93     | y -135*: 37..121, top 141       |
| `story-community-garden`, visit, chapter 1 resolution               | y -178.5: 1.5..111.5, top 113   | y -178.5: 1.5..111.5, top 113   | y -135*: 45..155, top 161       |
| `aboard`, boarding                                                  | y -95.5: 76.5..160.5, top 237   | y -95.5: 76.5..160.5, top 237   | y -71.5: 100.5..184.5, top 285  |
| `aboard`, boarding after an unlock                                  | y -99.5: 72.5..156.5, top 229   | y -99.5: 72.5..156.5, top 229   | y -75.5: 96.5..180.5, top 277   |
| `aboard`, holodisk moment, fourth memory line                       | y -125.5: 46.5..130.5, top 177  | y -125.5: 46.5..130.5, top 177  | y -101.5: 70.5..154.5, top 225  |
| `aboard-emergency`, jump home                                       | y -85.5: 86.5..170.5, top 257   | y -85.5: 86.5..170.5, top 257   | y -61.5: 110.5..194.5, top 305  |
| `story-school-hallway`, visit, chapter 2 opening                    | y -170.5: 13.5..119.5, top 133  | y -170.5: 13.5..119.5, top 133  | y -135*: 49..155, top 181       |
| `story-schoolyard`, visit, chapter 2 resolution                     | y -156.5: 11.5..121.5, top 133  | y -156.5: 11.5..121.5, top 133  | y -132.5: 35.5..145.5, top 181  |
| `story-front-door`, visit, chapter 3 opening                        | y -171: 4..109, top 113         | y -171: 4..109, top 113         | y -135*: 40..145, top 161       |
| `story-park`, visit, chapter 3 resolution                           | y -180*: 40..105, top 143       | y -176: 44..109, top 153        | y -135*: 85..150, top 201       |
| `story-ada-room-night`, jump home                                   | y -146.5: 103.5..153.5, top 257 | y -146.5: 103.5..153.5, top 257 | y -122.5: 127.5..177.5, top 305 |
| `story-ada-room-morning`, jump home                                 | y -173: 82..175, top 257        | y -173: 82..175, top 257        | y -135*: 120..213, top 305      |
| `story-ada-room-recorder`, new chapter at the limit                 | y -180*: 68..113, top 113       | y -180*: 68..113, top 113       | y -135*: 113..158, top 161      |
| `story-concert-hall`, new chapter at the limit                      | y -180*: 8..113, top 113        | y -180*: 8..113, top 113        | y -135*: 53..158, top 161       |
| `story-grandma-garden-spilled`, new chapter at the limit            | y -174: 2..111, top 113         | y -174: 2..111, top 113         | y -135*: 41..150, top 161       |
| `story-grandma-garden-replanted`, new chapter at the limit          | y -174: 2..111, top 113         | y -174: 2..111, top 113         | y -135*: 41..150, top 161       |

An [environment alias](#environment-aliases) carries its base's band and
takes its base's placement. Existing subject bands remain unchanged to keep
story-run anchors stable.

Every band in the current runs clears its panel at these views, the aboard
band under Astra's three questions included: its 84 rows fit the 93-row strip.
At Gameplay's limit the four new backgrounds clear too: Needle's recorder room
and concert hall rise 7 rows so their bands end by row 293, the lowest visible
row under a 220-character page at 360-high views.

## Environment aliases

These existing asset IDs preserve the page keys and run anchors. Each entry
shares its base's PNG, subject band and `base`, with no figure overlays.
Character names in the IDs are compatibility keys, not rendered contents.

| Alias | Environment base |
| ----- | ---------------- |
| `story-front-door-mom` | `story-front-door` |
| `story-ada-room-recorder-dad` | `story-ada-room-recorder` |
| `story-ada-room-unpolished-cats` | `story-ada-room-unpolished` |
| `story-ada-room-morning-cats` | `story-ada-room-morning` |
| `story-ada-room-sleep` | `story-ada-room-night` |

Only the galaxy map emits character sprites: `story-ada-skywatch` and
`story-penny-sitting`, drawn over `route-ground` at their established
`FIGURES` foot points and scale 1. Story backgrounds and sequences never
reference them. Other unused character PNGs remain on disk but are absent
from the manifest and all background and sequence references. The map's
grass, afterglow, sky and stellar phenomena remain unchanged. The established
portrait sheets and their generators are unchanged.

## Rock glow transition

The glow plays on the press that leaves Ada's room for the ship: the page
change from an `adaRoom` page to the first aboard page (in the prologue,
"Touch the glow."; at boarding, the room narration's press). Data:
[story-transition.json](../public/art/story-transition.json), linked from the
root manifest as `storyTransition`. Key `rockGlow` ends on
[`aboard`](aboard.md), in the prologue and at every boarding alike.

- `from` is the page's background, `story-ada-room`. On the press the story
  panel hides, then `steps` play in order.
- Each step cross-fades linearly from the previous image to its `background`
  over `fadeMs`, then holds for `holdMs`. A `fadeMs` of 0 is a cut.
- Steps: `story-ada-room-glow-1` (160 ms), `story-ada-room-glow-2` (160 ms),
  `story-ada-room-glow-3` (200 ms, hold 240 ms), then a cut to `aboard`. The
  first aboard page's panel then appears.
- `reducedMotion` replaces `steps`: one 400 ms cross-fade from
  `story-ada-room` to `aboard`, with no glow frames.

Needle boards from the recorder room, so key `rockGlowRecorder` is the
same glow from `story-ada-room-recorder` through `story-ada-room-recorder-glow-1`
to `-3` into `aboard`, with the same timing and reduced motion. Its
frames are the recorder room with the same glow amounts, drawn 7 rows higher as
the room is, the recorder in place on its song sheet, and carry the room's
subject band (248..293).

The glow frames are `story-ada-room` with the rock's glow grown to a third, two
thirds and all of the room: 32 nested ellipses (height 0.6 of width) in
`#96ecde` round the rock, radius `1.4 + 16 g` model units and peak alpha
`150 + 105 g` for amount `g`, blurred by a tenth of the radius, under
treatment d like every background.

## Overnight recharge

The emergency jump home lands at night. Three pages share Ada's room: the night
page (`adaRoomNight`, with the jump-home line), the sleep scene (`adaRoomSleep`,
no panel and no Skip) and the morning page (`adaRoomMorning`).

### Night and morning

Both are full backgrounds of the same room with the room's palette graded in
Oklab (`L' = l0 + l1 L`, chroma times `c`, then `+ (da, db)`); the glow colours
keep their values.

- Night: grade `(0.08, 0.42, 0.5, -0.012, -0.075)`, the lamp shade off at
  `#6c6a72`, a dark blue window `#16245e` with a moon `#f1ecd6` and seven stars
  `#e8e6ff`, a moonlight glow `#b9c9f2` (radius 3.4, peak 70) at the window, a
  faint moon beam and its floor patch screened in `#b9c9f2` (alpha 0.07 and
  0.26), and the rock's glow at radius 3.0, peak 170. Night haze.
- Morning: grade `(0.02, 0.99, 1.1, 0.014, 0.05)`, a pale gold window
  `#fad98a`, a sun glow `#ffdf96` (radius 3.0, peak 80), a long soft beam and
  bright floor patches screened in `#ffe2a0` that thin toward the room's front,
  and the rock's faint glow as in `story-ada-room`. Day haze. The bed,
  blanket and pillow remain unoccupied; morning has no baked Penny or
  waking sprite. Its existing `story-ada-room-morning-cats` page key is an
  environment alias.

### Sleep scene overlay

`story-ada-room-sleep` shares the night background and its run placement,
without a figures overlay. Only `story-ada-room-sleep-glow` is emitted: the
rock's glow at radius 3.8, peak 215, over the unoccupied night room at radius
3.0, peak 170.

The overlay is an RGBA PNG at 2x with `pivot` (0, 0) and `at`, its top-left
corner on the background canvas in logical px. It is the exact difference
between the peak-glow render and the night render: differing pixels grown
by 2 px, opaque, with clear pixels elsewhere in its cropped box. Its bounds
and placement are derived from those renders and written to the manifest
and sequence. At alpha 1 it reproduces the peak-glow render exactly, so a
linear alpha fade equals a cross-fade between the two renders.

### Sequence

Data: [story-overnight.json](../public/art/story-overnight.json), linked from
the root manifest as `storyOvernight`. Key `overnight`:

- `from` (`story-ada-room-night`), `sleep` (`story-ada-room-sleep`) and `to`
  (`story-ada-room-morning-cats`, the environment-only morning alias) name the three pages' backgrounds.
- `overlays` contains only the rock-glow overlay and its `at`, as in its
  manifest entry. The opening hold uses the existing background-step schema
  with the night background, `fadeMs: 0` and `holdMs: 400` (2000 for reduced
  motion); it introduces no new cross-fade or sequence schema.
- `steps` play in order when the sleep page starts (the night page's panel
  has hidden); `durationMs` is their total:
  - `{ overlay, fadeMs, holdMs }`: fade that overlay in from alpha 0 to 1,
    linearly over `fadeMs` (0 shows it at once), then hold for `holdMs`.
  - `{ breath, ms }`: that overlay's alpha follows
    `(1 - cos(2 pi t / ms)) / 2` over `ms`, 0 at both ends and 1 midway.
  - `{ background, fadeMs, holdMs }`: cross-fade the whole picture to that
    background over `fadeMs`, then hold; the overlays end with it.
- `reducedMotion` replaces `steps`; `reducedMotionMs` is its total.

| Time (ms)    | Steps                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| 0 to 400     | Hold the unoccupied night room                                            |
| 400 to 1900  | One breath: the rock's glow from radius 3.0, peak 170 to 3.8, 215 and back |
| 1900 to 2500 | Cross-fade to the morning page's background; the morning page follows      |

Reduced motion (2400 ms): hold the unoccupied night room for 2000 ms with
the glow steady, then one 400 ms cross-fade to the morning page's background. In the
breath only the glow patch changes, once per 1.5 s.
