import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import cartwheel from "../../public/art/cartwheel/manifest.json";
import phantom from "../../public/art/phantom/manifest.json";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { publicJson } from "../testing/publicArt.ts";
import {
  galaxyLoadsAtOnce,
  galaxyManifestKey,
  galaxyTowKey,
  readGalaxyManifest,
} from "./artManifest.ts";
import { craftFrameSets, readCraftNose } from "./cartwheelArt.ts";
import {
  composedArchetypes,
  ENEMY_HEADINGS,
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
import { PHANTOM_ALLIES_ART } from "./phantomAllyArt.ts";
import { readShipJets } from "./shipJets.ts";

const claim = GALAXY_FAMILIES.find(({ family }) => family === "claim")!;
const source = ts.createSourceFile(
  "sceneAssets.ts",
  readFileSync(new URL("./sceneAssets.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const names = new Set([
  "PHANTOM_CRAFT_JETS_KEY",
  "PHANTOM_CRAFT_JETS_PATH",
  "ensureEnemyFamilyManifest",
  "loadEnemyParts",
  "loadGalaxyArt",
  "loadGalaxyAsset",
  "queueGalaxyArt",
  "queueGalaxyAssets",
  "queuePhantomCraftJets",
]);
const code = source.statements
  .filter((node) => {
    if (ts.isFunctionDeclaration(node)) {
      return names.has(node.name?.text ?? "");
    }
    return (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(({ name }) => names.has(name.getText(source)))
    );
  })
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
      json: {
        add: (key: string, value: unknown) => cache.set(key, value),
        exists: (key: string) => cache.has(key),
        get: (key: string) => cache.get(key),
      },
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
    ENEMY_HEADINGS,
    GALAXY_FAMILIES,
    GALAXY_ID,
    GALAXY_NUMBERS,
    INDUSTRIAL_BODY_KEYS,
    Loader: { Events: { COMPLETE: "complete" } },
    PHANTOM_ALLIES_ART,
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
    readCraftNose,
    readEnemyArt: readArt,
    readGalaxyArt: readArt,
    readGalaxyManifest,
    readShipJets,
  });
  runInContext(ts.transpile(code), context);
  return {
    backdrop,
    cache,
    events,
    json,
    loadParts: context.loadEnemyParts as (value: typeof scene, archetype: string) => void,
    loadWorld: context.loadGalaxyArt as (value: typeof scene, galaxy: number) => void,
    readArt,
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
    // The platform's layout comes from Cartwheel's sidecars.
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

const phantomJetsKey = "phantom-story-craft-jets";
const phantomJetsPath = "/art/phantom/story-craft-jets.json";
const phantomJetsEvent = `filecomplete-json-${phantomJetsKey}`;

function phantomJetsFixture() {
  const f = fixture();
  const manifest = readGalaxyManifest(phantom)!;
  const craft = [...manifest.sidecars.keys()];
  const sidecars = new Map(craft.map((id) => [id, { jets: phantomJetsPath }]));
  const records =
    enemyJetsPath(manifest.sidecars, craft[0]!) === phantomJetsPath
      ? (publicJson(phantomJetsPath) as Record<string, unknown>)
      : Object.fromEntries(
          craft.map((id) => [id, publicJson(enemyJetsPath(manifest.sidecars, id)!)]),
        );
  return { ...f, craft, manifest: { ...manifest, sidecars }, records };
}

describe("Phantom story craft jets", () => {
  it("queues one optional pack and publishes the original payloads under all twelve cache keys", () => {
    const f = phantomJetsFixture();
    f.scene.galaxyManifests.delete(6);
    f.loadWorld(f.scene, 6);
    expect(f.json).not.toHaveBeenCalledWith(phantomJetsKey, phantomJetsPath);
    f.cache.set(galaxyManifestKey(6), {
      ...phantom,
      sidecars: Object.fromEntries(f.manifest.sidecars),
    });
    f.events.emit(`filecomplete-json-${galaxyManifestKey(6)}`);
    expect(
      f.json.mock.calls.filter(([key]) => key === phantomJetsKey || key.startsWith("craft-jets-")),
    ).toEqual([[phantomJetsKey, phantomJetsPath]]);
    expect(f.craft).toHaveLength(12);
    expect(f.craft.some((id) => f.cache.has(`craft-jets-${id}`))).toBe(false);
    f.events.emit(phantomJetsEvent, phantomJetsKey, "json", f.records);
    for (const id of f.craft) {
      expect(f.cache.get(`craft-jets-${id}`)).toBe(f.records[id]);
    }
    f.events.emit("complete");
    expect(f.readArt).toHaveBeenCalledOnce();
  });

  it("publishes no records if one craft has malformed jet data", () => {
    const f = phantomJetsFixture();
    f.cache.set(galaxyManifestKey(6), {
      ...phantom,
      sidecars: Object.fromEntries(f.manifest.sidecars),
    });
    f.scene.galaxyManifests.delete(6);
    f.loadWorld(f.scene, 6);
    f.events.emit(`filecomplete-json-${galaxyManifestKey(6)}`);
    const records = { ...f.records, [f.craft.at(-1)!]: { headings: [] } };
    f.events.emit(phantomJetsEvent, phantomJetsKey, "json", records);
    expect(f.craft.every((id) => !f.cache.has(`craft-jets-${id}`))).toBe(true);
  });

  it("refreshes derived art when the optional pack arrives on the loader's retry", () => {
    const f = phantomJetsFixture();
    f.cache.set(galaxyManifestKey(6), {
      ...phantom,
      sidecars: Object.fromEntries(f.manifest.sidecars),
    });
    f.scene.galaxyManifests.delete(6);
    f.loadWorld(f.scene, 6);
    f.events.emit(`filecomplete-json-${galaxyManifestKey(6)}`);
    f.events.emit("complete");
    expect(f.readArt).toHaveBeenCalledOnce();
    expect(f.craft.every((id) => !f.cache.has(`craft-jets-${id}`))).toBe(true);
    f.events.emit(phantomJetsEvent, phantomJetsKey, "json", f.records);
    f.events.emit("complete");
    expect(f.readArt).toHaveBeenCalledTimes(2);
    expect(f.craft.every((id) => f.cache.get(`craft-jets-${id}`) === f.records[id])).toBe(true);
  });
});
