# Black Eye

Black Eye's art: a smoke-and-violet field and the three Blurb settlements.
Blurbs are goo folk, so their settlements are lilac goo domes on set-goo
floats. Gadget's home guard is the shared [coral family](enemies.md) and his
flagship the [Gadget capital](heavies.md#gadget), both in core.

- Rebuild with `node art/tools/black-eye.ts`. It writes
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
(`frame * 0.4375`) and its `viewBox` the frame in frame px. Manifest `width`
and `height` are the frame and `displayWidth` and `displayHeight` the display
size. `facing` is `fixed`.

| Variant   | Frame px | Display  | Pivot          | Dock `(x, y)`  | Dock width |
| --------- | -------- | -------- | -------------- | -------------- | ---------: |
| `homes`   | 96, 96   | 42 by 42 | `(0.5, 0.375)` | `(48, 61.456)` |     22.045 |
| `harbour` | 112, 80  | 49 by 35 | `(0.5, 0.4)`   | `(56, 57.456)` |     22.045 |
| `signal`  | 80, 112  | 35 by 49 | `(0.5, 0.5)`   | `(40, 81.456)` |     22.045 |

Pivots lie on the world plane at the float's centre. The dock entrance is the
mouth's centre on the world plane, 36 units along the dock axis and 25.456
frame px below the pivot; `dock.outward` is `[0, 1]`. Dock values are frame
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
