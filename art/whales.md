# Whirlpool whales

- Rebuild with `node art/tools/whales.ts`. It writes `public/art/whales/`,
  [whales.json](../public/art/whales.json) and its own `whale-` entries:
  the calves' in [Whirlpool's manifest](../public/art/whirlpool/manifest.json),
  which names the data file as `whales`, and the whale's and smaller adult's in
  the [core manifest](../public/art/manifest.json), since the Phantom finale
  draws them too. Every frame file stays in `public/art/whales/`.
- The model shares the rotation, culling, depth and projection of
  [art/tools/projection.ts](tools/projection.ts) with 16 headings
  (`ENEMY_HEADINGS`): heading `k` faces world angle `k * 22.5` degrees, as for
  the [enemies](enemies.md).

## Design

The lantern whale: a chunky low-poly humpback with a blunt rounded head, long
swept flippers and a notched fluke. Luminous spots run down its back with
three crown spots on the head; a pale throat, a round eye with a glint and a
short upturned smile face Ada. The indigo-violet hull sits between Ada's sky
blue and the point-of-interest lavender, clear of coral drones, mint and
amber signals.

| Role       | Whale and smaller adult   | Calves                    | Contrast on `#132D33` |
| ---------- | ------------------------- | ------------------------- | --------------------- |
| Hull ramp  | `#aaa5e6` to `#544d91`    | `#bfbaef` to `#6b64a6`    | 6.36 to 1.96 (adult)  |
| Throat     | `#e6e0f8` to `#7c72a4`    | `#eeeafb` to `#8a80b0`    | 11.29 (lit adult)     |
| Fins       | `#9d97dd` to `#4c4585`    | `#afa9e6` to `#504a87`    | 5.45 (lit adult)      |
| Glow       | `#cbb8ee`, core `#f7f2ff` | `#d8c9f4`, core `#fbf8ff` | 8.02, 13.16 (adult)   |
| Eye, glint | `#181425`, `#ffffff`      | same                      |                       |
| Smile      | `#2c2660`                 | same                      |                       |

Faces are flat polygons shaded from the world light `(-0.25, 0.45, 1)` into the
five ramp tones (thresholds 0.9, 0.78, 0.6 and 0.3), as for the asteroids. Body
and fin faces carry a 1 frame px stroke in their own fill so adjacent facets
rasterize without seams; spots, eyes and the smile are unstroked decals drawn
after the body.

## Kinds

| Kind        | Length (frame px) | Scale | Spots             | Display px (w by h) | Footprint radius |
| ----------- | ----------------: | ----: | ----------------- | ------------------- | ---------------: |
| `whale`     |               190 |     1 | 6, two rows       | 86-114 by 59-78     |      42.63-48.22 |
| `adult`     |               150 |  0.79 | 5, one centre row | 69-91 by 46-62      |      33.73-38.16 |
| `calf`      |                80 |  0.42 | 4, two rows       | 36-50 by 25-34      |      18.15-20.54 |
| `youngCalf` |                66 |  0.35 | 3, two rows       | 30-42 by 21-28      |      15.03-17.02 |

- The smaller adult's centre row alternates one spot and a pair, so it is told
  from the whale when they swim together. It has its own frame set.
- Calves use the paler ramps, a 14% fuller head, a 37% larger eye, shorter
  flippers and fewer, larger spots.

## Frames

- Each kind has 16 headings by 8 loop frames: `{kind}-{heading}-{frame}.svg`.
- Intrinsic `width` and `height` are integer display px with the `viewBox` in
  frame px (`display = frame * 0.4375`, as for Ada), so the browser rasterizes
  each frame at display size. The whole set is 512 frames and 1.71 megapixels
  (6.5 MiB as RGBA textures): whale 0.88, adult 0.56, calf 0.16 and younger
  calf 0.11.
- One canvas per heading is shared by its 8 frames, so the pivot does not move
  within a loop.
- The pivot is the centre of the whale's plan on the world plane below it; the
  body hovers above it. Place the pivot at the world position and sort by its
  screen y.
- Render the selected frame with rotation zero; no filters, raster assets or
  screen rotation.

## Motion

- Swim loop: 8 frames of a fluke wave, a flipper beat and a slight bob. The
  song ripple lights spot pair `f` on frame `f`, head to tail, and the crown
  spots on frames 0 and 1.
- Whale and smaller adult: 300 ms per frame idle (2.4 s), 150 ms swimming
  (1.2 s). Calves: 200 ms idle (1.6 s), 100 ms swimming (0.8 s). Idle plays at
  a destination; swimming plays while a whale travels.
- Each whale starts at its own phase, so a family never beats in step.
- Reduced motion holds frame 0; travel still happens.
- A stationary whale holds one fixed heading (`stationaryHeading`): 4 for the
  trapped whale, 6 for the smaller adult and the calf, 7 for the younger calf.
  A moving whale takes the nearest heading to its direction of travel.

## Placement

- Family destination: the calf at world offset `[38, 40]` and the younger calf
  at `[-18, 58]` from the smaller adult (`family` in the data).
- A guided calf: while the `calf` is away from its family, the family draws
  without that member, so a calf never shows twice. The guided calf uses the
  `calf` frames: its heading follows its travel, with the swim loop while it
  moves and the idle loop while it waits. On return it takes its offset again
  and settles to its stationary heading. A calf's state needs no extra art;
  any cue uses the existing UI.
- The debris trapping the whale is ordinary stone rocks from the
  [asteroid set](asteroids.md), with no separate art.
- The nursery beacon and the current-map buoys are Whirlpool's
  [project world changes](whirlpool.md#project-world-changes), not whale art.

## Data

`whales.json`, version 1. Frame values are frame px, display values logical px
and footprints world units.

- `displayScale` (0.4375), `headings` (16) and `files`, the frame path pattern.
- `palette`: the ramps and glow colours above.
- `reducedMotion.frame`: the held frame, 0.
- `family`: each family member's `kind` and world `offset` from the smaller
  adult.
- `kinds[i]`: `kind`, `title`, `length`, `scale` (of the whale's length),
  `spots` (`count`, `pattern`), `loop` (`frames`, `idleMs`, `swimMs`),
  `stationaryHeading` and `headings[k]`:
  - `index`, `frame` (`width`, `height` of the viewBox) and `display` (the
    intrinsic size).
  - `pivot`: `[x, y]` as a fraction of the canvas.
  - `footprintRadius`: world units from the pivot to the farthest point of the
    whale's plan over all 8 frames, for hit and overlap tests.

Manifest entries are `whale-{kind}-{heading}-{frame}` with `kind`,
`directionIndex`, `facing` `world-{heading}`, `loopFrame`, `pivot` and the
display size as both `width`/`height` and `displayWidth`/`displayHeight`.
