# Community projects

This guide covers the Community projects pane, contribution details and the
world change each funded project shows at its site. Gameplay owns project
order, prices, eligibility and strings ([Donations](../gameplay/economy.md)).

<a id="projects-tab"></a>

## Jobs & Projects

Open [Jobs & Projects](shop.md#jobs--projects) from the Station footer,
including at project-only stations. Jobs sits on the left with a Rewards
hint. Community projects sits on the right with a Contributions hint. Both
hints use the Stardust icon and equivalent spoken text. The project pane
lists the galaxy's projects in Gameplay order when the station offers them
after chapter completion.

### Project row

| Part          | Art                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Well and icon | The compact item well with the project's centred 20x20 `icon-project-*` glyph                   |
| Name          | The project name, cream                                                                         |
| Second line   | Row supporting `#c0bbd0`: the effect line, or `projectProgress` ("{paid} of {price}") once paid |
| Price pill    | The item row's pill with what remains: `price - paid`                                           |
| Funded        | `icon-shop-check` and `projectFunded` ("Funded") in row supporting, like Owned                  |

Row states:

- **Available**. The effect line and full price are visible. Activating
  opens the contribution detail.
- **Part-paid**. The second line shows `projectProgress` and the pill
  shows what remains. Activating opens the contribution detail.
- **Unaffordable**. The tile and well use the flat `#2f2d3d` face.
  The glyph uses its disabled frame (`#9a96ad`), and the row text uses
  `#a6a2b8`. The row stays focusable and can open a guarded detail.
- **Funded**. The check and Funded replace the price. The second line
  retains the progress text and the row cannot activate.

Use face, text or icon colour cues for focus, press and selection. Keep the
ordinary tile border in every state.

Selected effect lines from Gameplay:

| Project          | Key                          | Text                        |
| ---------------- | ---------------------------- | --------------------------- |
| `greenhouseRing` | `projectEffectGreenhouse`    | Domes for more crops        |
| `workshopCrane`  | `projectEffectCrane`         | A crane for heavy lifts     |
| `salvageBeacons` | `projectEffectBeacons`       | Helps find lost things      |
| `dockingBay`     | `projectEffectDockingBay`    | No miner waits alone        |
| `hubRepairs`     | `projectEffectHubRepairs`    | Repairs the mining hub      |
| `nurseryBeacon`  | `projectEffectNursery`       | A light for resting calves  |
| `currentBuoys`   | `projectEffectCurrentBuoys`  | Marks the currents          |
| `courierSchool`  | `projectEffectCourierSchool` | Trains careful couriers     |
| `spareBeacon`    | `projectEffectSpareBeacon`   | A backup guide light        |
| `channelLights`  | `projectEffectChannelLights` | Lights the practice channel |
| `loomHall`       | `projectEffectLoomHall`      | A place to teach pilots     |

## Donation confirm

Selecting a project opens its detail over the dimmed Jobs & Projects page.
Cancel, the close X, outside tap, back and Escape dismiss one layer and
return focus to the project row or an available board control.

1. The header uses `donateTitle` ("Donate to {name}?") for an eligible
   contribution. A guarded detail uses the project name.
2. Centre the project glyph at 2x in the item well and show the project's
   `projectAbout<Project>` description.
3. Show Contribution with the Stardust icon, offered amount and equivalent
   spoken text. The detail omits projected player balance and the amount
   that would remain unfunded after the contribution.
4. Place Cancel (secondary) on the left and Accept (primary) on the right.
   Accept rechecks the live offer and uses the
   [refusal cue](controls.md#refusal-cue) if the contribution is unavailable.

An eligible contribution pays as much of the remaining cost as Ada's
Stardust covers. After a partial contribution, the detail closes and
focus returns to the project row. Full funding undocks Ada and queues the
keeper's thank-you line.

## World changes

`node art/tools/stations.ts` writes the world changes that are station frames
and the salvage beacons' anchors ([Station redesign](station-redesign.md)), and
`node art/tools/friendly.ts` places the other project sprites
([Friendly object redesign](friendly-redesign.md#manifests)). `public/art/projects.json` places
them, keyed by project id; each generator replaces only its own projects
through `art/tools/projects.ts`, so reruns in any order leave the file
byte-identical. Cartwheel's are [hub frames](cartwheel.md#world-changes) and
Whirlpool's are placed by `public/art/whirlpool/projects.json`
([Whirlpool](whirlpool.md#project-world-changes)). A project with no world art
in any of these changes nothing in the world when funded.

A change is one of three kinds:

- **Replacement frames** when the change wraps around the outpost, so its parts
  sort in depth among the outpost's own: the greenhouse ring passes behind and
  in front of the planters. The pair replaces the outpost's pair at the same
  world point.
- **Overlay** when every part sits wholly beside or above the outpost, so
  drawing it after (or before) the unchanged outpost gives the same pixels as
  one depth sort of both: the workshop crane and the salvage beacons. Overlays
  keep the outpost's frames unchanged and reuse one small sprite.
- **Path** when the change lines a channel rather than a station: Channel
  lights. One small sprite at anchors measured along the channel's centre line.

Both kinds use the base asset's schema (for an outpost,
[Frames and manifest](outposts.md#frames-and-manifest)) with the fields that
name the base they attach to, and `project`. Replacement frames carry the
dock; overlays carry none, or only `berths` they add. The base entries are
unchanged.

### projects.json

- `reveal`: `durationMs` 600, `easing` `cubicOut` (see [Reveal](#reveal)).
- The base a project attaches to, by the base entries' own fields:
  `outpost` (the outpost role and destination id) at Sunflower's outposts,
  `station` `settlers` at every Andromeda station, `beacon` `guide` with
  `state` `relit` at Andromeda's relit dark beacon, and `galaxy` `needle` with
  `destination` `station` at the Weavers' station.
- `kind` `replace`: `frames` (A, B) replace `replaces` (A, B).
- `kind` `overlay`: `frames` (A, B) and `anchors`. Each anchor places one copy
  of the sprite with its pivot at the base's pivot plus (`x`, `y`) frame px;
  scale by the base's display size like the dock (`displayWidth / width`, 0.65625
  at the [destination scale](destinations.md#scale)), then
  convert screen to world as for the dock. `layer` `behind` draws before the
  base, `front` after it, all in the base's depth slot. `phase` 0 shows
  frame A while the base shows A; `phase` 1 shows the other frame.
- `kind` `path`: `galaxy`, `path` (Gameplay's channel id, such as `practice`),
  `frames` (A, B) and `anchors`: `start`, `spacing` and `inset` in world units
  and `sides`. Anchor `i` sits at arc length `start + i * spacing` along the
  channel's centre line, for every `i` with that within the channel, on each
  side in `sides` (1 left of the centre line's direction, -1 right), `inset`
  inside that edge, on the world plane. `phase` `alternate`: the anchor at `i`
  on side -1 shows frame A while `i` is even, the one on side 1 while `i` is
  odd, so neighbours along and across blink opposite. The sprites sort with
  the play objects at their pivots, with no collision, and blink on a 700 ms
  clock (`frameMs`).

### Greenhouse ring

`greenhouseRing` at the growers: replacement frames.

| Ids                                                | Frame px | Display           | Pivot         | Dock `(x, y)`   | Dock width |
| -------------------------------------------------- | -------- | ----------------- | ------------- | --------------- | ---------- |
| `outpost-growers-ring-a`, `outpost-growers-ring-b` | 180, 140 | 118.125 by 91.875 | `(0.5, 0.45)` | `(90, 106.841)` | 31.843     |

- The growers' model unchanged (the same polygons, offset by (18, 15) frame px)
  with the ring around the deck centre. The pivot and dock entrance are the same
  world points as `outpost-growers-a`: the entrance is 43.841 frame px below the
  pivot.
- Ring, in model units from the pivot: a cream walkway (sides `#bfae94`) from r
  61.5 to 69.5, z 0 to 3; a growers-glass tube `#c9ecb4` (sides `#8fbf78`) from
  r 63 to 68, z 3 to 5.5; a leaf `#9ccc5a` seam on top. The walkway skips the
  dock gap from 15 to 75 degrees, centred on the 45-degree dock axis.
- Eight stepped domes, r 8 on 12-gon footings, at r 65.5 and 15, 75, 112.5,
  157.5, 202.5, 247.5, 292.5 and 337.5 degrees: one between each pair of planter
  tips. Each dome cap carries a bloom lamp, `#f6d76b` in A and `#8a7a3e` in B,
  blinking with the planter tips.

### Workshop crane

`workshopCrane` at the workshop: one front overlay at the workshop's pivot.

| Ids                                                    | Frame px | Display        | Pivot           | Anchor `(x, y)` | Layer   | Phase |
| ------------------------------------------------------ | -------- | -------------- | --------------- | --------------- | ------- | ----- |
| `outpost-workshop-crane-a`, `outpost-workshop-crane-b` | 134, 80  | 87.938 by 52.5 | `(0.5, 0.7625)` | `(0, 0)`        | `front` | 0     |

- An additional articulated service arm extends from the forward side of the
  orbital repair rig. Its slate links and ochre joints match the two base
  manipulators. The tool tip pulses warm in frame A.

### Salvage beacons

`salvageBeacons` at the salvagers: one beacon sprite at three anchors.

| Ids                                                        | Frame px | Display  | Pivot           |
| ---------------------------------------------------------- | -------- | -------- | --------------- |
| `outpost-salvagers-beacon-a`, `outpost-salvagers-beacon-b` | 48, 80   | 21 by 35 | `(0.5, 0.2125)` |

| Anchor | Plan (degrees, r) | `(x, y)` frame px | Layer    | Phase |
| ------ | ----------------- | ----------------- | -------- | ----- |
| 1      | 225, 80           | `(0, -61.571)`    | `behind` | 0     |
| 2      | 135, 80           | `(-106.644, 0)`   | `front`  | 1     |
| 3      | 315, 80           | `(106.644, 0)`    | `front`  | 0     |

- The beacon is a [friendly object](friendly-redesign.md); its pivot is the
  float's centre on the world plane, with the stalk below it.
- The anchors sit in the gaps between the yard's leaves: behind the hub, and
  beside the yard at its screen left and right, clear of the leaves. The
  station producer places them from the plan points.

### Blink, keyline and reduced motion

- Every change blinks on its outpost's clock: frame A while the outpost shows A,
  except phase 1 anchors.
- On Sunflower's light field Tech draws the 1 px ink keyline at runtime
  ([Galaxies](galaxies.md)); the sprites carry none. An outpost and its overlays
  keyline as one silhouette, beneath the behind layer.
- Reduced motion holds the outpost on A, so phase 1 anchors hold B.

## Reveal

- Plays once per project, on the first frame its outpost is on screen after the
  project is funded (at once if it is on screen when the card closes). Every
  later sighting shows the after state.
- The before state at full opacity, with the after state over it as one group
  (its sprites and keyline) at alpha `1 - (1 - t)^3`, `t = elapsed / 600 ms`.
  Fade the group, not each sprite: per-sprite alpha lets the after keyline's
  fill darken the shared pixels mid-fade.
- Both states share the outpost's pivot and blink phase, so only the change
  appears. No flash, scale, shake or sound.
- A path change plays on the first frame any of its anchors is on screen; its
  sprites fade in as one group over the channel unchanged.
- Reduced motion cuts to the after state on that first frame.

### Waiting lights, practice berth and route rack

These projects add passable decoration at existing destinations. Frame pairs
use their manifest dimensions and pivot. Apply each `offset` in world units
before projection. Frame A is the held frame under reduced motion.

| Project        | Physical reference                                               | Offset         | Manifest frame IDs               | Shop glyph                    | Finale craft        |
| -------------- | ---------------------------------------------------------------- | -------------- | -------------------------------- | ----------------------------- | ------------------- |
| Quiet crossing | Whirlpool `family` destination                                   | `[100, -78]`   | `whirlpool-quiet-crossing-{a,b}` | `icon-project-quiet-crossing` | `voronguide`        |
| Practice berth | Needle `needlePractice`, at the first point of the practice path | `[-106, 158]`  | `needle-practice-berth-{a,b}`    | `icon-project-practice-berth` | `avipracticeglider` |
| Route exchange | Andromeda's saved `andromeda.settlement` destination             | `[-110, -143]` | `andromeda-route-exchange-{a,b}` | `icon-project-route-exchange` | `courierrunner`     |

Quiet crossing belongs to `public/art/whirlpool/projects.json`. Practice berth
and Route exchange belong to `public/art/projects.json`. The Route exchange
catalog site is `pip` and the rack uses the saved settlement as its physical
reference. The finale craft live in Phantom's manifest and use its shared
story-craft jets sidecar.
