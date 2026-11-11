import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ASTEROID_FOOTPRINTS,
  ASTEROID_SIZES,
  readAsteroidCatalog,
} from "../data/asteroid-catalog.ts";
import type { Vec } from "../model/types.ts";
import {
  artVariant,
  asteroidFiles,
  asteroidOutline,
  BACKDROP_FIELD,
  backdropRock,
  backdropTint,
  cellTint,
  driftChips,
  footprintOutline,
  frameSilhouette,
  mixColor,
  playDepth,
  SPACE_TINTS,
  spinFrame,
  tinted,
} from "./asteroid-art.ts";

const ART = readAsteroidCatalog(
  JSON.parse(readFileSync(new URL("../../public/art/asteroids.json", import.meta.url), "utf8")),
)!;

describe("asteroid placeholder art", () => {
  it("outlines only the union boundary of lobed asteroids", () => {
    const lobed = ASTEROID_FOOTPRINTS.asteroids.find((entry) => entry.collision.length > 1)!;
    const outline = asteroidOutline(lobed);
    const span = ([a, b]: readonly [Vec, Vec]) => Math.hypot(b.x - a.x, b.y - a.y);
    const perimeter = outline.parts
      .flatMap((part) => part.map((at, index) => [at, part[(index + 1) % part.length]!] as const))
      .reduce((sum, edge) => sum + span(edge), 0);
    const drawn = outline.edges.reduce((sum, edge) => sum + span(edge), 0);
    expect(outline.parts).toHaveLength(lobed.collision.length);
    expect(drawn).toBeLessThan(perimeter);
    expect(drawn).toBeGreaterThan(perimeter / 3);
    const single = ASTEROID_FOOTPRINTS.asteroids.find((entry) => entry.collision.length === 1)!;
    expect(asteroidOutline(single).edges).toHaveLength(single.collision[0]!.length);
    expect(footprintOutline(single.id)?.entry).toBe(single);
  });

  it("places the pivot at the origin of display pixels", () => {
    const entry = ASTEROID_FOOTPRINTS.asteroids[0]!;
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

describe("Art's asteroid sprites", () => {
  it("dresses every footprint in a rock of its size, larger footprints in larger rocks", () => {
    for (const size of ASTEROID_SIZES) {
      const footprints = ASTEROID_FOOTPRINTS.asteroids
        .filter((entry) => entry.size === size)
        .sort((a, b) => a.radius - b.radius);
      const rocks = footprints.map((entry) => artVariant(ART, entry.id)!);
      expect(rocks.every((rock) => rock.size === size)).toBe(true);
      // Equal counts per size: each rock dresses exactly one footprint, in radius order.
      expect(new Set(rocks).size).toBe(rocks.length);
      expect(rocks.map((rock) => rock.radius)).toEqual(
        [...rocks].map((rock) => rock.radius).sort((a, b) => a - b),
      );
    }
    expect(artVariant(ART, "unknown")).toBeUndefined();
  });

  it("turns spinning rocks through every frame at their seeded rate, in either direction", () => {
    const small = ART.asteroids.find((rock) => rock.size === "small")!;
    const huge = ART.asteroids.find((rock) => rock.size === "huge")!;
    const [slow, fast] = (small.spin as { degPerSecond: [number, number] }).degPerSecond;
    const frames = (id: string, seconds: number[]) =>
      seconds.map((at) => spinFrame(small, 7, false, id, at));
    // One frame is 15 degrees: at the slowest rate a frame lasts 15 / slow seconds at most.
    const sampled = frames(
      "rock-a",
      Array.from({ length: 400 }, (_, index) => index * 0.25),
    );
    expect(new Set(sampled).size).toBe(24);
    const steps = new Set<number>();
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const [now, next] = frames(id, [0, 15 / fast]);
      steps.add((next! - now! + 24) % 24);
    }
    // Each rock moves at most one frame per 15 / fast seconds; both directions occur.
    expect([...steps].every((step) => [0, 1, 23].includes(step))).toBe(true);
    expect(steps.has(1) && steps.has(23)).toBe(true);
    expect(spinFrame(small, 7, false, "rock-a", 3)).toBe(spinFrame(small, 7, false, "rock-a", 3));
    expect(slow).toBeLessThan(fast);
    expect(spinFrame(small, 7, true, "rock-a", 3)).toBe(0);
    expect(spinFrame(huge, 7, false, "rock-a", 3)).toBe(0);
  });

  it("scales a frame's silhouette to display px about the pivot", () => {
    const rock = ART.asteroids[0]!;
    const parts = frameSilhouette(rock, 0);
    const scale = rock.display.width / rock.frame.width;
    const [x, y] = [rock.frames[0]!.collision[0]![0]!.x, rock.frames[0]!.collision[0]![0]!.y];
    expect(parts[0]![0]!.x).toBeCloseTo((x - rock.pivot.x * rock.frame.width) * scale);
    expect(parts[0]![0]!.y).toBeCloseTo(
      (y - rock.pivot.y * rock.frame.height) * (rock.display.height / rock.frame.height),
    );
    const xs = parts.flat().map((at: Vec) => at.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(rock.display.width);
  });

  it("trails four shrinking, fading chips behind a drifting rock, outside its silhouette", () => {
    const rock = ART.asteroids.find((entry) => entry.size === "medium")!;
    const chips = driftChips(rock, 3, 0, "drifter", { x: -1, y: 0 });
    expect(chips.map((chip) => [chip.size, chip.alpha])).toEqual([
      [2, 0.9],
      [2, 0.7],
      [1, 0.5],
      [1, 0.35],
    ]);
    const points = frameSilhouette(rock, 0).flat();
    const xs = points.map((at) => at.x);
    const ys = points.map((at) => at.y);
    const left = Math.min(...xs);
    const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
    // Straight left, the ellipse edge is the bounds' left edge: chip i sits 4 + 6.5 i past it,
    // at most 1.5 to either side.
    chips.forEach((chip, index) => {
      expect(chip.x).toBeCloseTo(left - 4 - 6.5 * index);
      expect(Math.abs(chip.y - middle)).toBeLessThanOrEqual(1.5);
    });
    expect(driftChips(rock, 3, 0, "drifter", { x: 0, y: 0 })).toEqual([]);
  });

  it("tints the backdrop by galaxy, sorts play objects by pivot y and lists every SVG", () => {
    expect(backdropTint(ART, 1)).toEqual(ART.tints.sunflower);
    expect(backdropTint(ART, 3)).toEqual(ART.tints.whirlpool);
    expect(backdropTint(ART, null)).toEqual(ART.tints.base);
    const cells = Array.from({ length: 400 }, (_, index) =>
      backdropRock(ART, 9, index % 20, index),
    );
    const filled = cells.filter((cell) => cell !== null);
    expect(filled.length / cells.length).toBeGreaterThan(BACKDROP_FIELD.chance - 0.1);
    expect(filled.length / cells.length).toBeLessThan(BACKDROP_FIELD.chance + 0.1);
    for (const cell of filled) {
      expect(cell.scale).toBeGreaterThanOrEqual(0.6);
      expect(cell.scale).toBeLessThanOrEqual(1);
    }
    expect(backdropRock(ART, 9, 4, 4)).toEqual(backdropRock(ART, 9, 4, 4));
    expect(playDepth(100)).toBeLessThan(playDepth(101));
    expect(playDepth(-50)).toBeGreaterThan(1.9);
    expect(playDepth(5000)).toBeLessThan(3);
    expect(asteroidFiles(ART)).toHaveLength(202);
  });
});
