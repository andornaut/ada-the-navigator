# Outposts and discovery cache

- Rebuild the outposts with `node art/tools/outposts.ts`. It writes
  `public/art/outposts/<outpost>-a.svg` and `<outpost>-b.svg`, the
  [community project](projects.md) frames and overlays beside them and
  `public/art/projects.json`, and replaces its own outpost and project entries
  in [Sunflower's manifest](../public/art/sunflower/manifest.json).
- Rebuild the cache with `node art/tools/discovery-cache.ts`. It writes
  `public/art/discovery-cache.png` with its Aseprite data
  `discovery-cache.json` and replaces the `discovery-cache` core manifest
  entry, which follows the `station-*` entries and precedes the `enemy-*`
  entries.

## Outposts

The three sector one cooperating outposts: growers, a workshop and salvagers.

- Solid models in the [station](station.md) projection, culling and family:
  cream structure `#efe4cf` (sides `#bfae94`), warm lit windows `#ffe9b8`, and
  the station's dock collar, mouth, lit floor strip, blue corner lights and two
  approach-light pairs. Fixed orientation: no headings and no screen rotation.
- Each outpost is identified by its silhouette and colours alone. No labels,
  signs or text are drawn on or beside it.

### Palette

| Outpost   | Shapes                                                                    | Colours                                                                                                                                    |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Growers   | Seven planters radiating like a sunflower head, a round deck, three domes | Leaf `#9ccc5a` (sides `#6c9a3a`, tufts `#4f7a2c`), glass `#c9ecb4` (sides `#8fbf78`, cap `#eefbe2`), bloom lamps `#f6d76b` (dim `#8a7a3e`) |
| Workshop  | Long hall with a sawtooth roof, two lit bays, a sign band, two cranes     | Yellow `#f2d15a` (sides `#b99a36`, dark `#8c7428`), roof `#d9cbb1`, bay glow `#ffd88a`                                                     |
| Salvagers | Patched hull, tank, scrap stacks, a turret grabber with an electromagnet  | Steel `#b8bfc9`, slate `#8d9bb0`, olive `#aaa883`, rust `#b49a7c`, dark `#6e7482`; periwinkle magnet and beacon `#8f9cf0` (dim `#4a5080`)  |

Growers' leaf green stays clearly yellower and darker than the
[Stardust](stardust.md) mint.

### Frames and manifest

Every entry has the station schema plus `outpost`, the outpost role
(`growers`, `workshop` or `salvagers`).

| Outpost   | Ids                                          | Frame px | Display          | Pivot          | Dock `(x, y)`  | Dock width |
| --------- | -------------------------------------------- | -------- | ---------------- | -------------- | -------------- | ---------- |
| Growers   | `outpost-growers-a`, `outpost-growers-b`     | 144, 120 | 94.5 by 78.75    | `(0.5, 0.4)`   | `(72, 91.841)` | 31.843     |
| Workshop  | `outpost-workshop-a`, `outpost-workshop-b`   | 170, 120 | 111.563 by 78.75 | `(0.5, 0.675)` | `(85, 97.971)` | 29.394     |
| Salvagers | `outpost-salvagers-a`, `outpost-salvagers-b` | 168, 110 | 110.25 by 72.188 | `(0.5, 0.4)`   | `(84, 82.184)` | 31.843     |

- Display size is `frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale), as for the
  station. `facing` is
  `fixed`; `dock.outward` is `[0, 1]`.
- Pivots lie on the world plane: the growers' deck centre, the workshop hall's
  base centre and the model origin between the salvagers' hull and tank.
- The dock entrance is the mouth's centre on the world plane, below the pivot
  by 43.841 frame px (growers), 16.971 (workshop) and 38.184 (salvagers). Ada
  enters moving screen-up, opposite `dock.outward`. Dock values are frame px;
  scale them by the display size like any other manifest value.

### Blink

- `frameMs` 700: frames A and B alternate, 700 ms each.
- A lights the dock corner lights `#70ace8` and each outpost's own lamps: the
  growers' planter tips and dome beacon, the workshop's sign band, the
  salvagers' magnet and antenna beacon. B lights the approach-light pairs and
  dims the rest. Unlit blue lights use `#3f5878`.
- Reduced motion shows frame A only.

## Discovery cache

A sealed pod with a beacon mast, drawn as pixel art from character grids like
[Stardust](stardust.md). Every pixel is opaque or clear; draw with
nearest-neighbour filtering.

- Root manifest id `discovery-cache`: a 63 by 21 sheet of 21 by 21 frames,
  displayed at 21 by 21 logical px with the pivot at the centre. `frames` names
  `hidden` (0), `litA` (1) and `litB` (2).
- `hidden` is the pod before Ada approaches: desaturated and unlit, close to
  the environment tones.
- On approach the cache switches straight to the lit loop, with no reveal
  frame. `loop` (and the sheet's `lit` tag) alternates `litA` and `litB`,
  500 ms each.
- Lit frames use point-of-interest lavender from the
  [space palette](space-palette.md), linking the cache to the station and other
  points of interest. A lights the full beacon with a white core; B shrinks it
  to a warm core and shows eight warm halo pixels around the pod. The table
  lists frame A; B changes only the beacon and adds the halo.
- Reduced motion: `hidden` before approach, then `litA` without the loop.
- Collision: each frame of `discovery-cache.json` carries `collision`, its
  drawn silhouette: an array of convex parts, each an array of `[x, y]` in frame px of that
  frame (one frame px is one display px), the schema of the ship's
  `collision[k]`. Traced by the
  [shared tracer](ship.md#shared-tracer) at 0.4 frame px, the first of the
  ladder that passes: 16 parts, intersection over union 0.999. The halo is
  light, not matter, like the ship's speed jets, so `litB` traces its pod
  alone and all three frames carry the same parts.

| Role        | Hidden    | Lit       |
| ----------- | --------- | --------- |
| Light       | `#6e6478` | `#e6dbeb` |
| Body        | `#5a5164` | `#c4afcc` |
| Shade, mast | `#453e4f` | `#8f7c9c` |
| Seam        | `#3a3344` | `#ffe9b8` |
| Beacon      | `#5a5164` | `#ffe9b8` |
| Beacon core | `#6e6478` | `#ffffff` |
| Halo (B)    | none      | `#ffe9b8` |
