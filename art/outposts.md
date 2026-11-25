# Outposts and discovery cache

- `node art/tools/stations.ts` draws the outposts and their
  [community project](projects.md) frames into
  [Sunflower's manifest](../public/art/sunflower/manifest.json) and writes
  their `projects.json` entries ([Station redesign](station-redesign.md)).
  Reruns are byte-identical.
- `node art/tools/friendly.ts` draws the discovery cache, the salvage beacon
  and Sunflower's stranded craft
  ([Friendly object redesign](friendly-redesign.md)).

## Outposts

The three sector one cooperating outposts: growers, a workshop and salvagers,
each a member of Sunflower's flower station family. Ada visits each with Use.

- Connected solids from [station-models.ts](tools/station-models.ts), lit from
  the upper left in flat tones, in fixed orientations: no headings and no
  screen rotation.
- Each outpost is identified by its silhouette and colours alone. No labels,
  signs or text are drawn on or beside it.

| Outpost   | Form                                                                                                                                                | Colours                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Growers   | Eight leaf petals, each a lens with a raised inner pad, round a peg with a cream lamp cap and band, on a long foot                                  | Leaf `#f2b31c` (walls `#c48a10`, `#a8700c`), peg `#5a3f2e` (`#3f2b20`, `#2d1e16`), lamp `#fff2d0` |
| Workshop  | Five petal slabs with raised pads round the far half of a seed disc, screen lower left to upper right, a cream band and dome lamp, on a short stalk | Petal `#f2a51f` (`#c98212`, `#a66a0c`), seed `#6a4630` (`#4b3020`, `#35211a`), lamp `#fff4d6`     |
| Salvagers | Four long leaf petals at the screen's four diagonals round a tall peg with a cream lamp cap and band, on a foot                                     | As the growers                                                                                    |

The leaves are slabs 6 display px thick with their walls drawn.

### Frames and manifest

Every row has the station schema plus `outpost`, the outpost role (`growers`,
`workshop` or `salvagers`). Each outpost's frames are nested roots of one
sheet in `/art/sunflower/`.

| Outpost   | Ids                                          | Sheet                      | Frame px | Display         | Pivot            | Dock `(x, y)`   | Dock width |
| --------- | -------------------------------------------- | -------------------------- | -------- | --------------- | ---------------- | --------------- | ---------- |
| Growers   | `outpost-growers-a`, `outpost-growers-b`     | `growers-leaf-sheet.svg`   | 192, 144 | 176.4 by 132.3  | `(0.5, 0.45139)` | `(96, 83.471)`  | 31.843     |
| Workshop  | `outpost-workshop-a`, `outpost-workshop-b`   | `workshop-bloom-sheet.svg` | 200, 144 | 183.75 by 132.3 | `(0.5, 0.41667)` | `(100, 83.089)` | 29.394     |
| Salvagers | `outpost-salvagers-a`, `outpost-salvagers-b` | `salvagers-leaf-sheet.svg` | 176, 120 | 161.7 by 110.25 | `(0.5, 0.48333)` | `(88, 78.203)`  | 31.843     |

- Display size is `frame * 0.4375 * 1.5 * 1.4`, the
  [destination scale](destinations.md#scale) with Sunflower outpost growth.
  `facing` is `fixed`; `dock.outward` is `[0, 1]`.
- Pivots lie on the world plane on the peg's or the seed disc's axis. The dock
  is the peg collar's or the disc's wall straight down the screen from the
  pivot, on the world plane. Dock values are frame px.
- The growers' `greenhouseRing` frames share the growers' frame, pivot and
  dock; the workshop crane and the salvage beacons are overlays
  ([Community projects](projects.md#world-changes)).

### Blink

- `frameMs` 700: frames A and B alternate, 700 ms each.
- Frame A lights each lamp; frame B swaps every lamp tone for a dull dark tone.
  The lit and dim frames share one silhouette.
- Reduced motion shows frame A only.
- On Sunflower's light field each outpost and its overlays draw over the 2 px
  ink destination keyline as one silhouette
  ([Destinations](destinations.md)).

## Discovery cache

One six-sided vault, tapered at its foot and crown, with a single band round
its middle that is dark while the cache is hidden and lights when it is found.
Its rows are in the core manifest on `/art/pickups/pickups-sheet.svg`.

| Tone         | Top       | Left wall | Right wall |
| ------------ | --------- | --------- | ---------- |
| Vault        | `#a99dba` | `#7a6f8c` | `#544a66`  |
| Band, lit A  | `#f0ddf8` |           |            |
| Band, lit B  | `#c4afcc` |           |            |
| Band, hidden | `#3a3448` | `#2a2536` | `#181425`  |

- Rows `discovery-cache-lit-a`, `discovery-cache-lit-b` and
  `discovery-cache-hidden`: 64 by 80 frame px, displayed at 28 by 35 logical
  px with the pivot at the centre. The vault draws 24 by 31 display px. The lit
  rows carry `frameMs` 500.
- `hidden` is the cache before Ada approaches. On approach it switches to the
  lit pair, which alternates A and B, 500 ms each.
- Reduced motion: `hidden` before approach, then `lit-a` without the blink.
- Collision: `pickups.json` holds each row's strictly convex parts in frame px
  from the frame's top left; the three rows share one outline.
- On a light field the cache draws over the 1 px ink keyline
  ([Light fields](galaxies.md#light-fields)).

## Stranded craft

Two craft for Sunflower's rescue tows, in the flower family's cream, seed brown
and petal gold. Each follows the [stranded craft](cartwheel-props.md#stranded-craft)
schema: 16 headings in a square frame with a centred pivot, no jets and no
collision parts. Their rows are in
[Sunflower's manifest](../public/art/sunflower/manifest.json);
`/art/sunflower/friendly-tow.json`, linked as `tow`, gives each craft's
`frame`, `blink` and `frameMs`, and per heading the `tow` point and
`collision` in frame px.

| Craft                  | Job subject   | Manifest ids                        | Frame | Display | Frames per heading       |
| ---------------------- | ------------- | ----------------------------------- | ----: | ------: | ------------------------ |
| `stranded-seed-pod`    | a seed pod    | `craft-stranded-seed-pod-{k}-{a,b}` |    80 |      35 | `a` lit, `b` dim, 700 ms |
| `stranded-scrap-barge` | a scrap barge | `craft-stranded-scrap-barge-{k}`    |   112 |      49 | one                      |

- Seed pod: a lifeboat capsule in cream with a window band, a stern port, a
  distress lamp that blinks while it waits and a petal cup at the stern.
- Scrap barge: a short freighter with one scrap hold in rust brown `#9a7b5c`,
  a cab at the bow and an engine block at the stern.
- Sunflower is a light field: both craft draw over the 1 px ink keyline
  (`strandedCraft` in `lightField.keylined`).
