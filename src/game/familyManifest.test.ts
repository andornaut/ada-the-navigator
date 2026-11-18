import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import cartwheel from "../../public/art/cartwheel/manifest.json";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import {
  galaxyLoadsAtOnce,
  galaxyManifestKey,
  galaxyTowKey,
  readGalaxyManifest,
} from "./artManifest.ts";
import { craftFrameSets } from "./cartwheelArt.ts";
import {
  composedArchetypes,
  type EnemyFamily,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyPartFrame,
  enemyPartsToLoad,
  enemyShardsPath,
  GALAXY_FAMILIES,
  mergeEnemyAssets,
} from "./enemyArt.ts";

const claim = GALAXY_FAMILIES.find(({ family }) => family === "claim")!;
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const names = new Set([
  "ensureEnemyFamilyManifest",
  "loadEnemyParts",
  "loadGalaxyArt",
  "loadGalaxyAsset",
  "queueGalaxyArt",
  "queueGalaxyAssets",
]);
const code = source.statements
  .filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text ?? ""))
  .map((node) => node.getText(source).replace(/^export /u, ""))
  .join("\n");

function fixture(family: EnemyFamily | undefined = claim) {
  const events = new EventEmitter();
  const cache = new Map<string, unknown>();
  const svg = vi.fn();
  const json = vi.fn();
  const start = vi.fn();
  const backdrop = vi.fn();
  const readArt = vi.fn();
  const scene = {
    cache: {
      json: { exists: (key: string) => cache.has(key), get: (key: string) => cache.get(key) },
    },
    destruction: { archetypes: { platform: {} } },
    family: family as EnemyFamily | undefined,
    familyParts: new Map(),
    galaxyLoads: new Set(),
    galaxyManifestPaths: { 2: "/art/cartwheel/manifest.json", 6: "/art/phantom/manifest.json" },
    galaxyManifests: new Map([[6, { assets: [], links: {}, sidecars: new Map() }]]),
    load: { json, once: events.once.bind(events), spritesheet: vi.fn(), start },
    loads: { waitFor: vi.fn() },
    manifest: { assets: [] },
    model: { state: { flight: { galaxy: 6 } } },
    partAssets: [],
    partLoads: new Set<string>(),
    shipAssets: [],
    textures: { exists: () => false },
  };
  const context = createContext({
    GALAXY_FAMILIES,
    GALAXY_ID,
    GALAXY_NUMBERS,
    INDUSTRIAL_BODY_KEYS,
    Loader: { Events: { COMPLETE: "complete" } },
    composedArchetypes,
    craftFrameSets,
    enemyFrameSets,
    enemyHardpointsPath,
    enemyJetsPath,
    enemyPartFrame,
    enemyPartsToLoad,
    enemyShardsPath,
    familyOf: (value: typeof scene) => value.family,
    galaxyLoadsAtOnce,
    galaxyManifestKey,
    galaxyTowKey,
    loadSvg: svg,
    mergeEnemyAssets,
    queueBackdrop: backdrop,
    readEnemyArt: readArt,
    readGalaxyArt: readArt,
    readGalaxyManifest,
  });
  runInContext(ts.transpile(code), context);
  return {
    backdrop,
    cache,
    events,
    json,
    loadParts: context.loadEnemyParts as (value: typeof scene, archetype: string) => void,
    loadWorld: context.loadGalaxyArt as (value: typeof scene, galaxy: number) => void,
    scene,
    start,
    svg,
  };
}

describe("source-family manifest readiness", () => {
  it("waits for Claim's Cartwheel metadata in a direct Phantom flight, then queues only platform parts", () => {
    const f = fixture();
    f.loadParts(f.scene, "platform");
    f.loadParts(f.scene, "platform");
    expect(f.scene.partLoads.size).toBe(0);
    expect(f.json).toHaveBeenCalledExactlyOnceWith(
      galaxyManifestKey(2),
      "/art/cartwheel/manifest.json",
    );
    expect(f.events.listenerCount(`filecomplete-json-${galaxyManifestKey(2)}`)).toBe(1);
    expect(f.scene.loads.waitFor).not.toHaveBeenCalled();
    f.cache.set(galaxyManifestKey(2), cartwheel);
    f.events.emit(`filecomplete-json-${galaxyManifestKey(2)}`);
    expect(f.scene.galaxyManifests.has(2)).toBe(true);
    expect(f.scene.galaxyLoads.has(2)).toBe(false);
    expect(f.scene.partLoads.size).toBe(0);
    expect(f.backdrop).not.toHaveBeenCalled();
    f.loadParts(f.scene, "platform");
    expect(f.scene.partLoads.has("claim:platform")).toBe(true);
    const queued = f.svg.mock.calls.map(([, asset]) => asset);
    expect(queued.length).toBeGreaterThan(1);
    expect(
      queued.every((asset) => asset.family === "claim" && asset.archetype === "platform"),
    ).toBe(true);
    expect(queued.some(enemyPartFrame)).toBe(true);
    // Phantom has no sidecars map; the platform's layout comes from Cartwheel's.
    expect(f.json).toHaveBeenCalledWith(
      "claim-hardpoints-platform",
      cartwheel.sidecars.platform.hardpoints,
    );
    expect(cartwheel.sidecars.platform.hardpoints).toBe(
      "/art/cartwheel/enemies/platform-hardpoints.json",
    );
    // A later own flight still queues Cartwheel's world through its unchanged foreground path.
    f.loadWorld(f.scene, 2);
    expect(f.backdrop).toHaveBeenCalledOnce();
    expect(f.scene.loads.waitFor).toHaveBeenCalledExactlyOnceWith("galaxy");
  });

  it("materializes metadata already in the canonical cache without requesting the manifest again", () => {
    const f = fixture();
    f.cache.set(galaxyManifestKey(2), cartwheel);
    f.loadParts(f.scene, "platform");
    expect(f.scene.galaxyManifests.has(2)).toBe(true);
    expect(f.scene.partLoads.has("claim:platform")).toBe(true);
    expect(f.json.mock.calls.some(([, path]) => path === "/art/cartwheel/manifest.json")).toBe(
      false,
    );
    expect(f.backdrop).not.toHaveBeenCalled();
    expect(f.scene.loads.waitFor).not.toHaveBeenCalled();
  });

  it("never marks invalid source metadata as loaded even when the current flight manifest exists", () => {
    const f = fixture();
    f.cache.set(galaxyManifestKey(2), { assets: [], version: 0 });
    f.loadParts(f.scene, "platform");
    expect(f.scene.galaxyManifests.has(6)).toBe(true);
    expect(f.scene.galaxyManifests.has(2)).toBe(false);
    expect(f.scene.partLoads.size).toBe(0);
    expect(f.svg).not.toHaveBeenCalled();
    expect(f.start).not.toHaveBeenCalled();
  });

  it("retains the existing core-parts path for a craft without a galaxy family", () => {
    const f = fixture();
    f.scene.family = undefined;
    f.loadParts(f.scene, "platform");
    expect(f.scene.partLoads.has("coral:platform")).toBe(true);
    expect(f.json).not.toHaveBeenCalled();
  });
});
