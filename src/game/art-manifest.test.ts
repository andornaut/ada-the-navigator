import { describe, expect, it } from "vitest";

import { GALAXY_ID, SECTORS } from "../data/galaxies.ts";
import { ART_MANIFEST, CORE_MANIFEST, GALAXY_MANIFESTS } from "../testing/public-art.ts";
import {
  galaxyManifestKey,
  galaxyManifestPaths,
  galaxyTowKey,
  readGalaxyManifest,
} from "./art-manifest.ts";

describe("split art manifest", () => {
  it("maps each galaxy to its manifest from the core manifest, keyed by stable galaxy id", () => {
    // Every galaxy Art has drawn, by its stable id, at /art/{id}/manifest.json.
    const drawn = SECTORS.filter((sector) =>
      Object.hasOwn(CORE_MANIFEST.galaxies, GALAXY_ID[sector]),
    );
    expect(drawn).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    expect(galaxyManifestPaths(CORE_MANIFEST.galaxies)).toEqual(
      Object.fromEntries(
        drawn.map((sector) => [sector, `/art/${GALAXY_ID[sector]}/manifest.json`]),
      ),
    );
    expect([...GALAXY_MANIFESTS.keys()]).toEqual(drawn);
    expect(galaxyManifestKey(2)).toBe("art-manifest-galaxy-2");
  });

  it("loads only string paths under /art/, never inline data or other values", () => {
    expect(galaxyManifestPaths(undefined)).toEqual({});
    expect(galaxyManifestPaths("/art/sunflower/manifest.json")).toEqual({});
    expect(
      galaxyManifestPaths({
        1: "/art/sunflower/manifest.json",
        cartwheel: "https://example.invalid/manifest.json",
        extra: "/art/extra/manifest.json",
        needle: "/art/needle/manifest.json",
        sunflower: { assets: [] },
        whirlpool: "/art/whirlpool/manifest.json",
      }),
    ).toEqual({ 3: "/art/whirlpool/manifest.json", 4: "/art/needle/manifest.json" });
  });

  it("reads a version 1 galaxy manifest's assets and string data links", () => {
    expect(GALAXY_MANIFESTS.get(2)!.links).toEqual({
      backdrop: "/art/cartwheel/backdrop.json",
      cartwheelDebris: "/art/cartwheel/debris.json",
      oreField: "/art/cartwheel/ore-field.json",
    });
    expect(GALAXY_MANIFESTS.get(3)!.links).toEqual({
      backdrop: "/art/whirlpool/backdrop.json",
      whales: "/art/whales.json",
      whirlpoolCurrents: "/art/whirlpool/currents.json",
      whirlpoolDebris: "/art/whirlpool/debris.json",
      whirlpoolProjects: "/art/whirlpool/projects.json",
    });
    expect(GALAXY_MANIFESTS.get(1)!.links).toEqual({ backdrop: "/art/sunflower/backdrop.json" });
    // Black Eye holds its Blurb settlements, smoke banks and portraits, and its backdrop link.
    const blackEye = GALAXY_MANIFESTS.get(6)!;
    expect(blackEye.links).toEqual({ backdrop: "/art/black-eye/backdrop.json" });
    expect(blackEye.assets.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "outpost-homes-mended-a",
        "outpost-harbour-cracked-b",
        "outpost-signal-mended-b",
        "nebula-black-eye-1",
        "dollop-portrait",
      ]),
    );
    expect(readGalaxyManifest({ assets: [], tow: 3, version: 1, whales: "/art/w.json" })).toEqual({
      assets: [],
      links: { whales: "/art/w.json" },
    });
    expect(readGalaxyManifest({ assets: [], version: 2 })).toBeUndefined();
    expect(readGalaxyManifest({ version: 1 })).toBeUndefined();
    expect(readGalaxyManifest(null)).toBeUndefined();
  });

  it("reads each galaxy's stranded craft data apart from its links", () => {
    for (const [sector, galaxy] of GALAXY_MANIFESTS) {
      expect(galaxy.tow, GALAXY_ID[sector]).toBe(`/art/${GALAXY_ID[sector]}/tow.json`);
      expect(galaxy.links).not.toHaveProperty("tow");
    }
    // Core's tow, which holds the tow line, keeps its name once the galaxies' links merge.
    expect(ART_MANIFEST.tow).toBe(CORE_MANIFEST.tow);
    expect(readGalaxyManifest({ assets: [], tow: "/art/x/tow.json", version: 1 })).toEqual({
      assets: [],
      links: {},
      tow: "/art/x/tow.json",
    });
    expect(galaxyTowKey(4)).toBe("tow-galaxy-4");
  });

  it("keeps every id in exactly one manifest", () => {
    const ids = ART_MANIFEST.assets.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CORE_MANIFEST.assets.length).toBeGreaterThan(0);
  });
});
