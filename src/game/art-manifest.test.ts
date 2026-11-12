import { describe, expect, it } from "vitest";

import { ART_MANIFEST, CORE_MANIFEST, GALAXY_MANIFESTS } from "../testing/public-art.ts";
import { galaxyManifestKey, galaxyManifestPaths, readGalaxyManifest } from "./art-manifest.ts";

describe("split art manifest", () => {
  it("maps each galaxy to its manifest from the core manifest", () => {
    expect(galaxyManifestPaths(CORE_MANIFEST.galaxies)).toEqual({
      1: "/art/sunflower/manifest.json",
      2: "/art/cartwheel/manifest.json",
      3: "/art/whirlpool/manifest.json",
    });
    expect([...GALAXY_MANIFESTS.keys()]).toEqual([1, 2, 3]);
    expect(galaxyManifestKey(2)).toBe("art-manifest-galaxy-2");
  });

  it("loads only string paths under /art/, never inline data or other values", () => {
    expect(galaxyManifestPaths(undefined)).toEqual({});
    expect(galaxyManifestPaths("/art/sunflower/manifest.json")).toEqual({});
    expect(
      galaxyManifestPaths({
        1: { assets: [] },
        2: "https://example.invalid/manifest.json",
        3: "/art/whirlpool/manifest.json",
        4: "/art/extra/manifest.json",
      }),
    ).toEqual({ 3: "/art/whirlpool/manifest.json" });
  });

  it("reads a version 1 galaxy manifest's assets and string data links", () => {
    expect(GALAXY_MANIFESTS.get(2)!.links).toEqual({
      cartwheelDebris: "/art/cartwheel/debris.json",
      oreField: "/art/cartwheel/ore-field.json",
    });
    expect(GALAXY_MANIFESTS.get(3)!.links).toEqual({
      whales: "/art/whales.json",
      whirlpoolCurrents: "/art/whirlpool/currents.json",
      whirlpoolDebris: "/art/whirlpool/debris.json",
    });
    expect(GALAXY_MANIFESTS.get(1)!.links).toEqual({});
    expect(readGalaxyManifest({ assets: [], tow: 3, version: 1, whales: "/art/w.json" })).toEqual({
      assets: [],
      links: { whales: "/art/w.json" },
    });
    expect(readGalaxyManifest({ assets: [], version: 2 })).toBeUndefined();
    expect(readGalaxyManifest({ version: 1 })).toBeUndefined();
    expect(readGalaxyManifest(null)).toBeUndefined();
  });

  it("keeps every id in exactly one manifest", () => {
    const ids = ART_MANIFEST.assets.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CORE_MANIFEST.assets.length).toBeGreaterThan(0);
  });
});
