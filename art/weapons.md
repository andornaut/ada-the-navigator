# Weapons

Projectiles, missile blasts, the Multi-Laser fan, the Phaser beam, the
[enemy shots](#enemy-shots), the enemy Phaser, the
[enemy-only weapons](#enemy-only-weapons) and the upgrade pickup. Tech draws
every effect in code (Phaser Graphics) except the missiles and the mine, which
are [solid-model frames](#missile-and-mine-frames); the pickup's only image is
its chevron mask. The HUD and shop glyphs are in [weapon icons](weapon-icons.md) and [shop icons](shop-icons.md).

## Gameplay values

Gameplay owns these values; they appear here because the effects are sized and
timed against them. `src/data/weaponCatalog.ts` holds the current tuning.

| Weapon        | Interval         | Speed (wu/s) | Damage by level      | Effect                               |
| ------------- | ---------------- | ------------ | -------------------- | ------------------------------------ |
| Laser         | 0.30/0.25/0.20 s | 500/600/700  | 1/1.25/1.5           | Bolt                                 |
| Rapid Missile | 0.30/0.25/0.20 s | 500/600/700  | 1.5/1.5/1.5          | Missile, blast R 30                  |
| Heavy Missile | 2 s              | 400          | 5/6/7                | Missile, blast R 60                  |
| Multi-Laser   | 0.40 s           | 400/500/600  | 0.7 per bolt         | Fan of 3/4/5 bolts across ±8 degrees |
| Scattershot   | 1 s              | 600          | 0.8/1/1.2 per pellet | Fan of 7/9/11 pellets                |
| Phaser        | 1 s              | n/a          | 4/6/8                | Instant beam, fire-time coverage     |

Levels 2 and 3 change only these: Laser interval, bolt speed and damage; Rapid
Missile interval and missile speed; Heavy Missile and Phaser damage;
Multi-Laser bolt count and bolt speed; Scattershot pellet count and damage.
Blast radii and ranges are the same at every level: blast R 30 (Rapid) and 60
(Heavy); range 220 wu for missiles, 370 wu for Laser and Multi-Laser bolts, 100
wu for Scattershot and 370 wu for the Phaser (Ada's beam reaches her fire-time
coverage). The effects' strokes and timings do not change by level.

## Conventions

- Units are logical screen px at the base view, except where marked world units
  (wu). Tech's projection is `P(x, y) = (x - y, (x + y) / 2)`.
- Each shot is a screen-space vector shape rotated to its projected heading:
  `angle = atan2(P(vel).y, P(vel).x)` for world velocity `vel`. No direction frames.
- `u` runs forward along that angle from the head point (the projectile's
  projected position), `v` sideways. Shapes are symmetric in `v`.
- Missile bodies keep a fixed screen size. Trail lengths follow the projection:
  a length given "at heading 14" is multiplied by the heading factor
  `f = |P(d)| / sqrt 2` for the unit world direction of travel `d`. Heading 14
  (screen right) projects longest, so `f` is 1 there and 0.5 at headings 2
  and 10.

| Heading | 14, 6 | 13, 15, 5, 7 | 12, 0, 4, 8 | 11, 1, 3, 9 | 10, 2 |
| ------- | ----- | ------------ | ----------- | ----------- | ----- |
| `f`     | 1.000 | 0.943        | 0.791       | 0.600       | 0.500 |

- Every effect is solid shapes in opaque flat tones with hard edges: tapers are
  geometry and fades hold steps, with no alpha ramps, hairlines or blurred
  discs.
- Held fade: a fade whose linear value `x` runs from 1 to 0 draws at alpha 1
  while `x` is over 0.6, 0.6 while it is over 0.3, then 0.3. Every linear fade,
  Ada's and the enemies', uses it: beams, ripples, contact rings, the mine
  fizzle and the Scattershot range fade.
- Colours: amber `#f0bd68` (space palette `weapon`), cream `#ead4aa`, white
  `#ffffff`, ink `#181425`.
- Every player shot, bolt, missile and beam starts at the same origin, the
  ship's nose point for its heading.

## Hit animation families

Contacts carry explicit firing-weapon provenance, their actual world contact point and
elapsed age. Directional contacts retain the incoming world vector; missile effects use
that event's actual world blast radius. The current loadout, damage and radius do not
select a family. Rendering projects the contact and direction once.

| Source weapon                | Family          | Contact appearance                                         |
| ---------------------------- | --------------- | ---------------------------------------------------------- |
| Rapid Missile, Heavy Missile | `missile`       | One explosion recipe, scaled to the actual blast radius    |
| Laser, Multi-Laser           | `compact`       | The same compact flash, rays and flecks                    |
| Phaser                       | `compactBright` | The compact grammar, brighter and longer                   |
| Scattershot                  | `pellet`        | A tiny, short-lived spark per actual pellet contact        |
| Charged lance                | `lance`         | Concentrated flash and streak along the incoming direction |
| Ring burst                   | `ripple`        | One amber ground-plane ripple                              |
| Mine                         | `shockwave`     | An amber ground-plane ring over a cream ellipse            |

`impactEffect`, `IMPACT_STYLE` and the shared spark/blast constants in
[`weaponEffects.ts`](../src/game/weaponEffects.ts) are the canonical presentation
coefficients. The existing renderer consumes their `EffectShape` records and light-field
edges. The ripple and every enemy fade take their values from
[enemy-weapons.json](../public/art/enemy-weapons.json); there is no duplicated weapon
tuning.

Enemy Lance hooks use the actual drawn beam endpoint and its incoming vector;
enemy Phaser hooks use the fire-time contact point and incoming vector. Their existing hit-window age is normalized into the shared effect phase; the
mine pop uses its existing normal or reduced-motion duration. Firing tells, damage,
collision, arming, radius and expiry remain unchanged. Reduced motion removes expansion
and moving sparks while retaining the family silhouette and fade; the Mine keeps its ring
and cream ellipse, and the ellipse takes no field edge.

An impact is separate from [ship destruction](destruction.md). The destruction flash,
shards and pickup release use the same recipe regardless of the killing weapon; a
missile does not suppress the wreck's own flash.

## Bolt, pellet and fan

- Laser bolt: a 2.55 px amber slug 8.4 px long with a pointed head, a cream
  core and one amber tail step 1.275 px wide from 8.4 to 16.2 px behind the
  head. Slug `(0, 0) (-1.62, -1.275) (-8.4, -1.275) (-9.3, 0) (-8.4, 1.275)
(-1.62, 1.275)`; core `(-0.9, 0) (-1.98, -0.675) (-5.208, -0.675)
(-5.208, 0.675) (-1.98, 0.675)`, 1.35 px wide so it stays visible.
- Scattershot pellet: an amber disc of radius 1.7 with a cream disc of radius
  0.7 centred 0.45 px up and left of it. Past its fade point it fades by the
  [held fade](#conventions).
- Multi-Laser: 3, 4 and 5 bolts at levels 1 to 3, across 16 degrees at
  `-8 + 16 i / (n - 1)` degrees. Offsets apply in the projected aim plane, then
  each bolt's screen direction unprojects to its world velocity, so screen
  length and speed vary per bolt. All bolts leave the nose together.
- Multi-Laser near: while two or more bolts fly, every head is more than 4 px
  from the nose on screen and each pair of neighbouring heads, ordered across
  the fan, is under 5.6 px apart on screen: one amber band through the heads
  over a cream inner band.
- Multi-Laser far: otherwise each bolt is the slug scaled to 1.87 px wide with
  its shoulder 6 px behind the head, with no core and no tail, so bolts never
  overlap.

The fan band runs through the bolts' heads on screen. For each head at screen
distance `h` from the nose, the amber band runs from the head back toward the
nose to `max(4, h - 6.6)`, and its edges at the first and last heads move
0.935 px outward sideways (half a far slug). The cream band runs from `h - 1.5`
back to the amber's inner edge plus 2.4, its ends on the outer bolts'
centrelines, and draws only while it has depth at every head. Each edge is a
polyline through one point per head. The amber band's outer edge lies on the
heads, so the far slugs replace it in place. The 16 degree spread is the same on
screen at every heading, but screen speed varies with heading, so at one travel
the outer heads' screen distances differ by up to 23 percent and a sector of one
radius cannot match them. With Ada at rest, the band gives way to far slugs once
the farthest head is 34 to 40 px from the nose with 3 bolts and 66 to 80 px with
5, by heading.

## Missiles

Both missiles are small [solid models](#missile-and-mine-frames) with tops
lightest, walls facing left mid and walls facing right darkest, drawn at their
projected heading over a flat two-tone flame. Lengths are logical px along the
heading from the nose.

| Part          | Model                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Rapid body    | A round body of radius 1.5 from 7 to 2.2 behind the nose, a cone to a 0.2 tip 0.6 ahead, a dark rear cap                              |
| Rapid fins    | Three fin blocks 1 px thick, two level and one upright: roots 7.4 to 4.4 behind the nose, swept to 7.8 to 7, reaching 3.2 (3 upright) |
| Rapid flame   | A wedge 2.6 px wide at the tail, 12 `f` px long (15 `f` in frame 1), with an inner wedge half as wide and half as long                |
| Heavy body    | A round body of radius 2.9 from 13.2 to 4.2 behind the nose, a dark rear cap                                                          |
| Heavy warhead | A cone from radius 2.9 at 4.2 behind the nose to a 0.3 tip 1 ahead                                                                    |
| Heavy fins    | Three fin blocks 1.4 px thick: roots 13.2 to 8.6 behind the nose, swept to 14.4 to 12.6, reaching 6 (5.4 upright)                     |
| Heavy flame   | A wedge 5.6 px wide, 16.8 `f` px long (11.8 `f` in frame 1), with an inner wedge half as wide and half as long                        |

| Part             | Ada's | Enemy's          |
| ---------------- | ----- | ---------------- |
| Bodies and cones | White | Coral            |
| Rapid fins       | Amber | White            |
| Heavy warhead    | Amber | White            |
| Heavy fins       | Cream | Plate            |
| Flame            | Amber | Coral `obstacle` |
| Inner flame      | Cream | `plate`          |

Material tones, top, left and right: white `#ffffff`, `#cfd3e0`, `#9da2b8`;
cream `#ead4aa`, `#c2ad86`, `#978565`; amber `#f0bd68`, `#b98a40`,
`#8a6630`; coral `#d68b72`, `#a8654f`, `#7f4b3d`; plate `#e6a890`,
`#b98774`, `#8f6859`; dark `#2a2433`, `#1e1a26`, `#16131c`.

Flicker: two frames looping, 50 ms each for the Rapid and 90 ms for the Heavy.
Reduced motion holds frame 0. On a light field or Phantom the frame takes the
field keyline; the flame does not.

## Missile blasts

Rapid and Heavy contacts, Ada's and enemies', use one recipe through
`impactEffect`; only the actual event radius changes it. Every blast draws as
an on-screen circle of radius `R` (30 Rapid, 60 Heavy), centred on the actual
contact or the projectile position at range expiry. Hits test the drawn ship
shapes against that same circle. Screen-space strokes do not scale with `R`.
Its radius is `r = R (1 - (1 - g)^3)` for `g = min(1, t / 180)`, ending at
340 ms.

- Ring: an amber ring `4 - 2 t / 340` px wide at alpha 1 to 180 ms, 0.66 to
  260 ms, then 0.33, with a 1.2 px cream line inside it once `r` passes 6.
- Debris: eight cream wedges at 22.5 degrees and every 45 after, from `r + 3.5`
  to `r + 10`, 3.2 px wide at the base, at alpha 1 to 108 ms, 0.6 to 220 ms,
  then none.
- Flash: an eight-point amber burst of radius `0.425 R` with a 0.62 waist, a
  cream one 0.66 of it turned 22.5 degrees and a white core 0.3 of it, to
  30 ms; 0.55 of that size to 60 ms.
- Light field: the ring and the flash's amber burst take the field edge.
- Reduced motion: a 3 px amber ring at `R` with the ring's alpha steps, to
  300 ms, without flash, growth or debris.

Each detonation has one impact effect. A destroyed ship still plays its own
independent destruction.

## Phaser beam

The full collision width is 12 world units (half-width 6). Impact sparks use
the contact edge; whole-object destruction effects remain at the object pivot.

A hitscan flash runs from the nose to the first drawn contact edge. A miss
reaches Ada's fire-time rounded coverage boundary: half-width 380 and
half-height 260 at the 720 x 360 base view, scaled with the actual game area.
The shape and the player's centre are captured when firing. Levels change
neither this envelope nor the one-second fire interval.

The drawn beam stays attached to the firing ship's nose and turns with its aim
for the whole flash, at the length `L` fixed when firing. Coverage and the hit
are fire-time: turning after firing never extends, shortens or retargets the
beam.

Keyframes for width factor `w` and keyed alpha `a`, linear between keys: 0 ms
`w` 0.55 `a` 0.85; 20 ms `w` 1 `a` 1; 70 ms `w` 1 `a` 1; 150 ms `w` 0.4 `a` 0.
The flash ends at 150 ms, Tech's `BEAM.flashSeconds`.

- Bands: three opaque bands along `u` from 0 (nose) to `L`, butt ends, each
  width running linearly from the nose value to the end value over the whole
  beam: amber 8 to 5, cream 4.6 to 2.8, white 2.2 to 1.3, each times `w`.
- Alpha: one alpha for all bands and bloom, `a` by the
  [held fade](#conventions).
- Miss end: each band tapers to a point over the last 28 px; a hit ends hard at
  the contact.
- Muzzle bloom: opaque discs of radius `5 w`, `3.1 w` and `1.6 w` in the three
  band colours.
- Light field and Phantom: the amber band and the amber bloom disc draw over
  their silhouettes grown by 1 px in ink (`phaser.edge` in
  [Light fields](galaxies.md#light-fields)); the inner bands and discs take
  none.
- Reduced motion: the beam's own bands at `w` 1 without bloom, alpha 1 to 90 ms,
  then the held fade of `1 - (t - 90) / 60`, with the same 1 px field edge. A
  miss keeps the 28 px end taper.

### Hit spark

A Phaser contact uses `compactBright`, the Laser and Multi-Laser contact
`compact`: the same shapes, brighter and longer for the Phaser. A miss has no
contact effect. The spark stays at the fire-time contact point, aligned with
the beam's fire-time direction, while the beam turns with the nose. With
`p` its age over its life:

- Rays: six wedges at 30 degrees and every 60 after about the incoming axis,
  from `1.5 + 5 k` to `8.5 + 3 k` times the scale for `k = p / 0.6`, 2.6 wide
  at the base, white to `p` 0.25 then cream, at alpha 1 to `k` 0.5 then 0.6,
  to `p` 0.6.
- Core: a white disc of radius `3 (1 - p / 0.35) + 0.5` times the scale, to
  `p` 0.35.
- Flecks: three amber diamonds 3 px across at 60, 180 and 300 degrees,
  `6 + 5 (1 - (1 - m)^2)` out for `m = (p - 0.2) / 0.8`, at alpha 1 to `m` 0.5
  then 0.5, from `p` 0.2.
- Reduced motion: one still cream ring of radius 3 and width 2 as drawn, at the
  held fade of `1 - p`; the lance contact uses the same ring.

The Phaser's own contact ring (`phaserRings`): one cream ring of radius
`3 + 13 (1 - (1 - k)^2)` and width `3 - 1.6 k` for `k = age / 160`, at alpha 1
to `k` 0.5, 0.6 to 0.78, then 0.3, with a four-point amber burst `5.5 (1 - k)`
with a 0.3 waist and a white core `2.2 (1 - k)` while `k` is under 0.45. A
four-point burst has its notches at 0.3 of its point radius, as the
[quantum jump](quantum-jump.md) star does.

## Enemy shots

Every enemy shot is coral, the palette's `obstacle`, in every galaxy, so an
enemy's shot never takes its fleet family's colour. The shapes and colours are
in [enemy-weapons.json](../public/art/enemy-weapons.json); the
[enemy-only conventions](#enemy-only-conventions) apply, and each shape turns
to its projected heading as Ada's shots do.

- Bolt (`bolt`): the ring dart's construction stretched to a bolt, matched to
  Ada's bolt in length and width, its head at the shot's point. Body
  `(0, 0) (-2.16, -1.785) (-7.2, 0) (-2.16, 1.785)` in `obstacle`, core
  `(-0.72, 0) (-2.16, -0.95) (-4.2, 0) (-2.16, 0.95)` in white, over a
  `coralSide` tail wedge `(-4.8, -0.935) (-12, 0) (-4.8, 0.935)`. The body and core
  take the field edge; the tail does not.
- Multi-Laser (`fan`): the volley follows Ada's [fan](#bolt-pellet-and-fan)
  rules. Near the nose it draws her band through the heads in `obstacle` with a
  white inner band, its ends widened 1.105 px (half a far dart), and both
  bands' trailing edges brought 1.8 px forward at the middle head, falling to 0
  at the outer heads, so the wedge reads as a chevron while its leading edge
  stays on the heads. Far, each bolt is a coral dart
  `(0, 0) (-1.8, -1.105) (-6, 0) (-1.8, 1.105)`. Every part takes the field
  edge.
- Scattershot pellet (`pellet`): a coral diamond
  `(2.4, 0) (0, -1.9) (-2.4, 0) (0, 1.9)` with a white core
  `(1.2, 0) (0.2, -0.8) (-0.8, 0) (0.2, 0.8)`, turned to its heading. Both take
  the field edge. Past its fade point it fades by the held fade.
- Missiles (`missiles`): the enemy Rapid and Heavy frames (`enemyRapidMissile`,
  `enemyHeavyMissile`) over a coral flame with a `plate` inner wedge, in
  [Ada's missiles'](#missiles) geometry, flicker and keyline.
- Ripple (`ripple`), the ring-burst contact: an amber (`weapon`) ground-plane
  ellipse of radius `R (0.2 + 0.8 p)` over its 160 ms for the contact's radius
  `R` (12 unless the event gives one), stroke `2.2 - p` px, at the held fade of
  `1 - p`, with the field edge. Reduced motion holds it at `R` with a 2 px
  stroke.
- Fades (`fade`): the [held fade](#conventions) as data, `steps` of threshold
  and alpha with `last` below the last threshold.

## Enemy Phaser

A capital's Phaser shows a fixed aim line for 0.4 s, then fires the hitscan beam
along it. The values are in `phaser` in
[enemy-weapons.json](../public/art/enemy-weapons.json); the
[enemy-only conventions](#enemy-only-conventions) apply.

Aim line, from the turret's muzzle to the beam's reach (`|P(d x range)|` px, as
for Ada's beam) or to the first obstacle on it. It stays where it started.

| Time       | Line                                                |
| ---------- | --------------------------------------------------- |
| 0-300 ms   | 1.5 px coral (`obstacle`), dashes 6 on 4 off, still |
| 300-400 ms | 1.5 px solid pale coral (`plate`)                   |

- Chevron: `(L + 3, 0) (L - 1, -3) (L - 1, 3)` at the aim's end `L`, in the
  line's colour (`chevron`, `u` from the end).
- Charge: a coral disc at the muzzle, radius 1 to 2.5 over the 400 ms, with a
  white core of radius 0.5 to 1.1.

Beam: Ada's [Phaser beam](#phaser-beam) geometry, keys (150 ms), held alpha,
miss taper, field edge and reduced-motion rule. The beam stays attached to the turret's muzzle and turns with
its aim for the flash, at its fire-time length; the aim line before it stays
where it started.

- Bands (`layers`): coral 8 to 5, plate 4.6 to 2.8, white 2.2 to 1.3, each
  times `w`.
- Muzzle bloom (`bloom`): opaque discs of radius `5 w` coral, `3.1 w` plate and
  `1.6 w` white.
- A hit uses the shared `compactBright` contact at the fire-time contact
  point.
- Light field and Phantom: the coral band and the coral bloom disc draw over
  their silhouettes grown by 1 px in ink; the inner bands and discs take none. The aim line follows the
  [edged line](#enemy-only-conventions) rule.
- Reduced motion (`reducedMotion`): the aim line is unchanged. The beam is its
  own bands at `w` 1 without bloom, alpha 1 to 90 ms (`holdMs`), then the held
  fade of `1 - (t - 90) / 60`, with the same 1 px field edge. A miss keeps the
  28 px end taper. The contact uses the shared reduced-motion ring.

## Enemy-only weapons

The ring burst, mine and charged lance that only enemies carry. Gameplay owns
their damage, intervals, speeds, counts and lifetimes
([Ships](../gameplay/ships.md)).

- Rebuild with `node art/tools/enemy-weapons.ts`. It writes
  [enemy-weapons.json](../public/art/enemy-weapons.json), formatted with the
  project's Prettier settings, and links it from the core manifest as
  `enemyWeapons`. Reruns are byte-identical. The build fails if the ink edge
  falls below 5:1 on a light galaxy's background (Phantom's dark field takes
  the same ink with no floor), or if the mine's collision parts leave any pixel
  of a frame uncovered,
  trace the union of its frames with an IoU below 0.98 or stray more than
  0.5 px from its edge.

### Enemy-only conventions

- Colours by key in `colours`: `obstacle` coral `#D68B72` and `weapon` amber
  `#F0BD68` (space palette), `coralSide` `#A8654F` and `plate` pale coral
  `#E6A890` (the [coral family](enemies.md#family-style)), white and ink
  `#181425`. Coral marks every enemy shot, so the enemy beams are coral where
  Ada's are amber and cream.
- Every shape that has to be seen draws at alpha 1 in `obstacle`, `plate`,
  `weapon` or white, over the ink edge. Fades hold steps, and a
  fill inside an edged stroke, such as the shockwave's cream ellipse, carries
  nothing.
- Widths and radii are logical px scaled by `s`; the `u`, `v` heading frame and
  `f` are those of [Conventions](#conventions).
- Tells, lines and beams draw in the effect layer with the Phaser beam. They
  start at the firing turret's muzzle and stop at the first obstacle, like the
  beams.
- Contact effects use the shared [hit families](#hit-animation-families):
  `compactBright` for Phaser and `lance` for the lance. Their warm contact
  colours do not recolour the coral beam body or its tell.
- Light field and Phantom (`lightField.edge` px): a stroke draws over an edge
  stroke 2 px wider on the same path. A solid line's edge runs 1 px past each
  end. A dashed line's edge dashes are 8 on 2 off, offset 1 px earlier, so each
  coral dash has 1 px of edge at both ends. A filled shape draws over its
  silhouette grown by 1 px. Every edge takes its shape's alpha.

### Ring burst

`ringBurst`. At firing, for 180 ms, the bolts' spawn circle (Gameplay's spawn
radius around the hull centre) draws as a ground-plane ellipse, half-width
`r x 1.414` and half-height `r x 0.707`, stroked coral 2 px at alpha 1 to
90 ms, then 0.5 to 180 ms (`emission.alpha`, each alpha held to its step's end).
For 120 ms a coral disc at each bolt's origin shrinks from radius 3.6 to 0.6,
with a white core from 2.0 toward 0.4 drawn to 60 ms.

Each bolt is a ring dart of fixed size, rotated to its projected heading: a
`coralSide` tail wedge `(-3.2, -1) (-10, 0) (-3.2, 1)`, a coral body
`(2.6, 0) (-0.6, -2.3) (-3.8, 0) (-0.6, 2.3)` and a white core
`(1, 0) (-0.6, -1) (-2.2, 0) (-0.6, 1)`.

Light field: the body takes the field edge; the tail does not. The emission
ring and muzzle discs take edges. Reduced motion: no muzzle discs; the emission
ring is unchanged.

### Mine

`mine`. One solid model, drawn at its projected centre from the
[mine frames](#missile-and-mine-frames) and sorted with the play objects by
that centre's screen y: a coral ball of radii 4.7 by 4.7 by 4.5, a dark belt
of radius 5 and height 2.2, four coral studs from 4.6 to 7.4 out tapering from
radius 1.9 to 1, a dark collar of radius 2.3 from 4.2 to 5 up and an amber lamp
dome of radius 1.6. Its coral tones are `#d68b72`, `#a8654f` and `#7f4b3d`.

The mine spins at 60 degrees a second (`spin.degPerSecond`), so its spin angle
is `th = 60 x age` for its age in seconds since the drop, and it shows frame
`floor(th / 11.25) mod 8` (`spin.stepDeg`). A blink shows the same step from
the blink set, its lamp white `#ffffff` with a `#e8e8f0` shade.

| Remaining life | Blink period | White for |
| -------------- | ------------ | --------- |
| Over 4 s       | 1000 ms      | 120 ms    |
| 1.5 to 4 s     | 500 ms       | 100 ms    |
| Under 1.5 s    | 250 ms       | 80 ms     |

The blink phase counts from the drop.

Vanish hint: over the last 4 s a 1.2 px coral arc of radius 11 runs clockwise
from 12 o'clock through `360 x remaining / 4 s` degrees, so it shortens to
nothing as the mine vanishes.

Vanish: a 200 ms fizzle that deals no damage. With `p = t / 200` the mine's
frame scales by `1 - p^2` about its centre on its blink lamp, and four coral
flecks of radius 1 at 45, 135, 225 and 315 degrees sit at distance `5 + 6 p`,
their y times 0.75, at the held fade of `1 - p`.

Pop, when a shot destroys the mine or it touches Ada, uses the shared
`shockwave` family, normalised over the pop's 220 ms: an amber ground-plane
ring `2.4 - 1.2 p` px wide at alpha 1 to `p` 0.5, 0.6 to 0.78, then 0.3, with
a cream ellipse 0.55 of its size at alpha 1 to `p` 0.3 then 0.6, to `p` 0.6.
This is presentation only, not a new blast or damage radius. Ring burst
contacts remain one clean ripple.

Collision: contact is the drawn mine against Ada's drawn ship, and it covers
the full stud sweep. `collision` holds the union of the eight
[mine frames](#missile-and-mine-frames) as 36 convex `[x, y]` parts in
logical px around the mine's centre: the screen outlines of the ball, the belt,
the collar and the lamp, and of the four studs at each of the eight spin steps.
The parts overlap; their union is the same at every spin, so it holds still
while the frames turn. The light field's keyline is not part of it, and a
fizzling mine has none. Every pixel a frame draws lies in the parts, and against
the union of the frames they have an IoU of 0.9999 and lie within 0.004 px of
its edge.

Light field and Phantom: the frame takes the field keyline; the hint arc,
fizzle flecks and the pop's ring take edges. The pop's cream ellipse takes
none (`pop.edged`): an edge on it would merge with the ring's edge across its
narrow axis while the pop is small and band the pop in stripes on Phantom.

Reduced motion: `th` stays 0 with no blink; the hint arc is unchanged. The
fizzle is the still frame at the held fade of `1 - p` over 200 ms. The pop
holds the ring and ellipse at the shared radius while fading, without
expansion, over its 200 ms (`reducedMotion.pop.ms`).

### Charged lance

`lance`. A frigate's lance tracks Ada, locks, then fires a beam along the
locked line. Gameplay sets its length: as long as the game area is wide, in
on-screen px. The line runs from the turret's muzzle for that length, or to the
first obstacle on it.

| Time        | Line                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| 0-700 ms    | Tracking: 1 px coral dashes, 6 on 4 off, marching outward at 60 px/s, aimed at Ada each frame |
| 700-1000 ms | Locked: still, 1.5 px solid `plate`; white for 0-60 ms and 200-260 ms of the lock             |

- Charge: a coral disc at the muzzle, radius 1 to 3.5 over the 1000 ms, with a
  white core of radius 0.5 to 1.5. During each white pulse a `plate` disc of
  radius 4.5 at alpha 0.5 sits under it.
- Beam, 300 ms from the end of the lock. Keys for `w` and `a`, linear between
  keys: 0 ms `w` 0.5 `a` 0.9; 30 ms `w` 1.2 `a` 1; 120 ms `w` 1 `a` 1; 300 ms
  `w` 0.35 `a` 0. Bands as for the enemy Phaser: coral 9 to 6.8, plate 5.4 to
  4, white 2.4 to 1.6, each times `w`, at the held alpha of `a`.
- Muzzle bloom: opaque discs of radius `6.5 w` coral, `4.2 w` plate and
  `2.3 w` white. A beam at full length tapers every band to a point over its
  last 28 px, as a Phaser miss does; one stopped by an obstacle ends hard there
  with the shared `lance` contact: a white dart `(-20 a, 0) (0, -2.2 a)
(4 a, 0) (0, 2.2 a)` and a cream four-point burst `4.5 a` with a 0.3 waist
  for `a = 1 - p`, at alpha 1 to `p` 0.5, then 0.6.

Light field and Phantom: as for the enemy Phaser, the coral band and the coral
bloom disc take a 1 px field edge. The lines and the charge disc follow the
edge rule.

Reduced motion: the dashes do not march and the lock has no white pulses. The
beam is its own bands at `w` 1 without bloom, alpha 1 to 180 ms (`holdMs`),
then the held fade of `1 - (t - 180) / 120`, with the 1 px field edge. The
contact uses the shared reduced-motion ring over the existing lance hit window.

## Missile and mine frames

`node art/tools/weapon-solids.ts` builds the five models and writes their
frames, with their manifest rows and each missile's flame geometry staged as
`weapon-solids` in [polish-rows.json](polish-rows.json). Frame px times
0.4375 is logical px; every pivot is the frame's centre.

| Sheet                                        | Ids                                                    | Frame | Frames                                                                                  |
| -------------------------------------------- | ------------------------------------------------------ | ----: | --------------------------------------------------------------------------------------- |
| `/art/weapons/rapid-missile-sheet.svg`       | `weapon-rapidMissile-{k}`, `k` 0 to 31                 |    56 | Heading `k` of 32, `facing` `world-{k}`; the nose at the pivot                          |
| `/art/weapons/heavy-missile-sheet.svg`       | `weapon-heavyMissile-{k}`, `k` 0 to 31                 |    96 | The same                                                                                |
| `/art/weapons/enemy-rapid-missile-sheet.svg` | `weapon-enemyRapidMissile-{k}`, `k` 0 to 31            |    56 | The same, `projectile` `enemyRapidMissile`                                              |
| `/art/weapons/enemy-heavy-missile-sheet.svg` | `weapon-enemyHeavyMissile-{k}`, `k` 0 to 31            |    96 | The same, `projectile` `enemyHeavyMissile`                                              |
| `/art/weapons/mine-sheet.svg`                | `weapon-mine-{j}`, `weapon-mine-blink-{j}`, `j` 0 to 7 |    48 | Spin step `j` of 11.25 degrees, a quarter turn in eight; the mine's centre at the pivot |

The missile frames hold the body and fins; the game draws the flat flame
behind the tail, 7 px (Rapid) or 13.2 px (Heavy) behind the nose along the
projected heading. On a light field each frame takes the ink keyline.
`node art/tools/polish-contact-sheet.ts <dir> weapons` writes the review sheet.

## Pickups

Every upgrade drop is one shared upgrade pickup; what it gives is chosen when
Ada collects it, so it shows no weapon or upgrade kind. Galaxy field retints
leave its amber signal unchanged.

- Square: a 1.5 px amber `#f0bd68` (`weapon`) outline, no fill, centred on the
  pickup's projected point and aligned with the screen, half-size
  `pickupRadius` (10, so 20 px across).
- Chevrons: the core manifest strip `upgrade-chevron` on
  `/art/pickups/pickups-sheet.svg`, drawn by `node art/tools/friendly.ts`
  ([Friendly object redesign](friendly-redesign.md)), centred on the pickup's
  point. Each frame holds two flat chevrons facing the viewer, one above the
  other with a clear gap, each in one tone: `#f0bd68`, or `#fff2cc` while lit.
  Three 40 by 40 frame px frames, each displayed at 17.5 by 17.5 logical px with
  the pivot at the centre; the pair draws 14 by 16 display px. `frames` names
  `rest` (0, both amber), `lower` (1) and `upper` (2), and `facing` is `fixed`.
- Climb, looping from the still frame when the pickup appears: `climb` steps
  rest 900 ms, `lower` 120 ms and `upper` 120 ms; 1140 ms in all. A step's
  `lit` names the frame it shows; a step without one shows `rest`.
- Light field: the square's stroke draws over an ink stroke 2 px wider on the
  same path, and the chevrons over the ink keyline of their silhouette, at the
  pickup's alpha (`upgradePickup` in [Light fields](galaxies.md#light-fields)).
- Reduced motion: the `rest` frame only, both chevrons amber.

The pickup's collision is the outline's outer edge: one square part, half-size
`pickupRadius` plus half the 1.5 px outline (10.75 display px), centred on the
projected point and aligned with the screen. The chevrons and the climb do not
change it.

## Ammo pack

The ammo pack is one shared pickup for every ammunition drop: what it gives is
chosen when Ada collects it (Gameplay), so it shows no weapon. It is a
chamfered crate in ammo green, apart from the amber upgrade pickup, gold
Stardust, the rust ore nugget, the lavender hunt glint and the red edge
markers.

- `node art/tools/friendly.ts` draws the pack from the model layer
  ([Friendly object redesign](friendly-redesign.md)): the core manifest strip
  row `ammo-pack` on `/art/pickups/pickups-sheet.svg`, with its collision in
  `/art/pickups/pickups.json`.
- Model: one chamfered crate lying across the screen, with one ink band round
  its middle, lit from the upper left in flat tones.

| Part       | Top       | Left wall | Right wall |
| ---------- | --------- | --------- | ---------- |
| Crate      | `#b4e67e` | `#8fd14f` | `#5e9a2e`  |
| Band (ink) | `#3a3448` | `#2a2536` | `#181425`  |

- Row `ammo-pack`: a strip of four 40 by 40 frame px frames, each displayed at
  17.5 by 17.5 logical px with the pivot at the centre; the crate draws 16 by
  15 display px. `frames` names `rest` (0), `glint1` (1), `glint2` (2) and
  `glint3` (3).
- Glint (`loop`): rest 1100 ms, then `glint1`, `glint2` and `glint3` for 70 ms
  each, 1310 ms in all. The glint crosses the crate: glint 1 whitens the top,
  glint 2 the top and the lit left wall, and glint 3 lights the left wall alone.
- Reduced motion: the `rest` frame only.
- Light field: keylined, kind `ammoPickup`: the frame's silhouette grown by
  1 px in ink, 10.90:1 on Sunflower. On Phantom's `#514955` it draws over the
  same ink keyline; the crate's left wall is 4.68:1 on the field.
- Collision: `pickups.json` `frames["ammo-pack"]` holds four strictly convex
  parts in frame px from the frame's top left, the rest frame's outline, for
  every frame of the strip. Their farthest point is 8.76 display px from the
  centre, inside the upgrade pickup's 10.75 square, so `pickupRadius`, the
  pickup reach and the tractor rules are unchanged.

## Reduced motion summary

| Effect   | Full                            | Reduced                                       |
| -------- | ------------------------------- | --------------------------------------------- |
| Missiles | Two-frame flame flicker         | Frame 0 held, no flicker                      |
| Blasts   | Flash, growing ring, debris     | Still 3 px ring at `R`, held fade             |
| Beams    | Width keys, taper, bloom        | Their own bands at `w` 1, no bloom, held fade |
| Spark    | Rays, core, flecks              | Still cream ring of radius 3, held fade       |
| Ripple   | Growing amber ripple, thinning  | Still 2 px ripple at `R`, held fade           |
| Tells    | Lance dashes march, lock pulses | Still dashes, no pulses                       |
| Ring     | Emission ring and muzzle discs  | Emission ring only                            |
| Mine     | Spin, blink, fizzle, pop        | Still frame, no blink, held fade, still pop   |
| Pickup   | Chevron climb                   | Still frame, both chevrons amber              |
| Ammo     | Glint across the crate          | `rest` frame                                  |
