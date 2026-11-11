# Needle

Needle's space art: the Weavers' station and its Loom hall. Everything here is
in [Needle's manifest](../public/art/needle/manifest.json) and under
`public/art/needle/`, drawn in the shared solid-model projection
([ship geometry](ship.md)) with the station family's parts
([art/tools/solid.ts](tools/solid.ts)). Shared generator parts and the Weaver
palette are in [art/tools/needle-common.ts](tools/needle-common.ts).

- Every SVG keeps its `viewBox` in frame px and declares its display size
  (frame times 0.4375) as `width` and `height`. Manifest `width` and `height`
  are frame px; `displayWidth` and `displayHeight` are the drawn size. Frame-px
  values (pivots, docks, berths, anchors) scale by 0.4375 to display px.
- Nothing is labelled: no text, signs or letters on or beside any asset.
- Contrast is WCAG against Needle's background `#26221F`. Needle is a dark
  field: no light-field keyline applies.

## Weavers' station

Needle's dockable station. Rebuild with `node art/tools/needle-station.ts`; it
writes `station-{a,b}.svg` and `station-hall-{a,b}.svg` and replaces its
`needle-station-` entries, which open Needle's manifest.

- A spool hub: pearl flanges round a core wound in lavender and silver thread,
  a domed cabin with warm windows, the spindle mast and a blue beacon.
- A loom frame to screen left: a sill, two posts and a lintel strung with nine
  silver warp threads behind a band of woven lavender cloth with rose and sage
  weft stripes.
- A bobbin rack behind the hub (lavender, rose and sage thread), a mooring arm
  and post to screen right, and the dock toward the viewer with the station
  family's collar, dark mouth, lit floor, four corner lights and two
  approach-light pairs.
- Fixed orientation: no headings and no screen rotation. 5.7 Ada wingspans
  across (the trading station is 3.0).

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Ids                 | `needle-station-a`, `-b`; Loom hall `needle-station-hall-a`, `-b`         |
| Frame               | 320 by 144 frame px; display 140 by 63                                    |
| Pivot               | `(0.5, 0.5)`: the hub base on the world plane                             |
| `facing`            | `fixed`                                                                   |
| `frameMs`           | 700                                                                       |
| `destination`       | `station`; `variant` `base` or `loom-hall`                                |
| `dock`              | `(160, 122.912)`, outward `[0, 1]`, width 29.394                          |
| `berths`, base      | `(0.783, 72)` outward `[-1, 0]`; `(250.631, 72)` outward `[1, 0]`; 24.495 |
| `berths`, Loom hall | `(0.783, 72)` outward `[-1, 0]`; `(299.621, 72)` outward `[1, 0]`; 24.495 |

- `dock` and `berths` use the station schema: the point on the world plane in
  frame px, the outward screen direction and the drawn width. Ada docks moving
  screen-up, opposite `outward`; a craft at a berth holds just beyond its point
  along `outward`. The dock entrance is 50.912 frame px below the pivot.
- The berths are the loom's outer post (left) and the mooring post (right).
  The Loom hall moves the right berth out to the hall's end, so read `berths`
  from the frame in use.
- Blink as the station: frame A lights the dock corner lights and the mast
  beacon `#70ace8`, B the approach-light pairs; the loom post and mooring post
  (or hall end) beacons blink opposite the mast. Unlit blue `#3f5878`. Reduced
  motion shows A.

### Palette

| Role                   | Colour    | Contrast |
| ---------------------- | --------- | -------: |
| Pearl structure        | `#e9e3da` |  12.37:1 |
| Pearl side             | `#b3aba1` |   6.95:1 |
| Silver threads, cap    | `#cfc5bd` |   9.30:1 |
| Lavender thread, roof  | `#c4afcc` |   7.78:1 |
| Lavender side          | `#8f7c9c` |   4.16:1 |
| Rose thread            | `#e3b7c0` |   8.87:1 |
| Sage thread            | `#b9cfae` |   9.47:1 |
| Warm windows, lanterns | `#ffe9b8` |  13.22:1 |
| Blue lights            | `#70ace8` |   6.58:1 |

The silhouette's edge median is 5.95:1, with 90% of edge pixels at 3:1 or more.

### Loom hall

`loomHall` replaces the station frames: draw `needle-station-hall-a` and `-b`
in place of `needle-station-a` and `-b`. The mooring arm and post become a
short link and a long teaching hall: pearl walls with eight warm windows on the
near side, a stepped lavender roof with three warm lanterns, a lavender porch
with a lit door toward the dock side and a beacon on the far end. Frame, pivot
and dock are unchanged; the right berth moves to the hall's end. The hall sorts
in depth with the hub, so it is a replacement, not an overlay.
