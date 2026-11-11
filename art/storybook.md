# Storybook art

- Rebuild with `node art/tools/storybook.ts` (optionally one id). It writes the
  Earth backgrounds, [Ada's sprites](#adas-sprites) and the overnight overlays
  to `public/art/story/`, their `story-` root manifest entries,
  `story-transition.json` and `story-overnight.json`. `art/tools/diorama.ts`
  holds the solids, painter, lights and treatment; `art/tools/ada-sprites.ts`
  draws the sprites.
- Output is deterministic: the same source writes byte-identical PNGs.

## Canvas

Every storybook background, like the cockpit, is a 960 by 540 logical px canvas
at 2x: a 1920 by 1080 opaque PNG with `displayWidth` 960 and `displayHeight` 540
and the pivot at the centre. Draw it at display size under the insets, centred
across and offset down by the [scene anchor](layout.md#storybook-page), which
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
| `story-front-door`               | Front door, coats and lead, shoe rack, dog's bowl     | `#e6dccd` → `#dcd0c0` | door `#a98bc4`, floor `#d6b48e`, coats `#f0c95e` and `#86ade0`            |
| `story-ada-room-recorder`        | `story-ada-room` with the recorder on a song sheet    | `#d9d2e6` → `#cfc5de` | as `story-ada-room`, recorder `#7a4a32`, rings `#efe4c8`                  |
| `story-concert-hall`             | Corner stage, curtains, piano, spotlight, chair rows  | `#d8cde0` → `#cbbfd2` | wall `#efe2cf`, floor `#d7ad7c`, curtain `#c95a66`, chairs `#6f93cf`      |
| `story-grandma-garden-spilled`   | `story-grandma-garden` with the tray spilled          | `#bfe0e8` → `#d9ecd6` | as `story-grandma-garden`, tray `#4f6a5a`, pots `#d9825b`, soil `#6e4a30` |
| `story-grandma-garden-replanted` | `story-grandma-garden` with the tray replanted        | `#bfe0e8` → `#d9ecd6` | as above, seedlings `#7cc95a`, trowel `#9aa6b4`, sack `#c9a978`           |
| `story-ada-room-night`           | Ada's room at night: moon and stars, lamp off         | `#1d2452` → `#2a2f5e` | wall `#445487`, floor `#414c64`, blanket `#1d4484`, glass `#16245e`       |
| `story-ada-room-morning`         | Morning: the bed, Penny awake; Ada is a sprite        | `#f6d9b4` → `#efcfb4` | wall `#ffd5cb`, floor `#f3b65f`, blanket `#a6b3cb`, glass `#fad98a`       |

Full palettes are in the generator. Colours are before treatment d.

- Needle opens and resolves in `story-ada-room-recorder`: the recorder lies on
  its song sheet at the desk's free left end, left of the rock, so the rock
  stays the brightest point. It closes in `story-concert-hall`, the stage seen
  from the hall, with Ada playing in the spotlight.
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

The game names each page's location by a background key
(`Background` in `src/data/storybook.ts`):

| Key                      | Asset id                                         |
| ------------------------ | ------------------------------------------------ |
| `grandmaGarden`          | `story-grandma-garden`                           |
| `gardenLot`              | `story-community-garden`                         |
| `schoolHallway`          | `story-school-hallway`                           |
| `schoolyard`             | `story-schoolyard`                               |
| `frontDoor`              | `story-front-door`                               |
| `park`                   | `story-park`                                     |
| `adaRoom`                | `story-ada-room`                                 |
| `adaRoomUnpolished`      | `story-ada-room-unpolished` (the rock as dug up) |
| `adaRoomNight`           | `story-ada-room-night`                           |
| `adaRoomSleep`           | `story-ada-room-sleep` (night plus the figures)  |
| `adaRoomMorning`         | `story-ada-room-morning`                         |
| `adaRoomRecorder`        | `story-ada-room-recorder` (key to add)           |
| `concertHall`            | `story-concert-hall` (key to add)                |
| `grandmaGardenSpilled`   | `story-grandma-garden-spilled` (key to add)      |
| `grandmaGardenReplanted` | `story-grandma-garden-replanted` (key to add)    |
| `cockpit`                | `cockpit` ([cockpit](cockpit.md))                |
| `cockpitSeated`          | `cockpit-seated` ([cockpit](cockpit.md))         |

`cockpit` is the empty cockpit, used only in the prologue: from the arrival
narration through Astra's lines and the optional questions. `cockpitSeated`
starts on the page where Ada sits and buckles Penny in, and covers every later
ship-scene page: quantum jump, the galaxy selector, and every later chapter's
boarding and Continue, where they sit at once. Gameplay owns the page marks.

On a cockpit page whose speaker is Astra, she speaks with her dialogue
portrait; the cockpit background stays still. See
[Astra speaking](cockpit.md#astra-speaking).

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
(`art/tools/storybook.ts`, `art/tools/cockpit.ts`). The story page offsets the
background so the band centres in the strip above the scene's tallest panel
([scene anchor](layout.md#storybook-page)). At a 360-high view the canvas can
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
| `story-front-door`               | 175..280 | The coats and Penny's lead on their hooks by the door  |
| `story-ada-room-night`           | 250..300 | The rock's glow on the desk; the sleep scene shares it |
| `story-ada-room-morning`         | 245..350 | Ada stretching on the bed, the rock on the desk        |
| `cockpit`                        | 175..298 | The canopy dome                                        |
| `cockpit-seated`                 | 175..298 | The canopy dome                                        |
| `story-ada-room-recorder`        | 255..300 | The rock and the recorder on the desk                  |
| `story-concert-hall`             | 195..300 | The stage, the piano and Ada in the spotlight          |
| `story-grandma-garden-spilled`   | 176..285 | The seedling tray on the potting table and the beds    |
| `story-grandma-garden-replanted` | 176..285 | The seedling tray on the potting table and the beds    |

Placement per scene and background: canvas top `y`, then the band's view rows
and the tallest panel's top, at 720x360 with insets 43/43/0/19, 844x390 with
the same insets, and 1280x720 (720x405). A star marks a clamped placement.

| Scene, background                      | 720x360, insets                 | 844x390, insets                 | 1280x720                        |
| -------------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| opening:1, `story-grandma-garden`      | y -180*: 15..135, top 133       | y -180*: 15..135, top 133       | y -135*: 60..180, top 181       |
| resolution:1, `story-community-garden` | y -168.5: 11.5..121.5, top 133  | y -168.5: 11.5..121.5, top 133  | y -135*: 45..155, top 181       |
| opening:2, `story-school-hallway`      | y -146: -1..144, top 143        | y -141: 4..149, top 153         | y -117: 28..173, top 201        |
| resolution:2, `story-schoolyard`       | y -158.5: 1.5..141.5, top 143   | y -153.5: 6.5..146.5, top 153   | y -129.5: 30.5..170.5, top 201  |
| opening:3, `story-front-door`          | y -161: -1..134, top 133        | y -161: -1..134, top 133        | y -135*: 25..160, top 181       |
| resolution:3, `story-park`             | y -180*: 40..105, top 143       | y -168: 52..117, top 169        | y -135*: 85..150, top 217       |
| prologue, `story-park`                 | y -138: 82..147, top 229        | y -134: 86..151, top 237        | y -110: 110..175, top 285       |
| prologue, `story-ada-room-unpolished`  | y -162: 93..138, top 231        | y -162: 93..138, top 231        | y -135*: 120..165, top 279      |
| prologue, `story-ada-room`             | y -165: 90..135, top 225        | y -165: 90..135, top 225        | y -135*: 120..165, top 273      |
| prologue, `cockpit`                    | y -175: -10..135, top 125       | y -175: -10..135, top 125       | y -135*: 30..175, top 173       |
| prologue, `cockpit-seated`             | y -136: 29..174, top 203        | y -136: 29..174, top 203        | y -112: 53..198, top 251        |
| room, `story-ada-room`                 | y -165: 90..135, top 225        | y -165: 90..135, top 225        | y -135*: 120..165, top 273      |
| room (empty visit), `story-ada-room`   | y -165: 90..135, top 225        | y -165: 90..135, top 225        | y -135*: 120..165, top 273      |
| boarding, `story-ada-room`             | y -149: 106..151, top 257       | y -149: 106..151, top 257       | y -125: 130..175, top 305       |
| boarding, `cockpit-seated`             | y -123: 42..187, top 229        | y -123: 42..187, top 229        | y -99: 66..211, top 277         |
| jumpHome, `story-ada-room-night`       | y -146.5: 103.5..153.5, top 257 | y -146.5: 103.5..153.5, top 257 | y -122.5: 127.5..177.5, top 305 |
| jumpHome, `story-ada-room-morning`     | y -169: 76..181, top 257        | y -169: 76..181, top 257        | y -135*: 110..215, top 305      |

Apart from the cockpit below, every band clears its panel at these views with
Gameplay's current pages, within 2 rows (Grandma's beds, the hallway's doors
and the coats graze the panel or the view top by 1 or 2). Two cases crop a key
object:

- The prologue's cockpit, under Astra's questions (panel top 125 at 360-high
  views): the 145-row canopy is taller than the 125 strip, so 10 rows go under
  the panel and 10 above the view. Recompose: draw the ship at 0.85 about the
  canopy's centre, so the dome spans 175..298 (123 rows).
- A 218-character opening, resolution or closing at 720x360 with insets
  (panel top 117, a 117 strip): Grandma's beds lose 18 rows at their foot
  (the placement clamps), the schoolyard's 140 rows lose 11.5 at each end, the
  hallway's 145 rows 14 at each end and the front door's 135 rows 9 at each
  end. Recompose each subject into at most 110 rows ending by row 290: move
  Grandma's beds to the house's side of the lot (rows 185..290), set the play
  structure beside the school's door (180..290), hang the notice board lower
  beside the near door (180..290), and hang the coats and lead lower by the
  door (180..290).

## Ada's sprites

Ada on the concert stage and waking on the morning page is a crisp pixel
sprite drawn over the treated background, not painted into it. Each is an
overlay of its background: the background entry's `overlays` names it, and
its entry gives the PNG at one sprite px per image px, `scale` (logical px per
sprite px), `displayWidth` and `displayHeight` (the image times `scale`),
`pivot` (0, 0), `at` (its top-left corner on the canvas in whole logical px)
and `sampling: "nearest"`.

| Id                  | Size (px) | `scale` | `at`       | Background               | Pose                                        |
| ------------------- | --------- | ------- | ---------- | ------------------------ | ------------------------------------------- |
| `story-ada-playing` | 44 x 56   | 1       | (480, 228) | `story-concert-hall`     | Playing the recorder, feet on the spotlight |
| `story-ada-waking`  | 48 x 42   | 2       | (249, 264) | `story-ada-room-morning` | Stretching and yawning, kneeling in bed     |

- Scale: one sprite px is 1 logical px in the concert hall and 2 in Ada's room,
  each scene's furniture scale; that is 2 and 4 canvas px at the canvas's 2x.
  Whole-px `at` puts the sprite's grid on whole canvas px.
- Drawing: after the background's blur, desaturation and haze, with the
  background's transform (centred, the scene anchor's offset, scale
  `max(1, viewW / 960, viewH / 540)`), nearest-neighbour at that scale and at
  the device ratio, like every pixel sprite ([layout](layout.md)): no linear
  filter and no sub-pixel offset, so each sprite px stays one solid square.
  It moves and scales with its background and shows whenever it does,
  cross-fades included.
- Head: Ada's portrait's neutral frame, pixel for pixel
  (`art/sources/face-walker-ada.png`, [provenance](portraits.md#storybook-sprite-source)),
  with these changes only: the crown rounded into an oval (one more row on
  top), one 1 px white shine per eye (the lower-right shines go), 2 px of blush
  `#f6757a` per cheek inside the face outline, a small smile, no chin line (the
  chin is skin and the neck under it `#9c5a42`), and no hair below the chin;
  the back hair reaches her shoulders behind the neck.
- Body: a front view in Archie's walker-ada colours (shirt `#fee761` and
  `#feae34`, shorts `#0099db` and `#124e89`, skin `#b86f50` and `#c28569`,
  white shoes with soles `#f6757a`), ink edge `#181425` and flat shading,
  about 2.5 heads tall with torso and legs about equal (shoulder 25 to hip 40,
  hip to sole 54). It centres on the head's centre line (x 21.5), with weight
  on her left leg, a gentle A-line shirt hem, rounded shoes and arms as 3 px
  strokes with clean 1 px steps and bent elbows.
- Playing: the recorder (`#7a4a32`, shade `#5a3424`, ring `#efe4c8`) leans down
  and forward from her lips to the viewer's left; her left hand holds it high
  and her right hand low, each arm from its own side with the elbow out, the
  arms apart so the recorder shows between them. A 22 by 3 ink shadow at alpha
  60 sits under her shoes.
- Waking: arms in a soft V with bent elbows and loose fists by the top of her
  head, eyes shut and a small open yawn. The duvet's bunched edge covers her
  lap, in the morning page's treated blanket colour sampled at canvas px
  (492, 776), with a fold shade 24 darker and the ink edge.
- Penny stays painted on the morning page; a crisp Penny sprite on the same
  rule could follow.

## Rock glow transition

The glow plays on the press that leaves Ada's room for the cockpit: the page
change from an `adaRoom` page to the ship scene's first page (in the prologue,
"Touch the glow."; at boarding, the room narration's press). Data:
[story-transition.json](../public/art/story-transition.json), linked from the
root manifest as `storyTransition`. Key `rockGlow` ends on `cockpit` (the
prologue); `rockGlowSeated` is identical but ends on `cockpit-seated`
(boarding). The game picks the entry whose final background matches the next
page's.

- `from` is the page's background, `story-ada-room`. On the press the story
  panel hides, then `steps` play in order.
- Each step cross-fades linearly from the previous image to its `background`
  over `fadeMs`, then holds for `holdMs`. A `fadeMs` of 0 is a cut.
- Steps: `story-ada-room-glow-1` (160 ms), `story-ada-room-glow-2` (160 ms),
  `story-ada-room-glow-3` (200 ms, hold 240 ms), then a cut to the entry's
  cockpit background. The ship scene's first page panel then appears.
- `reducedMotion` replaces `steps`: one 400 ms cross-fade from
  `story-ada-room` to the entry's cockpit background, with no glow frames.

Needle boards from the recorder room, so key `rockGlowRecorderSeated` is the
same glow from `story-ada-room-recorder` through `story-ada-room-recorder-glow-1`
to `-3` into `cockpit-seated`, with the same timing and reduced motion. Its
frames are the recorder room with the same glow amounts, the recorder in place
on its song sheet, and carry the room's subject band (255..300).

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
  and the rock's faint glow as in `story-ada-room`. Day haze. Penny and the
  blanket over Ada's legs are drawn into this background; Ada is the
  `story-ada-waking` sprite over it ([Ada's sprites](#adas-sprites)).

The painted figures (Ada asleep, and Penny) are drawn about 1.5 times the room's furniture scale so they read
on a phone, within the bed's footprint, from the portrait palettes: Ada's hair
`#262b44`, skin `#b86f50`, shirt `#fee761` and bow `#b55088`; Penny's coat
`#feae34`, ears and tail `#f77622`, muzzle `#fee761` and collar `#0099db`. They
take their own lighter grades so they stay the subject: night
`(0.12, 0.6, 1.0, -0.015, 0.01)`, which keeps Penny a dusky gold under the
night haze (coat `#b57100` before treatment), and morning
`(0.01, 1.0, 1.0, 0.006, 0.02)` (coat `#ffae00`).

- Asleep: Ada on her back, head on the pillow, the blanket to her chin; Penny
  asleep across the foot of the bed over Ada's feet, head turned to the viewer,
  eyes closed.
- Waking: Penny sits up awake at the foot of the bed; Ada kneels up in bed
  stretching, the `story-ada-waking` sprite.

On the 844 by 390 phone with insets the morning page's panel top is at logical
y 257 and its background at canvas top -169: the rock's top (109), Ada's sprite
(top 95, chin 139) and Penny's head (194) all clear the panel. The sleep scene
shows no panel and keeps the night page's placement (-146.5), so both figures
stay in view (Ada 206.5, Penny 261.5).

### Sleep scene overlays

`story-ada-room-sleep` is a composite entry: its `path` is the night background
and `overlays` lists `story-ada-room-sleep-figures`, drawn over it. Overlay
entries are RGBA PNGs at 2x with `pivot` (0, 0) and `at`, their top-left corner
on the background canvas in logical px.

| Id                             | Size (px) | `at`       | Contents                                |
| ------------------------------ | --------- | ---------- | --------------------------------------- |
| `story-ada-room-sleep-figures` | 334 x 230 | (168, 325) | Ada and Penny asleep, over the night    |
| `story-ada-room-sleep-glow`    | 440 x 302 | (361, 194) | The rock's glow at radius 3.8, peak 215 |

Each overlay is the exact difference between two full renders: the pixels that
differ, grown by 2 px, opaque, with clear pixels elsewhere in its box. Over its
base at alpha 1 it reproduces the larger render exactly, so a linear alpha fade
equals a cross-fade between the two renders. The figures overlay is the sleep
render over the night render; the glow overlay is the sleep render at the
breath's peak over the sleep render.

### Sequence

Data: [story-overnight.json](../public/art/story-overnight.json), linked from
the root manifest as `storyOvernight`. Key `overnight`:

- `from` (`story-ada-room-night`), `sleep` (`story-ada-room-sleep`) and `to`
  (`story-ada-room-morning`) name the three pages' backgrounds.
- `overlays` maps each overlay id to its `at`, as in its manifest entry.
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
| 0 to 400     | Figures fade in: night to sleep                                            |
| 400 to 1900  | One breath: the rock's glow from radius 3.0, peak 170 to 3.8, 215 and back |
| 1900 to 2500 | Cross-fade to the morning background; the morning page follows             |

Reduced motion (2400 ms): the figures show at once and hold 2000 ms with the
glow steady, then one 400 ms cross-fade to the morning background. In the
breath only the glow patch changes, once per 1.5 s.
