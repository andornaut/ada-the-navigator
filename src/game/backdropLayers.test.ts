import { describe, expect, it } from "vitest";

import * as art from "../../art/tools/backdrop-field.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import {
  chunkItems,
  inside,
  patternValue,
  plates,
  project,
  type Rect,
  valueNoise,
  type Xy,
} from "./backdropField.ts";
import {
  type GalaxyBackdrop,
  paintCluster,
  paintDisc,
  paintPlanet,
  paintSky,
  readBackdropRules,
  readGalaxyBackdrop,
  SKY_AREA,
  skyColor,
  streakPieces,
  twinkleAt,
  viewFar,
  viewPlanets,
  viewPlates,
  viewStars,
  viewStreaks,
} from "./backdropLayers.ts";

const rulesFile = publicJson(CORE_MANIFEST.backdropLayers as string) as Record<string, unknown>;
const rules = readBackdropRules(rulesFile)!;
const backdrops = new Map(
  GALAXY_NUMBERS.map((galaxy) => [
    galaxy,
    readGalaxyBackdrop(publicJson(GALAXY_MANIFESTS.get(galaxy)!.links.backdrop!))!,
  ]),
);
const backdropOf = (galaxy: (typeof GALAXY_NUMBERS)[number]): GalaxyBackdrop =>
  backdrops.get(galaxy)!;
const CAMERAS: readonly Xy[] = [
  [0, 0],
  [1234, -567],
  [-8000, 4200],
  [25000, 31000],
];
const texel = (raster: { data: Uint8ClampedArray; width: number }, x: number, y: number) => [
  ...raster.data.slice((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4),
];

describe("backdrop layers data", () => {
  it("reads Art's shared rules for the 720 by 360 view and every backdropOf's backdrop", () => {
    expect(rulesFile.view).toEqual([SCREEN.width, SCREEN.height]);
    expect(rules).toMatchObject({
      far: { parallax: 0.05 },
      planets: { parallax: 0.12 },
      plates: { parallax: 0.15 },
      rocks: { parallax: 0.8 },
      specks: { parallax: 0.7 },
      streaks: { parallax: 0.6 },
    });
    expect(rules.stars.layers.map(({ name, parallax }) => [name, parallax])).toEqual([
      ["far", 0.3],
      ["near", 0.5],
    ]);
    for (const galaxy of GALAXY_NUMBERS) {
      expect(backdropOf(galaxy).galaxy, String(galaxy)).toBe(GALAXY_ID[galaxy]);
    }
    expect(readBackdropRules({ ...rulesFile, version: 2 })).toBeUndefined();
    expect(readBackdropRules({ ...rulesFile, plates: { parallax: 0.15 } })).toBeUndefined();
    expect(readGalaxyBackdrop({ galaxy: "sunflower", version: 1 })).toBeUndefined();
  });

  it("names each fixed layer by a link of its backdropOf's manifest: Andromeda's haze, Needle's band", () => {
    const fixed = GALAXY_NUMBERS.map((galaxy) => [GALAXY_ID[galaxy], backdropOf(galaxy).fixed]);
    expect(Object.fromEntries(fixed)).toEqual({
      andromeda: ["backdropHaze"],
      cartwheel: [],
      needle: ["needleBand"],
      phantom: [],
      sunflower: [],
      whirlpool: [],
    });
    for (const galaxy of GALAXY_NUMBERS) {
      const links = GALAXY_MANIFESTS.get(galaxy)!.links as Record<string, unknown>;
      for (const link of backdropOf(galaxy).fixed) {
        expect(typeof links[link], link).toBe("string");
      }
    }
  });

  it("draws Whirlpool's nebulae from its manifest's 192 by 80 textures at 768 by 320", () => {
    const far = backdropOf(3).far;
    expect(far).toEqual([{ assets: ["nebula-whirlpool-1", "nebula-whirlpool-2"], look: "nebula" }]);
    expect(rules.nebula.display).toEqual([768, 320]);
    const assets = GALAXY_MANIFESTS.get(3)!.assets;
    for (const id of ["nebula-whirlpool-1", "nebula-whirlpool-2"]) {
      expect(assets.find((asset) => asset.id === id)).toMatchObject({
        displayHeight: 320,
        displayWidth: 768,
        height: 80,
        width: 192,
      });
    }
  });
});

describe("backdrop field generation", () => {
  it("follows Art's generator exactly: noise, patterns, plates and chunks", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      const { plates: spec, seed } = backdropOf(galaxy);
      for (const [u, v] of [
        [0, 0],
        [-913.5, 2207.25],
        [40123, -1987],
      ] as const) {
        expect(patternValue(seed, spec.pattern, u, v)).toBe(
          art.patternValue(seed, spec.pattern as art.Pattern, u, v),
        );
        const octave = { angle: -6, salt: "plate-n1", scale: 300, stretch: 6, weight: 1 };
        expect(valueNoise(seed, octave, u, v)).toBe(art.valueNoise(seed, octave, u, v));
      }
      for (const camera of CAMERAS) {
        const [x, y] = project(camera[0], camera[1]);
        const rect: Rect = [x * 0.15 - 376, y * 0.15 - 196, x * 0.15 + 376, y * 0.15 + 196];
        expect(plates(seed, rules.plates, spec, rect)).toEqual(
          art.plates(
            seed,
            { ...rules.plates, edges: [...rules.plates.edges] as [number, number, number, number] },
            spec as art.PlateSpec,
            rect,
          ),
        );
        const rule = { chance: rules.planets.chance, chunk: rules.planets.chunk };
        expect(chunkItems(seed, "planet", rule, rect)).toEqual(
          art.chunkItems(seed, "planet", rule, rect),
        );
      }
    }
  });

  it("tiles the view with plates that never overlap, a few steps either side of the sky", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      for (const camera of CAMERAS) {
        const view = viewPlates(rules, backdropOf(galaxy), camera);
        expect(view.length, String(galaxy)).toBeGreaterThan(0);
        for (let x = 5; x < SCREEN.width; x += 71) {
          for (let y = 5; y < SCREEN.height; y += 53) {
            const hits = view.filter((plate) => inside(plate.points, x, y)).length;
            expect(hits).toBeLessThanOrEqual(1);
          }
        }
        for (const plate of view) {
          expect(plate.multiply === undefined).toBe(plate.screen !== undefined);
        }
      }
    }
    // Andromeda's plates only shade, so the haze stays its light.
    expect(viewPlates(rules, backdropOf(5), [0, 0]).every((plate) => plate.multiply)).toBe(true);
  });
});

