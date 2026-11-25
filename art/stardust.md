# Stardust

- Rebuild with `node art/tools/resource-pickups.ts`. It writes the Stardust
  sheet `public/art/stardust.png` with its Aseprite data `stardust.json`, the
  [ore nugget](cartwheel-props.md#ore-nugget) sheet beside it, and replaces
  both rows of the core manifest in place. JSON goes through the project's
  Prettier settings. Reruns are byte-identical.
- Pixel art from character grids, like the [settings icons](settings-icons.md).
  Every pixel is opaque or clear; draw with nearest-neighbour filtering, at
  whole multiples of 9 px.
- One image: the world pickup and every UI icon draw this sheet, the UI its
  `rest` frame ([Shared image](#shared-image)).

## Colour

Pale gold-white: a light glinting star, apart from ore's matte burgundy-purple
nugget ([ore nugget](cartwheel-props.md#ore-nugget)) of the same 9 px size by
silhouette, colour, surface and lightness, so the two read apart in greyscale
too.

| Role       | Colour    |
| ---------- | --------- |
| Glint core | `#ffffff` |
| Light      | `#fff2cc` |
| Body       | `#f4d98a` |
| Shade      | `#c8a24e` |

| Field     | Body    | Shade  |
| --------- | ------- | ------ |
| Base      | 10.56:1 | 6.09:1 |
| Cartwheel | 10.65:1 | 6.14:1 |
| Whirlpool | 10.43:1 | 6.02:1 |
| Needle    | 11.37:1 | 6.56:1 |
| Andromeda | 10.62:1 | 6.13:1 |
| Phantom   | 12.51:1 | 7.21:1 |

On Sunflower's light field the pickup draws over the ink keyline
([Light fields](galaxies.md#light-fields)), 10.90:1. The body is 0.07 from the
weapon pickup's amber `#F0BD68` in Oklab: the weapon pickup is a square with a
glyph and darker, the Stardust a small star.

## Pickup

Every pickup looks the same regardless of the Stardust it carries.

- Root manifest id `stardust`: a 36 by 9 sheet of 9 by 9 frames, displayed at
  9 by 9 logical px for one Stardust and 18 by 18 for five, with the pivot at
  the centre. `frames` names `rest` (0), `glint1` (1) and `glint2` (2).
- A small four-point star lit from the upper left, 9 px tip to tip: a white
  core in a light ring, the top and left rays and shoulders in the body tone,
  the right and bottom ones in shade. `glint1` steps each tone one lighter and
  `glint2` whitens the ring and lights the rays, on the same silhouette.
- Glint loop (`loop`, and the sheet's `glint` tag): rest 420 ms, glint1 60 ms,
  glint2 80 ms, glint1 60 ms; 620 ms in all. Each pickup starts at a random phase
  so a cluster twinkles out of step.
- Reduced motion: the rest frame only.
- Collision: each frame of `stardust.json` carries `collision`, its drawn
  silhouette: an array of convex parts, each an array of `[x, y]` in frame px of that
  frame (one frame px is one display px), the schema of the ship's
  `collision[k]`. Traced by the
  [shared tracer](ship.md#shared-tracer), 12 parts per frame on the shared
  silhouette. The five-Stardust pickup scales the centred parts by `18 / 9`.
- The tractor beam has no visual. A pulled pickup's drift toward Ada is the only
  feedback.

### Pull streak

`pullStreak` in `stardust.json`: two opaque wedges drawn in order behind a
pickup while it is inside Ada's tractor radius. Each point is `[u, v]` in
display px, `u` along the pull direction from the pickup's centre and `v`
across it. The first wedge is `#c9a86a` over `(-2.5, -1.2) (-9, 0)
(-2.5, 1.2)` and takes the ink keyline on a light field (`keyline`); the
second is `#f6e4b8` over `(-2.5, -0.6) (-6, 0) (-2.5, 0.6)`. The wedges start
inside the 9 px star and reach 4.5 px past its tips. `reducedMotion` is
`false`: reduced motion draws no streak ([handoff](polish-handoff.md)).

## Shared image

The Stardust and ore icons in the HUD status pill, the station balances, the
Shop's price pills and confirm price, the Exchange, the ship card and the
Penny markers are the pickups' own images: the `rest` frame of
`/art/stardust.png` and the frame of `/art/ore-nugget.png`, drawn at 18 by 18
px (2x) with nearest-neighbour filtering, centred in the 20 px icon slot. A
light-field outline, where one applies, is drawn around the image; no outline
is baked into it.

The shipped UI still draws `icon-stardust-20` and `icon-ore-20` from
`public/art/ui/icons/icons-20x20.svg` until it switches to the shared image;
the two vector icons then leave the sheet.

## HUD count

The count leads the HUD status pill beside the pause button:
the Stardust icon and the count in bold cream `#ead4aa`, as wide as it renders,
in at most five characters ("9999", "44.4k", "100k" to "9999k", "10m"), with a gold
`+N` tick (`#f4d98a`, the body) on pickup. Geometry and timing are `STATUS_PILL` in
[Layout](layout.md#status-pill); colours are in
[Controls](controls.md#status-pill).
