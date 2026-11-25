# Cartwheel props

Cartwheel's traveling debris, the ore nugget cargo piece, the two stranded
craft a tow job brings home, the tow line and the [ore field](#ore-field)
layouts. The
resource rocks are in [Asteroids](asteroids.md#resource-rocks). Cartwheel has
no damaging hazards.

- Rebuild the debris with `node art/tools/cartwheel-props.ts`. It writes the
  debris sheet and [debris.json](../public/art/cartwheel/debris.json) to
  `public/art/cartwheel/` and the debris entries and `cartwheelDebris` link in
  [Cartwheel's manifest](../public/art/cartwheel/manifest.json), each row in
  its place. Reruns are byte-identical. The debris models, tumble and frame
  export are shared with Whirlpool's river debris and Needle's channel debris
  in [art/tools/debris.ts](tools/debris.ts).
- `node art/tools/friendly.ts` draws the stranded craft and the tow line
  ([Friendly object redesign](friendly-redesign.md)): the `tow` link is in the
  core manifest, since any rescue draws the tow line; the stranded craft and a
  `tow` link to the same `friendly-tow.json` are in Cartwheel's.
- `node art/tools/resource-pickups.ts` draws the [ore nugget](#ore-nugget).
- Every SVG keeps its `viewBox` in frame px and declares its display size
  (frame times 0.4375) as `width` and `height`, so it rasterizes at the size it
  is drawn. Manifest `width` and `height` are frame px; `displayWidth` and
  `displayHeight` are the drawn size. Frame-px values (anchors, bounds, radius)
  scale by 0.4375 to display px.

## Traveling debris

A broken piece of the Cartwheel hub: a wheel-rim segment with the stub of its
spoke and the collar that held it, one connected solid tumbling about a
tilted axis.

- Manifest `cartwheel-debris-{k}`, `k` 0 to 7, `tumbleIndex` `k`: frame 118 by
  115, display 51.625 by 50.3125, pivot (0.5, 0.50435), the piece's centre of
  rotation. The piece leans 20 degrees, then frame `k` shows it turned `45k`
  degrees about an axis tilted 24 degrees from vertical; show frame
  `floor(angle / 45) mod 8` and pick a tumble rate in `tumble.degPerSecond`
  (60 to 120) per piece. Reduced motion shows frame 0.
- Model: an 84 degree arc of a rim 11 wide and 10 deep at radius 30, a spoke
  stub 8 wide and 6 deep, and a collar 11 wide and 9 deep, in display px at
  scale 0.8. The widest drawn extent is 46.6 px.
- Body, lit to shadow: `#D9B09F`, `#C9A190`, `#B99181`, `#AC8575` and
  `#A37C6C` (`body`), 1.07 to 1.48:1 on Cartwheel's light background: Cartwheel's `environmentDetail` lightness plus 0.2, 0.15,
  0.1, 0.06 and 0.03, at its tint hue with 1.3 times its chroma. Muted field
  matter, never the neutral stone of harmless rocks.
- Faces resolve by depth into flat tones under the one light from the upper
  left. The rim and collar take steps 1, 3 and 5 of the ramp for tops, walls
  facing left and walls facing right; the spoke stub takes steps 2 and 4 and
  `#906A5B`, step 5 lowered by 0.06 Oklab L. Each frame is one path per
  tone, with no seam strokes.
- A 1.5 px coral (`obstacle`, `#D68B72`) contour outside the silhouette (`contour`):
  1.07:1 on Cartwheel's background, and 1.05 to 1.38:1 on the body tones (1.05:1
  on the middle one). Coral means damage.
- On Cartwheel's light field the piece draws over the 1 px ink keyline of the
  [light-field rule](galaxies.md#light-fields) (`debris`): the silhouette,
  contour included, at alpha 0.5, grown by 1 px in all eight directions. Ink
  `#181425` is 7.18:1 on the field and 4.85 to 9.15:1 against the body tones.
- `radius`: 58.56 frame px from the pivot to the farthest drawn point over all
  frames, contour included. Each frame's `bounds` is its drawn box in frame px,
  `[minX, minY, maxX, maxY]`, and its `collision` is its drawn silhouette
  ([Collision](#collision)). Damage is a Gameplay value.

### Collision

Each traveling debris frame collides, makes contact and is placed by its drawn
silhouette, contour included: `debris[i].frames[k].collision` beside `file` and
`bounds`, an array of convex parts, each an array of `[x, y]` in frame px of
that piece's frame (the schema of the ship's `collision[k]`). Multiply offsets
from the pivot by `displayScale` for display px.

- `art/tools/debris.ts` traces each frame's visible faces with the
  [shared tracer](ship.md#shared-tracer), grown by half the 6.86 frame px
  contour stroke (3.43), the outermost stroke. Each frame takes the first
  Douglas-Peucker tolerance of 0.75, 0.5, 0.4 and 0.3 frame px that passes the
  0.98 floor. No frame has a notch tip.
- Every frame passes the floor with 4 to 7 parts.

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

The ore piece a resource rock releases, collected on contact: a chunky,
irregular, matte rock nugget, never animated, so it reads apart from the small
twinkling [Stardust](stardust.md) star by silhouette, colour, surface, size and
lightness, in greyscale too.

- Rebuild with `node art/tools/resource-pickups.ts`, with the
  [Stardust](stardust.md) sheet. It writes `public/art/ore-nugget.png` and its
  Aseprite data `ore-nugget.json`; the core manifest row that switches to it
  is in [resource-rows.json](resource-rows.json).
- Manifest `ore-nugget`: a 9 by 9 sheet with one `rest` frame, displayed at
  9 by 9 logical px for one ore and 18 by 18 for five ore, with the pivot at
  the centre, nearest-neighbour filtered. The same 9 px size as Stardust.
- One image: the ore icon in every UI draws this frame at 18 by 18 px
  ([Shared image](stardust.md#shared-image)).
- Pixel art from a character grid; every pixel is opaque or clear. Lit from
  the upper left, with no white or glint pixel: a lit facet at the upper left,
  a two-pixel crease down the crown, the body, and one shade facet with a deep
  edge to the lower right.
- Ore's palette is shared with the resource rocks' crystals and the ore HUD
  icon (`art/tools/ore.ts`): a burgundy-purple body inside a light mauve rim. Every
  outline pixel (one with a clear neighbour) is rim, the lit rim where the
  clear side is up or left and the rim shade where it is down or right.
- Collision: the `rest` frame of `ore-nugget.json` carries `collision`, its
  drawn silhouette: an array of convex parts, each an array of `[x, y]` in frame px of that
  frame (one frame px is one display px), the schema of the ship's
  `collision[k]`. Traced by the
  [shared tracer](ship.md#shared-tracer) at 0.4 frame px, the first of the
  ladder that passes: 15 parts. The five-ore pickup scales the centred parts
  by `18 / 9`; the source frame stays unchanged.

| Role       | Colour    |
| ---------- | --------- |
| Rim, lit   | `#e798cd` |
| Rim, shade | `#d481b9` |
| Light      | `#a56490` |
| Body       | `#774667` |
| Shade      | `#58324c` |
| Deep       | `#3d2334` |

The rim carries the nugget's contrast; the body inside it is 1.97:1 to 2.31:1
on the dark fields, so the nugget reads as a dark burgundy-purple nugget with a light edge.

| Field     | Lit rim | Rim shade |
| --------- | ------- | --------- |
| Base      | 6.81:1  | 5.33:1    |
| Cartwheel | 6.87:1  | 5.37:1    |
| Whirlpool | 6.73:1  | 5.27:1    |
| Needle    | 7.34:1  | 5.74:1    |
| Andromeda | 6.86:1  | 5.36:1    |
| Phantom   | 7.91:1  | 6.19:1    |

On Sunflower's light field the burgundy-purple body carries the nugget's
contrast against the light background; the pickup keeps its authored rim.

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
| `stranded-hauler`  | `craft-stranded-hauler-{k}`        |   128 |      56 | one                      |

- Ore pod: a sealed cream cargo capsule with an ore band, a steel tow lug
  forward and a mast light that blinks while it waits (`blink`, `frameMs`).
  Reduced motion shows `a`.
- Stuck hauler: the story miner's tri-hull geometry with its power off: dark
  cab glass, dim running and mast lights, no jets, listing 12 degrees to port
  and 5 degrees nose down. Its tow point is the drill tip.
- Each entry has `directionIndex` `k`, `facing` `world-{k}` and `craft`.

Every galaxy's stranded craft share this schema and one producer,
`node art/tools/friendly.ts`. Each galaxy manifest links its own
`friendly-tow.json` as `tow`, holding its `craft` in the shape above (`id`, `frame`,
`display`, `blink` and `frameMs` for a blinking craft, and `headings[k].tow`);
the core `tow` link keeps the line below and Cartwheel's craft. Pods and buoys
blink a waiting light, `a` lit and `b` dim at 700 ms; crewed craft show one
frame with their power off, dark glass, dim lamps and a list. No stranded craft
has jets or collision parts: it takes no hits and passes through scenery. On a
light field every stranded craft draws over the ink keyline (`strandedCraft`
in `lightField.keylined`). The other galaxies' craft:

| Galaxy    | Craft                                                              |
| --------- | ------------------------------------------------------------------ |
| Sunflower | [Seed pod and scrap barge](outposts.md#stranded-craft)             |
| Whirlpool | [Current skimmer and shell pod](whirlpool.md#stranded-craft)       |
| Needle    | [Stuck glider and spool pod](needle.md#stranded-craft)             |
| Andromeda | [Lost courier and drifting lamp buoy](andromeda.md#stranded-craft) |
| Phantom   | [Traveler's pod](phantom.md#stranded-craft)                        |

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
- Accepted flat look ([handoff](polish-handoff.md)), staged whole as
  `effects-tow` in [polish-rows.json](polish-rows.json) to replace `line`:
  - `layers`: the outer stroke `#4F5462` 3 px wide and the core `#B8BFC9`
    1.4 px wide.
  - `lightInk` 4.2: the ink stroke under the cable on a light field.
  - `clamp`: one `#4F5462` block at the tow point in place of the bead row
    and the round cap, from `before` 3.2 px along the line toward Ada to
    `after` 2.6 px past the point and `across` 5.2 px wide, with a
    `face` band `#B8BFC9` `depth` 2.2 px on its screen-upper edge. On a
    light field it takes the ink keyline as the effect kind `towClamp`
    ([light fields](galaxies.md#light-fields)).
  - No `beads` and no `cap`. `tow.json` keeps the shipped line until the
    reader accepts a line without them.
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
dust or other field marks, so the ore crystals alone set it apart from plain
rock clusters, and no field speck can read as a nugget or Stardust.

- Rebuild with `node art/tools/ore-field.ts` after `node art/tools/asteroids.ts`.
  It reads the footprints from
  [resource-rocks.json](../public/art/resource-rocks.json), writes
  [ore-field.json](../public/art/cartwheel/ore-field.json) and links it from
  Cartwheel's manifest as `oreField`. Reruns are byte-identical.
- Eight pattern families: `loose-cluster`, `crescent`, `two-pockets`,
  `broken-ring`, `scattered-trail`, `three-pockets`, `forked-trail` and `open-spiral`.
  Each family has one realization for each rock count from 6 to 10: 40 records,
  with eight families available for every count.
- The loose cluster uses the first seed from 23 up that draws its count
  (Python's `random.Random` sequence, `art/tools/random.ts`). Its published
  positions, rock order, shapes and start frames are retained. Every other
  family reuses that count's exact rock order, shapes and frames; only positions
  differ. Large counts remain 2, 2, 3, 3 and 3 for totals 6 through 10.
- Every footprint stays inside the 450 world unit radius and at least 55 world
  units clear of every other footprint. Rounded positions are checked using
  the resource catalog's footprint radii. The open gaps provide ship routes;
  rigid rotation preserves those clearances. Each family's anchors place the
  large rocks where the full set has the most clearance.
- Medium rocks start on a seeded spin frame; large rocks show their one frame.

Field counts, size, spacing and guards are Gameplay values
([Ships](../gameplay/ships.md)). Tech places a field's layout
by a seeded family choice for its existing rock count, with the layout centre
at the field centre and its existing seeded rotation. Field centres, counts,
frequencies, guard rolls and identities keep their independent seeds. A guard
remains 610 units from the centre on its independently seeded angle; its
platform stays facing world +X. Positions are rest positions; drift is the
rocks' class data.

`ore-field.json`, version 2, world units:

- `rocks`: the resource rock catalog the ids name.
- `radius` (450), `gap` (55) and `count` (`[6, 10]`).
- `variants[i]`: the family `id` and its five `layouts`.
- Each layout: `count`, `large` (its large rocks), `seed` (the retained rock
  selection seed), `reach` (the farthest footprint edge from the centre) and
  `rocks`, each with `id`, `position` (`[x, y]` from the field centre on the
  world plane) and `frame` (the start frame).

The loose cluster retains these seed and reach values:

| Rocks | Seed | Large |  Reach |
| ----: | ---: | ----: | -----: |
|     6 |   28 |     2 | 418.45 |
|     7 |   26 |     2 | 441.06 |
|     8 |   23 |     3 | 446.42 |
|     9 |   24 |     3 | 440.27 |
|    10 |   29 |     3 | 441.48 |
