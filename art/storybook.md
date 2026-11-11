# Storybook art

- Rebuild with `node art/tools/storybook.ts` (optionally one id). It writes the
  Earth backgrounds and the overnight overlays to `public/art/story/`, their
  `story-` root manifest entries, `story-transition.json` and
  `story-overnight.json`. `art/tools/diorama.ts` holds the solids, painter,
  lights and treatment.
- Output is deterministic: the same source writes byte-identical PNGs.

## Canvas

Every storybook background, like the cockpit, is a 960 by 540 logical px canvas
at 2x: a 1920 by 1080 opaque PNG with `displayWidth` 960 and `displayHeight` 540
and the pivot at the centre. Draw it at display size, centred on the view under
the insets. It covers every view up to 960 by 540 (a 720 by 540 4:3 view, an
800 by 360 21:9 phone); scale it up to cover only past that.

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

| Id                          | Scene                                                 | Backdrop              | Key colours                                                         |
| --------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| `story-park`                | Park: pond, bench, three trees, the dig spot and rock | `#cfe4e8` → `#dfeadb` | grass `#8cc777`, path `#e8d3a2`, pond `#8fc8de`, rock `#93877e`     |
| `story-ada-room-unpolished` | Ada's room, the rock on the desk as dug up            | `#d9d2e6` → `#cfc5de` | wall `#e6d6ea`, floor `#d9b98f`, blanket `#8fb0e2`, rock `#93877e`  |
| `story-ada-room`            | Ada's room, the polished rock's faint glowing pattern | `#d9d2e6` → `#cfc5de` | as above, glow line `#53d1c2`, glow `#96ecde`                       |
| `story-grandma-garden`      | Grandma's house, fence, raised beds in bloom, tree    | `#bfe0e8` → `#d9ecd6` | grass `#86c46f`, wall `#f0d7a8`, roof `#d06a55`, blooms `#ef7f8f`   |
| `story-community-garden`    | Fenced lot: shed, one sprouting and two empty beds    | `#d3dfe6` → `#dfe6dc` | ground `#cfae82`, patches `#a9c98b`, shed `#b49ad6`, bin `#6f9a7a`  |
| `story-schoolyard`          | School, hopscotch, play structure and slide, tree     | `#cfe0ea` → `#dde6e4` | asphalt `#b6aebf`, brick `#d48f7e`, slide `#f2c95c`, bars `#ea8f84` |
| `story-school-hallway`      | Lockers, notice board, two doors, bench               | `#c7d3e6` → `#a9b8d2` | wall `#f1e3c6`, lockers `#5fb3a6`, floor `#d8c29c`, bench `#7d8fc0` |
| `story-front-door`          | Front door, coats and lead, shoe rack, dog's bowl     | `#e6dccd` → `#dcd0c0` | door `#a98bc4`, floor `#d6b48e`, coats `#f0c95e` and `#86ade0`      |
| `story-ada-room-night`      | Ada's room at night: moon and stars, lamp off         | `#1d2452` → `#2a2f5e` | wall `#445487`, floor `#414c64`, blanket `#1d4484`, glass `#16245e` |
| `story-ada-room-morning`    | Morning: Ada sits up stretching, Penny awake          | `#f6d9b4` → `#efcfb4` | wall `#ffd5cb`, floor `#f3b65f`, blanket `#a6b3cb`, glass `#fad98a` |

Full palettes are in the generator. Colours are before treatment d.

The game names each page's location by a background key
(`Background` in `src/data/storybook.ts`):

| Key                 | Asset id                                         |
| ------------------- | ------------------------------------------------ |
| `grandmaGarden`     | `story-grandma-garden`                           |
| `gardenLot`         | `story-community-garden`                         |
| `schoolHallway`     | `story-school-hallway`                           |
| `schoolyard`        | `story-schoolyard`                               |
| `frontDoor`         | `story-front-door`                               |
| `park`              | `story-park`                                     |
| `adaRoom`           | `story-ada-room`                                 |
| `adaRoomUnpolished` | `story-ada-room-unpolished` (the rock as dug up) |
| `adaRoomNight`      | `story-ada-room-night`                           |
| `adaRoomSleep`      | `story-ada-room-sleep` (night plus the figures)  |
| `adaRoomMorning`    | `story-ada-room-morning`                         |
| `cockpit`           | `cockpit` ([cockpit](cockpit.md))                |
| `cockpitSeated`     | `cockpit-seated` ([cockpit](cockpit.md))         |

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
bottom-anchored on the available rect, sized to its own content, no dim. The
background never moves or scales between pages of a scene. Choice pages reuse
their scene's background (Grandma's choice uses `story-grandma-garden`).

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
  and the rock's faint glow as in `story-ada-room`. Day haze. The waking
  figures are drawn into this background: the morning page needs only one
  image.

Ada and Penny are drawn about 1.5 times the room's furniture scale so they read
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
- Waking: Ada sits back against the pillow, arms raised in a stretch; Penny
  sits up awake at the foot of the bed.

On the 844 by 390 phone the morning page's panel top is at logical y 236 and the
rock's top at 188. Ada's head (centre 211) and raised arms clear the panel;
Penny's head (273) sits under it and shows during the cross-fade into the
morning, before the panel appears. The sleep scene shows no panel, so both
figures stay in view (Ada 263, Penny 318).

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
