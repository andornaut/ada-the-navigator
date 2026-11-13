import { expect, it } from "vitest";

import { fogStampBounds } from "./mapFog.ts";

it.each([
  {
    clipHeight: 55,
    clipWidth: 55,
    height: 56,
    padding: 26,
    pixels: 3136,
    rx: 0.1,
    ry: 0.05,
    sigma: 3,
    width: 56,
    x: 28,
    y: 28,
  },
  {
    clipHeight: 72,
    clipWidth: 89,
    height: 72,
    padding: 26,
    pixels: 6480,
    rx: 17.4,
    ry: 8.7,
    sigma: 3,
    width: 90,
    x: 45,
    y: 36,
  },
  {
    clipHeight: 123,
    clipWidth: 155,
    height: 124,
    padding: 44,
    pixels: 19344,
    rx: 32.25,
    ry: 16.125,
    sigma: 5.16,
    width: 156,
    x: 78,
    y: 62,
  },
])("preserves fractional ellipse clip and bitmap extents for radius $rx", (expected) => {
  expect(fogStampBounds(expected)).toEqual(expected);
});