describe("backdrop layers in the view", () => {
  it("moves each layer by its parallax share of the camera's projected motion", () => {
    const delta: Xy = [300, -100];
    const [sx, sy] = project(delta[0], delta[1]);
    const shifted = (from: Xy, parallax: number): Xy => [
      from[0] - sx * parallax,
      from[1] - sy * parallax,
    ];
    const before = viewPlates(rules, backdropOf(2), [0, 0])[0]!;
    const after = viewPlates(rules, backdropOf(2), delta).find((plate) =>
      plate.points.every((point, k) => {
        const [x, y] = shifted(before.points[k]!, 0.15);
        return Math.abs(point[0] - x) < 1e-9 && Math.abs(point[1] - y) < 1e-9;
      }),
    );
    expect(after).toBeDefined();
    const stars = viewStars(rules, backdropOf(2), [0, 0], 0, true);
    const moved = viewStars(rules, backdropOf(2), delta, 0, true);
    // A star of either depth, moved by 0.3 or 0.5 of the camera's projected motion.
    for (const parallax of [0.3, 0.5]) {
      const star = stars.find((each) => {
        const [x, y] = shifted([each.x, each.y], parallax);
        return moved.some((other) => Math.abs(other.x - x) < 1e-9 && Math.abs(other.y - y) < 1e-9);
      });
      expect(star, String(parallax)).toBeDefined();
    }
  });

  it("places one or two planets and far items at most, with their recipes", () => {
    let planets = 0;
    let far = 0;
    for (const galaxy of GALAXY_NUMBERS) {
      for (let k = 0; k < 40; k++) {
        const camera: Xy = [k * 2400, k * -1100];
        const seen = viewPlanets(rules, backdropOf(galaxy), camera);
        const items = viewFar(rules, backdropOf(galaxy), camera);
        expect(seen.length).toBeLessThanOrEqual(4);
        expect(items.length).toBeLessThanOrEqual(4);
        planets += seen.length;
        far += items.length;
        for (const planet of seen) {
          expect(backdropOf(galaxy).planets).toContain(planet.recipe);
          expect(planet.r).toBeLessThanOrEqual(98 * planet.recipe.size);
        }
      }
    }
    expect(planets).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(0);
    // Sunflower and Needle have no far items.
    expect(viewFar(rules, backdropOf(1), [0, 0])).toEqual([]);
    expect(viewFar(rules, backdropOf(4), [0, 0])).toEqual([]);
  });

  it("twinkles each star across 0.7 to 1, held at 0.85 under reduced motion", () => {
    const { twinkle } = rules.stars;
    const values = Array.from({ length: 200 }, (_, k) =>
      twinkleAt(twinkle, 9, "1,2", "star-far-3", k * 0.07, false),
    );
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.7);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.25);
    expect(twinkleAt(twinkle, 9, "1,2", "star-far-3", 3.3, true)).toBe(0.85);
    const held = viewStars(rules, backdropOf(3), [0, 0], 0, true);
    expect(viewStars(rules, backdropOf(3), [0, 0], 12.5, true)).toEqual(held);
    expect(viewStars(rules, backdropOf(3), [0, 0], 12.5, false)).not.toEqual(held);
    // About 60 stars cover the view.
    expect(held.length).toBeGreaterThan(40);
    expect(held.length).toBeLessThan(200);
    for (const star of held) {
      expect(star.alpha).toBeLessThanOrEqual(backdropOf(3).stars.alpha.near);
    }
  });

  it("draws dust streaks 26 to 72 px long near the backdropOf's angle, fading at both ends", () => {
    const streaks = CAMERAS.flatMap((camera) => viewStreaks(rules, backdropOf(2), camera));
    expect(streaks.length).toBeGreaterThan(0);
    for (const streak of streaks) {
      expect(streak.length).toBeGreaterThanOrEqual(26);
      expect(streak.length).toBeLessThanOrEqual(72);
      const degrees = (streak.angle * 180) / Math.PI - backdropOf(2).streaks.angle;
      expect(Math.abs(degrees)).toBeLessThanOrEqual(5.75);
    }
    const pieces = streakPieces({ angle: 0, length: 40, x: 100, y: 50 }, 8);
    expect(pieces[0]!.from).toEqual([80, 50]);
    expect(pieces[7]!.to).toEqual([120, 50]);
    expect(pieces[0]!.fade).toBeCloseTo(pieces[7]!.fade, 12);
    expect(pieces[3]!.fade).toBeGreaterThan(0.95);
    expect(pieces[0]!.fade).toBeLessThan(0.25);
  });
});

