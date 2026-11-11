import { describe, expect, it } from "vitest";

import { ASTEROID_CATALOG } from "../data/asteroid-catalog.ts";
import type { Vec } from "../model/types.ts";
import {
  asteroidArt,
  asteroidOutline,
  cellTint,
  mixColor,
  SPACE_TINTS,
  tinted,
} from "./asteroid-art.ts";

describe("asteroid placeholder art", () => {
  it("outlines only the union boundary of lobed asteroids", () => {
    const lobed = ASTEROID_CATALOG.asteroids.find((entry) => entry.collision.length > 1)!;
    const outline = asteroidOutline(lobed);
    const span = ([a, b]: readonly [Vec, Vec]) => Math.hypot(b.x - a.x, b.y - a.y);
    const perimeter = outline.parts
      .flatMap((part) => part.map((at, index) => [at, part[(index + 1) % part.length]!] as const))
      .reduce((sum, edge) => sum + span(edge), 0);
    const drawn = outline.edges.reduce((sum, edge) => sum + span(edge), 0);
    expect(outline.parts).toHaveLength(lobed.collision.length);
    expect(drawn).toBeLessThan(perimeter);
    expect(drawn).toBeGreaterThan(perimeter / 3);
    const single = ASTEROID_CATALOG.asteroids.find((entry) => entry.collision.length === 1)!;
    expect(asteroidOutline(single).edges).toHaveLength(single.collision[0]!.length);
    expect(asteroidArt(single.id)?.entry).toBe(single);
  });

  it("places the pivot at the origin of display pixels", () => {
    const entry = ASTEROID_CATALOG.asteroids[0]!;
    const xs = asteroidOutline(entry)
      .parts.flat()
      .map((at) => at.x);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });

  it("keeps tints light: a small share of the hue mixed into the muted role", () => {
    const base = 0x403f4d;
    expect(mixColor(0, 0xffffff, base)).toBe(base);
    expect(mixColor(1, 0xffffff, base)).toBe(0xffffff);
    expect(tinted(0.3, "unknown", base)).toBe(base);
    const lilac = tinted(0.3, "lilac", base);
    expect(lilac).not.toBe(base);
    expect(lilac).toBe(mixColor(0.3, SPACE_TINTS.lilac!, base));
    expect(cellTint(3, -7)).toBe(cellTint(3, -7));
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map((x) => cellTint(x, 2 * x))).size).toBeGreaterThan(
      1,
    );
  });
});
