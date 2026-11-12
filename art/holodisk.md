# Holodisk

- Rebuild with `node art/tools/holodisk.ts`. It writes the item icons as UI
  subset sheets in `public/art/ui/sprites/`, the pickup and beacon sheets in
  `public/art/`, their Aseprite data, and their entries in the
  [UI manifest](../public/art/ui/manifest.json) and the root
  [manifest](../public/art/manifest.json).
- Icons, pickup and beacon are pixel art: every pixel opaque or clear, drawn
  with nearest-neighbour filtering.

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

## Inserting

Inserting a holodisk plays on the ship from outside: a magenta pulse at Astra's
drive on the hull, a ring of magenta dots and Astra's light in the canopy. See
the [holodisk moment](aboard.md#holodisk-moment).
