# Black Eye

Black Eye's art: a smoke-and-violet field, Black Eye's own station and the
three Blurb settlements.
Blurbs are goo folk, so their settlements are lilac goo domes on set-goo
floats. Gadget's home guard is the shared [coral family](enemies.md) and his
flagship the [Gadget capital](heavies.md#gadget), both in core.

- Rebuild the settlements with `node art/tools/black-eye.ts` and the station
  with `node art/tools/black-eye-station.ts`. Each writes its files to
  `public/art/black-eye/` and replaces its own entries in place in
  [Black Eye's manifest](../public/art/black-eye/manifest.json).
- [art/tools/black-eye-models.ts](tools/black-eye-models.ts) holds the solid
  models in the [station](station.md) projection, culling and family: the
  dock collar, mouth, lit floor strip, blue corner lights and approach lights,
  and warm lit windows `#ffe9b8`.
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  asset.

## Field

Smoke violet, tint `lightness` -0.05, `chroma` 0.034, `hue` 320
([Galaxies](galaxies.md#field-hues)): background `#241827`, environment
`#302333`, detail `#3C2E3F` and marker `#DCBAE3`. Every signal stays above
5:1 on the background, lowest `obstacle` at 6.31:1, and the ship's darkest
hull tone `#9AABBF` is 7.25:1. Backdrop rocks tint to `#49344E` lit and
`#3A2A3E` side. Its [backdrop](galaxies.md#backdrop-layers) is smoke:
plates toned by drifting bands, one dim crescent and violet smoke-bank
nebulae (`nebula-black-eye-1`, `-2`).

## Station

Black Eye's own station, the Bobbin, in place of the shared
[trading station](station.md) at every Black Eye station. Ada enters it by
Use, the Dock action; it has no dock, mouth or approach lights.

- A long habitat cylinder of lilac goo, 112 units long and 40 across, wound
  with a helical band of set goo, two turns round, and a line of warm windows.
  The whole hull turns under its winding.
- Forward: a blunt stepped command section with a band of lit windows, and a
  lamp stalk ending in a round lamp. Aft: a goo dome with a set-goo rim, as the
  Blurbs build their homes, then a short truss with two flat solar wings across
  the axis, three cells of set goo each in lilac goo frames.
- Built as a lathe and block mesh in the [station](station.md) projection,
  each face shaded from the world light into its ramp, as the
  [debris](whirlpool.md#river-debris) is. Fixed orientation: no headings and
  no screen rotation. 4.8 Ada wingspans from the solar wings to the lamp.

### Rotation and manifest

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Ids           | `black-eye-station-{k}`, `k` 0 to 7, files `/art/black-eye/station-{k}.svg`                |
| Frame         | 288 by 112 frame px; display 189 by 73.5 at the [destination scale](destinations.md#scale) |
| Pivot         | `(0.5, 0.8125)`: the world plane under the hull's middle                                   |
| `facing`      | `fixed`                                                                                    |
| `frameMs`     | 150                                                                                        |
| `destination` | `station`; `rotationIndex` `k`                                                             |

- Rotation: show frame `k` for 150 ms, 0 to 7 in order, and loop (1.2 s).
  Each frame turns the band and the window line one facet of the hull's 16, so
  the loop is seamless. The lamp is lit in frames 0 to 3 and dim in 4 to 7.
- Reduced motion holds frame 0.
- Every frame shares one frame size and pivot, so the station turns in place.
  Silhouette radius 90.2 and top 52.5 above the pivot over all eight frames, at
  1.5x; the Dock callout's centre sits 72.5 above the pivot
  ([Destinations](destinations.md#collision-silhouette-dock-and-clearance)).
  Pass-through, with no `collision`, as every destination.

### Palette

| Role           | Colour    | On the field |
| -------------- | --------- | -----------: |
| Gloss          | `#f4eafc` |      14.59:1 |
| Goo            | `#d4b8ee` |       9.63:1 |
| Goo mid        | `#bba0d8` |       7.40:1 |
| Goo side       | `#a283c2` |       5.31:1 |
| Set goo, lit   | `#a58bc3` |       5.73:1 |
| Set goo        | `#9c82ba` |       5.11:1 |
| Set goo shadow | `#8a6fa8` |       3.98:1 |
| Set goo deep   | `#715a94` |       2.91:1 |
| Windows, lamp  | `#ffe9b8` |      14.25:1 |
| Lamp dim       | `#8a7a5c` |       4.06:1 |

The goo and set goo stay in the field's own hue, lighter, as the settlements'
do, and take no signal band. The silhouette's edge median is 3.49:1, with 63%
of edge pixels at 3:1 or more.

## Settlements

The settlements are Black Eye's outposts, story destinations placed like
Sunflower's, one design per settlement in story order. Ada uses one without
docking, so their docks are decorative. Entries use the
[outpost schema](outposts.md#frames-and-manifest) with `outpost`
`settlement`, `variant` naming the design and `state` the dock.

| Variant   | Settlement      | Design                                                                                                   |
| --------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `homes`   | First           | Five goo domes of mixed sizes with round warm windows on a round float 62 units across, and a lamp stalk |
| `harbour` | Second          | A long float 80 by 48 units with a three-dome hall and a cream berth with a lamp pylon at each end       |
| `signal`  | Third, Dollop's | A tall wobbly goo spire of six leaning tiers under a signal lamp with a white core, and two small domes  |

### Dock states

Each settlement has two states. `cracked`: the dock as the blockades left it,
until the chapter is complete. `mended`: the dock the Blurbs and General
Gadget repaired, after it. Tech draws the state for the chapter; both states
blink.

- Cracked: the collar's top corner on the screen-right side of the mouth is
  broken off 2.8 units down, a stepped dark crack (`#1e1a26`) runs from the
  break across the band above the mouth, the lit floor strip is split, and
  the corner light beside the break is out (`#3f5878` in both frames).
- Mended: the collar whole, every light working, and the crack filled with
  goo `#d4b8ee`, a lilac seam where the break was.

### Frames and manifest

Ids are `outpost-{variant}-{state}-{a|b}`, files
`public/art/black-eye/{variant}-{state}-{a|b}.svg`. A design's four sprites
share one frame and pivot, so a state change or a blink swaps the sprite in
place. Frames are multiples of 16 px with the pivot on the vertical centre
line at an exact fraction; each SVG's intrinsic size is its display size
(`frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale)) and
its `viewBox` the frame in frame px; frame-px pivots and docks are unchanged. Manifest `width`
and `height` are the frame and `displayWidth` and `displayHeight` the display
size. `facing` is `fixed`.

| Variant   | Frame px | Display      | Pivot          | Dock `(x, y)`  | Dock width |
| --------- | -------- | ------------ | -------------- | -------------- | ---------: |
| `homes`   | 96, 96   | 63 by 63     | `(0.5, 0.375)` | `(48, 61.456)` |     22.045 |
| `harbour` | 112, 80  | 73.5 by 52.5 | `(0.5, 0.4)`   | `(56, 57.456)` |     22.045 |
| `signal`  | 80, 112  | 52.5 by 73.5 | `(0.5, 0.5)`   | `(40, 81.456)` |     22.045 |

Pivots lie on the world plane at the float's centre. The dock entrance is the
mouth's centre on the world plane, 36 units along the dock axis and 25.456
frame px (16.706 display px at 1.5x) below the pivot; `dock.outward` is `[0, 1]`. Dock values are frame
px in the station's dock schema.

### Blink

- `frameMs` 700: frames A and B alternate, 700 ms each.
- A lights the dock corner lights and each settlement's own lamps: the homes'
  lamp stalk, the harbour's two pylons and the signal lamp, whose white core
  shows in A only. B lights the approach-light pairs and dims the lamps to
  `#8a7a5c`. Unlit blue lights use `#3f5878`.
- Reduced motion shows frame A only.

### Palette

| Role           | Colour    | On the field |
| -------------- | --------- | -----------: |
| Goo            | `#d4b8ee` |       9.63:1 |
| Goo side       | `#a283c2` |       5.31:1 |
| Gloss          | `#f4eafc` |      14.59:1 |
| Float          | `#8a6fa8` |       3.98:1 |
| Float side     | `#614b7e` |       2.28:1 |
| Float inset    | `#9c82ba` |       5.11:1 |
| Windows, lamps | `#ffe9b8` |      14.25:1 |
| Lamp dim       | `#8a7a5c` |       4.06:1 |

Lilac goo sits in the field's own hue, lighter, so the Blurbs read as folk of
the violet rim and take no signal band; the station family's cream collar,
blue lights and warm windows carry the settlement read.

## Portraits

Rebuild with `node art/tools/black-eye-portraits.ts`. It writes `dollop` and
`blurb-settler` sheets (`{key}.png` and `{key}-compact.png`, ids
`{key}-portrait` and `{key}-portrait-compact`, frame `neutral` 0) to
`public/art/black-eye/portraits/` in the
[conversation portrait](conversation.md) format, last in Black Eye's
manifest. Both are Blurbs drawn from the bust parts in `art/tools/bust.ts`: a
jelly blob over three drips that run off the frame's bottom edge, a glossy
highlight and three bubbles.

| Speaker | Key             | Crop   | Look                                                                                                                    |
| ------- | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Dollop  | `dollop`        | (5, 2) | Orchid `#e48fd4` (shade `#b05aa6`, light `#ffd6f4`), a cream-dollop curl, blush                                         |
| Settler | `blurb-settler` | (5, 3) | Every settlement greeter but Dollop: violet-blue `#a896ec`, no peak, a floating bubble, an amber scarf with a red patch |

General Gadget, Black Eye's keeper once the chapter is complete, uses his named
portrait ([Conversation portraits](conversation.md)).
