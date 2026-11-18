import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { GALAXY_ID } from "../data/galaxies.ts";
import { CORE_MANIFEST, GALAXY_MANIFESTS, publicJson } from "../testing/publicArt.ts";
import { readGalaxyManifest } from "./artManifest.ts";
import { type CartwheelAsset, craftFrameSets } from "./cartwheelArt.ts";
import {
  composedArchetypes,
  type EnemyFrame,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyPartFrame,
  enemyShardsPath,
  GALAXY_FAMILIES,
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
    for (const galaxy of [1, 3, 6] as const) {
      expect(publicJson(`/art/${GALAXY_ID[galaxy]}/manifest.json`)).not.toHaveProperty("sidecars");
      expect(GALAXY_MANIFESTS.get(galaxy)!.sidecars.size, GALAXY_ID[galaxy]).toBe(0);
    }
    const sidecars = GALAXY_MANIFESTS.get(1)!.sidecars;
    expect(enemyJetsPath(sidecars, "fighter")).toBeUndefined();
    expect(enemyHardpointsPath(sidecars, "capital")).toBeUndefined();
    expect(enemyShardsPath(sidecars, "fighter")).toBeUndefined();
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

  // CLEANUP (added 2026-11-18): remove with Art's ada-0282 dedupe pass, which repoints shared
  // files away from their frames' folders; until then this proves the switch kept every path.
  it("names the same files the loader derived from each craft's frames before the map", () => {
    const beside = (kind: string, craft: string, { path }: { readonly path?: string }) =>
      `${path!.slice(0, path!.lastIndexOf("/") + 1)}${craft}-${kind}.json`;
    const destruction = publicJson("/art/enemies/destruction.json") as {
      archetypes: Record<string, unknown>;
    };
    const covered = (archetype: string) =>
      Object.hasOwn(
        destruction.archetypes,
        INDUSTRIAL_BODY_KEYS.some((key) => key === archetype) ? "retaliator" : archetype,
      );
    const counts: Record<string, readonly [number, number]> = {};
    for (const [name, assets, sidecars] of manifests) {
      const derived = new Map<string, string>();
      for (const [craft, frames] of craftFrameSets(assets as unknown as CartwheelAsset[])) {
        derived.set(`${craft}.jets`, beside("jets", craft, frames[0]!));
      }
      if (name === "core") {
        const composed = composedArchetypes(assets);
        for (const [archetype, frames] of enemyFrameSets(assets)) {
          derived.set(`${archetype}.jets`, beside("jets", archetype, frames[0]!));
          if (composed.has(archetype)) {
            derived.set(`${archetype}.hardpoints`, beside("hardpoints", archetype, frames[0]!));
          }
        }
        for (const archetype of [...Object.keys(destruction.archetypes), ...INDUSTRIAL_BODY_KEYS]) {
          derived.set(`${archetype}.shards`, `/art/enemies/${archetype}-shards.json`);
        }
      } else {
        for (const { family, prefix, wired } of GALAXY_FAMILIES) {
          const parts = composedArchetypes(
            assets.filter((asset) => enemyPartFrame(asset) && asset.family === family),
          );
          for (const [archetype, frames] of enemyFrameSets(assets, prefix)) {
            if (!wired.has(archetype)) {
              continue;
            }
            if (frames.length > 1) {
              derived.set(`${archetype}.jets`, beside("jets", archetype, frames[0]!));
            }
            if (covered(archetype)) {
              derived.set(`${archetype}.shards`, beside("shards", archetype, frames[0]!));
            }
            if (parts.has(archetype)) {
              derived.set(`${archetype}.hardpoints`, beside("hardpoints", archetype, frames[0]!));
            }
          }
        }
      }
      const mapped = new Map(
        [...sidecars].flatMap(([craft, kinds]) =>
          Object.entries(kinds).map(([kind, path]) => [`${craft}.${kind}`, path] as const),
        ),
      );
      expect(mapped, name).toEqual(derived);
      counts[name] = [sidecars.size, mapped.size];
    }
    // Crafts and paths per manifest.
    expect(counts).toEqual({
      andromeda: [9, 21],
      cartwheel: [13, 25],
      core: [12, 25],
      needle: [9, 20],
      phantom: [0, 0],
      sunflower: [0, 0],
      whirlpool: [0, 0],
    });
  });
});
