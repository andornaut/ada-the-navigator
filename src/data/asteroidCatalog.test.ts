import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_ART, readAsteroidCatalog } from "./asteroidCatalog.ts";
import { BUILT } from "./galaxies.ts";
import { GALAXIES } from "./storybook.ts";

const PUBLIC = new URL("../../public", import.meta.url).pathname;
const FILE = JSON.parse(readFileSync(`${PUBLIC}/art/asteroids.json`, "utf8")) as Record<
  string,
  unknown
> & { asteroids: Record<string, unknown>[] };
const CRYSTALS = FILE.crystals as Record<string, unknown>;
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
    // The model's catalog is this file, read at import.
    expect(ASTEROID_ART).toEqual(catalog);
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
    expect(files).toHaveLength(204);
    expect(new Set(files).size).toBe(files.length);
    const sources = [
      ...catalog.asteroids.flatMap((rock) =>
        rock.svgSheet ? [rock.svgSheet] : rock.frames.map((frame) => frame.file),
      ),
      ...catalog.backdrop.sprites.map((sprite) => sprite.file),
    ];
    for (const file of sources) {
      expect(existsSync(`${PUBLIC}${file}`), file).toBe(true);
    }
    // The base field and every built galaxy have a tint; each other tint names a galaxy.
    const ids = GALAXIES.map((galaxy) => galaxy.id);
    const built = GALAXIES.filter(({ galaxy }) => BUILT.has(galaxy)).map(({ id }) => id);
    expect(Object.keys(catalog.tints)).toEqual(expect.arrayContaining(["base", ...built]));
    expect(Object.keys(catalog.tints).filter((id) => id !== "base" && !ids.includes(id))).toEqual(
      [],
    );
  });

  it("reads crystal variants that keep their plain rocks' size, frames and geometry", () => {
    const { crystals } = catalog;
    expect(crystals.ramp).toHaveLength(5);
    expect(crystals.rocks).toHaveLength(17);
    const plain = new Map(catalog.asteroids.map((rock) => [rock.id, rock]));
    for (const [id, variants] of Object.entries(crystals.variants)) {
      const base = plain.get(id)!;
      expect(base, id).toBeDefined();
      // Small rocks are never crystal rocks; ore fields place no huge rocks.
      expect(Object.keys(variants).sort(), id).toEqual(
        base.size === "small" ? [] : base.size === "huge" ? ["small"] : ["full", "small"],
      );
      for (const variantId of Object.values(variants)) {
        const variant = crystals.rocks.find((rock) => rock.id === variantId)!;
        expect(variant.size).toBe(base.size);
        expect(variant.pivot).toEqual(base.pivot);
        expect(variant.frame).toEqual(base.frame);
        expect(variant.spin).toEqual(base.spin);
        expect(
          variant.frames.map(({ collision, footprint }) => ({ collision, footprint })),
        ).toEqual(base.frames.map(({ collision, footprint }) => ({ collision, footprint })));
        expect(existsSync(`${PUBLIC}${variant.svgSheet!}`), variant.svgSheet).toBe(true);
      }
    }
  });

  const first = FILE.asteroids[0]!;
  it("adds a physical sheet source without changing any logical frame or geometry", () => {
    const rock = FILE.asteroids.find(({ id }) => id === "asteroid-m1")!;
    const svgSheet = "/art/asteroids/asteroid-m1-sheet.svg";
    const read = (entry: Record<string, unknown>) =>
      readAsteroidCatalog({ ...FILE, asteroids: [entry] })?.asteroids[0];
    expect(read({ ...rock, svgSheet })).toEqual({ ...read(rock), svgSheet });
  });

  it.each([
    ["an unknown version", { ...FILE, version: 2 }],
    ["a duplicate id", { ...FILE, asteroids: [first, first] }],
    [
      "the former top-level collision without frames",
      { ...FILE, asteroids: [{ ...first, collision: [[[0, 0]]], frames: undefined }] },
    ],
    ["a spin range pair", { ...FILE, asteroids: [{ ...first, spin: [8, 18] }] }],
    [
      "an external sheet source",
      { ...FILE, asteroids: [{ ...first, svgSheet: "https://example.com/rock.svg" }] },
    ],
    [
      "a rock without its footprint radius",
      { ...FILE, asteroids: [{ ...first, footprintRadius: 0 }] },
    ],
    [
      "a frame without its footprint",
      {
        ...FILE,
        asteroids: [
          {
            ...first,
            frames: (first.frames as Record<string, unknown>[]).map((frame) => ({
              ...frame,
              footprint: undefined,
            })),
          },
        ],
      },
    ],
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
    ["no crystals", { ...FILE, crystals: undefined }],
    [
      "a crystal selection under another flag",
      {
        ...FILE,
        crystals: {
          ...CRYSTALS,
          selection: { ...(CRYSTALS.selection as object), flag: "ore" },
        },
      },
    ],
    [
      "a crystal share above 1",
      {
        ...FILE,
        crystals: {
          ...CRYSTALS,
          selection: {
            ...(CRYSTALS.selection as object),
            ordinary: { ...(CRYSTALS.selection as { ordinary: object }).ordinary, share: 1.5 },
          },
        },
      },
    ],
    [
      "a variant naming no crystal rock",
      {
        ...FILE,
        crystals: { ...CRYSTALS, variants: { "asteroid-m1": { small: "asteroid-m1-glow" } } },
      },
    ],
    [
      "a variant of another size",
      {
        ...FILE,
        crystals: {
          ...CRYSTALS,
          variants: {
            ...(CRYSTALS.variants as object),
            "asteroid-h1": { small: "asteroid-l1-crystals-small" },
          },
        },
      },
    ],
    [
      "a crystal rock no variant names",
      {
        ...FILE,
        crystals: {
          ...CRYSTALS,
          variants: { ...(CRYSTALS.variants as object), "asteroid-h3": {} },
        },
      },
    ],
  ])("rejects %s", (_, file) => {
    expect(readAsteroidCatalog(JSON.parse(JSON.stringify(file)))).toBeUndefined();
  });
});
