# Weapons

Projectiles, missile blasts, the Multi-Laser fan and the Phaser beam. Tech draws
every effect in code (Phaser Graphics); none uses a sprite or sheet. The HUD and
shop glyphs are in [weapon icons](weapon-icons.md) and [shop icons](shop-icons.md).

## Gameplay values

Gameplay owns these values; they appear here because the effects are sized and
timed against them. `src/data/weapon-catalog.ts` holds the current tuning.

| Weapon        | Interval | Speed | Damage       | Effect                        |
| ------------- | -------- | ----- | ------------ | ----------------------------- |
| Basic         | 0.28 s   | x1    | x1           | Bolt                          |
| Rapid Missile | 0.30 s   | x1.3  | x1.5         | Missile, blast R 25           |
| Heavy Missile | 1.2 s    | x0.6  | x8 and blast | Missile, blast R 60, 72, 85   |
| Multi-Laser   | 0.3 s    | x1    | x1           | Fan of 3, 4, 5 bolts by level |
| Phaser        | 1.12 s   | n/a   | x4           | Hitscan beam, 320 world units |

Levels 2 and 3 change intervals, damage, blast radius and beam range as the
catalogue sets them. The effects below take the level's blast radius and beam
range; their strokes and timings do not change by level.

## Conventions

- Units are logical screen px at the base view, except where marked world units
  (wu). Tech's projection is `P(x, y) = (x - y, (x + y) / 2)`.
- Each shot is a screen-space vector shape rotated to its projected heading:
  `angle = atan2(P(v).y, P(v).x)` for world velocity `v`. No direction frames.
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

Unchanged. The Basic and Multi-Laser bolt is a 1.5 px amber line from the head
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
`u = -(6 + 23 f)`; nothing else changes.

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

## Missile blasts

A ground-plane circle of world radius `r` draws as an ellipse centred on the
projected blast point, half-width `r x 1.414` and half-height `r x 0.707`.
Stroke widths and dash lengths are screen px and do not scale with `R`; radii
in world units do.

| Blast | `R` (wu)   | Ellipse at the base view (px)  | `T`    | `G`    | Flash steps    | `k_f` | Ring stroke | Tint | Debris |
| ----- | ---------- | ------------------------------ | ------ | ------ | -------------- | ----- | ----------- | ---- | ------ |
| Rapid | 25         | 71 x 35                        | 220 ms | 110 ms | 0-20, 20-40 ms | 0.42  | 2.5 to 1.0  | 0.14 | none   |
| Heavy | 60, 72, 85 | 170 x 85, 204 x 102, 240 x 120 | 340 ms | 180 ms | 0-30, 30-60 ms | 0.34  | 4.0 to 1.5  | 0.16 | 8      |

Rapid uses `R` 25 at every level; Heavy takes 60, 72 and 85 at levels 1 to 3.
At time `t` from detonation, with `g = min(1, t / G)`:

- Ring radius `r = max(0.5, R (1 - (1 - g)^3))` wu (ease-out cubic).
- Ring alpha `a = 1` to `G`, then linear to 0 at `T`.
- Tint: the ellipse at `r` filled amber, alpha `tint x (1 - t / T)^2`.
- Ring: the ellipse at `r` stroked amber, alpha `a`, width linear from the first
  to the second ring stroke value over `T`.
- Inner line: when `r > 6`, the ellipse at `r - 2.2` wu stroked cream, 1 px,
  alpha `0.8 a`.
- Debris (Heavy only, to `G + 40` = 220 ms): for `i` 0 to 7, `th = 2 pi i / 8 +
0.3`, ellipse direction `e = (1.414 cos th, 0.707 sin th)` and its unit `n`;
  a cream line from `centre + r e + 3 n` for 6 px along `n`, 1.5 px, round caps,
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
circles and asteroids), or to the level's full range on a miss: `|P(d x range)|`
px, 453 px at heading 14 and 226 px at headings 2 and 10 for 320 wu.

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

## Reduced motion summary

| Effect   | Full                              | Reduced                             |
| -------- | --------------------------------- | ----------------------------------- |
| Missiles | Two-frame exhaust flicker         | Unchanged                           |
| Blasts   | Flash, growing ring, debris, tint | Static ring and tint at `R`, fading |
| Beam     | Width keys, taper, bloom          | Steady 2 px line, fading            |
| Spark    | Rays, core, flecks                | Static ring, fading                 |
