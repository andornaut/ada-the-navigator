import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import art from "../../public/art/cartwheel/ore-field.json";
import { ORE_FIELD_LAYOUTS, oreFieldLayout, readOreFieldLayouts } from "./oreFieldLayouts.ts";

const families = [
  "loose-cluster",
  "crescent",
  "two-pockets",
  "broken-ring",
  "scattered-trail",
  "three-pockets",
  "forked-trail",
  "open-spiral",
];
const altered = (change: (copy: typeof art) => void) => {
  const copy = structuredClone(art);
  change(copy);
  return copy;
};

describe("ore field family catalog", () => {
  it("reads eight distinct families, each realizing the existing six-through-ten counts", () => {
    expect(ORE_FIELD_LAYOUTS.variants.map(({ id }) => id)).toEqual(families);
    expect(ORE_FIELD_LAYOUTS.count).toEqual([6, 10]);
    expect(ORE_FIELD_LAYOUTS.radius).toBe(450);
    expect(ORE_FIELD_LAYOUTS.gap).toBe(55);
    for (const count of [6, 7, 8, 9, 10]) {
      const loose = oreFieldLayout("loose-cluster", count);
      const compositions = loose.map(({ asteroid, frame, resource }) => ({
        asteroid,
        frame,
        resource,
      }));
      const positions = new Set<string>();
      for (const id of families) {
        const rocks = oreFieldLayout(id, count);
        expect(rocks).toHaveLength(count);
        expect(
          rocks.map(({ asteroid, frame, resource }) => ({ asteroid, frame, resource })),
        ).toEqual(compositions);
        positions.add(JSON.stringify(rocks.map(({ position }) => position)));
      }
      expect(positions.size).toBe(families.length);
    }
  });

  it("preserves the five original loose-cluster layouts without changing authored rock identity or position", () => {
    const rows = [6, 7, 8, 9, 10].map((count) => ({
      count,
      rocks: oreFieldLayout("loose-cluster", count).map(({ asteroid, frame, position }) => ({
        frame,
        id: asteroid.replace("asteroid-", "resource-"),
        position: [position.x, position.y],
      })),
    }));
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(
            rows.map(({ count, rocks }) => [
              count,
              rocks.map(({ frame, id, position }) => [id, position, frame]),
            ]),
          ),
        )
        .digest("hex"),
    ).toBe("d01240aec1f4d6f0acfa30e074e0483181018d8582c5321cb6d2030b6e6f5cd9");
  });

  it("rejects empty or duplicate families and incomplete or duplicate counts", () => {
    expect(() => readOreFieldLayouts({ ...art, variants: [] })).toThrow();
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants.push(copy.variants[0]!);
        }),
      ),
    ).toThrow("duplicate family");
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants[0]!.layouts.pop();
        }),
      ),
    ).toThrow("lacks a supported count");
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants[0]!.layouts.push(copy.variants[0]!.layouts[0]!);
        }),
      ),
    ).toThrow("do not match its count");
    expect(() => oreFieldLayout("unknown", 6)).toThrow();
    expect(() => oreFieldLayout("loose-cluster", 5)).toThrow();
  });

  it("rejects unsupported shapes, frames and overlapping or out-of-bounds geometry", () => {
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants[0]!.layouts[0]!.rocks[0]!.id = "resource-m99";
        }),
      ),
    ).toThrow("does not read");
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants[0]!.layouts[0]!.rocks[0]!.frame = 99;
        }),
      ),
    ).toThrow("does not read");
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          copy.variants[0]!.layouts[0]!.rocks[0]!.position = [9999, 0];
        }),
      ),
    ).toThrow("field clearance");
    expect(() =>
      readOreFieldLayouts(
        altered((copy) => {
          const row = copy.variants[0]!.layouts[0]!;
          row.rocks[1]!.position = [...row.rocks[0]!.position];
        }),
      ),
    ).toThrow("field clearance");
    expect(() => readOreFieldLayouts({ ...art, version: 1 })).toThrow("version 2");
  });
});
