import { describe, expect, it } from "vitest";

import * as art from "../../art/tools/backdrop-field.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import {
  checkerItems,
  chunkItems,
  evenCell,
  insideRings,
  motifPlates,
  project,
  type Rect,
  type Xy,
} from "./backdropField.ts";
import {
  clusterReach,
  type GalaxyBackdrop,
  paintCluster,
  paintDisc,
  paintPlanet,
  paintSky,
  planetReach,
  readBackdropRules,
  readGalaxyBackdrop,
  SKY_AREA,
  skyColor,
  streakEnds,
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
/** Whether an item at (x, y) reaching rx by ry from it meets the view and its 16 px margin. */
const meets = (x: number, y: number, rx: number, ry: number) =>
  x + rx > -16 && x - rx < SCREEN.width + 16 && y + ry > -16 && y - ry < SCREEN.height + 16;
const texel = (raster: { data: Uint8ClampedArray; width: number }, x: number, y: number) => [
  ...raster.data.slice((y * raster.width + x) * 4, (y * raster.width + x) * 4 + 4),
];

describe("backdrop layers data", () => {
  it("reads Art's shared rules for the 720 by 360 view and every backdropOf's backdrop", () => {
    expect(rulesFile.view).toEqual([SCREEN.width, SCREEN.height]);
    expect(rules).toMatchObject({
      far: { parallax: 0.05 },
      farRocks: {
        cell: 240,
        chance: 1,
        checker: true,
        parallax: 0.45,
        salt: "backdrop-far",
        scale: [0.3, 0.5],
        value: 0.4,
      },
      planets: { checker: true, parallax: 0.12 },
      plates: {
        empty: { i: 1, j: 2, modulus: 3 },
        lattice: [
          [250, 125],
          [-250, 125],
        ],
        parallax: 0.15,
      },
      rocks: {
        cell: 320,
        chance: 1,
        checker: true,
        parallax: 0.8,
        salt: "backdrop",
        scale: [0.6, 1],
        value: 0.75,
      },
      specks: { alpha: 0.45, cell: 112, parallax: 0.7 },
      streaks: { cell: 240, length: 44, parallax: 0.6, width: 1 },
    });
    expect(rules.stars.layers.map(({ name, parallax }) => [name, parallax])).toEqual([
      ["far", 0.3],
      ["near", 0.5],
    ]);
    for (const galaxy of GALAXY_NUMBERS) {
      expect(backdropOf(galaxy).galaxy, String(galaxy)).toBe(GALAXY_ID[galaxy]);
    }
    expect(readBackdropRules({ ...rulesFile, version: 1 })).toBeUndefined();
    expect(readBackdropRules({ ...rulesFile, plates: { parallax: 0.15 } })).toBeUndefined();
    const debris = rulesFile.debris as Record<string, unknown>;
    expect(
      readBackdropRules({ ...rulesFile, debris: { ...debris, farRocks: { parallax: 0.45 } } }),
    ).toBeUndefined();
    expect(readGalaxyBackdrop({ galaxy: "sunflower", version: 2 })).toBeUndefined();
    const sunflower = publicJson(GALAXY_MANIFESTS.get(1)!.links.backdrop!) as Record<
      string,
      unknown
    >;
    const plateData = sunflower.plates as Record<string, unknown>;
    expect(readGalaxyBackdrop({ ...sunflower, version: 1 })).toBeUndefined();
    expect(
      readGalaxyBackdrop({ ...sunflower, plates: { ...plateData, steps: [] } }),
    ).toBeUndefined();
    expect(
      readGalaxyBackdrop({ ...sunflower, plates: { ...plateData, motif: { name: "petal" } } }),
    ).toBeUndefined();
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
  it("follows Art's generator exactly: motif plates, checker cells and chunks", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      const { plates: spec, seed } = backdropOf(galaxy);
      const rings = spec.motif.rings as Xy[][];
      for (const camera of CAMERAS) {
        const [x, y] = project(camera[0], camera[1]);
        const rect: Rect = [x * 0.15 - 376, y * 0.15 - 196, x * 0.15 + 376, y * 0.15 + 196];
        expect(motifPlates(rules.plates, rings, rect, 236)).toEqual(
          art.motifPlates(rules.plates, rings, rect, 236),
        );
        expect(checkerItems(240, rect)).toEqual(art.checkerItems(240, rect));
        const rule = { chance: rules.planets.chance, chunk: rules.planets.chunk };
        expect(chunkItems(seed, "planet", rule, rect)).toEqual(
          art.chunkItems(seed, "planet", rule, rect),
        );
        for (let u = rect[0]; u < rect[2]; u += 37) {
          for (let v = rect[1]; v < rect[3]; v += 23) {
            expect(insideRings(rings, u - x * 0.15, v - y * 0.15)).toBe(
              art.insideRings(rings, u - x * 0.15, v - y * 0.15),
            );
          }
        }
      }
    }
  });

  it("fills two lattice nodes of every three, alternating the two steps by i + j", () => {
    const square: Xy[] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const placed = motifPlates(rules.plates, [square], [-2000, -1000, 2000, 1000], 0);
    const nodes = placed.map(({ even, rings }) => {
      const [x, y] = rings[0]![0]!.map((value) => value + 1) as unknown as Xy;
      // Node (i, j) sits at i (250, 125) + j (-250, 125).
      const i = Math.round((x / 250 + y / 125) / 2);
      const j = Math.round((y / 125 - x / 250) / 2);
      expect(Math.hypot(i * 250 - j * 250 - x, i * 125 + j * 125 - y)).toBeLessThan(1e-9);
      expect(even).toBe(evenCell(i, j));
      return [i, j] as const;
    });
    // 145 nodes meet the rectangle; 102 of them are filled.
    expect(nodes).toHaveLength(102);
    for (const [i, j] of nodes) {
      expect((((i + 2 * j) % 3) + 3) % 3).not.toBe(0);
    }
    expect(nodes.some(([i, j]) => i === 0 && j === 0)).toBe(false);
    expect(nodes.some(([i, j]) => i === 1 && j === 0)).toBe(true);
  });

  it("draws Cartwheel's rim with its opening clear, by the even-odd rule", () => {
    const { rings } = backdropOf(2).plates.motif;
    expect(rings).toHaveLength(2);
    // The rim's band is filled and its centre is the opening.
    expect(insideRings(rings, 0, 0)).toBe(false);
    expect(insideRings(rings, 100, 0)).toBe(true);
    expect(insideRings(rings, 0, 50)).toBe(true);
    expect(insideRings(rings, 130, 0)).toBe(false);
  });

  it("covers the view with motif plates that never overlap, in the galaxy's two steps", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      const [even, odd] = backdropOf(galaxy).plates.steps;
      // The view at (0, 0) meets only odd nodes, so both paints show across the cameras.
      const paints = new Set<number | string>();
      for (const camera of CAMERAS) {
        const view = viewPlates(rules, backdropOf(galaxy), camera);
        expect(view.length, String(galaxy)).toBeGreaterThan(0);
        for (let x = 5; x < SCREEN.width; x += 71) {
          for (let y = 5; y < SCREEN.height; y += 53) {
            const hits = view.filter((plate) => insideRings(plate.rings, x, y)).length;
            expect(hits).toBeLessThanOrEqual(1);
          }
        }
        for (const plate of view) {
          expect(plate.multiply === undefined).toBe(plate.screen !== undefined);
          expect([even, odd].some((step) => step.multiply === plate.multiply)).toBe(true);
          expect([even, odd].some((step) => step.screen === plate.screen)).toBe(true);
        }
        for (const plate of view) {
          paints.add(plate.multiply ?? plate.screen!);
        }
      }
      expect(paints.size, String(galaxy)).toBe(2);
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
    const beforePlates = viewPlates(rules, backdropOf(2), [0, 0]);
    const afterPlates = viewPlates(rules, backdropOf(2), delta);
    let checked = 0;
    for (const before of beforePlates) {
      const edge = before.rings[0]!;
      const centre: Xy = [
        edge.reduce((sum, point) => sum + point[0], 0) / edge.length,
        edge.reduce((sum, point) => sum + point[1], 0) / edge.length,
      ];
      const movedCentre = shifted(centre, 0.15);
      const interior = ([x, y]: Xy) => x > 0 && x < 720 && y > 0 && y < 360;
      if (!interior(centre) || !interior(movedCentre)) {
        continue;
      }
      const after = afterPlates.find((plate) =>
        plate.rings[0]!.every((point, k) => {
          const [x, y] = shifted(edge[k]!, 0.15);
          return Math.abs(point[0] - x) < 1e-9 && Math.abs(point[1] - y) < 1e-9;
        }),
      );
      expect(after).toBeDefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
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

  it("keeps at most four planets on the chunk checker and four far items, each meeting the view", () => {
    let planets = 0;
    let far = 0;
    for (const galaxy of GALAXY_NUMBERS) {
      // Cameras 165 world px apart, so the view meets each chunk on the path at many offsets.
      for (let k = 0; k < 2000; k++) {
        const camera: Xy = [k * 137.3, k * -91.7];
        const seen = viewPlanets(rules, backdropOf(galaxy), camera);
        const items = viewFar(rules, backdropOf(galaxy), camera);
        // Every item of each chunk the lookup touches is up to 9 planets and 6 far items; those
        // whose extent meets the view and its margin are 4 at most.
        expect(seen.length).toBeLessThanOrEqual(4);
        expect(items.length).toBeLessThanOrEqual(4);
        planets += seen.length;
        far += items.length;
        for (const planet of seen) {
          const [i, j] = planet.id.split(",").map(Number) as [number, number];
          expect(evenCell(i, j), planet.id).toBe(true);
          expect(backdropOf(galaxy).planets).toContain(planet.recipe);
          expect(planet.r).toBeLessThanOrEqual(98 * planet.recipe.size);
          const reach = planet.recipe.look === "ringed" ? planetReach(planet.r) : planet.r;
          expect(meets(planet.x, planet.y, reach, reach)).toBe(true);
        }
        for (const item of items) {
          const [rx, ry] =
            item.recipe.look === "nebula"
              ? [rules.nebula.display[0] / 2, rules.nebula.display[1] / 2]
              : clusterReach(rules);
          expect(meets(item.x, item.y, rx, ry)).toBe(true);
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
    // About 185 stars cover the view and its margin.
    expect(held.length).toBeGreaterThan(150);
    expect(held.length).toBeLessThan(220);
    for (const star of held) {
      expect(star.alpha).toBeLessThanOrEqual(backdropOf(3).stars.alpha.near);
    }
  });

  it("draws one 44 px dust streak at the galaxy's angle on every even 240 px cell", () => {
    for (const camera of CAMERAS) {
      const streaks = viewStreaks(rules, backdropOf(2), camera);
      expect(streaks.length).toBeGreaterThan(0);
      const origin = project(camera[0] * 0.6, camera[1] * 0.6);
      for (const streak of streaks) {
        expect(streak.length).toBe(44);
        expect((streak.angle * 180) / Math.PI).toBeCloseTo(backdropOf(2).streaks.angle, 9);
        // Back in layer px, the streak sits at the centre of an even cell.
        const u = streak.x + origin[0] - SCREEN.width / 2;
        const v = streak.y + origin[1] - SCREEN.height / 2;
        const [i, j] = [(u - 120) / 240, (v - 120) / 240];
        expect(Math.abs(i - Math.round(i))).toBeLessThan(1e-6);
        expect(Math.abs(j - Math.round(j))).toBeLessThan(1e-6);
        expect(evenCell(Math.round(i), Math.round(j))).toBe(true);
      }
    }
    const [from, to] = streakEnds({ angle: 0, length: 44, x: 100, y: 50 });
    expect(from).toEqual([78, 50]);
    expect(to).toEqual([122, 50]);
  });
});

describe("backdrop rasters", () => {
  it("paints the sky from the background at the top-left to the darker tone at the bottom-right", () => {
    const { sky } = backdropOf(3);
    expect(skyColor(sky, 0, 0).map((c) => Math.round(c * 255))).toEqual([0xb8, 0xce, 0xc4]);
    expect(skyColor(sky, SCREEN.width, SCREEN.height).map((c) => Math.round(c * 255))).toEqual([
      0xb0, 0xca, 0xc1,
    ]);
    const raster = paintSky(sky, 1 / 4);
    expect([raster.width, raster.height]).toEqual([SKY_AREA.width / 4, SKY_AREA.height / 4]);
    expect(texel(raster, 0, 0)[3]).toBe(255);
  });

  it("paints a crescent in two flat tones, lit from the upper left over its night side", () => {
    const recipe = backdropOf(4).planets[0]!;
    expect(recipe.look).toBe("crescent");
    const raster = paintPlanet(rules, { id: "0,0", r: 40, recipe, x: 0, y: 0 }, 1);
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
    // Every texel on the disc is opaque night or lit: no third tone and no blend.
    const tones = new Set<string>();
    for (let y = 0; y < raster.height; y++) {
      for (let x = 0; x < raster.width; x++) {
        const value = texel(raster, x, y);
        if (value[3] === 255) {
          tones.add(hex(value));
        } else {
          expect(value[3]).toBe(0);
        }
      }
    }
    expect([...tones].sort()).toEqual([recipe.colors.lit, recipe.colors.night].sort());
  });

  it("paints a ringed planet's one opaque ring band past its disc, tilted -14 degrees", () => {
    const recipe = backdropOf(3).planets.find(({ look }) => look === "ringed")!;
    const raster = paintPlanet(rules, { id: "0,0", r: 30, recipe, x: 0, y: 0 }, 1);
    const centre = raster.width / 2;
    const along = (t: number): [number, number] => {
      const a = (-14 * Math.PI) / 180;
      return [Math.floor(centre + Math.cos(a) * t), Math.floor(centre + Math.sin(a) * t)];
    };
    const ring = recipe.colors.ring.toLowerCase();
    const at = ([x, y]: [number, number]) => texel(raster, x, y);
    const hex = (value: number[]) =>
      `#${value
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
    // 0.88 of the ring's 2 r along its tilted axis, either side: opaque ring.
    for (const t of [53, -53]) {
      expect(at(along(t))[3], String(t)).toBe(255);
      expect(hex(at(along(t))), String(t)).toBe(ring);
    }
    // 0.7 of 2 r, inside the one band's inner edge at 0.78, and past its outer edge: clear.
    expect(at(along(42))[3]).toBe(0);
    expect(at(along(60))[3]).toBe(0);
  });

  it("paints a cluster's glow at 0.5 at its centre and its 90 stars around it", () => {
    const recipe = backdropOf(5).far[0]!;
    expect(recipe.look).toBe("cluster");
    if (recipe.look !== "cluster") {
      return;
    }
    const raster = paintCluster(rules, backdropOf(5).seed, { id: "3,4" }, recipe, 1);
    expect([raster.width, raster.height]).toEqual([384, 252]);
    const alpha = texel(raster, 192, 126)[3]!;
    expect(alpha).toBeGreaterThanOrEqual(Math.round(0.5 * 255) - 1);
    expect(alpha).toBeLessThanOrEqual(Math.round(0.5 * 255) + 8);
    expect(texel(raster, 0, 0)[3]).toBeLessThan(3);
  });

  it("paints a star disc opaque at its centre with a clear edge", () => {
    const disc = paintDisc(0.85, 2);
    expect(disc.width).toBe(6);
    expect(texel(disc, 3, 3)).toEqual([255, 255, 255, 255]);
    expect(texel(disc, 0, 0)[3]).toBe(0);
  });
});
