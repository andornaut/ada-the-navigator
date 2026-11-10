# Ship geometry

- Rebuild with `node art/tools/ship.ts` inside the isolated export container.
  The single module uses Node builtins and writes directly to `public/art/`.
- Exports: `ship-{0..7}.svg` and `ship-thrust-{0..7}.svg`.
  `ship.svg` and `ship-thrust.svg` are byte-identical aliases of index 5 (up).
- Transparent 96 by 96 viewport, pivot (48, 48), display 42 by 42.
  Keep the viewport intact and render the selected frame with rotation zero.
- Heading index is normalized `round(atan2(world.y, world.x) / (PI / 4))` modulo 8.
  Index 0 projects down-right, 1 down, 2 down-left, 3 left, 4 up-left,
  5 up, 6 up-right and 7 right.
- Local forward is negative Y. Rotate the solid model into world heading before
  projecting `screenX = (x - y) * sqrt(3) / 2` and
  `screenY = (x + y) / 2 - z`, then add the viewport pivot.
- Compact white triangular hull, two triangular rear wings and a small vertical
  triangular tail use eleven hull polygons before visibility culling. Filled
  shaded sides show thickness. The low opaque blue canopy has a flat trapezoidal roof,
  two blue tones and a two-occupant footprint of roughly 27 percent of the central hull top, without interior detail.
- Twin mouths sit at the rear wing corners and stay blue in both states.
  Thrust adds short pale blue flames.
  Faces share one projection and outward-normal culling. Wing sides precede wing
  tops, then hull sides and hull top, then canopy. The tail draws before or after
  the canopy according to heading; depth orders faces within each layer.
  No raster assets, filters, strokes, external dependencies or screen rotation.
