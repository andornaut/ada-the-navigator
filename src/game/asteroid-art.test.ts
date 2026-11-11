import { describe, expect, it } from "vitest";

import { ASTEROID_ART } from "../data/asteroid-catalog.ts";
import type { Vec } from "../model/types.ts";
import {
  asteroidFiles,
  asteroidOutline,
  BACKDROP_FIELD,
  backdropRock,
  backdropTint,
  driftChips,
  footprintOutline,
  frameSilhouette,
  playDepth,
  rockArt,
} from "./asteroid-art.ts";

const ART = ASTEROID_ART;

describe("footprint outlines", () => {
  it("outlines only the union boundary of a footprint with several parts", () => {
    const rock = ART.asteroids.find((entry) => entry.frames[0]!.footprint.length > 1)!;
    const footprint = rock.frames[0]!.footprint;
    const outline = asteroidOutline(footprint);
    const span = ([a, b]: readonly [Vec, Vec]) => Math.hypot(b.x - a.x, b.y - a.y);
    const perimeter = outline.parts
      .flatMap((part) => part.map((at, index) => [at, part[(index + 1) % part.length]!] as const))
      .reduce((sum, edge) => sum + span(edge), 0);
    const drawn = outline.edges.reduce((sum, edge) => sum + span(edge), 0);
    expect(outline.parts).toHaveLength(footprint.length);
    expect(drawn).toBeLessThan(perimeter);
    expect(drawn).toBeGreaterThan(perimeter / 3);
    expect(footprintOutline(rock, 0)).toBe(footprintOutline(rock, 0));
  });

  it("projects the world footprint to display px about the pivot, inside the drawn rock", () => {
    for (const rock of ART.asteroids) {
      const points = footprintOutline(rock, 0).parts.flat();
      const drawn = frameSilhouette(rock, 0).flat();
      const [first] = rock.frames[0]!.footprint[0]!;
      expect(points[0]!.x).toBeCloseTo(first!.x - first!.y);
      expect(points[0]!.y).toBeCloseTo((first!.x + first!.y) / 2);
      // The base sits within the silhouette's horizontal extent.
      const xs = drawn.map((at) => at.x);
      for (const at of points) {
        expect(at.x, rock.id).toBeGreaterThanOrEqual(Math.min(...xs) - 1);
        expect(at.x, rock.id).toBeLessThanOrEqual(Math.max(...xs) + 1);
      }
    }
  });
});

describe("Art's asteroid sprites", () => {
  it("finds each rock by its own id", () => {
    for (const rock of ART.asteroids) {
      expect(rockArt(rock.id)).toBe(rock);
    }
    expect(rockArt("placeholder-small-0")).toBeUndefined();
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
