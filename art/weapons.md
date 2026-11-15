# Weapons

Projectiles, missile blasts, the Multi-Laser fan, the Phaser beam, the enemy
Phaser, the [enemy-only weapons](#enemy-only-weapons) and the upgrade pickup. Tech
draws every effect in code (Phaser Graphics); none uses a sprite or sheet, and the
pickup's only image is its chevron mask. The HUD and shop glyphs are in [weapon icons](weapon-icons.md) and [shop icons](shop-icons.md).

## Gameplay values

Gameplay owns these values; they appear here because the effects are sized and
timed against them. `src/data/weaponCatalog.ts` holds the current tuning.

| Weapon        | Interval         | Speed (wu/s) | Damage by level      | Effect                               |
| ------------- | ---------------- | ------------ | -------------------- | ------------------------------------ |
| Laser         | 0.30/0.25/0.20 s | 500/600/700  | 1/1.25/1.5           | Bolt                                 |
| Rapid Missile | 0.30/0.25/0.20 s | 500/600/700  | 1.5/1.5/1.5          | Missile, blast R 30                  |
| Heavy Missile | 2 s              | 400          | 8/12/16              | Missile, blast R 60                  |
| Multi-Laser   | 0.30 s           | 400/500/600  | 0.7 per bolt         | Fan of 3/4/5 bolts across ±8 degrees |
| Scattershot   | 1 s              | 600          | 0.8/1/1.2 per pellet | Fan of 7/9/11 pellets                |
| Phaser        | 1 s              | n/a          | 13/3, 6.5, 9.75      | Instant beam, fire-time coverage     |

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

## Hit animation families

Contacts carry explicit firing-weapon provenance, their actual world contact point and
elapsed age. Directional contacts retain the incoming world vector; missile effects use
that event's actual world blast radius. The current loadout, damage and radius do not
select a family. Rendering projects the contact and direction once.

| Source weapon                | Family          | Contact appearance                                            |
| ---------------------------- | --------------- | ------------------------------------------------------------- |
| Rapid Missile, Heavy Missile | `missile`       | One explosion recipe, scaled to the actual blast radius       |
| Laser, Multi-Laser           | `compact`       | The same compact flash, rays and flecks                       |
| Phaser                       | `compactBright` | The compact grammar, brighter and longer                      |
| Scattershot                  | `pellet`        | A tiny, short-lived spark per actual pellet contact           |
| Charged lance                | `lance`         | Concentrated flash and streak along the incoming direction    |
| Ring burst                   | `ripple`        | One clean projected circular ripple                           |
| Mine                         | `shockwave`     | An expanding outer front, distinct inner front and faint fill |

`impactEffect`, `IMPACT_STYLE` and the shared spark/blast constants in
[`weaponEffects.ts`](../src/game/weaponEffects.ts) are the canonical presentation
coefficients. The existing renderer consumes their `EffectShape` records and light-field
edges. There is no second effect-data file or duplicated weapon tuning.

Enemy Lance and Phaser hooks use the actual drawn beam endpoint and its incoming
vector. Their existing hit-window age is normalized into the shared effect phase; the
mine pop uses its existing normal or reduced-motion duration. Firing tells, damage,
collision, arming, radius and expiry remain unchanged. Reduced motion removes expansion
and moving sparks while retaining the family silhouette and fade; the Mine keeps both
fronts and its fill, and the fill receives no ink outline.

An impact is separate from [ship destruction](destruction.md). The destruction flash,
shards and pickup release use the same recipe regardless of the killing weapon; a
missile does not suppress the wreck's own flash.

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

Rapid and Heavy contacts both use the shared `BLASTS.heavy` recipe through
`impactEffect`; only the actual event radius changes their spatial envelope.
A ground-plane circle of world radius `r` projects to an ellipse with half-width
`r × sqrt(2)` and half-height `r / sqrt(2)`, centred on the actual contact or
projectile position at range expiry. Screen-space strokes do not scale with `r`.

The recipe draws a tint, expanding ring, inner line, debris and a brief layered
flash. Its growth, fade, stroke, alpha and flash coefficients remain in
[`weaponEffects.ts`](../src/game/weaponEffects.ts). Each actual detonation has
one impact effect. A destroyed ship still plays its own independent destruction.

Reduced motion keeps a fading ring and tint at the actual radius, without
flash, growth or debris, using the same shared recipe for both missiles.

## Multi-Laser fan

The existing bolt, fired as a fan evenly spaced across 16 degrees: 3, 4 and 5
bolts at levels 1 to 3, at `-8 + 16 i / (n - 1)` degrees. Offsets apply in the projected aim plane,
then each bolt's screen direction unprojects to its world velocity, so screen
length and speed vary per bolt. All bolts leave the nose together. The level
reads from the bolt count only; colour and width stay the bolt's.

## Phaser beam

The full collision width is 12 world units (half-width 6). Beam layers derive
their width from the canonical collision half-width. Impact sparks use the
contact edge; whole-object destruction effects remain at the object pivot.

A hitscan flash runs from the nose to the first drawn contact edge. A miss
reaches Ada's fire-time rounded coverage boundary: half-width 380 and
half-height 260 at the 720 x 360 base view, scaled with the actual game area.
The shape and the player's centre are captured when firing. Levels change
neither this envelope nor the one-second fire interval.

Keyframes for width factor `w` and alpha `a`, linear between keys: 0 ms `w`
0.55 `a` 0.85; 20 ms `w` 1 `a` 1; 70 ms `w` 1 `a` 1; 150 ms `w` 0.4 `a` 0. The
flash ends at 150 ms, Tech's `BEAM.flashSeconds`.

Three layers along `u` from 0 (nose) to `L` (beam length), each a taper with
round caps whose width runs linearly from the nose value to the end value over
the whole beam, whatever its length:

| Layer | Colour | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ------ | ------------------------------------ | -------- |
| Glow  | amber  | 12 to 7.5                            | `0.38 a` |
| Body  | cream  | 6 to 3.6                             | `0.95 a` |
| Core  | white  | 2.7 to 1.5                           | `a`      |

A miss fades every layer linearly to alpha 0 over its last 28 px; a hit ends
hard at the contact. Over the beam, a muzzle bloom at `u = 0`: discs of radius
`5 w` amber `0.3 a`, `2.9 w` cream `0.9 a` and `1.6 w` white `a`.

### Hit spark

A successful Phaser contact uses `compactBright`: the same rays, central core
and flecks as Laser and Multi-Laser, at greater brightness and a longer visual
lifetime. A miss has no contact effect. The spark is centred on the actual
contact and aligned with the incoming beam; source coefficients live in
`IMPACT_STYLE` and `spark`, rather than a separate Phaser spark recipe.

### Reduced motion

A steady 6 px cream line (alpha `a`) over a 12 px amber edge (alpha `0.35 a`),
without taper, width change or bloom, alpha 1 to 90 ms then linear to 0 at
150 ms. A miss keeps the 28 px end fade. The contact becomes the shared family's still cream ring and fades over its visual lifetime.

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
miss fade over the last 28 px. Its beam layers are coral:

| Layer | Colour     | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ---------- | ------------------------------------ | -------- |
| Glow  | `obstacle` | 12 to 7.5                            | `0.38 a` |
| Body  | `obstacle` | 6 to 3.6                             | `a`      |
| Core  | white      | 2.7 to 1.5                           | `a`      |

Muzzle bloom: discs of radius `5 w` coral `0.3 a`, `2.9 w` coral `0.9 a` and
`1.6 w` white `a`. A hit uses the shared `compactBright` contact family at
the drawn endpoint, independently of the coral beam body.

Light field: the glow is ink, width 6.5 to 4 times `w`, alpha `0.9 a`; the
bloom's outer disc is ink at `0.6 a`. The aim line follows the
[edged line](#enemy-only-conventions) rule.

Reduced motion: the aim line is unchanged. The beam is a steady 6 px coral line
over a 12 px coral edge at `0.35 a` (ink at `0.9 a` on a light field), alpha 1 to
90 ms then linear to 0 at 150 ms. The contact uses the shared reduced-motion `compactBright` ring.

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
- Contact effects use the shared [hit families](#hit-animation-families):
  `compactBright` for Phaser and a directional streak for Lance. Their warm
  contact colours do not recolour the coral beam body or its tell.
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

Pop, when a shot destroys the mine or it touches Ada, uses the shared
`shockwave` family: an expanding outer ring, a separate inner front and faint
fill. The actual pop age is normalized over the existing pop duration. Ring
burst contacts remain one clean ripple; they do not acquire the Mine's inner
front or fill. This is presentation only, not a new blast or damage radius.

Collision: contact is the drawn silhouette against Ada's drawn ship. `collision`
holds it as convex `[x, y]` parts in logical px around the mine's centre at
`th = 0`: a 32-sided polygon inscribed in the body disc (within 0.03 px of it)
and the 8 spike triangles. The parts overlap; their union is the silhouette.
Rotate them by `th` with the drawing. The light field's ink keyline is not part of
it, and a fizzling mine has none. Against the drawing the parts have an IoU of
0.9977 and lie within 0.023 px of its edge.

Light field: the spikes and body draw over their silhouette grown by 1 px in
ink; the hint arc, fizzle flecks and both pop front strokes take ink edges,
never the pop's faint fill.

Reduced motion: `th` stays 0 and the core stays amber with no blink; the hint arc
is unchanged. The fizzle is the still mine fading to alpha 0 over 200 ms. The pop
holds both shockwave fronts and its fill at the shared radius while fading,
without expansion. It retains the existing reduced pop expiry.

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
  `w` 0.35 `a` 0. Layers as for the Phaser beam:

| Layer | Colour     | Width at nose to end (px, times `w`) | Alpha    |
| ----- | ---------- | ------------------------------------ | -------- |
| Glow  | `obstacle` | 12 to 9                              | `0.45 a` |
| Body  | `obstacle` | 6 to 4.5                             | `a`      |
| Core  | white      | 2.4 to 1.6                           | `a`      |

- Muzzle bloom: discs of radius `7 w` coral `0.3 a`, `4.5 w` coral `0.9 a` and
  `2.5 w` white `a`. A beam at full length fades every layer linearly to
  alpha 0 over its last 28 px, as a Phaser miss does; one stopped by an
  obstacle ends hard there with the shared directional `lance` contact flash.

Light field: the glow is ink, width 10 to 7.5 times `w`, alpha `0.9 a`; the
bloom's outer disc is ink at `0.6 a`. The lines and the charge disc follow the
edge rule.

Reduced motion: the dashes do not march and the lock has no white pulses. The
beam is a steady 3 px coral line over a 6 px coral edge at `0.35 a` (ink at
`0.9 a` on a light field), alpha 1 to 180 ms then linear to 0 at 300 ms. The contact uses the shared still-ring
reduced-motion fallback over the existing Lance hit window.

## Pickups

Every upgrade drop is one shared upgrade pickup; what it gives is chosen when
Ada collects it, so it shows no weapon or upgrade kind. Galaxy field retints
leave its amber signal unchanged.

- Square: a 1.5 px amber `#f0bd68` (`weapon`) outline, no fill, centred on the
  pickup's projected point and aligned with the screen, half-size
  `pickupRadius` (10, so 20 px across).
- Chevrons: two copies of the generic upgrade chevron, the core manifest mask
  `upgrade-chevron` (`public/art/pickups/upgrade-chevron.svg`, 12 by 8 px, pivot
  at the centre, rebuilt by `node art/tools/upgrade-pickup.ts`), tinted amber
  and centred at `(0, 2.4)` (lower) and `(0, -2.4)` (upper) from the pickup's
  point, 4.8 px apart. Each is a 2.2 px
  stroke with butt caps and a mitred apex along a centreline from
  `(-5.2, 2.1)` up to `(0, -2.1)` and down to `(5.2, 2.1)` about its own centre.
  Its outline, in frame px: `(0.109, 5.244) (6, 0.486) (11.891, 5.244)
(10.509, 6.956) (6, 3.314) (1.491, 6.956)`.
- Climb, looping from the still frame when the pickup appears: still 900 ms
  (both amber), lower chevron white `#ffffff` 120 ms, upper chevron white
  120 ms; 1140 ms in all. The manifest entry carries the offsets (`chevrons`)
  and the keys (`climb`, each `ms` with the lit chevron's name, or none).
- Light field: the square's stroke draws over an ink stroke 2 px wider on the
  same path, and each chevron over its silhouette grown by 1 px in ink, at the
  pickup's alpha (`upgradePickup` in [Light fields](galaxies.md#light-fields)).
- Reduced motion: the still frame only, both chevrons amber.

The pickup's drawn silhouette is the outline's outer edge, which encloses the
chevrons: one square part, half-size `pickupRadius` plus half the 1.5 px outline
(10.75 display px), centred on the projected point and aligned with the
screen. The chevrons and the climb do not change it, and the square has no frame
data.

## Ammo pack

The ammo pack is one shared pickup for every ammunition drop: what it gives is
chosen when Ada collects it (Gameplay), so it shows no weapon. It is a cartridge
clip in ammo green (`ammo`), apart from the amber upgrade pickup, gold Stardust,
the rust ore nugget, the lavender hunt glint and the red edge markers.

- Rebuild with `node art/tools/ammo-pack.ts`. It writes
  `public/art/pickups/ammo-pack.png`, a 64 by 16 sheet of four 16 by 16
  frames, its Aseprite data `ammo-pack.json` with each frame's `collision`, and
  the core manifest entry `ammo-pack`, displayed at 16 by 16 logical px with
  the pivot at the centre, nearest-neighbour filtered. Reruns are
  byte-identical.
- Drawing: three rounds 4 px wide at columns 1, 6 and 11, rows 1 to 14: a
  cream tip (rows 1 to 3, shaded on the right), a casing lit on its left and
  shaded on its right, and a shade base row; a 2-row ink clip across the full
  16 px at rows 10 and 11. Every pixel is opaque or clear.

| Part  | Colour    | Contrast                                                    |
| ----- | --------- | ----------------------------------------------------------- |
| Body  | `#8fd14f` | 7.86:1 (Whirlpool) to 9.23:1 (Phantom) on the dark galaxies |
| Light | `#d2f3a6` | 11.79:1 or more on the dark galaxies                        |
| Shade | `#5e8f2a` | 2.10:1 against the body                                     |
| Tip   | `#f2edd5` | Tip shade `#b9b095`                                         |
| Clip  | `#181425` | 9.78:1 against the body                                     |
| Glint | `#ffffff` |                                                             |

In Oklab the body is 0.142 from Stardust's shade `#c8a24e`, 0.144 from
`active`, 0.146 from the amber `weapon`, 0.155 from Stardust's body, 0.188
from the ore rim, 0.221 from `obstacle`, 0.222 from `pointOfInterest`, 0.252
from `shipHardpoint` and 0.301 from `threat`.

- Glint (`loop`, the sheet's `glint` tag): rest 1100 ms, then `glint1`,
  `glint2` and `glint3` for 70 ms each, 1310 ms in all; glint `k` whitens round
  `k`'s tip and lit edge, left to right.
- Reduced motion: the `rest` frame only.
- Light field: keylined, kind `ammoPickup`: the frame's silhouette grown by
  1 px in ink. The bare body is 1.11:1 on Sunflower; the keyline is 10.90:1.
- Collision: one convex part, the 16 by 14 hull of the rounds and clip,
  `[0, 1] [16, 1] [16, 15] [0, 15]` in frame px (one frame px is one display px),
  the same on every frame. Its farthest point is 9.90 from the centre, inside
  the upgrade pickup's 10.75 square, so `pickupRadius`, the pickup reach and
  the tractor rules are unchanged.

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
| Pickup   | Chevron climb                     | Still frame, both chevrons amber    |
| Ammo     | Glint across the rounds           | `rest` frame                        |
