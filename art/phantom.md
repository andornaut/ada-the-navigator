# Phantom

Phantom's art: a smoke-and-violet field, Phantom's own station and the
three Blurb settlements. Each uses folded or faceted organic material in a
distinct colour family. Gadget's home guard is the shared [coral family](enemies.md) and his
flagship the [Gadget capital](heavies.md#gadget), both in core.

- Rebuild the settlements with `node art/tools/phantom.ts` and the station
  with `node art/tools/phantom-station.ts`. Each writes its files to
  `public/art/phantom/` and replaces its own entries in place in
  [Phantom's manifest](../public/art/phantom/manifest.json).
- [art/tools/phantom-models.ts](tools/phantom-models.ts) holds the solid
  settlement models in the [station](station.md) projection, with sealed
  membranes and local windows.
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  asset.

## Field

Dark plum, tint `lightness` 0.137, `chroma` 0.022, `hue` -45.4
([Galaxies](galaxies.md#field-hues)): background `#514955`, environment
`#625868`, detail `#75677B` and marker `#DCBAE3` (5.00:1). It is a dark field
with the white `foregroundEdge` `#FFFFFF`, 8.63:1 on the background, as its
recognition boundary: the [light-field keyline](galaxies.md#light-fields)
widths and kinds in white, 2 px round the station, settlements and story
places and 1 px round the other keylined objects. Every signal is 3:1 or more
on the background, lowest `threat` at 3.11:1 and `obstacle` at 3.20:1, and the
ship's darkest hull tone `#9AABBF` is 3.68:1. Backdrop rocks tint to `#7A6D81`
lit (1.78:1) and `#625767` side. Its [backdrop](galaxies.md#backdrop-layers) is smoke:
plates toned by drifting bands, one dim crescent and violet smoke-bank
nebulae (`nebula-phantom-1`, `-2`).

## Station

The station has a broad teal mantle, swept lateral fins and three
magenta-banded limbs. Magenta inlays pulse inside the mantle. Ada enters by Use.

### Frames and manifest

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Ids           | `phantom-station-{k}`, `k` 0 to 7, files `/art/phantom/station-{k}.svg`                    |
| Frame         | 288 by 112 frame px; display 189 by 73.5 at the [destination scale](destinations.md#scale) |
| Pivot         | `(0.5, 0.8125)`: the world plane under the hull's middle                                   |
| `facing`      | `fixed`                                                                                    |
| `frameMs`     | 150                                                                                        |
| `destination` | `station`; `frameIndex` `k`                                                                |

- The eight inlay phases advance every 150 ms. Reduced motion holds frame 0.
- Over the eight frames the silhouette radius is 98.4 display px and the top is
  52.1 px above the pivot. The station stays pass-through.

## Settlements

The Blurb settlements are story destinations entered by Use. In the outpost
schema, `variant` names the settlement and `state` identifies its damaged or
repaired membrane.

| Variant   | Settlement      | Design                                                |
| --------- | --------------- | ----------------------------------------------------- |
| `homes`   | First           | Cluster of rose, lilac and ice-blue habitation lobes  |
| `harbour` | Second          | Teal central body with wide, swept protective vanes   |
| `signal`  | Third, Dollop's | Pink base with a curved blue-violet transmitter stalk |

Both states blink. The cracked state has a dark break and dim light near its
base. The mended state replaces that break with a bright membrane.

### Frames and manifest

Ids are `outpost-{variant}-{state}-{a|b}`, files
`public/art/phantom/{variant}-{state}-{a|b}.svg`. A design's four sprites
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

| Role           | Colour    | On the field | White edge |
| -------------- | --------- | -----------: | ---------: |
| Goo            | `#d4b8ee` |       4.88:1 |     8.63:1 |
| Goo side       | `#a283c2` |       2.70:1 |     8.63:1 |
| Gloss          | `#f4eafc` |       7.40:1 |     8.63:1 |
| Float          | `#8a6fa8` |       2.02:1 |     8.63:1 |
| Float side     | `#614b7e` |       1.16:1 |     8.63:1 |
| Float inset    | `#9c82ba` |       2.59:1 |     8.63:1 |
| Windows, lamps | `#ffe9b8` |       7.23:1 |     8.63:1 |
| Lamp dim       | `#8a7a5c` |       2.06:1 |     8.63:1 |

Lilac goo sits in the field's own hue, lighter, so the Blurbs read as folk of
the violet rim and take no signal band; the station family's cream collar,
blue lights and warm windows carry the settlement read.

## Stranded craft

One craft for Phantom's rescue tows: travelers stranded by the blockades. Rebuild with `node art/tools/stranded-craft.ts`. Each craft follows
Cartwheel's [stranded craft](cartwheel-props.md#stranded-craft) schema: the
sixteen enemy headings, the smallest square frame (a multiple of 16 px) with
4 px padding round a centred pivot, no jets and no collision parts. Files are
`/art/phantom/{craft}-{k}[-{a,b}].svg`;
[phantom/tow.json](../public/art/phantom/tow.json), linked from
[Phantom's manifest](../public/art/phantom/manifest.json) as `tow`, gives each craft's
`frame`, `display`, `blink` and `frameMs`, and `headings[k].tow`, the tow point
in frame px.

| Craft                   | Job subject      | Manifest ids                            | Frame | Display | Frames per heading       | Hull top on field | White edge |
| ----------------------- | ---------------- | --------------------------------------- | ----: | ------: | ------------------------ | ----------------: | ---------: |
| `stranded-traveler-pod` | a traveler's pod | `craft-stranded-traveler-pod-{k}-{a,b}` |    80 |      35 | `a` lit, `b` dim, 700 ms |  `#ddd0e2` 5.83:1 |     8.63:1 |

- Traveler's pod: a pale mauve capsule with a mauve band `#a77fb2`, dim warm
  portholes, two tan luggage bundles strapped on its back and a pale lilac
  distress lamp `#dcbae3` that blinks while it waits (dim `#6c5d78`); a tow lug
  forward. Reduced motion shows `a`.

## Portraits

Rebuild with `node art/tools/phantom-portraits.ts`. It writes `dollop` and
`blurb-settler` sheets (`{key}.png` and `{key}-compact.png`, ids
`{key}-portrait` and `{key}-portrait-compact`, frame `neutral` 0) to
`public/art/phantom/portraits/` in the
[conversation portrait](conversation.md) format, last in Phantom's
manifest. Both are Blurbs drawn from the bust parts in `art/tools/bust.ts`: a
jelly blob over three drips that run off the frame's bottom edge, a glossy
highlight and three bubbles.

| Speaker | Key             | Crop   | Look                                                                                                                    |
| ------- | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Dollop  | `dollop`        | (5, 2) | Orchid `#e48fd4` (shade `#b05aa6`, light `#ffd6f4`), a cream-dollop curl, blush                                         |
| Settler | `blurb-settler` | (5, 3) | Every settlement greeter but Dollop: violet-blue `#a896ec`, no peak, a floating bubble, an amber scarf with a red patch |

General Gadget, Phantom's keeper once the chapter is complete, uses his named
portrait ([Conversation portraits](conversation.md)).
