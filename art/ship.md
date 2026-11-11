# Ship geometry

- Rebuild with `node art/tools/ship.ts` when resources are available.
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
- Compact delta A uses one continuous filled white hull with two rear wing
  corners and a small vertical triangular tail. The six-point hull and large
  six-point opaque blue canopy match the selected plan coordinates at scale 0.32:
  `localX = planY * 0.32`, `localY = planX * 0.32`. Reversing mapped vertex
  order preserves counterclockwise top winding.
- Hull thickness is 4 units. The canopy uses its full selected hexagonal footprint,
  a flat roof 3.5 units above the hull and darker blue vertical sides. No interior,
  seams or panel detail. The canopy size follows the selected profile directly.
- Twin subtle blue mouths follow the rear wing edges near their outer corners.
  Thrust adds pale blue flames 16 units long with 9-unit white cores, readable at
  42px display. Hull sides precede the continuous hull top;
  canopy sides precede its roof. The tail draws before or after the canopy
  according to heading. All faces use one projection and outward-normal culling;
  depth orders faces within each component layer.
- No raster assets, filters, strokes, external dependencies or screen rotation.
