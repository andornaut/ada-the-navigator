import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GALAXY_MANIFESTS } from "../testing/publicArt.ts";
import { galaxyLoadsAtOnce } from "./artManifest.ts";
import {
  CLAIM,
  CLAIM_WIRED,
  composedArchetypes,
  type EnemyFrame,
  enemyFrameSets,
  enemyPartFrame,
  enemyPartsToLoad,
} from "./enemyArt.ts";

// Cartwheel's claim jumpers: their hulls and part frames are in Cartwheel's manifest, which loads
// with the galaxy's first flight (sceneAssets.ts loadGalaxyArt).
const cartwheel = GALAXY_MANIFESTS.get(2)!.assets as unknown as (EnemyFrame & {
  family?: string;
  path: string;
})[];
const claim = cartwheel.filter((asset) => asset.family === "claim");
const parts = claim.filter(enemyPartFrame);
const present = (path: string) => existsSync(new URL(`../../public${path}`, import.meta.url));

describe("claim jumper art loading", () => {
  it("resolves every claim archetype's hull frames from Cartwheel's manifest", () => {
    const hulls = enemyFrameSets(claim, CLAIM);
    expect([...hulls.keys()].sort()).toEqual([...CLAIM_WIRED].sort());
    for (const [archetype, frames] of hulls) {
      expect(frames.length, archetype).toBe(archetype === "platform" ? 1 : 16);
      for (const frame of frames) {
        expect(present(frame.path), frame.path).toBe(true);
      }
    }
  });

  it("queues each hull with the galaxy and holds every part frame for its craft", () => {
    const hulls = [...enemyFrameSets(claim, CLAIM).values()].flat();
    expect(hulls.every(galaxyLoadsAtOnce)).toBe(true);
    expect(parts.some(galaxyLoadsAtOnce)).toBe(false);
  });

  it("resolves every composed claim body's exact parts once Cartwheel's manifest is known", () => {
    const expectedCounts = {
      capital: 464,
      frigate: 224,
      hostileStation: 416,
      platform: 160,
      retaliator: 32,
      retaliatorCargoHauler: 32,
      retaliatorMiningFreighter: 32,
    };
    expect([...composedArchetypes(claim)].sort()).toEqual(Object.keys(expectedCounts).sort());
    const allDue: string[] = [];
    for (const [body, count] of Object.entries(expectedCounts)) {
      const due = enemyPartsToLoad(true, () => false, parts, body)!;
      expect(due, body).toHaveLength(count);
      for (const part of due) {
        expect(part.id.startsWith(`enemy-claim-${body}-`), part.id).toBe(true);
        // Each fleet body's parts are its design's files: the claim capital is the Outrigger
        // carrier, and the Mining Freighter draws the Manta gunship's top.
        const fleet: Readonly<Record<string, string>> = {
          capital: "fleetCapitalOutrigger",
          frigate: "fleetFrigate",
          retaliator: "fleetRetaliator",
          retaliatorCargoHauler: "fleetRetaliatorCargoHauler",
          retaliatorMiningFreighter: part.id.includes("-turret-top-")
            ? "fleetRetaliator"
            : "fleetRetaliatorMiningFreighter",
        };
        const files = fleet[body] ?? body;
        expect(part.path.startsWith(`/art/cartwheel/enemies/${files}-`), part.path).toBe(true);
        expect(present(part.path), part.path).toBe(true);
        allDue.push(part.id);
      }
    }
    expect(allDue.sort()).toEqual(parts.map(({ id }) => id).sort());
    expect(new Set(allDue).size).toBe(allDue.length);
  });

  it("asks again, rather than marking the parts loaded, while the galaxy's manifest is unknown", () => {
    expect(enemyPartsToLoad(false, () => false, parts, "platform")).toBeNull();
    expect(enemyPartsToLoad(false, () => false, [], "platform")).toBeNull();
    // Once known, loaded textures drop out and an archetype with none left resolves empty.
    const loaded = new Set(parts.map(({ id }) => id));
    expect(enemyPartsToLoad(true, (id) => loaded.has(id), parts, "platform")).toEqual([]);
  });
});
