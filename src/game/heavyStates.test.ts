import { describe, expect, it } from "vitest";

import capitalHardpoints from "../../public/art/enemies/capital-hardpoints.json";
import { ART_MANIFEST } from "../testing/publicArt.ts";
import {
  bannerOffset,
  composedArchetypes,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
} from "./enemyArt.ts";
import {
  SALVAGED,
  salvagedColour,
  salvagedMatrix,
  showsBanner,
  spritesBounds,
} from "./heavyStates.ts";

const assets = ART_MANIFEST.assets as EnemyFrame[];
const capital = enemyArt(
  () => undefined,
  (archetype) => (archetype === "capital" ? capitalHardpoints : undefined),
  composedArchetypes(assets),
  assets,
  enemyFrameSets(assets),
).get("capital")!;

/** Applies a 4 x 5 row-major colour matrix to an opaque RGB colour. */
const apply = (matrix: readonly number[], rgb: readonly number[]) =>
  [0, 1, 2].map((row) =>
    [0, 1, 2].reduce((sum, column) => sum + matrix[row * 5 + column]! * rgb[column]!, 0),
  );

describe("disabled banner", () => {
  it("shows while a heavy is disabled and goes once it is salvaged", () => {
    expect(showsBanner({ disabled: false, salvaged: false })).toBe(false);
    expect(showsBanner({ disabled: true, salvaged: false })).toBe(true);
    expect(showsBanner({ disabled: true, salvaged: true })).toBe(false);
  });

  it("centres on the drawn heading's banner point in display px", () => {
    for (const heading of [0, 5, 12]) {
      const [x, y] = capitalHardpoints.headings[heading]!.banner;
      const offset = bannerOffset(capital, capital.frames[heading]!)!;
      expect(offset.x).toBeCloseTo((x! - 240) * (210 / 480), 9);
      expect(offset.y).toBeCloseTo((y! - 240) * (210 / 480), 9);
    }
  });
});

describe("salvaged dimming", () => {
  it("mixes each colour 85% toward its Rec. 601 grey and keeps alpha", () => {
    const matrix = salvagedMatrix();
    expect(matrix).toHaveLength(20);
    expect(matrix.slice(15)).toEqual([0, 0, 0, 1, 0]);
    for (const rgb of [
      [214, 139, 114],
      [255, 0, 0],
      [24, 20, 37],
    ] as const) {
      const luma = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
      const expected = rgb.map((c) => c + 0.85 * (luma - c));
      salvagedColour(rgb).forEach((c, index) => expect(c).toBeCloseTo(expected[index]!, 9));
      apply(matrix, rgb).forEach((c, index) => expect(c).toBeCloseTo(expected[index]!, 9));
    }
    expect(SALVAGED.alpha).toBe(0.6);
  });

  it("bounds a composed frame around its sprites' pivots", () => {
    const frame = (width: number, pivot = 0.5) =>
      ({
        displayHeight: width,
        displayWidth: width,
        id: "f",
        pivot: { x: pivot, y: pivot },
      }) as const;
    expect(
      spritesBounds([
        { frame: frame(20), offset: { x: 0, y: 0 } },
        { frame: frame(4), offset: { x: 15, y: -12 } },
      ]),
    ).toEqual({ bottom: 10, left: -10, right: 17, top: -14 });
  });
});
