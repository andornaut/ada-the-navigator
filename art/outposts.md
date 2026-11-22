# Outposts and discovery cache

- Rebuild the outposts with `node art/tools/outposts.ts`. It writes
  `public/art/outposts/<outpost>-a.svg` and `<outpost>-b.svg`, the
  [community project](projects.md) frames and overlays beside them and
  `public/art/projects.json`, and replaces its own outpost and project entries
  in [Sunflower's manifest](../public/art/sunflower/manifest.json). The outpost
  frames carry two-decimal coordinates ([SVG output](README.md#svg-output)).
- Rebuild the cache with `node art/tools/discovery-cache.ts`. It writes
  `public/art/discovery-cache.png` with its Aseprite data
  `discovery-cache.json` and replaces the `discovery-cache` core manifest
  entry, which follows the `station-*` entries and precedes the `enemy-*`
  entries.

## Outposts

The three sector one cooperating outposts: growers, a workshop and salvagers.

- Solid models in the [station](station.md) projection, culling and family:
  cream structure `#efe4cf` (sides `#bfae94`), warm lit windows `#ffe9b8`, and
  fixed orientations. The Growers' navigation strip sits in the habitat rim.
  The Salvagers' lights sit on the hull and grabber. The Workshop's articulated
  arms surround an open repair area. Ada visits each outpost with Use.
- Each outpost is identified by its silhouette and colours alone. No labels,
  signs or text are drawn on or beside it.

### Palette

| Outpost   | Shapes                                                                   | Colours                                                                                                                                   |
| --------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Growers   | Seven hydroponic modules around a round deck and three habitat domes     | Steel `#637985`, leaf `#9ccc5a`, glass `#c9ecb4` (sides `#8fbf78`, cap `#eefbe2`), bloom lamps `#f6d76b` (dim `#8a7a3e`)                  |
| Workshop  | Open repair rig with a triangular truss and two articulated manipulators | Blue steel `#899fbd`, slate `#43546f`, mint `#9fcbc1` and blue-green `#527c83`                                                            |
| Salvagers | Patched hull, tank, scrap stacks, a turret grabber with an electromagnet | Steel `#b8bfc9`, slate `#8d9bb0`, olive `#aaa883`, rust `#b49a7c`, dark `#6e7482`; periwinkle magnet and beacon `#8f9cf0` (dim `#4a5080`) |

Growers' leaf green stays clearly yellower and darker than the
[Stardust](stardust.md) mint.

### Frames and manifest

Every entry has the station schema plus `outpost`, the outpost role
(`growers`, `workshop` or `salvagers`).

| Outpost   | Ids                                          | Frame px | Display           | Pivot          | Dock `(x, y)`  | Dock width |
| --------- | -------------------------------------------- | -------- | ----------------- | -------------- | -------------- | ---------- |
| Growers   | `outpost-growers-a`, `outpost-growers-b`     | 144, 120 | 132.3 by 110.25   | `(0.5, 0.4)`   | `(72, 91.841)` | 31.843     |
| Workshop  | `outpost-workshop-a`, `outpost-workshop-b`   | 170, 120 | 156.188 by 110.25 | `(0.5, 0.675)` | `(85, 97.971)` | 29.394     |
| Salvagers | `outpost-salvagers-a`, `outpost-salvagers-b` | 168, 110 | 154.35 by 101.063 | `(0.5, 0.4)`   | `(84, 82.184)` | 31.843     |

- Display size is `frame * 0.4375 * 1.5 * 1.4`, the [destination scale](destinations.md#scale) with
  Sunflower outpost growth. `facing` is `fixed`; `dock.outward` is `[0, 1]`.
- Pivots lie on the world plane: the growers' deck centre, the workshop's central bus and the model origin between the salvagers' hull and tank.
- The legacy approach point lies on the world plane, below the pivot by 43.841
  frame px (growers), 16.971 (workshop) and 38.184 (salvagers). Dock values are
  frame px.

### Blink

- `frameMs` 700: frames A and B alternate, 700 ms each.
- A lights the growers' module tips and dome beacon, the workshop's
  manipulator tips, and the salvagers' magnet and antenna beacon. B dims them.
- Reduced motion shows frame A only.

## Discovery cache

A sealed data satellite with swept solar wings, a central bus and a mast
receiver. Draw the opaque and clear pixel art with nearest-neighbour filtering.

- Root manifest id `discovery-cache`: a 63 by 21 sheet of 21 by 21 frames,
  displayed at 31 by 31 logical px with the pivot at the centre. `frames` names
  `hidden` (0), `litA` (1) and `litB` (2).
- `hidden` is the satellite before Ada approaches: desaturated and unlit, close to
  the environment tones.
- On approach the cache switches straight to the lit loop, with no reveal
  frame. `loop` (and the sheet's `lit` tag) alternates `litA` and `litB`,
  500 ms each.
- Lit frames reveal navy solar wings, a bronze bus and a warm beacon.
  A broad pale cluster on the bus separates the lit frames from the hidden
  state. Frame A uses a white beacon core. Frame B uses a warm core and eight
  warm halo pixels around the satellite.
- Reduced motion: `hidden` before approach, then `litA` without the loop.
- Collision: each frame of `discovery-cache.json` carries `collision`, its
  drawn silhouette: an array of convex parts, each an array of `[x, y]` in frame px of that
  frame (one frame px is one display px), the schema of the ship's
  `collision[k]`. Traced by the
  [shared tracer](ship.md#shared-tracer) from the 21 px sprite. All three
  frames use the same physical silhouette and the trace excludes the beacon halo.

## Stranded craft

Two craft for Sunflower's rescue tows, in the outposts' leaf, bloom, cream and workshop yellow. Rebuild with `node art/tools/stranded-craft.ts`. Each craft follows
Cartwheel's [stranded craft](cartwheel-props.md#stranded-craft) schema: the
sixteen enemy headings, the smallest square frame (a multiple of 16 px) with
4 px padding round a centred pivot, no jets and no collision parts. Files are
`/art/sunflower/{craft}-{k}[-{a,b}].svg`;
[sunflower/tow.json](../public/art/sunflower/tow.json), linked from
[Sunflower's manifest](../public/art/sunflower/manifest.json) as `tow`, gives each craft's
`frame`, `display`, `blink` and `frameMs`, and `headings[k].tow`, the tow point
in frame px.

| Craft                  | Job subject   | Manifest ids                        | Frame | Display | Frames per heading       |          Hull top on field |
| ---------------------- | ------------- | ----------------------------------- | ----: | ------: | ------------------------ | -------------------------: |
| `stranded-seed-pod`    | a seed pod    | `craft-stranded-seed-pod-{k}-{a,b}` |    64 |      28 | `a` lit, `b` dim, 700 ms | `#efe4cf` 1.31:1, keylined |
| `stranded-scrap-barge` | a scrap barge | `craft-stranded-scrap-barge-{k}`    |    96 |      42 | one                      | `#aaa883` 1.47:1, keylined |

- Seed pod: a striped cream sunflower-seed capsule, rounded at the bow and
  pointed at the tail, with a leaf collar and sprout at the tail, a bloom lamp
  `#f6d76b` that blinks while it waits (dim `#8a7a3e`) and a steel tow lug
  forward. Reduced motion shows `a`.
- Scrap barge: an olive steel tray with a raised workshop-yellow hazard rim,
  heaped with scrap (rust and olive plates, a steel tank, a wheel, a bent pipe),
  a cream cab on the stern quarter with dark glass and a dim lamp, and a dark
  engine block; power off, listing 10 degrees to starboard and 4 nose down.
- Each tow point is the bow lug's face.
- Sunflower is a light field: both craft draw over the 1 px ink keyline
  (`strandedCraft` in `lightField.keylined`, ink `#181425` at 10.90:1 on the
  sand), as the outposts do.
