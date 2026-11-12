# Weapons

Projectiles, missile blasts, the Multi-Laser fan, the Phaser beam, the enemy
Phaser, the [enemy-only weapons](#enemy-only-weapons) and weapon pickups. Tech
draws every effect in code (Phaser Graphics); none uses a sprite or sheet. The HUD and shop glyphs are in [weapon icons](weapon-icons.md) and [shop icons](shop-icons.md).

## Gameplay values

Gameplay owns these values; they appear here because the effects are sized and
timed against them. `src/data/weapon-catalog.ts` holds the current tuning.

| Weapon        | Interval | Speed | Damage       | Effect                        |
| ------------- | -------- | ----- | ------------ | ----------------------------- |
| Laser         | 0.28 s   | x1    | x1           | Bolt                          |
| Rapid Missile | 0.30 s   | x1.3  | x1.5         | Missile, blast R 25           |
| Heavy Missile | 1.2 s    | x0.6  | x8 and blast | Missile, blast R 60, 72, 85   |
| Multi-Laser   | 0.3 s    | x1    | x1           | Fan of 3, 4, 5 bolts by level |
| Phaser        | 1.12 s   | n/a   | x4           | Hitscan beam, 320 wu range    |

Levels 2 and 3 change intervals, damage, blast radius and beam range as the
catalogue sets them. The effects below take the level's blast radius and beam
range; their strokes and timings do not change by level.

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

- A taper is a quad along `u` from a tail to a head, centred on `v = 0`, with
  full widths `w_tail` and `w_head` and alpha interpolated linearly from tail to
  head (per-vertex alpha).
- Colours: amber `#f0bd68` (space palette `weapon`), cream `#ead4aa`, white
  `#ffffff`, ink `#181425`.
- Every player shot, bolt, missile and beam starts at the same origin, the
  ship's nose point for its heading.

## Bolt and dot

Unchanged. The Laser and Multi-Laser bolt is a 1.5 px amber line from the head
back by `screen velocity x 0.035 s` (29.7 px at heading 14), butt caps. The
Scattershot dot is an amber disc, radius 1.5.

## Rapid Missile

A small white dart with amber fins and a long thin amber streak. Draw in order:

1. Streak: amber taper from tail `u = -(6 + 20 f)` (width 0.5, alpha 0) to head
   `u = -6` (width 1.6, alpha 0.85).
2. Core: cream taper from `u = -(6 + 6 f)` (width 0.4, alpha 0) to `u = -6`
   (width 1.0, alpha 0.9).
3. Fins: two amber triangles `(-4.6, -1.2) (-7.6, -2.8) (-7.6, -1.2)` and the
   mirror in `v`.
4. Body: white polygon `(0, 0) (-2.2, -1.2) (-7, -1.2) (-7, 1.2) (-2.2, 1.2)`.

Flicker: two frames, 50 ms each, looping. Frame 1 moves the streak tail to
`u = -(6 + 23 f)`; nothing else changes. Reduced motion holds frame 0.

## Heavy Missile

A fat white body with an amber warhead, a cream band and cream fins, an ink
keyline and a thick two-tone plume. Let `tail = 13.2 + 16.8 f` in frame 0 and
`13.2 + 11.8 f` in frame 1. Draw in order:

1. Plume: amber taper from `u = -tail` (width 0, alpha 0) to `u = -13.2` (width
   6.4, alpha 0.95).
2. Plume core: cream taper from `u = -(13.2 + (tail - 13.2) / 2)` (width 0,
   alpha 0) to `u = -13.2` (width 3.2, alpha 1).
3. Throat: white disc at `(-13.6, 0)`, radius 1.6.
4. Keyline: ink polygons, each the body or fin pushed 1 px out from its vertex
   centroid:
   - body `(1, 0) (-0.65, -2.01) (-3.52, -3.63) (-12.87, -3.39) (-14.14, -2.64)
(-14.14, 2.64) (-12.87, 3.39) (-3.52, 3.63) (-0.65, 2.01)`;
   - fin `(-7.67, -2.53) (-14.18, -6.82) (-15.4, -6.59) (-13.61, -1.99)` and the
     mirror in `v`.
5. Fins: cream `(-8.6, -2.9) (-13.6, -6) (-14.6, -6) (-13.2, -2.9)` and the
   mirror.
6. Body: white `(0, 0) (-1.6, -1.7) (-4.2, -2.9) (-12, -2.9) (-13.2, -2.3)
(-13.2, 2.3) (-12, 2.9) (-4.2, 2.9) (-1.6, 1.7)`.
7. Warhead: amber `(0, 0) (-1.6, -1.7) (-3.6, -2.75) (-3.6, 2.75) (-1.6, 1.7)`.
8. Band: cream rectangle `u` -7.6 to -6.4, `v` -2.9 to 2.9.

Flicker: two frames, 90 ms each, looping (plume 30 then 25 px long at heading 14).
Reduced motion holds frame 0.

## Missile blasts

A ground-plane circle of world radius `r` draws as an ellipse centred on the
projected blast point, half-width `r x 1.414` and half-height `r x 0.707`.
Stroke widths and dash lengths are screen px and do not scale with `R`; radii
in world units do.

| Blast | `R` (wu)   | Ellipse at the base view (px)  | `T`    | `G`    | Flash steps    | `k_f` | Ring stroke (px) | Tint | Debris |
| ----- | ---------- | ------------------------------ | ------ | ------ | -------------- | ----- | ---------------- | ---- | ------ |
| Rapid | 25         | 71 x 35                        | 220 ms | 110 ms | 0-20, 20-40 ms | 0.42  | 2.5 to 1.0       | 0.14 | none   |
| Heavy | 60, 72, 85 | 170 x 85, 204 x 102, 240 x 120 | 340 ms | 180 ms | 0-30, 30-60 ms | 0.34  | 4.0 to 1.5       | 0.16 | 8      |

Rapid uses `R` 25 at every level; Heavy takes 60, 72 and 85 at levels 1 to 3.
At time `t` from detonation, with `g = min(1, t / G)`:

- Ring radius `r = max(0.5, R (1 - (1 - g)^3))` wu (ease-out cubic).
- Ring alpha `a = 1` to `G`, then linear to 0 at `T`.
- Tint: the ellipse at `r` filled amber, alpha `tint x (1 - t / T)^2`.
- Ring: the ellipse at `r` stroked amber, alpha `a`, width linear from the first
  to the second ring stroke value over `T`.
- Inner line: when `r > 6`, the ellipse at `r - 2.2` wu stroked cream, 1 px,
  alpha `0.8 a`.
- Debris (Heavy only, to `G + 40` = 220 ms): for `i` 0 to 7, angle
  `th = 2 pi i / 8 + 0.3`, ellipse direction
  `e = (1.414 cos th, 0.707 sin th)` and its unit `n`; a cream line from `centre + r e + 3 n` for 6 px along `n`, 1.5 px, round caps,
  alpha `1 - t / (G + 40)`.
- Flash, drawn last: four filled ellipses of world radius `fr = R x k_f x s`,
  scaled `1.25 fr` amber 0.3, `fr` amber 0.85, `0.66 fr` cream 1, `0.36 fr`
  white 1, each alpha times `q`. Step 1: `s = 1`, `q = 0.95`. Step 2: `s = 0.55`,
  `q = 0.6`. Then none.

Each blast has at most one flash, played once. When a blast kills an enemy, its
flash stands in for that enemy's [destruction](destruction.md) flash: the
destruction skips its flash and keeps its shards and Stardust release.

Reduced motion: no flash, growth or debris. The ellipse at `R` fills amber at
alpha `0.15 a` and strokes amber at alpha `0.9 a`, with `a = 1 - t / T_r`:
Rapid `T_r` 200 ms, stroke 2 px; Heavy `T_r` 300 ms, stroke 3 px.

## Multi-Laser fan

The existing bolt, fired as a fan evenly spaced across 40 degrees: 3, 4 and 5
bolts at levels 1 to 3, at `-20 + 40 i / (n - 1)` degrees (-20, 0, 20; -20,
-6.7, 6.7, 20; -20, -10, 0, 10, 20). Offsets apply in the projected aim plane,
then each bolt's screen direction unprojects to its world velocity, so screen
length and speed vary per bolt. All bolts leave the nose together. The level
reads from the bolt count only; colour and width stay the bolt's.

## Phaser beam

A hitscan flash from the nose to the first contact (Tech's beam test against hit
circles and asteroids), or on a miss to the level's full range, `|P(d x range)|`
px. Gameplay's ranges are 320, 384 and 460.8 wu at levels 1 to 3:

| Level | Range (wu) | Heading 14 (px) | Headings 2 and 10 (px) |
| ----- | ---------- | --------------- | ---------------------- |
| 1     | 320        | 453             | 226                    |
| 2     | 384        | 543             | 272                    |
| 3     | 460.8      | 652             | 326                    |

Keyframes for width factor `w` and alpha `a`, linear between keys: 0 ms `w`
0.55 `a` 0.85; 20 ms `w` 1 `a` 1; 70 ms `w` 1 `a` 1; 150 ms `w` 0.4 `a` 0. The
flash ends at 150 ms, Tech's `BEAM.flashSeconds`.

Three layers along `u` from 0 (nose) to `L` (beam length), each a taper with
round caps whose width runs linearly from the nose value to the end value over
the whole beam, whatever its length:

| Layer | Colour | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ------ | ------------------------------------ | -------- |
| Glow  | amber  | 8 to 5                               | `0.38 a` |
| Body  | cream  | 4 to 2.4                             | `0.95 a` |
| Core  | white  | 1.8 to 1                             | `a`      |

A miss fades every layer linearly to alpha 0 over its last 28 px; a hit ends
hard at the contact. Over the beam, a muzzle bloom at `u = 0`: discs of radius
`5 w` amber `0.3 a`, `2.9 w` cream `0.9 a` and `1.6 w` white `a`.

### Hit spark

One spark per shot, centred on the contact point (a fighter or an asteroid), for
160 ms; a miss has none. With `p = t / 160`, rotated by the beam's screen angle:

- Rays, while `p < 0.6` with `k = p / 0.6`: six 1.5 px round-capped lines at -150,
  -95, -35, 25, 80 and 140 degrees, from radius `1.5 + 5 k` to `7.5 + 3 k`,
  white while `p < 0.25` then cream, alpha `1 - 0.6 k`.
- Core, while `p < 0.35`: white disc, radius `3 (1 - p / 0.35) + 0.5`.
- Flecks, while `p > 0.2` with `m = (p - 0.2) / 0.8`: three amber discs, radius
  1.1, at -120, -10 and 100 degrees and radius `6 + 5 (1 - (1 - m)^2)`, alpha
  `1 - m`.

### Reduced motion

A steady 2 px cream line (alpha `a`) over a 4 px amber edge (alpha `0.35 a`),
without taper, width change or bloom, alpha 1 to 90 ms then linear to 0 at
150 ms. A miss keeps the 28 px end fade. The spark becomes an unrotated cream
ring, radius 3, 1.5 px stroke, alpha `1 - p` over 160 ms.

## Enemy Phaser

A capital's Phaser shows a fixed aim line for 0.4 s, then fires the hitscan beam
along it. The values are in `phaser` in
[enemy-weapons.json](../public/art/enemy-weapons.json); the
[enemy-only conventions](#enemy-only-conventions) apply.

Aim line, from the turret's muzzle to the beam's reach (`|P(d x range)|` px, as
for Ada's beam) or to the first obstacle on it. It stays where it started.

| Time       | Line                                              |
| ---------- | ------------------------------------------------- |
| 0-300 ms   | 1 px coral (`obstacle`), dashes 6 on 4 off, still |
| 300-400 ms | 1 px solid pale coral (`plate`)                   |

- End tick: a 5 px line across the end of the aim, 1 px, in the line's colour.
- Charge: a coral disc at the muzzle, radius 1 to 2.5 over the 400 ms, with a
  white core of radius 0.5 to 1.1.

Beam: Ada's [Phaser beam](#phaser-beam) geometry, width and alpha keys (150 ms),
miss fade over the last 28 px and hit spark, in coral:

| Layer | Colour     | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ---------- | ------------------------------------ | -------- |
| Glow  | `obstacle` | 8 to 5                               | `0.38 a` |
| Body  | `obstacle` | 4 to 2.4                             | `a`      |
| Core  | white      | 1.8 to 1                             | `a`      |

Muzzle bloom: discs of radius `5 w` coral `0.3 a`, `2.9 w` coral `0.9 a` and
`1.6 w` white `a`. The [enemy spark](#enemy-only-conventions) marks a hit.

Light field: the glow is ink, width 6.5 to 4 times `w`, alpha `0.9 a`; the
bloom's outer disc is ink at `0.6 a`. The aim line follows the
[edged line](#enemy-only-conventions) rule.

Reduced motion: the aim line is unchanged. The beam is a steady 2 px coral line
over a 4 px coral edge at `0.35 a` (ink at `0.9 a` on a light field), alpha 1 to
90 ms then linear to 0 at 150 ms. The spark is an unrotated coral ring, radius 3,
1.5 px, alpha `1 - p` over 160 ms.

## Enemy-only weapons

The ring burst, mine and charged lance that only enemies carry. Gameplay owns
their damage, intervals, speeds, counts and lifetimes
([Ships](../gameplay/ships.md)).

- Rebuild with `node art/tools/enemy-weapons.ts`. It writes
  [enemy-weapons.json](../public/art/enemy-weapons.json), formatted with the
  project's Prettier settings, and links it from the core manifest as
  `enemyWeapons`. Reruns are byte-identical. The build fails if a carrying
  colour falls below 5:1 on a dark galaxy's background or the ink below 5:1 on
  a light one, or if the mine's collision parts trace its drawing with an IoU
  below 0.98 or stray more than 1 px from its edge.

### Enemy-only conventions

- Colours by key in `colours`: `obstacle` coral `#D68B72` and `weapon` amber
  `#F0BD68` (space palette), `coralSide` `#A8654F` and `plate` pale coral
  `#E6A890` (the [coral family](enemies.md#family-style)), white and ink
  `#181425`. Coral marks every enemy shot, so the enemy beams are coral where
  Ada's are amber and cream.
- Every shape that has to be seen draws at alpha 1 in `obstacle`, `plate`,
  `weapon` or white: at least 5.37:1 on every dark galaxy (`plate` 7.15:1, white
  14.47:1, amber 8.40:1). Glows, fades and tints carry nothing.
- Widths and radii are logical px scaled by `s`; the `u`, `v` heading frame and
  `f` are those of [Conventions](#conventions).
- Tells, lines and beams draw in the effect layer with the Phaser beam. They
  start at the firing turret's muzzle and stop at the first obstacle, like the
  beams.
- Enemy spark: Art's [hit spark](#hit-spark) with rays white while `p < 0.25`
  then coral, a white core and coral flecks. `scale` multiplies its radii.
- Light field: a stroke draws over an ink stroke 2 px wider on the same path. A
  solid line's ink runs 1 px past each end. A dashed line's ink dashes are 8 on
  2 off, offset 1 px earlier, so each coral dash has 1 px of ink at both ends. A
  filled shape draws over its silhouette grown by 1 px. Tints are never edged.
  Every edge takes its shape's alpha.

### Ring burst

`ringBurst`. At firing, for 180 ms, the bolts' spawn circle (Gameplay's spawn
radius around the hull centre) draws as a ground-plane ellipse, half-width
`r x 1.414` and half-height `r x 0.707`, stroked coral 1.5 px at alpha
`1 - t / 180`. For 120 ms a coral disc at each bolt's origin shrinks from radius
3.6 to 0.6, with a white core from 2.0 toward 0.4 drawn to 60 ms.

Each bolt is a ring dart of fixed size, rotated to its projected heading. Draw in
order:

1. Tail: coral taper from `u = -(3 + 9 f)` (width 0.5, alpha 0) to `u = -3`
   (width 2, alpha 0.9).
2. Body: coral `(2.2, 0) (-0.6, -2) (-3.6, 0) (-0.6, 2)`.
3. Core: white `(0.8, 0) (-0.6, -0.9) (-2, 0) (-0.6, 0.9)`.

Light field: the body draws over its silhouette grown by 1 px in ink; the tail
stays as it is, like the missile streak. The emission ring and muzzle discs take
ink edges. Reduced motion: no muzzle discs; the emission ring is unchanged.

### Mine

`mine`. A spiked coral mine with an amber light, drawn at its projected centre and
sorted with the play objects by that centre's screen y. Angles are screen angles,
0 at screen right and clockwise on screen. At spin angle `th`:

1. Spikes: 8 coral triangles, spike `i` along `th + 45 i` degrees, tip at radius
   7.5 and base corners 1.5 either side of the point at radius 3.6.
2. Body: a `coralSide` disc of radius 5, then an `obstacle` disc of radius 4.3
   centred at `(-0.6, -0.7)`, which leaves a darker rim on the lower right.
3. Core: an ink disc of radius 2.5 and an amber disc of radius 1.5; on a blink, a
   white disc of radius 1.8 instead of the amber.

`th` is `60 x age` degrees for the mine's age in seconds since the drop.

| Remaining life | Blink period | White for |
| -------------- | ------------ | --------- |
| Over 4 s       | 1000 ms      | 120 ms    |
| 1.5 to 4 s     | 500 ms       | 100 ms    |
| Under 1.5 s    | 250 ms       | 80 ms     |

The blink phase counts from the drop.

Vanish hint: over the last 4 s a 1.2 px coral arc of radius 11 runs clockwise
from 12 o'clock through `360 x remaining / 4 s` degrees, so it shortens to
nothing as the mine vanishes.

Vanish: a 200 ms fizzle that deals no damage. With `p = t / 200` the mine
scales by `1 - p^2` about its centre with its core white, and four coral flecks of
radius 1 at 45, 135, 225 and 315 degrees sit at distance `5 + 6 p`, their y
times 0.75, at alpha `1 - p`.

Pop, when Ada's shot destroys the mine or it touches Ada, for 220 ms. With
`g = min(1, t / 110)` and `R = 5 + 11 (1 - (1 - g)^3)`:

- An ellipse of half-width `R` and half-height `R / 2`, filled coral at alpha
  `0.14 (1 - t / 220)^2` and stroked coral at alpha 1 to 110 ms then linear to 0
  at 220 ms, width 2 to 1 over the 220 ms.
- To 180 ms, four coral flecks of radius 1.1 at 20, 110, 200 and 290 degrees, at
  distance `4 + 9 (1 - (1 - t / 180)^2)`, their y times 0.6, alpha `1 - t / 180`.
- Flash, drawn last: discs of radius `6 x scale` times 1.25 coral 0.3, 1 coral
  0.85, 0.66 `plate` 1 and 0.36 white 1, each alpha times `q`. 0-40 ms: scale 1,
  `q` 0.95. 40-80 ms: scale 0.55, `q` 0.6. Then none.

Collision: contact is the drawn silhouette against Ada's drawn ship. `collision`
holds it as convex `[x, y]` parts in logical px around the mine's centre at
`th = 0`: a 32-sided polygon inscribed in the body disc (within 0.03 px of it)
and the 8 spike triangles. The parts overlap; their union is the silhouette.
Rotate them by `th` with the drawing. The light field's ink keyline is not part of
it, and a fizzling mine has none. Against the drawing the parts have an IoU of
0.9977 and lie within 0.023 px of its edge.

Light field: the spikes and body draw over their silhouette grown by 1 px in
ink; the hint arc, fizzle flecks, pop ring stroke, pop flecks and the flash's
outer disc take ink edges, never the pop's tint.

Reduced motion: `th` stays 0 and the core stays amber with no blink; the hint arc
is unchanged. The fizzle is the still mine fading to alpha 0 over 200 ms. The pop
is the ellipse at `R` 16, filled coral at `0.15 a` and stroked coral 2 px at
`0.9 a`, with `a = 1 - t / 200`.

### Charged lance

`lance`. A frigate's lance tracks Ada, locks, then fires a beam across the game
area along the locked line. The line runs from the turret's muzzle to the edge of
the game area or the first obstacle on it.

| Time        | Line                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| 0-700 ms    | Tracking: 1 px coral dashes, 6 on 4 off, marching outward at 60 px/s, aimed at Ada each frame |
| 700-1000 ms | Locked: still, 1.5 px solid `plate`; white for 0-60 ms and 200-260 ms of the lock             |

- Charge: a coral disc at the muzzle, radius 1 to 3.5 over the 1000 ms, with a
  white core of radius 0.5 to 1.5. During each white pulse a `plate` disc of
  radius 4.5 at alpha 0.5 sits under it.
- Beam, 300 ms from the end of the lock. Keys for `w` and `a`, linear between
  keys: 0 ms `w` 0.5 `a` 0.9; 30 ms `w` 1.2 `a` 1; 120 ms `w` 1 `a` 1; 300 ms
  `w` 0.35 `a` 0. Layers as for the Phaser beam:

| Layer | Colour     | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ---------- | ------------------------------------ | -------- |
| Glow  | `obstacle` | 12 to 9                              | `0.45 a` |
| Body  | `obstacle` | 6 to 4.5                             | `a`      |
| Core  | white      | 2.4 to 1.6                           | `a`      |

- Muzzle bloom: discs of radius `7 w` coral `0.3 a`, `4.5 w` coral `0.9 a` and
  `2.5 w` white `a`. A beam that leaves the game area needs no end fade; one
  stopped by an obstacle ends hard there with the enemy spark at scale 1.35.

Light field: the glow is ink, width 10 to 7.5 times `w`, alpha `0.9 a`; the
bloom's outer disc is ink at `0.6 a`. The lines and the charge disc follow the
edge rule.

Reduced motion: the dashes do not march and the lock has no white pulses. The
beam is a steady 3 px coral line over a 6 px coral edge at `0.35 a` (ink at
`0.9 a` on a light field), alpha 1 to 180 ms then linear to 0 at 300 ms. The spark
is an unrotated coral ring, radius 4, 1.5 px, alpha `1 - p` over 160 ms.

## Pickups

A weapon pickup in space is the existing square: a 1.5 px amber `#f0bd68`
outline, no fill, centred on the pickup's projected point, half-size
`pickupRadius` (10, so 20 px across). Inside it, the weapon's 20 px HUD mask SVG,
`weapon-<id>.svg`, draws at 14 px in amber, centred on the same point. This
applies to `scattershot`, `rapidMissile`, `multiLaser`, `heavyMissile` and
`phaser`, and replaces the old line glyphs, Scattershot's dot fan and the missile
line glyph included. Galaxy field retints leave the amber signal unchanged.

The pickup's drawn silhouette is the outline's outer edge, which encloses the
icon: one square part, half-size `pickupRadius` plus half the 1.5 px outline
(10.75 display px), centred on the projected point and aligned with the
screen. Tech draws the pickup at runtime, so it has no frame data.

## Reduced motion summary

| Effect   | Full                              | Reduced                             |
| -------- | --------------------------------- | ----------------------------------- |
| Missiles | Two-frame exhaust flicker         | Frame 0 held, no flicker            |
| Blasts   | Flash, growing ring, debris, tint | Static ring and tint at `R`, fading |
| Beam     | Width keys, taper, bloom          | Steady 2 px line, fading            |
| Spark    | Rays, core, flecks                | Static ring, fading                 |
| Tells    | Lance dashes march, lock pulses   | Still dashes, no pulses             |
| Ring     | Emission ring and muzzle discs    | Emission ring only                  |
| Mine     | Spin, blink, fizzle, pop flash    | Still, amber, fade, static ring     |
