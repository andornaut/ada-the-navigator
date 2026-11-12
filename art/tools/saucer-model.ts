// Elder Loom's saucer (needle-craft.ts): a pearl saucer with a lavender thread band round its rim,
// a raised upper deck and a smoked bridge dome with a warm pane, two short nacelles slung low on
// struts from the rear flanks with lavender tail bands and blue bow lamps, and a small stern pod
// between them. No wings or tail. Design units, built at SAUCER_SCALE. Contract: art/needle.md
// (Elder Loom's saucer).
import { FWD, cube, disc, hcyl, part, scaleGroups, uv } from "./hull-shapes.ts";
import {
  blueSide,
  glass,
  glassSide,
  lav,
  lavSide,
  pearl,
  pearlRear,
  pearlSide,
} from "./needle-common.ts";
import { blue, orientedBox, type Part, warm } from "./solid.ts";

const SAUCER_SCALE = 1.2;

// Heights parts rest on (the saucer top): groups based there draw after those below.
export const SAUCER_LEVELS = [9.5 * SAUCER_SCALE];
// Jet mouths (u, v, z) at the nacelle tails, and their width.
export const SAUCER_MOUTHS = (
  [
    [-21.6, -13, 4.8],
    [-21.6, 13, 4.8],
  ] as const
).map(([u, v, z]) => [u * SAUCER_SCALE, v * SAUCER_SCALE, z * SAUCER_SCALE] as const);
export const SAUCER_MOUTH_WIDTH = 3 * SAUCER_SCALE;

export function saucer(): Part[][] {
  const hull = { top: pearl, side: pearlSide, rear: pearlRear, back: "flat" } as const;
  return scaleGroups(SAUCER_SCALE, [
    ...[-1, 1].map((s) => hcyl(-21, -3, s * 13, 4.8, 2.6, hull)),
    ...[-1, 1].map((s) => [
      part(orientedBox(...uv(-20.6, s * 13), FWD, 1.2, 5), 2.4, 7.2, lav, lavSide),
    ]),
    ...[-1, 1].map((s) => [disc(-3.2, s * 13, 1.5, 3.6, 6, blue, blueSide, 8)]),
    ...[-1, 1].map((s) => [
      part(orientedBox(...uv(-10, s * 9.5), FWD + s * 0.35, 4, 1.2), 5, 8, pearlSide, pearlRear),
    ]),
    hcyl(-18, -4, 0, 5.4, 3, hull),
    [
      disc(4, 0, 17, 7, 7.6, pearl, pearlSide, 24),
      disc(4, 0, 17.4, 7.6, 8.8, lav, lavSide, 24),
      disc(4, 0, 17, 8.8, 9.5, pearl, pearlSide, 24),
    ],
    [disc(4, 0, 11, 9.5, 10.7, pearl, pearlSide, 20)],
    [
      disc(6, 0, 4, 10.7, 12.4, glass, glassSide, 12),
      part(orientedBox(...uv(9.4, 0), FWD, 0.8, 3.2), 11, 12, warm, warm),
    ],
    [cube(4, -17.2, 9.5, 1.4, blue)],
    [cube(4, 17.2, 9.5, 1.4, blue)],
  ]);
}
