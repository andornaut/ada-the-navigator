import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readAsteroidCatalog } from "./asteroid-catalog.ts";
import { GALAXIES } from "./storybook.ts";

const PUBLIC = new URL("../../public", import.meta.url).pathname;
const FILE = JSON.parse(readFileSync(`${PUBLIC}/art/asteroids.json`, "utf8")) as Record<
  string,
  unknown
> & { asteroids: Record<string, unknown>[] };
const MANIFEST = JSON.parse(readFileSync(`${PUBLIC}/art/manifest.json`, "utf8")) as {
  asteroids?: string;
};

describe("Art's asteroid catalog, version 1", () => {
  const catalog = readAsteroidCatalog(FILE)!;

  it("reads the delivered file, linked from the manifest", () => {
    expect(MANIFEST.asteroids).toBe("/art/asteroids.json");
    expect(catalog).toBeDefined();
    expect(catalog.displayScale).toBe(0.4375);
    expect(catalog.stone).toHaveLength(5);
  });

  it("gives small and medium rocks 24 spin frames and large and huge one still frame", () => {
    const sizes = new Map<string, number>();
    for (const rock of catalog.asteroids) {
      sizes.set(rock.size, (sizes.get(rock.size) ?? 0) + 1);
      const spins = rock.size === "small" || rock.size === "medium";
      expect(rock.frames, rock.id).toHaveLength(spins ? 24 : 1);
      expect(rock.spin === false, rock.id).toBe(!spins);
      for (const frame of rock.frames) {
        expect(frame.collision.length, frame.file).toBeGreaterThan(0);
      }
    }
    expect(Object.fromEntries(sizes)).toEqual({ huge: 3, large: 3, medium: 4, small: 4 });
  });

  it("names only files that exist and backdrop tints for the base field and every galaxy", () => {
    const files = [
      ...catalog.asteroids.flatMap((rock) => rock.frames.map((frame) => frame.file)),
      ...catalog.backdrop.sprites.map((sprite) => sprite.file),
    ];
    expect(files).toHaveLength(202);
    for (const file of files) {
      expect(existsSync(`${PUBLIC}${file}`), file).toBe(true);
    }
    const ids = GALAXIES.map((galaxy) => galaxy.id);
    expect(Object.keys(catalog.tints).sort()).toEqual(["base", ...ids].sort());
  });

  const first = FILE.asteroids[0]!;
  it.each([
    ["an unknown version", { ...FILE, version: 2 }],
    ["a duplicate id", { ...FILE, asteroids: [first, first] }],
    [
      "the former top-level collision without frames",
      { ...FILE, asteroids: [{ ...first, collision: [[[0, 0]]], frames: undefined }] },
    ],
    ["a spin range pair", { ...FILE, asteroids: [{ ...first, spin: [8, 18] }] }],
    ["a still rock with several frames", { ...FILE, asteroids: [{ ...first, spin: false }] }],
    [
      "a concave collision part",
      {
        ...FILE,
        asteroids: [
          {
            ...first,
            frames: [
              {
                collision: [
                  [
                    [0, 0],
                    [10, 0],
                    [2, 2],
                    [0, 10],
                  ],
                ],
                file: "/art/asteroids/x.svg",
              },
            ],
            spin: false,
          },
        ],
      },
    ],
    ["backdrop tints without the base field", { ...FILE, tints: { sunflower: {} } }],
    ["tints at the backdrop instead of the root", { ...FILE, tints: undefined }],
  ])("rejects %s", (_, file) => {
    expect(readAsteroidCatalog(JSON.parse(JSON.stringify(file)))).toBeUndefined();
  });
});
