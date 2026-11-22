# Finale allies

The allies of the Phantom fleet battle and flagship fight
([Finale allies](../gameplay/ships.md#finale-allies)): twelve new craft, the
reused story craft and whales that draw the rest, Marlo's song and the ally
jump.

- Rebuild with `node art/tools/allies.ts`. It writes `public/art/phantom/`
  (the frames, `story-craft-jets.json` and `allies.json`), replaces its own
  `craft-` entries in [Phantom's manifest](../public/art/phantom/manifest.json)
  and registers their jet sidecars. It links `allies.json` as `allies`. Reruns
  are byte-identical.
- Round hulls (cylinders, balls, rings and pills) come from
  [art/tools/hull-shapes.ts](tools/hull-shapes.ts), shared with the story craft.
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  craft.
- Phantom is a dark field, `#514955`, with a white foreground edge
  (`#FFFFFF`, [Light fields](galaxies.md#light-fields)): every ally, new craft,
  reused story craft and whale alike, draws over its 1 px white keyline, 8.63:1
  on the field.

## Craft

Every new craft is a non-hostile story craft in the
[Cartwheel story craft](cartwheel.md#story-craft) contract:

- 16 headings in 22.5 degree world steps, as the [enemies](enemies.md): heading
  `k` faces world angle `k * 22.5` degrees and local forward is negative Y.
  Square transparent frames, a multiple of 16 px holding every heading with
  4 px padding, with the pivot at the centre. Render the selected frame with
  rotation zero. No blink and no thrust frames.
- Each SVG's intrinsic `width` and `height` are its display size
  (`frame * 0.4375`); its `viewBox` is the frame in frame px. The export keeps the approved
  two-decimal coordinates.
- Entries are `craft-{craft}-{k}` with `craft`, `directionIndex` `k`, `facing`
  `world-{k}` and pivot `(0.5, 0.5)`.
- No hit circle and no collision parts: drones never target allies, and Ada and
  shots pass through them.
- Groups draw far to near; a group resting on the hull or cab top draws after
  every group below that level.
- Built at 1.2 times the size of their approved mock-ups, times a per-craft
  factor that keeps each near Ada's 42 px ship: 1.25 for the crane and the
  student, 1.2 for the salvager and the trainee, 1.35 for the beacon tender,
  1.1 for the tug and 1.15 for Reed.
- No craft has wings, a tailplane or a tail fin, and no two of the new craft
  share an archetype; the trainee takes Pip's on purpose.
- None is coral, threat red or Ada's white and blue, and none carries pincers,
  a dark visor or General Gadget's insignia. Each takes its home galaxy's
  family: Sunflower's outposts, Whirlpool's whale tones and buoys, Needle's
  Weavers, Andromeda's settlers and Cartwheel's hub.

| Craft          | Ally                       | Frame | Display | Hull top  | On `#514955` | Shape                                                                                        |
| -------------- | -------------------------- | ----: | ------: | --------- | -----------: | -------------------------------------------------------------------------------------------- |
| `grower`       | Greenhouse ring            |    64 |      28 | `#9ccc5a` |       4.60:1 | Round leaf-green float under a stepped glass dome, bloom lamp, planter pods                  |
| `crane`        | Workshop crane             |    96 |      42 | `#f2d15a` |       5.77:1 | Open-frame gantry: square yellow frame, tall bridge with trolley, crate on a hook, cream cab |
| `salvager`     | Salvage beacons            |    96 |      42 | `#b8bfc9` |       4.66:1 | Pod cluster: olive, steel and rust tanks round a hex core, a magnet arm                      |
| `buoytender`   | Current-map buoys          |    96 |      42 | `#aaa5e6` |       3.79:1 | Submarine hull: lilac cigar, cream sail, two song buoys in deck cradles, a davit             |
| `student`      | Channel lights             |    80 |      35 | `#c4afcc` |       4.25:1 | Ring ship: lavender needle hull through a ring banded in rose thread                         |
| `loomship`     | Loom hall                  |    80 |      35 | `#e9e3da` |       6.76:1 | Twin pearl pontoons carrying a low, deep loom frame, warp threads and woven cloth            |
| `trainee`      | Courier school             |    80 |      35 | `#8d94c4` |       2.94:1 | Pip's pod scooter reversed: slate-blue cab pod, cream pannier pods, tandem pod               |
| `beacontender` | Spare beacon               |    96 |      42 | `#efe4cf` |       6.85:1 | Lander: cream descent stage on four legs carrying the upright spare beacon                   |
| `driller`      | Second docking bay         |    96 |      42 | `#9aaccb` |       3.75:1 | Drill mole: round slate body behind a stepped steel drill cone, cab, ore bin                 |
| `tug`          | Hub repairs                |    80 |      35 | `#b3a68a` |       3.59:1 | Drum tug: octagonal stone drum, curved push ring, four-bell engine bank                      |
| `barge`        | Clover's barge (Sunflower) |   112 |      49 | `#efe4cf` |       6.85:1 | Modular hauler: truss spine, three planter modules, bloom-roofed cab module                  |
| `reed`         | Reed's glider (Needle)     |    80 |      35 | `#b9cfae` |       5.18:1 | Dumbbell: sage command ball and engine ball on a spine, rose thread bands                    |

Contrast is WCAG against Phantom's `#514955`. The trainee's slate-blue hull,
the lowest at 2.94:1, reads by its white edge. The student's ring reads
apart from [Elder Loom's saucer](needle.md#elder-looms-saucer) and from Reed's
two sage balls; the courier trainee reverses Pip's cream and periwinkle and
adds a tandem pod.

### Speed jets and nose

`story-craft-jets.json` holds one complete record per craft name. Each record uses the
[enemy speed jets](enemies.md#speed-jets) schema (version 1, outer and core
layers, no halo, length `(6 + 24 f²) * sqrt(frame / 96)`) in the story craft's
civil palette: outer `#c9a978` to `#ffe9b8`, core `#efe4cf` to `#ffffff`. It
also carries `nose`, 16 entries from [art/tools/nose.ts](tools/nose.ts), as for
the story craft. Mouths sit at the engine faces; values are at the built size.

| Craft          | Mouths | Mouth width | Mouth (u, v, z), u forward                        |
| -------------- | -----: | ----------: | ------------------------------------------------- |
| `grower`       |      2 |         4.8 | `(-20.4, ±3.6, 5.7)`                              |
| `crane`        |      2 |         5.4 | `(-27.9, ±10.5, 7.5)`                             |
| `salvager`     |      2 |        5.18 | `(-22.32, ±10.8, 7.92)`                           |
| `buoytender`   |      2 |        4.32 | `(-27.84, ±2.64, 7.92)`                           |
| `student`      |      2 |         3.9 | `(-17.13, ±3, 7.5)`                               |
| `loomship`     |      2 |         3.6 | `(-24.6, ±13.8, 5.1)`                             |
| `trainee`      |      2 |        3.74 | `(-25.34, ±3.74, 7.78)`                           |
| `beacontender` |      2 |        5.18 | `(-18.47, ±5.51, 8.1)`                            |
| `driller`      |      2 |        4.32 | `(-22.32, ±4.32, 7.92)`                           |
| `tug`          |      4 |        4.49 | `(-20.33, ±3.96, 7.13)`, `(-20.33, ±11.88, 7.13)` |
| `barge`        |      2 |         4.8 | `(-36.6, ±4.8, 5.4)`                              |
| `reed`         |      2 |        3.31 | `(-24.29, ±3.31, 8.56)`                           |

## Roster

`allies.json` `roster` names the art for each ally: `craft` is a story craft
name, drawn from its `craft-{craft}-{k}` frames and the jets sidecar in
the manifest that lists them; `whale` is a [whale](whales.md) kind, drawn from
its `whale-{kind}-{k}-{f}` frames with its swim loop. The reused craft and
whales are shared art, so the core manifest lists them. `projects` is
keyed by Gameplay's project id and `quests` by galaxy id.

| Ally               | Key                | Art                                          |
| ------------------ | ------------------ | -------------------------------------------- |
| Project allies     | `projects.{id}`    | The new craft above; `nurseryBeacon` `adult` |
| Clover's barge     | `quests.sunflower` | `barge`                                      |
| Marlo              | `quests.whirlpool` | `whale`, the trapped whale                   |
| Reed's glider      | `quests.needle`    | `reed`                                       |
| Pip's courier ship | `quests.andromeda` | `pip`, Pip's mail scooter                    |
| Mica's mining ship | `quests.cartwheel` | `miner`, Cartwheel's miner                   |

The nursery whale is the family's smaller adult: its centre row of single and
paired spots tells it from Marlo when the two swim together.

## Formation

Placement is Gameplay's ([Finale allies](../gameplay/ships.md#finale-allies));
the art needs no formation data. Escorts share one ring round Ada at equal
angles, starting behind her and turning with her heading. The ring's radius
grows with the escort count: at least 60 world units beyond Ada's drawn ship,
and wide enough that neighbouring escorts' drawn ships stay at least 16 world
units apart. At most eight allies fly at once. Whales follow 150 world units
behind Ada, with 80 between their centres when both fly.

## Marlo's song

`allies.json` `song` holds the look of Marlo's song, in the whale glow `color`
`#cbb8ee` (4.78:1 on `#514955`). `quest` names the one ally that sings,
`quests.whirlpool`; the nursery whale and every other ally have no song.
`reach` holds Gameplay's reach in world units: `base` 300, and `nurseryBeacon`
450 while the nursery whale flies. Widths are logical px, scaled by `s`. Every
part is a vector Tech draws on the world plane, so circles project to
ellipses: a 300 unit reach is 849 by 424 logical px and a 450 unit reach 1273
by 636, both wider than the base view, so the rim shows where it crosses the
view.

| Part       | Rule                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field      | A filled world circle of the reach round Marlo's pivot at `field.alpha` 0.08, drawn at field level, above the specks and backdrop rocks and below every play object                                       |
| Rim        | The same circle's outline, `rim.width` 2 at `rim.alpha` 0.78, in the field's layer                                                                                                                        |
| Ripples    | `ripples.count` 2 outlines, `ripples.width` 2, evenly phased over `ripples.periodMs` 2400: at phase `p` the radius is `p` times the reach and the alpha `ripples.alpha` 0.3 times `1 - p`                 |
| Drone ring | Under each slowed drone, a world circle of its drawn reach plus `droneRing.margin` 4 world units round its pivot, `droneRing.width` 2 at `droneRing.alpha` 1, directly before the drone in its depth slot |

- A drone's drawn reach is the farthest point of its drawn silhouette
  ([Collision](enemies.md#collision)) on the world plane, the largest over its
  16 headings, so the ring keeps one size as the drone turns: about 10.8 for
  a swarm, 15.4 for an interceptor and 20.0 for a fighter.
- Reduced motion hides the ripples; the field, rim and drone rings hold
  steady. None of them blinks or pulses.
- On `#514955` the field tint `#5b5261` is 1.16:1, a tint rather than a signal.
  Over the tint, the rim `#b2a2cf` is 3.17:1, a ripple at its strongest
  `#7d718b` 1.63:1 and the drone ring `#cbb8ee` 4.12:1. Rendered at 1280x720
  and 720x360, the rim samples 3.22:1 and 3.18:1 and the drone ring 4.18:1.
- The drone ring stays in the song's glow, apart from the white foreground
  edge on the drone inside it.

## Ally jump

Allies jump in and out with the [quantum jump](quantum-jump.md)'s parts at
ally scale, centred on the ally's pivot, with no tunnel, field, streaks or turn.
`allies.json` `jump` lists the steps; each holds for its `ms`, and nothing tweens
between steps.

- Glow: the `quantum-jump-glow` frame a step names, 112 logical px times the
  ally's display size over `glowReference` 42 (Ada's), centred under the ally.
- Out, 230 ms: three 50 ms steps over glow `full`, then one 80 ms bright step:
  the ally stretched `stretch` 3.2 times along its heading about its pivot, a
  white silhouette of it at `white` 0.7, and `quantum-jump-star` at 37 logical
  px over it. The ally is gone after the last step.
- In, 300 ms: six 50 ms steps. Each draws the ally at `scale` (1.2, 1.1, 1.05,
  then 1) over its glow (`mid`, `mid`, `low`, `low`, then none) and the iris
  round it at `iris` times its display size (0.5 to 1.75): the
  `quantum-jump.json` `iris` rim, 3 px `#dcc3f2` from that radius outward, and
  its 1 px `#8fe0f2` line at that radius plus 5. The ally then shows as usual.
- In a rotation, an arriving ally starts its first step when the leaving
  ally's last step ends, 230 ms after the wave starts.
- Allies leaving together share one bright step, so a rotation adds one flash
  ([Flashing](quantum-jump.md#flashing)). On `#514955` the iris rim is 5.39:1
  and its line 5.80:1.
- Reduced motion: no glow, stretch, whitening, star or iris. A leaving ally
  fades out linearly over `reducedMotion.fadeMs` 200 and an arriving one fades
  in over the same 200, at its usual size.
