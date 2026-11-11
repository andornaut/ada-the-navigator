# Holodisk

- Rebuild with `node art/tools/holodisk.ts`. It writes the item icons and the
  insert inset as UI subset sheets in `public/art/ui/sprites/`, the pickup and
  beacon sheets in `public/art/`, their Aseprite data, and their entries in the
  [UI manifest](../public/art/ui/manifest.json) and the root
  [manifest](../public/art/manifest.json).
- Icons, pickup and beacon are pixel art: every pixel opaque or clear, drawn
  with nearest-neighbour filtering. The inset is painted.

A pearl disc with a magenta hologram band: round where Stardust is a diamond,
magenta where weapon signals are amber, so shape, size and hue all differ.

## Colour

| Role           | Colour                          |
| -------------- | ------------------------------- |
| Pearl rim, hub | `#ffffff`, `#d9dff0`, `#a3aacb` |
| Hologram band  | `#ffb3ec`, `#e868c8`, `#a83a96` |
| Outline, hole  | `#181425`                       |

The rim is lit from the upper left; the 16 px and larger icons add a white
glint on the band.

## Item icon

| Key                | Size     |
| ------------------ | -------- |
| `icon-holodisk`    | 16 by 16 |
| `icon-holodisk-20` | 20 by 20 |
| `icon-holodisk-24` | 24 by 24 |

UI subset sprites with a single `rest` frame: ink outline, pearl rim, magenta
band, pearl hub and a dark spindle hole.

## Pickup

- Root manifest id `holodisk`: a 44 by 11 sheet of 11 by 11 frames, displayed
  at 11 by 11 logical px with the pivot at the centre. `frames` names `rest`
  (0), `turn1` (1), `edge` (2) and `turn2` (3).
- Coin turn (`loop`, and the sheet's `turn` tag): rest 600 ms, then turn1,
  edge and turn2 at 70 ms each; 810 ms in all. The turn narrows the silhouette
  to the pearl edge instead of flashing; turn2 mirrors the band. Each pickup
  starts at a random phase.
- Reduced motion: the rest frame only.

## Beacon

- Root manifest id `holodisk-beacon`: a 38 by 19 sheet of 19 by 19 frames, a
  dotted 1 px ring of 16 dots at radius 8, displayed at 19 by 19 logical px
  with the pivot at the centre. `frames` names `base` (0, `#a83a96`) and
  `bright` (1, `#e868c8`).
- Pulse (`loop`, and the sheet's `pulse` tag): base 600 ms, bright 600 ms; a
  1.2 s cycle stepping one band value. Reduced motion: base, held.
- Show it only while the holodisk's location is known, centred on the
  holodisk's waypoint under the pickup, at any range until the holodisk is
  recovered. A holodisk whose location is unknown shows no beacon.
- It is always paired with a direction indicator: the existing discovery
  indicator arrow, drawn in `#e868c8` for the holodisk waypoint.

## Insert inset

The cockpit background is too far out to show a slot, so inserting a holodisk
plays as a close-up inset over it. The drive is a slot-loading car-stereo unit
in the centre stack: a chrome face, a dark slot, a four-digit amber LED counter,
three chunky keys and a magenta status LED.

UI subset sprite `holodisk-insert`: a 1056 by 132 sheet of four 264 by 132
opaque frames, shown at 264 by 132 logical px. Its `insert` tag plays once:

| Frame | Shows                                                   | Duration |
| ----- | ------------------------------------------------------- | -------- |
| 0     | Hold: Ada offers the disk to the slot                   | 400 ms   |
| 1     | Push: half in, the far half hidden                      | 250 ms   |
| 2     | Read: LEDs amber, a magenta link up to Astra, Astra lit | 400 ms   |
| 3     | Restored: a ring of magenta dots round Astra's porthole | 600 ms   |

1650 ms in all, then Astra's line.

- Card: the panel inside a 6 px `#3b3850` band with a 2 px `#181425` outer
  edge (280 by 148 overall), and a 1 px `#ead4aa` keyline just outside the
  panel. The card's outer edge sits `SPACING.pageInset` from the safe rect's
  top and right edges, over the nose beside the canopy.
- It pops in with no transition and cross-fades out over 200 ms when Astra
  starts speaking. Narration in the story panel accompanies it.
- Reduced motion: frame 0, then a 300 ms cross-fade to frame 3, with no
  moving link.

The frames are the 300 by 150 design px crop at (300, 168) of the storybook
dash ([dash.ts](tools/dash.ts)), reduced to 264 by 132 with Lanczos filtering.
Ada and Penny in the seats are Archie's idle sprites at 3x by nearest
neighbour, from `andornaut/archies-dog-walks` commit
`46251d3f9b661b5508bbb6ba1d27baa4c1ba62bc` (CC BY-NC-SA 4.0, as the
[portraits](portraits.md)):

| Source frame in `art/sources/`  | Archie sheet, frame                     | Sheet SHA-256                                                      |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `walker-ada-idle.png`, 48 by 72 | `public/art/sprites/walker-ada.png`, 14 | `fa50740f63f7df102eab0a8b844bc41ae631a9e4c473ac95941d72e4f449fbb8` |
| `dog-penny-idle.png`, 54 by 54  | `public/art/sprites/dog-penny.png`, 20  | `0f59aef0664900ac8bd70df1c9520e91f6df6d83797b7c6646a7f2b1f526c002` |
