import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GALAXY_ID } from "../data/galaxies.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { readGalaxyManifest } from "./artManifest.ts";
import {
  type EnemyFrame,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyShardsPath,
  readSidecars,
  type Sidecars,
} from "./enemyArt.ts";

const coreSidecars = readSidecars(CORE_MANIFEST.sidecars)!;
const manifests: readonly (readonly [string, readonly EnemyFrame[], Sidecars])[] = [
  ["core", CORE_MANIFEST.assets as unknown as EnemyFrame[], coreSidecars],
  ...[...GALAXY_MANIFESTS].map(
    ([galaxy, manifest]) =>
      [GALAXY_ID[galaxy], manifest.assets as unknown as EnemyFrame[], manifest.sidecars] as const,
  ),
];

describe("sidecars map", () => {
  it("reads a missing map as empty and rejects a malformed one", () => {
    expect(readSidecars(undefined)).toEqual(new Map());
    expect(
      readSidecars({ capital: { hardpoints: "/art/enemies/capital-hardpoints.json" } }),
    ).toEqual(new Map([["capital", { hardpoints: "/art/enemies/capital-hardpoints.json" }]]));
    for (const value of [
      null,
      [],
      "/art/enemies/capital-jets.json",
      { capital: {} },
      { capital: "/art/enemies/capital-jets.json" },
      { capital: { frames: "/art/enemies/capital-frames.json" } },
      { capital: { jets: 1 } },
      { capital: { jets: "enemies/capital-jets.json" } },
      { capital: { jets: "/art/enemies/capital-jets.svg" } },
    ]) {
      expect(readSidecars(value), JSON.stringify(value)).toBeUndefined();
    }
  });

  it("gives a galaxy manifest without the map no sidecars, and rejects one with a malformed map", () => {
    expect(readGalaxyManifest({ assets: [], version: 1 })!.sidecars).toEqual(new Map());
    expect(readGalaxyManifest({ assets: [], sidecars: [], version: 1 })).toBeUndefined();
    for (const galaxy of [1, 3] as const) {
      expect(publicJson(`/art/${GALAXY_ID[galaxy]}/manifest.json`)).not.toHaveProperty("sidecars");
      expect(GALAXY_MANIFESTS.get(galaxy)!.sidecars.size, GALAXY_ID[galaxy]).toBe(0);
    }
    const sidecars = GALAXY_MANIFESTS.get(1)!.sidecars;
    expect(enemyJetsPath(sidecars, "fighter")).toBeUndefined();
    expect(enemyHardpointsPath(sidecars, "capital")).toBeUndefined();
    expect(enemyShardsPath(sidecars, "fighter")).toBeUndefined();
  });

  it("links exactly the authored Phantom story craft jet sidecars", () => {
    const craft = [
      "barge",
      "beacontender",
      "buoytender",
      "crane",
      "driller",
      "grower",
      "loomship",
      "reed",
      "salvager",
      "student",
      "trainee",
      "tug",
    ];
    expect(GALAXY_MANIFESTS.get(6)!.sidecars).toEqual(
      new Map(craft.map((id) => [id, { jets: `/art/phantom/${id}-jets.json` }])),
    );
  });

  it("names only files that exist", () => {
    for (const [name, , sidecars] of manifests) {
      for (const [craft, kinds] of sidecars) {
        for (const path of Object.values(kinds)) {
          expect(
            existsSync(new URL(`../../public${path}`, import.meta.url)),
            `${name} ${craft}`,
          ).toBe(true);
        }
      }
    }
  });
});