describe("backdrop rasters", () => {
  it("paints the sky from the background at the top-left to the darker tone at the bottom-right", () => {
    const { sky } = backdropOf(3);
    expect(skyColor(sky, 0, 0).map((c) => Math.round(c * 255))).toEqual([0x13, 0x2d, 0x33]);
    expect(skyColor(sky, SCREEN.width, SCREEN.height).map((c) => Math.round(c * 255))).toEqual([
      0x07, 0x28, 0x2b,
    ]);
    const raster = paintSky(sky, 1 / 4);
    expect([raster.width, raster.height]).toEqual([SKY_AREA.width / 4, SKY_AREA.height / 4]);
    expect(texel(raster, 0, 0)[3]).toBe(255);
  });

  it("paints a crescent lit from the upper left over its night side", () => {
    const recipe = backdropOf(4).planets[0]!;
    expect(recipe.look).toBe("crescent");
    const raster = paintPlanet(rules, { id: "0,0", r: 40, recipe, tilt: 0, x: 0, y: 0 }, 1);
    const centre = raster.width / 2;
    const hex = (values: number[]) =>
      `#${values
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
    // Just inside the disc's upper-left edge, its lit side; at its lower right, its night side.
    expect(hex(texel(raster, Math.floor(centre - 25), Math.floor(centre - 28)))).toBe(
      recipe.colors.lit,
    );
    expect(hex(texel(raster, Math.floor(centre + 25), Math.floor(centre + 25)))).toBe(
      recipe.colors.night,
    );
    // Outside the disc, clear.
    expect(texel(raster, 0, 0)[3]).toBe(0);
  });

  it("paints a ringed planet's ring past its disc", () => {
    const recipe = backdropOf(3).planets.find(({ look }) => look === "ringed")!;
    const raster = paintPlanet(rules, { id: "0,0", r: 30, recipe, tilt: 0, x: 0, y: 0 }, 1);
    const centre = Math.floor(raster.width / 2);
    // 0.88 of the ring's 2 r across, in its outer band at alpha 0.85.
    expect(texel(raster, centre + 53, centre)[3]).toBe(Math.round(0.85 * 255));
  });

  it("paints a cluster's glow at 0.7 at its centre and its 90 stars around it", () => {
    const recipe = backdropOf(5).far[0]!;
    expect(recipe.look).toBe("cluster");
    if (recipe.look !== "cluster") {
      return;
    }
    const raster = paintCluster(rules, backdropOf(5).seed, { id: "3,4" }, recipe, 1);
    expect([raster.width, raster.height]).toEqual([384, 252]);
    const alpha = texel(raster, 192, 126)[3]!;
    expect(alpha).toBeGreaterThanOrEqual(Math.round(0.7 * 255) - 1);
    expect(texel(raster, 0, 0)[3]).toBeLessThan(3);
  });

  it("paints a star disc opaque at its centre with a clear edge", () => {
    const disc = paintDisc(0.85, 2);
    expect(disc.width).toBe(6);
    expect(texel(disc, 3, 3)).toEqual([255, 255, 255, 255]);
    expect(texel(disc, 0, 0)[3]).toBe(0);
  });
});
