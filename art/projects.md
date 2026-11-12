# Community projects

The shop's Projects tab, the donation confirm, and the world change each funded
project shows at its outpost. Gameplay owns the projects, prices, order, the
donation rule and the strings ([Donations](../gameplay/economy.md)); keys below
are Gameplay's player string keys, and keys marked placeholder await Gameplay
strings. Project ids are Gameplay's (`greenhouseRing`, `workshopCrane`,
`salvageBeacons`, `dockingBay`, `hubRepairs`, `nurseryBeacon`, `currentBuoys`).

## Projects tab

The third shop tab, after Weapons and Ship ([Shop](shop.md#shop)), shown once
the galaxy's projects are offered. It lists that galaxy's projects as one row
group in Gameplay's order. Rows use the shop item row's parts, geometry and
shared width ([Layout](layout.md#shop-item-row)), so the card keeps its width on
every tab.

### Project row

| Part          | Art                                                                                    |
| ------------- | -------------------------------------------------------------------------------------- |
| Well and icon | The 36 item well with the project's 20x20 `icon-project-*` glyph at 8                  |
| Name          | The project name, cream                                                                |
| Second line   | Supporting text: the effect line, or `projectProgress` ("{paid} of {price}") once paid |
| Price pill    | The item row's pill with what remains: `price - paid`                                  |
| Funded        | `icon-shop-check` and `projectFunded` ("Funded") in supporting text, like Owned        |

Row states:

- **Available**: nothing paid and Ada can donate. The second line is the effect
  line; the pill shows the full price. Activating opens the donation confirm.
- **Part-paid**: some paid. The second line is `projectProgress`; the pill shows
  what remains. Activating opens the donation confirm.
- **Unaffordable**: Gameplay's donation rule refuses at the current balance.
  The unaffordable shop row: the tile's disabled frame, well `#2f2d3d`, glyph
  frame 1 (`#9a96ad`), name, second line and price in `#9a96ad`. It stays
  focusable; activation plays the [refusal cue](controls.md#refusal-cue) on the
  name and price.
- **Funded**: the check and Funded, the effect line on the second line.
  Activation does nothing.

Focus and contrast are the item row's ([Shop](shop.md#item-row)).

Effect lines, placeholder strings:

| Project          | Key (placeholder)           | Text (placeholder)      |
| ---------------- | --------------------------- | ----------------------- |
| `greenhouseRing` | `projectEffectGreenhouse`   | Domes for more crops    |
| `workshopCrane`  | `projectEffectCrane`        | A crane for heavy lifts |
| `salvageBeacons` | `projectEffectBeacons`      | Lights the scrap lanes  |
| `dockingBay`     | `projectEffectDockingBay`   | No miner waits alone    |
| `hubRepairs`     | `projectEffectHubRepairs`   | Fixes the station's hub |
| `nurseryBeacon`  | `projectEffectNursery`      | Guides whale calves     |
| `currentBuoys`   | `projectEffectCurrentBuoys` | Marks the currents      |

## Donation confirm

The [buy confirm](shop.md#buy-confirm) pattern, over the dimmed shop. The close
X, an outside tap, back, Escape and Cancel all cancel. Gameplay's current rule
pays each Donate press without a confirm; the confirm applies once Gameplay
adopts it.

1. Header: `donateTitle` (placeholder, "Donate to {name}?").
2. Item well: the confirm well with the project glyph at 2x.
3. The project's description (placeholder, `projectAbout<Project>`; for example
   "A ring of greenhouse domes around the growers."), body text, centred.
4. Price: `icon-stardust-20` and the amount this donation pays, in cream.
5. `confirmLeft` ("{amount} left after"), supporting text.
6. When the donation leaves part unpaid: `donateStillNeeded` (placeholder,
   "{amount} still needed after"), supporting text, below `confirmLeft`.
7. Action group: Cancel (`confirmCancel`, secondary) left, Donate (`donate`,
   primary) right.

After Donate the confirm closes and focus returns to the row in its new state.
Funding the last part follows Gameplay: the card closes and the thank-you line
plays.

## World changes

`node art/tools/outposts.ts` writes Sunflower's world changes with the
[outposts](outposts.md), and `public/art/projects.json` places them, keyed by
project id. Cartwheel's are [hub frames](cartwheel.md#world-changes) and
Whirlpool's are in [whirlpool.md](whirlpool.md#project-world-changes), placed by
`public/art/whirlpool/projects.json`. A project absent from `projects.json` has no world art yet, so
funding it changes nothing in the world.

A change is one of two kinds:

- **Replacement frames** when the change wraps around the outpost, so its parts
  sort in depth among the outpost's own: the greenhouse ring passes behind and
  in front of the planters. The pair replaces the outpost's pair at the same
  world point.
- **Overlay** when every part sits wholly beside or above the outpost, so
  drawing it after (or before) the unchanged outpost gives the same pixels as
  one depth sort of both: the workshop crane and the salvage beacons. Overlays
  keep the outpost's frames unchanged and reuse one small sprite.

Both kinds use the outpost schema ([Frames and manifest](outposts.md#frames-and-manifest))
with `outpost`, the role they attach to, and `project`. Replacement frames carry
the dock; overlays carry none. The base `outpost-<role>-a` and `-b` entries are
unchanged.

### projects.json

- `reveal`: `durationMs` 600, `easing` `cubicOut` (see [Reveal](#reveal)).
- `projects.<id>.outpost`: the outpost role and destination id.
- `kind` `replace`: `frames` (A, B) replace `replaces` (A, B).
- `kind` `overlay`: `frames` (A, B) and `anchors`. Each anchor places one copy
  of the sprite with its pivot at the outpost's pivot plus (`x`, `y`) frame px;
  scale by the display size like the dock (`* 0.4375` to display px), then
  convert screen to world as for the dock. `layer` `behind` draws before the
  outpost, `front` after it, all in the outpost's depth slot. `phase` 0 shows
  frame A while the outpost shows A; `phase` 1 shows the other frame.

### Greenhouse ring

`greenhouseRing` at the growers: replacement frames.

| Ids                                                | Frame px | Display        | Pivot         | Dock `(x, y)`   | Dock width |
| -------------------------------------------------- | -------- | -------------- | ------------- | --------------- | ---------- |
| `outpost-growers-ring-a`, `outpost-growers-ring-b` | 180, 140 | 78.75 by 61.25 | `(0.5, 0.45)` | `(90, 106.841)` | 31.843     |

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

| Ids                                                    | Frame px | Display      | Pivot           | Anchor `(x, y)` | Layer   | Phase |
| ------------------------------------------------------ | -------- | ------------ | --------------- | --------------- | ------- | ----- |
| `outpost-workshop-crane-a`, `outpost-workshop-crane-b` | 134, 80  | 58.625 by 35 | `(0.5, 0.7625)` | `(0, 0)`        | `front` | 0     |

- A yellow `#f2d15a` gantry (sides `#b99a36`, dark `#8c7428`) straddling the
  hall 6 units behind its centre: two legs 44 tall beside the hall's ends and a
  bridge over the roof, with a trolley, a hook line and a cream hook block. It
  reads apart from the two jib cranes by its span and its legs.
- A warm beacon on the bridge, `#ffe9b8` in A and `#8c7428` in B, with the sign
  band.

### Salvage beacons

`salvageBeacons` at the salvagers: one beacon sprite at three anchors.

| Ids                                                        | Frame px | Display      | Pivot          |
| ---------------------------------------------------------- | -------- | ------------ | -------------- |
| `outpost-salvagers-beacon-a`, `outpost-salvagers-beacon-b` | 20, 40   | 8.75 by 17.5 | `(0.5, 0.625)` |

| Anchor | Plan (degrees, r) | `(x, y)` frame px   | Layer    | Phase |
| ------ | ----------------- | ------------------- | -------- | ----- |
| 1      | 200, 70           | `(-36.232, -44.86)` | `behind` | 0     |
| 2      | 125, 66           | `(-79.605, 8.104)`  | `front`  | 1     |
| 3      | 0, 64             | `(55.426, 32)`      | `front`  | 0     |

- A slate float `#8d9bb0`, a dark mast and a periwinkle lamp, `#8f9cf0` lit and
  `#4a5080` dim; the pivot is the float's centre on the world plane.
- The anchors sit in clear space: behind the back scrap stack, left of the front
  stack and right of the dock, away from the magnet. Neighbours blink opposite.

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
- Reduced motion cuts to the after state on that first frame.
