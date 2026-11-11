# Cartwheel props

Cartwheel's traveling debris, ore nugget cargo piece, the two stranded craft a
tow job brings home, the tow line and the [ore field](#ore-field) layouts. The
resource rocks are in [Asteroids](asteroids.md#resource-rocks). Cartwheel has
no damaging hazards.

- Rebuild with `node art/tools/cartwheel-props.ts`. It writes the SVGs, the
  nugget sheet, [debris.json](../public/art/cartwheel/debris.json) and
  [tow.json](../public/art/cartwheel/tow.json) to `public/art/cartwheel/`
  (JSON through the project's Prettier settings) and replaces its manifest
  entries in place. The nugget entry and the `tow` link are in the core
  manifest, since every galaxy's resource rocks drop cargo and any rescue draws
  the tow line; the debris, the stranded craft and the `cartwheelDebris` link
  are in [Cartwheel's manifest](../public/art/cartwheel/manifest.json). Reruns
  are byte-identical.
- The craft models are in `art/tools/cartwheel-craft.ts`: the miner A hauler,
  powered or not, and the ore pod.
- Every SVG keeps its `viewBox` in frame px and declares its display size
  (frame times 0.4375) as `width` and `height`, so it rasterizes at the size it
  is drawn. Manifest `width` and `height` are frame px; `displayWidth` and
  `displayHeight` are the drawn size. Frame-px values (anchors, bounds, radius)
  scale by 0.4375 to display px.

## Traveling debris

A bent hull plate, torn on one edge and folded along a rib, tumbling about a
tilted axis.

- Manifest `cartwheel-debris-{k}`, `k` 0 to 7, `tumbleIndex` `k`: frame 118 by
  115, display 51.625 by 50.3125, pivot (0.5, 0.50435), the plate's centre of
  rotation. Frame `k` shows the plate turned `45k` degrees; show frame
  `floor(angle / 45) mod 8` and pick a tumble rate in `tumble.degPerSecond`
  (60 to 120) per piece. Reduced motion shows frame 0.
- Body, lit to shadow: `#926F68`, `#83605A`, `#74524C`, `#684742` and
  `#603F3A` (`body`): Cartwheel's `environmentDetail` lightness plus 0.2, 0.15,
  0.1, 0.06 and 0.03, at its tint hue with 1.3 times its chroma. The rib sits
  one tone deeper. Muted field matter, never the neutral stone of harmless
  rocks.
- A 1.5 px coral (`obstacle`, `#D68B72`) contour outside the silhouette (`contour`):
  5.48:1 on Cartwheel's background, and 1.66 to 3.43:1 on the body tones (2.55:1
  on the middle one). Coral means damage.
- `radius`: 56.35 frame px from the pivot to the farthest drawn point over all
  frames, contour included. Each frame's `bounds` is its drawn box in frame px,
  `[minX, minY, maxX, maxY]`. Collision radius and damage are Gameplay values.

### Direction mark

Tech draws three coral dashes trailing each moving piece (`marks`), in logical
px, 2 px wide. Let `e` be the distance from the centre of the current frame's
`bounds` to the edge of the ellipse with the bounds' half extents along the
reverse velocity, as for the [asteroid drift cue](asteroids.md#drift-cue).

| Dash | Length | Alpha | Centre behind `e` | Side (left of travel) |
| ---- | -----: | ----: | ----------------: | --------------------: |
| 0    |      9 |  0.95 |               7.5 |                    -3 |
| 1    |      6 |   0.7 |              14.5 |                     3 |
| 2    |      4 |  0.45 |              21.5 |                     0 |

The dashes lie along the velocity, move with the piece and are drawn under
it. They mirror the stone chips of drifting rocks in shape, so the only
difference is the coral that means damage. Reduced motion keeps them, static.

## Ore nugget

The cargo piece a resource rock releases, collected on contact.

- Manifest `ore-nugget`: an 11 by 11 sheet with one `rest` frame, displayed at
  11 by 11 logical px with the pivot at the centre, nearest-neighbour filtered.
  Its Aseprite data is `ore-nugget.json`.
- Pixel art from a character grid; every pixel is opaque or clear.

| Role      | Colour    |
| --------- | --------- |
| Highlight | `#d2f7f2` |
| Light     | `#9ee5dd` |
| Body      | `#65c9bf` |
| Shade     | `#3e9189` |
| Deep      | `#2f6f69` |

The faceted teal nugget matches the rocks' crystals and reads apart from the
mint Stardust gem by hue and shape.

## Stranded craft

Two craft for Cartwheel's rescue and tow jobs. Both are drawn at the sixteen
enemy headings (heading `k` faces world angle `22.5k` degrees) so a towed craft
turns to face the line: show the heading nearest the direction from the craft
to Ada. As for the story craft, the smallest square frame, a multiple of 16 px,
holds every heading with 4 px padding around a centred pivot on the world
plane. Neither has jets. Files are `/art/cartwheel/{craft}-{k}[-{a,b}].svg`.

| Craft              | Manifest ids                       | Frame | Display | Frames per heading       |
| ------------------ | ---------------------------------- | ----: | ------: | ------------------------ |
| `stranded-ore-pod` | `craft-stranded-ore-pod-{k}-{a,b}` |    64 |      28 | `a` lit, `b` dim, 700 ms |
| `stranded-hauler`  | `craft-stranded-hauler-{k}`        |   144 |      63 | one                      |

- Ore pod: a sealed cream cargo capsule with an ore teal band, a steel tow lug
  forward and a mast light that blinks while it waits (`blink`, `frameMs`).
  Reduced motion shows `a`.
- Stuck hauler: the story miner's geometry with its power off: dark cab glass,
  dim running and mast lights, no jets, listing 12 degrees to port and 5
  degrees nose down.
- Each entry has `directionIndex` `k`, `facing` `world-{k}` and `craft`.

## Tow line

Ada attaches with Use (labelled Tow) within 120 world units, and the craft
trails on an 80 world unit line; range, length and handling are Gameplay values,
listed here for reference. The line is a vector Tech draws (`tow.json` `line`,
logical px):

- A steel cable from Ada's pivot to the craft's tow point: an outer stroke
  `#4F5462` 2.5 px wide and a core `#B8BFC9` 1.2 px wide, round caps and
  joins.
- Beads: `#4F5462` discs of radius 0.9, every 12 px along the line starting
  6 px from the craft end.
- Cap at the tow point: a `#4F5462` disc of radius 1.8 with a `#B8BFC9` centre
  of radius 0.8.
- `craft[i].headings[k].tow` is the tow point for heading `k` in frame px of
  that craft's frame (the pod's lug, the hauler's nose).
- Draw the line under both Ada and the craft, so it leaves from under Ada's
  hull.
- Taut (the craft at the full line length), the line is straight. Slack, at
  chord `d` world units under length `L`, it is a quadratic curve whose middle
  sags `sqrt(3 d (L - d) / 8)` world units from the chord (control point twice
  that), on the side away from Ada's sideways velocity, or screen-down when
  she has none. Compute it on the world plane and project each point.

## Ore field

An ore field is a cluster of crystal resource rocks and nothing else: no ore
dust or other field marks, so the teal crystals alone set it apart from plain
rock clusters, and no field speck can read as a nugget or Stardust.

- Rebuild with `node art/tools/ore-field.ts` after `node art/tools/asteroids.ts`.
  It reads the footprints from
  [resource-rocks.json](../public/art/resource-rocks.json), writes
  [ore-field.json](../public/art/cartwheel/ore-field.json) and links it from
  Cartwheel's manifest as `oreField`. Reruns are byte-identical.
- One layout per rock count from 6 to 10, each from the first seed from 23 up
  that draws that count (Python's `random.Random` sequence, `art/tools/random.ts`).
  Seed 23, 8 rocks, is the approved field.
- Large rocks: `round(count / 3)`, so two of every three are medium. Each rock
  is a seeded pick of its class's shapes; large rocks are placed first.
- Each rock's centre is a uniform point of the disc of radius `450 - footprint
radius`, outside its innermost 2% by area, so every footprint stays inside the
  450 world unit field radius. A try is kept when its footprint stays at least
  55 world units (`gap`) from every placed footprint, by footprint radius; the
  build fails if a rock finds no room in 4000 tries or if a rounded position
  breaks a clearance.
- Medium rocks start on a seeded spin frame; large rocks show their one frame.

Field counts, size, spacing and guards are Gameplay values
([Ships](../gameplay/ships.md)). Tech places a field's layout
for its rock count with the layout centre at the field centre, and may turn it
about the centre by a seeded angle, which keeps every clearance. Positions are
rest positions; drift is the rocks' class data.

`ore-field.json`, version 1, world units:

- `rocks`: the resource rock catalog the ids name.
- `radius` (450), `gap` (55) and `count` (`[6, 10]`).
- `layouts[i]`: `count`, `large` (its large rocks), `seed`, `reach` (the
  farthest footprint edge from the centre) and `rocks`, each with `id`,
  `position` (`[x, y]` from the field centre on the world plane) and `frame`
  (the start frame).

| Rocks | Seed | Large |  Reach |
| ----: | ---: | ----: | -----: |
|     6 |   28 |     2 | 418.45 |
|     7 |   26 |     2 | 441.06 |
|     8 |   23 |     3 | 446.42 |
|     9 |   24 |     3 | 440.27 |
|    10 |   29 |     3 | 441.48 |
