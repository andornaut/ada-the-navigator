import { describe, expect, it, vi } from "vitest";

import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SCREEN } from "../data/screen.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import * as asteroid from "./asteroidArt.ts";
import { unit } from "./asteroidArt.ts";
import { layerOrigin, viewRect, type Xy } from "./backdropField.ts";
import {
  type BackdropRules,
  type GalaxyBackdrop,
  readBackdropRules,
  readGalaxyBackdrop,
  twinkleAt,
  VIEW_MARGIN,
  type ViewStar,
  viewStars,
} from "./backdropLayers.ts";

const VIEW: Xy = [SCREEN.width, SCREEN.height];
const toView = (origin: Xy, [u, v]: Xy): Xy => [
  u - origin[0] + SCREEN.width / 2,
  v - origin[1] + SCREEN.height / 2,
];
const rules = readBackdropRules(publicJson(CORE_MANIFEST.backdropLayers as string))!;
const galaxies = GALAXY_NUMBERS.map((galaxy) =>
  readGalaxyBackdrop(publicJson(GALAXY_MANIFESTS.get(galaxy)!.links.backdrop!))!,
);

// Direct generation is the reference for culling, ordering, coordinates, radii and twinkle.
function uncachedStars(
  rules: BackdropRules,
  galaxy: GalaxyBackdrop,
  camera: Xy,
  seconds: number,
  reducedMotion: boolean,
): ViewStar[] {
  const { brightness, chunk, large, salt, twinkle } = rules.stars;
  const { seed } = galaxy;
  const out: ViewStar[] = [];
  for (const layer of rules.stars.layers) {
    const origin = layerOrigin(camera, layer.parallax);
    const reach = layer.radius * large.scale;
    const rect = viewRect(origin, VIEW, [VIEW_MARGIN + reach, VIEW_MARGIN + reach]);
    for (let i = Math.floor(rect[0] / chunk); i <= Math.floor(rect[2] / chunk); i++) {
      for (let j = Math.floor(rect[1] / chunk); j <= Math.floor(rect[3] / chunk); j++) {
        const id = `${i},${j}`;
        for (let k = 0; k < layer.perChunk; k++) {
          const name = `${salt}-${layer.name}-${k}`;
          const u = (i + unit(seed, id, `${name}-x`)) * chunk;
          const v = (j + unit(seed, id, `${name}-y`)) * chunk;
          if (u < rect[0] || u > rect[2] || v < rect[1] || v > rect[3]) {
            continue;
          }
          const shine =
            brightness[0] + (brightness[1] - brightness[0]) * unit(seed, id, `${name}-b`);
          const [x, y] = toView(origin, [u, v]);
          out.push({
            alpha:
              galaxy.stars.alpha[layer.name] *
              shine *
              twinkleAt(twinkle, seed, id, name, seconds, reducedMotion),
            r: layer.radius * (unit(seed, id, `${name}-l`) > 1 - large.share ? large.scale : 1),
            x,
            y,
          });
        }
      }
    }
  }
  return out;
}

describe("visible star chunk cache", () => {
  it("matches direct generation exactly across all galaxies, chunk boundaries, motion modes and teleports", () => {
    for (const galaxy of galaxies) {
      for (const reduced of [false, true]) {
        for (let k = 0; k < 80; k++) {
          const camera: Xy =
            k % 9 === 0 ? [-80000 + k * 239.999, 42000] : [k * 47.999, k * -96.001];
          const seconds = k * 0.137;
          expect(viewStars(rules, galaxy, camera, seconds, reduced)).toEqual(
            uncachedStars(rules, galaxy, camera, seconds, reduced),
          );
        }
      }
    }
  });

  it("reuses hashes within visible chunks and evicts chunks after a teleport", () => {
    const ownRules = structuredClone(rules);
    const galaxy = structuredClone(galaxies[0]!);
    const spy = vi.spyOn(asteroid, "unit");
    try {
      viewStars(ownRules, galaxy, [0, 0], 0, false);
      const coldCalls = spy.mock.calls.length;
      expect(coldCalls).toBeGreaterThan(0);
      spy.mockClear();
      viewStars(ownRules, galaxy, [0.01, 0], 1, false);
      expect(spy).not.toHaveBeenCalled();
      viewStars(ownRules, galaxy, [100000, -100000], 1, true);
      spy.mockClear();
      viewStars(ownRules, galaxy, [0, 0], 2, false);
      expect(spy.mock.calls.length).toBe(coldCalls);
    } finally {
      spy.mockRestore();
    }
  });

  it("isolates replaced rule and galaxy recipes and keeps returned frames independent", () => {
    const galaxy = galaxies[0]!;
    const first = viewStars(rules, galaxy, [0, 0], 0, false);
    const snapshot = structuredClone(first);
    const otherGalaxy = { ...galaxy, seed: galaxy.seed + 1 };
    const otherRules = { ...rules, stars: { ...rules.stars, salt: "other" } };
    expect(viewStars(rules, otherGalaxy, [0, 0], 0, false)).toEqual(
      uncachedStars(rules, otherGalaxy, [0, 0], 0, false),
    );
    expect(viewStars(otherRules, galaxy, [0, 0], 0, false)).toEqual(
      uncachedStars(otherRules, galaxy, [0, 0], 0, false),
    );
    viewStars(rules, galaxy, [-4000, 3200], 12, true);
    expect(first).toEqual(snapshot);
  });
});
