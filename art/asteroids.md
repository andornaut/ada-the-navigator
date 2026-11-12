# Asteroids

Asteroids are play objects: faceted low-poly rocks in the shared solid-model
projection, in one neutral stone ramp in every galaxy. Backdrop rocks are field
scenery: greyscale sprites tinted per galaxy at runtime.

- Rebuild with `node art/tools/asteroids.ts`. It writes one SVG per frame to
  `public/art/asteroids/`, writes [asteroids.json](../public/art/asteroids.json)
  (formatted with the project's Prettier settings) and links it from the root
  manifest as `asteroids`. It also writes the [resource rocks](#resource-rocks)
  and [resource-rocks.json](../public/art/resource-rocks.json), linked as
  `resourceRocks`. Reruns are byte-identical.
- The models are seeded, so a shape changes only when its seed, aspect, width or
  class rules change in the generator.
- The build reads the field colours from
  [space-palette.json](../public/art/space-palette.json) and
  [galaxies.json](../public/art/galaxies.json), and fails if `backdropLit` or
  `backdropSide` reaches 1.8:1 on its galaxy background.

## Classes

Each rock's scale puts its footprint radius inside its class's world range, and
keeps each class's footprint radius order. Silhouette widths are display px of
frame 0, the width the generator scales each rock to (Ada is 42 px wide). Spin
and drift rates are ranges; Tech picks one value per rock from the level seed.

| Size     | Shapes | Footprint range | Footprint radii | Silhouette width | Frames | Spin       | Drift         |  HP | Stardust |
| -------- | -----: | --------------- | --------------- | ---------------- | -----: | ---------- | ------------- | --: | -------: |
| `small`  |      4 | 12 to 18        | 13 to 17.2      | 26.71 to 50      |     24 | 8 to 18°/s | 14 to 32 px/s |   3 |      0–1 |
| `medium` |      4 | 24 to 34        | 31.43 to 33.8   | 57.12 to 84      |     24 | 4 to 10°/s | 8 to 20 px/s  |   5 |        1 |
| `large`  |      3 | 52 to 70        | 58.28 to 61.37  | 135.34 to 167.19 |      1 | none       | none          |  10 |        2 |
| `huge`   |      3 | 84 to 104       | 97.25 to 102    | 233.29 to 260    |      1 | none       | none          |  16 |        3 |

- Each model is a seeded star-shaped plan with one or two concave bays, built up
  through a tapered base, a full girth, an inset shoulder and a crown of one to
  three ridge peaks. Every face is a triangle with one flat tone.
- Spin frame `k` shows the rock turned `15k` degrees about its vertical axis
  under a fixed world light, so facets change tone as it turns. Show frame
  `floor(angle / 15) mod 24`; play frames ascending or descending for the two
  spin directions.
- Only small and medium rocks drift; large and huge rocks have
  `eligible: false` and a `[0, 0]` speed.
- HP and Stardust are Gameplay values ([economy](../gameplay/economy.md)), listed
  here for reference.

### Per rock

All three widths are display px. The silhouette widths are the drawn rock's
horizontal extent, in frame 0 and in its widest spin frame. The frame width is
the SVG canvas: one size for every spin frame, centred on the pivot and wide
enough for every rotation plus a 2 frame px margin, so an elongated rock's frame
is about twice its frame 0 silhouette. The footprint radius is in world units
([Footprint](#footprint)).

| Rock          | Frame 0 silhouette | Widest silhouette | Frame width by height | Footprint radius |
| ------------- | -----------------: | ----------------: | --------------------: | ---------------: |
| `asteroid-s1` |               40.4 |              43.2 |        48.13 by 29.31 |            13.94 |
| `asteroid-s2` |               27.1 |              52.4 |        56.88 by 35.44 |             17.2 |
| `asteroid-s3` |               40.2 |              42.1 |        46.38 by 30.19 |               13 |
| `asteroid-s4` |               50.4 |              51.4 |        55.13 by 36.31 |            16.43 |
| `asteroid-m1` |               84.3 |              93.1 |       103.25 by 63.44 |            31.43 |
| `asteroid-m2` |               77.3 |             104.8 |       106.75 by 66.94 |             32.2 |
| `asteroid-m3` |               79.4 |              98.2 |        111.13 by 73.5 |               33 |
| `asteroid-m4` |               57.5 |             108.0 |       114.63 by 69.56 |             33.8 |
| `asteroid-l1` |              135.7 |             135.7 |         154 by 111.56 |            58.28 |
| `asteroid-l2` |              151.5 |             151.5 |       158.38 by 93.19 |            61.01 |
| `asteroid-l3` |              167.7 |             167.7 |      179.38 by 112.44 |            61.37 |
| `asteroid-h1` |              260.4 |             260.4 |      296.63 by 165.81 |            97.25 |
| `asteroid-h2` |              233.6 |             233.6 |      250.25 by 193.38 |             99.5 |
| `asteroid-h3` |              258.8 |             258.8 |      278.25 by 165.81 |              102 |

## Palette

Play stone, lit to shadow: Oklab L 0.61, 0.545, 0.48, 0.42 and 0.365 at chroma
0.016, hue 70 (`stone` in the data). A facet takes a tone by the dot product of
its normal with the world light: at least 0.9, 0.78, 0.6 and 0.3 for tones 0
to 3, and tone 4 below that. Neutral stone never reads as the coral
`obstacle` signal or as tinted field.

Contrast on each background (WCAG):

| Field       | `#8A8279` | `#766F66` | `#645C54` | `#534C44` | `#443D35` |    `backdropLit` |   `backdropSide` |
| ----------- | --------: | --------: | --------: | --------: | --------: | ---------------: | ---------------: |
| base        |    3.87:1 |    2.95:1 |    2.23:1 |    1.73:1 |    1.37:1 | `#49475D` 1.63:1 | `#3A394A` 1.30:1 |
| `sunflower` |    2.29:1 |    3.00:1 |    3.97:1 |    5.11:1 |    6.47:1 | `#C9BB86` 1.16:1 | `#A1966B` 1.79:1 |
| `cartwheel` |    3.90:1 |    2.98:1 |    2.25:1 |    1.75:1 |    1.38:1 | `#643F39` 1.63:1 | `#50322E` 1.29:1 |
| `whirlpool` |    3.83:1 |    2.92:1 |    2.21:1 |    1.71:1 |    1.35:1 | `#26515C` 1.66:1 | `#1E414A` 1.32:1 |
| `black-eye` |    4.58:1 |    3.50:1 |    2.64:1 |    2.05:1 |    1.62:1 | `#4F2F48` 1.51:1 | `#3F263A` 1.28:1 |

On the dark fields lit stone stays at 3.8:1 or more; on Sunflower's light
field the shadow tones carry the contrast and the
[light-field](galaxies.md#light-fields) ink keyline (10.90:1) outlines every
play rock. Backdrop rocks stay below 1.8:1, so play rocks always stand in front
of the field. Signals are unchanged.

## Backdrop

Backdrop rocks (`backdrop.sprites`) are four greyscale SVGs, white tops and grey
sides, drawn under every play object with no collision. Tech multiplies them by
the current galaxy's `backdropLit` (Phaser `setTint`), so the tops take
`backdropLit` and the sides `backdropSide` exactly. The mock-ups draw them at
0.6 to 1 times their display size, and colour the field's dust specks with
`backdropSide`.

Rocks and specks are the debris layer of the [backdrop layers](backdrop.md),
at their own depth behind the play plane:

- Backdrop rocks move at parallax 0.8 (`debris.rocks` in
  [backdrop.json](../public/art/backdrop.json)) and the dust specks at 0.7
  (`debris.specks`). Each keeps its world rule (cells, density, scale, seed),
  placed at the parallax times the camera's world position and projected as
  the scene projects, so its layout stays isometric. The specks' positions
  are in layer coordinates, not world coordinates.
- Backdrop rocks keep no ore-field clearance: at parallax 0.8 they slide past
  an ore field, under its crystals, so a world-space clearance would not hold.
- A placeholder galaxy's rocks and specks take the base field's tints.

Density: one backdrop rock in 35% of the 320 by 320 world-unit cells.

`tints` holds the computed colours for the base field and each galaxy id, from
one rule (`backdrop.rule`):

- `backdropLit` on a dark field: Oklab L of the field's `environmentDetail`
  plus 0.035 (`lift`), at the galaxy tint hue with 1.5 times the galaxy tint
  chroma (`chromaScale`). The base field uses the hue and chroma of its own
  `environmentDetail`.
- `backdropLit` on a light field (`tint.light`): Oklab L of the background
  minus 0.045 (`lightDrop`), at the tint chroma and hue. The tops sit just
  under the background and the sides are the darker tone, as Chibi's farm
  layers step darker.
- `backdropSide`: `backdropLit` times 0.8 per sRGB channel (`sideScale`).
- Both tones stay below 1.8:1 on their background; on a light field the side
  is the higher one (Sunflower 1.79:1).

## Placement and draw order

Gameplay rules, recorded here for the art's use and implemented by Gameplay and
Tech:

- Every asteroid can be destroyed; HP and Stardust follow [Classes](#classes).
- Drifting rocks follow seeded closed loops that never overlap other rocks, so
  rocks never bounce off each other.
- Every hit, bounce, pickup, dock and tow contact uses drawn silhouettes, and
  placement keeps drawn objects from overlapping on screen.
- Shots hit, and ships (Ada's and enemies') bounce off, a rock's current
  frame's drawn silhouette (`collision`). Rocks deal no damage.
- A rock's `silhouetteRadius` is the greatest distance from its pivot to a
  `collision` vertex over all its frames, in display px. Tech derives it at
  load from the parts; the data stores no radius for it.
- Large and huge rocks keep their `silhouetteRadius` plus 160 clear of
  stations, destinations and launch points, and stay out of passages. Any
  clearance written as radius plus margin uses `silhouetteRadius`;
  centre-to-centre spacings are unchanged.
- Draw play objects in ascending pivot screen y, except that Ada's ship draws
  in front of every pass-through object it overlaps: stations and docks,
  outposts and destinations, story ships and buoys, towed craft, whales and the
  calf, wrecks, the holodisk and landmarks. Those carry no `collision`; solid
  objects (rocks, debris, enemies and heavies) contact where drawn.

## Drift cue

A drifting rock trails four square stone chips behind it, in `#766F66` (stone
1), so it reads as moving but harmless rather than as coral debris. In logical
px from the silhouette centre (the centre of the current frame's drawn
`collision` bounds) along the reverse drift direction:

- Chip `i` (0 to 3) sits `e + 4 + 6.5 i` behind, where `e` is the distance to the
  edge of the ellipse with the drawn bounds' half extents, offset sideways by a
  seeded value within ±1.5.
- Sizes 2, 2, 1 and 1 px; alpha 0.9, 0.7, 0.5 and 0.35.
- The chips move with the rock and keep their offsets; still rocks have none.

## Reduced motion

Spinning rocks show frame 0 and never change frame. Drift is gameplay, so
drifting rocks still move, with their chips drawn as a static direction mark.

## Destruction

[Enemy destruction](destruction.md) defines its shards, flash and timings per
enemy archetype from the craft models, and cools coral toward `#7f4b3d`; it has
no asteroid entry. Until a stone break is authored, a destroyed rock at every
motion setting uses the generic reduced-motion form at the fighter's reduced
timing:

- Over 360 ms the frame shrinks about the pivot to 80%, darkens by a multiply
  tint from `#ffffff` to `#c1b9b8` and fades out, all linearly.
- At 240 ms its Stardust appears at the pivot already spread over
  `7.68 * U(0.6, 1)` world units, on its rest frame, with no burst or glint.
- No flash and no shards.

## Data

`asteroids.json`, version 1. Drawn values (`frame`, `pivot`,
`collision`) are frame px in the art's own projection; multiply by
`displayScale` (0.4375) for display px. Footprints are world units.

- `stone`: the play stone ramp, lit to shadow.
- `asteroids[i]`:
  - `id` and `size` (`small`, `medium`, `large` or `huge`).
  - `frame` (frame px) and `display` (display px, `frame * displayScale`): the
    canvas, shared by every spin frame.
  - `pivot`: `[x, y]` as a fraction of the frame. It is the centre of the
    rock's base on the world plane: place it at the world position and sort by
    it.
  - `footprintRadius`: world units from the pivot to the farthest footprint
    point over all frames.
  - `drift`: `eligible` and `speed`, a `[min, max]` range in logical px per
    second; `[0, 0]` when not eligible.
  - `spin`: `{ "degPerSecond": [min, max] }`, or `false` for one still frame.
  - `frames[k]`:
    - `file`: public path of the frame's SVG.
    - `collision`: the drawn silhouette as convex `[x, y]` parts in frame px.
      Use it for shot hits, ship contact, drawing bounds and the drift cue.
    - `footprint`: the rock's base on the world plane as convex `[x, y]`
      parts in world units from the pivot. Play does not use it: contact and
      placement use `collision`.
- `backdrop`: `sideScale`, `rule` (`lift`, `chromaScale`, `lightDrop`) and `sprites`, each
  with `id`, `file`, `frame`, `display`, `pivot` and `tint` (`backdropLit`).
- `tints`: `backdropLit` and `backdropSide` for `base` and each galaxy id.

Sample (one small rock, first frame only):

```json
{
  "id": "asteroid-s3",
  "size": "small",
  "frame": {
    "width": 106,
    "height": 69
  },
  "display": {
    "width": 46.38,
    "height": 30.19
  },
  "pivot": [0.5, 0.66667],
  "footprintRadius": 13,
  "drift": {
    "eligible": true,
    "speed": [14, 32]
  },
  "spin": {
    "degPerSecond": [8, 18]
  },
  "frames": [
    {
      "file": "/art/asteroids/asteroid-s3-0.svg",
      "collision": [
        [
          [57.25, 5.5],
          [96.75, 26.5],
          [94, 46.5],
          [68.5, 63.75],
          [49.5, 61.75],
          [28.75, 57],
          [19.25, 49.5],
          [4.75, 27],
          [5, 25.75],
          [40, 11.5]
        ],
        [
          [5, 25.75],
          [18.25, 16],
          [40, 11.5]
        ]
      ],
      "footprint": [
        [
          [6.03, 7.28],
          [-0.66, 9.8],
          [-10.54, 4.46],
          [-9.71, -3.83],
          [-6.35, -8.38],
          [4.62, -10.48],
          [10.03, -2.54],
          [10.85, 4.28]
        ]
      ]
    }
  ]
}
```

## Footprint

The footprint is the ring the rock stands on (the model's base ring at height
0), from the same posed model as the frame's drawing, so it turns with the
drawing: every spin frame has its own. It is not rotation-invariant, because the
art's projection and the game's differ in aspect.

World units are the game's world plane, which the game projects to display px
from the pivot as `(x - y, (x + y) / 2)`. The generator projects each base
point the art's way, `displayScale * ((x - y) sqrt(3) / 2, (x + y) / 2)` in
model units, and inverts the game's projection, so the footprint drawn the
game's way lands on the drawn base. It splits the ring into convex parts by
ear clipping and Hertel-Mehlhorn merging, rounds to 0.01 and fails if a part is
not strictly convex. Parts per frame: 1 to 3 for small, 2 to 4 for medium, 3 to
5 for large and 4 to 6 for huge.

The drawn silhouette also covers the girth and crown above the base: its radius
in display px (`radius * displayScale`) is 1.45 to 1.77 times the footprint
radius in world units.

## Collision

The drawn silhouette (`collision`) of each frame is traced from the drawing
itself by the [shared tracer](ship.md#shared-tracer), `art/tools/silhouette.ts`:

1. Fill the frame's visible projected facets into a grid of 4 cells per frame px
   and grow it by half the 1.2 px seam stroke.
2. Trace the outer boundary along cell edges and simplify it by Douglas-Peucker
   at 0.75 frame px.
3. Fill the tip of every notch narrower than 30 degrees, up to the chord where
   it is 0.6 frame px wide: the frame draws the tip triangle under its facets,
   with no seam, in the colour of the topmost facet over the apex, and the
   outline cuts the tip off along the chord. A narrower tip tapers into a
   background hairline that a raster closes at a different depth from the
   drawing.
4. Ear-clip the outline into triangles and merge neighbours while the result
   stays convex (Hertel-Mehlhorn).

Checked against the rendered SVGs at 4 px per frame px: every part is convex,
the parts' union matches the drawn alpha with intersection over union 0.981 or
more (0.991 or more from medium up), and no boundary lies more than 1 frame px
from the drawing in either direction. Parts per frame: 1 to 4 for small, 1 to 6
for medium, 3 to 8 for large and 4 to 8 for huge.

## Resource rocks

Cartwheel's resource rocks are every medium and large shape with a cluster of
ore crystals on its crown: three crystals on a medium rock, five on a
large one. The crystals change the silhouette as well as the colour, so a
resource rock reads apart from plain stone at 1x without relying on hue.

- Each `resource-{shape}` uses its plain `asteroid-{shape}`'s seed, aspect,
  width and scale, so its base ring, `footprint` parts and `footprintRadius`
  are identical frame for frame; the build fails if they differ. Place and
  collide them on the drawn silhouettes exactly as for asteroids.
- Medium rocks spin through the same 24 frames as medium asteroids; large
  rocks have one still frame. Drift data is the class's, as for asteroids.
- The cluster grows from the crown facets nearest the highest one, each
  crystal tilted out along its facet's normal and never leaning down-screen
  past the rock. Seat facets under the cluster take the ore shadow tones. The
  cluster turns with the rock, lit by the same world light.
- Ore ramp (`ore`), lit to shadow: `#EAA070`, `#D68A54`, `#A86A42`,
  `#7A4A30` and `#5C3424`, ore's rim and body tones (`art/tools/ore.ts`), so
  the crystals read as the same ore as the
  [ore nugget](cartwheel-props.md#ore-nugget) a rock releases.
- HP and pieces are Gameplay values (medium 3 HP and 3 pieces, large 5 and 5,
  two medium for every large), listed here for reference.

Resource rock SVGs keep the `viewBox` in frame px and declare their display
size (frame times 0.4375) as `width` and `height`, so they rasterize at the
size they are drawn: load them without the `displayScale` load scale that the
plain asteroid SVGs, which declare frame size, take.

| Rock          | Plain shape   | Size   | Frames | Frame (display px) | Footprint radius | Footprint parts | Collision parts | Drawn radius (display px) |
| ------------- | ------------- | ------ | -----: | ------------------ | ---------------: | --------------: | --------------: | ------------------------: |
| `resource-m1` | `asteroid-m1` | medium |     24 | 103.25 by 79.19    |            31.43 |               2 |         2 to 13 |                      55.2 |
| `resource-m2` | `asteroid-m2` | medium |     24 | 106.75 by 72.19    |             32.2 |               3 |         4 to 14 |                      53.7 |
| `resource-m3` | `asteroid-m3` | medium |     24 | 111.13 by 90.56    |               33 |               4 |         4 to 13 |                      65.2 |
| `resource-m4` | `asteroid-m4` | medium |     24 | 114.63 by 74.38    |             33.8 |               2 |         4 to 11 |                      57.0 |
| `resource-l1` | `asteroid-l1` | large  |      1 | 154 by 120.31      |            58.28 |               5 |              13 |                      84.7 |
| `resource-l2` | `asteroid-l2` | large  |      1 | 158.38 by 94.94    |            61.01 |               4 |              11 |                      90.4 |
| `resource-l3` | `asteroid-l3` | large  |      1 | 179.38 by 112.44   |            61.37 |               3 |               3 |                      96.1 |

Frames are taller than the plain shapes' (the crystals rise above the crown),
so the pivot fraction differs while the pivot itself stays the base centre.

The drawn silhouettes follow [Collision](#collision). Checked against the
rendered SVGs at 4 px per frame px, with enclosed background between crossing
crystals (at most 1.31 frame px²) filled as the traced outline drops it:
intersection over union 0.991 or more, and no boundary more than 1 frame px
from the drawing. Six frames fill a notch tip between crystals: `resource-m1`
frames 1 and 6 and `resource-m3` frames 1, 6, 7 and 14; no plain rock has one.
Contact and placement use the drawn silhouette, as for asteroids.

`resource-rocks.json`, version 1: `displayScale`, `stone`, `ore` and `rocks`.
Each `rocks[i]` has the `asteroids[i]` schema ([Data](#data)), so the asteroid
reader parses it unchanged. It is its own file because the asteroid catalog is
bundled into the app at import, and Cartwheel's rocks need not ship with every
galaxy, and because its SVGs declare display size where the plain asteroid
SVGs declare frame size.
