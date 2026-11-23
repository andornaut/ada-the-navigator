import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

import andromeda from "../../public/art/andromeda/manifest.json";
import cartwheel from "../../public/art/cartwheel/manifest.json";
import core from "../../public/art/manifest.json";
import needle from "../../public/art/needle/manifest.json";
import phantom from "../../public/art/phantom/manifest.json";
import sunflower from "../../public/art/sunflower/manifest.json";
import { ASTEROID_ART } from "../data/asteroidCatalog.ts";
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
import type { Asset } from "./sceneShared.ts";
import { readShipJets } from "./shipJets.ts";
import { SvgRasters, type SvgRequest } from "./svgRasters.ts";
import { vectorSheetKey } from "./svgSheet.ts";
import { fileFilter, vectorRaster } from "./textures.ts";

const m1 = ASTEROID_ART.asteroids.find(({ id }) => id === "asteroid-m1")!;
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
  "queueEagerSvgSheets",
  "queueEnemyPartSheets",
  "queuePhantomCraftJets",
  "svgSheets",
  "loadSvg",
  "queueSvg",
  "rasterAgain",
  "replaceImage",
  "rockTexture",
  "queueRockSheetFrame",
  "queueRockSvg",
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

function fixture(family: EnemyFamily | undefined = claim, useRealSvg = false) {
  const events = new EventEmitter();
  const cache = new Map<string, unknown>();
  const documents = new Map<string, unknown>();
  const textures = new Set<string>();
  const life = new EventEmitter();
  const xml = vi.fn();
  const extract = vi.fn((_xml: unknown, _path: string, asset: Asset) => `data:${asset.id}`);
  const svg = vi.fn();
  const loadRaster = vi.fn();
  const json = vi.fn();
  const start = vi.fn();
  const backdrop = vi.fn();
  const readArt = vi.fn();
  const scene = {
    asteroidArt: ASTEROID_ART,
    cache: {
      json: {
        add: (key: string, value: unknown) => cache.set(key, value),
        exists: (key: string) => cache.has(key),
        get: (key: string) => cache.get(key),
      },
      xml: { get: (key: string) => documents.get(key) },
    },
    children: { list: [] },
    destruction: { archetypes: { platform: {} } },
    family: family as EnemyFamily | undefined,
    familyParts: new Map(),
    galaxyLoads: new Set(),
    galaxyManifestPaths: {
      2: "/art/cartwheel/manifest.json",
      4: "/art/needle/manifest.json",
      6: "/art/phantom/manifest.json",
    },
    galaxyManifests: new Map([[6, { assets: [], links: {}, sidecars: new Map() }]]),
    load: {
      json,
      off: events.off.bind(events),
      on: events.on.bind(events),
      once: events.once.bind(events),
      scene: { events: life, sys: { isActive: () => true } },
      spritesheet: vi.fn(),
      start,
      svg: loadRaster,
      xml,
    },
    loads: { waitFor: vi.fn() },
    manifest: { assets: [] },
    model: { state: { flight: { galaxy: 6 } } },
    partAssets: [] as Asset[],
    partLoads: new Set<string>(),
    rasters: new SvgRasters(1),
    resourceFiles: new Set<string>(),
    rockQueued: false,
    rockRequests: new Set<string>(),
    shipAssets: [] as Asset[],
    textures: { exists: (key: string) => textures.has(key) },
  };
  const context = createContext({
    ENEMY_HEADINGS,
    GALAXY_FAMILIES,
    GALAXY_ID,
    GALAXY_NUMBERS,
    GameObjects: { Image: class {} },
    INDUSTRIAL_BODY_KEYS,
    Loader: { Events: { COMPLETE: "complete", FILE_COMPLETE: "filecomplete" } },
    PHANTOM_ALLIES_ART,
    Scenes: { Events: { DESTROY: "destroy", SHUTDOWN: "shutdown" } },
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
    loadingRockSheets: new WeakMap(),
    materialShipHeading: () => undefined,
    mergeEnemyAssets,
    queueBackdrop: backdrop,
    readCraftNose,
    readEnemyArt: readArt,
    readGalaxyArt: readArt,
    readGalaxyManifest,
    readShipJets,
    rockSheetFrames: new Map(
      m1.frames.map(({ file }, index) => [
        file,
        { id: `asteroid-m1-${index}`, path: m1.svgSheet, ...m1.frame },
      ]),
    ),
    vectorRaster,
    vectorSheetKey,
    vectorSheetSource: extract,
  });
  runInContext(ts.transpile(code), context);
  if (!useRealSvg) {
    context.loadSvg = svg;
  }
  return {
    backdrop,
    cache,
    documents,
    events,
    extract,
    json,
    life,
    loadParts: context.loadEnemyParts as (value: typeof scene, archetype: string) => void,
    loadRaster,
    loadWorld: context.loadGalaxyArt as (value: typeof scene, galaxy: number) => void,
    queueCore: context.queueEagerSvgSheets as (
      value: typeof scene,
      current: () => boolean,
      fail: (error: unknown) => void,
      assets: readonly Asset[],
    ) => void,
    rasterAgain: context.rasterAgain as (
      value: typeof scene,
      requests: readonly SvgRequest[],
    ) => void,
    readArt,
    rockTexture: context.rockTexture as (value: typeof scene, file: string) => boolean,
    scene,
    start,
    svg,
    textures,
    xml,
  };
}

describe("source-family manifest readiness", () => {
  it.each([
    ["/art/needle/enemies/fighter-sheet.svg", false],
    ["/art/needle/enemies/frigate-sheet.svg", true],
  ] as const)("loads a cold family once and publishes a late %s retry", (path, usesDisplaySize) => {
    const f = fixture();
    const key = galaxyManifestKey(4);
    f.loadWorld(f.scene, 4);
    expect(f.json).toHaveBeenCalledWith(key, "/art/needle/manifest.json");
    expect(f.xml).not.toHaveBeenCalled();
    f.cache.set(key, needle);
    f.events.emit(`filecomplete-json-${key}`);
    const hulls = (needle.assets as readonly Asset[]).filter(
      (asset) => asset.svgSheet && asset.family === "needle" && galaxyLoadsAtOnce(asset),
    );
    const paths = [...new Set(hulls.map((asset) => asset.path))];
    expect(hulls).toHaveLength(80);
    expect([...paths].sort()).toEqual([
      "/art/needle/enemies/capital-sheet-2.svg",
      "/art/needle/enemies/capital-sheet.svg",
      "/art/needle/enemies/fighter-sheet.svg",
      "/art/needle/enemies/frigate-sheet.svg",
      "/art/needle/enemies/interceptor-sheet.svg",
      "/art/needle/enemies/swarm-sheet.svg",
    ]);
    for (const path of paths) {
      expect(f.xml.mock.calls.filter(([, url]) => url === path)).toEqual([
        [vectorSheetKey(path), path],
      ]);
    }
    expect(f.svg.mock.calls.some(([, asset]) => paths.includes(asset.path))).toBe(false);

    f.events.emit("complete");
    expect(f.readArt).toHaveBeenCalledTimes(1);
    const sheetKey = vectorSheetKey(path);
    const document = {};
    f.documents.set(sheetKey, document);
    f.events.emit(`filecomplete-xml-${sheetKey}`);
    const frames = hulls.filter((asset) => asset.path === path);
    expect(f.extract.mock.calls).toEqual(
      frames.map((frame) => [
        document,
        path,
        usesDisplaySize
          ? { ...frame, intrinsicHeight: frame.displayHeight, intrinsicWidth: frame.displayWidth }
          : frame,
      ]),
    );
    expect(f.svg.mock.calls.slice(-frames.length)).toEqual(
      frames.map((frame) => [f.scene, { ...frame, path: `data:${frame.id}` }]),
    );
    expect(f.readArt).toHaveBeenCalledTimes(1);
    f.events.emit("complete");
    expect(f.readArt).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["/art/outposts/outposts-sheet.svg", sunflower, false],
    ["/art/andromeda/hamlet-sheet.svg", andromeda, true],
    ["/art/andromeda/settlers-school-sheet.svg", andromeda, true],
    ["/art/phantom/homes-cracked-sheet.svg", phantom, true],
  ] as const)(
    "loads station sheet %s at its authored dimensions",
    (path, manifest, displaySized) => {
      const f = fixture();
      const assets = (manifest.assets as readonly Asset[]).filter((asset) => asset.path === path);
      expect(assets.length).toBeGreaterThan(0);
      const fail = vi.fn();
      f.queueCore(f.scene, () => true, fail, assets);
      const sheet = vectorSheetKey(path);
      expect(f.xml).toHaveBeenCalledExactlyOnceWith(sheet, path);
      const document = {};
      f.documents.set(sheet, document);
      f.events.emit(`filecomplete-xml-${sheet}`, sheet, "xml", document);
      expect(fail).not.toHaveBeenCalled();
      expect(f.extract.mock.calls).toEqual(
        assets.map((asset) => [
          document,
          path,
          displaySized
            ? { ...asset, intrinsicHeight: asset.displayHeight, intrinsicWidth: asset.displayWidth }
            : asset,
        ]),
      );
    },
  );

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
    const selected = readGalaxyManifest<Asset>(cartwheel)!.assets.filter(
      (asset) => asset.family === "claim" && asset.archetype === "platform",
    );
    const sheets = [
      ...new Set(selected.filter(({ svgSheet }) => svgSheet).map(({ path }) => path)),
    ];
    expect(f.xml.mock.calls).toEqual(sheets.map((path) => [vectorSheetKey(path), path]));
    for (const path of sheets) {
      const key = vectorSheetKey(path);
      f.documents.set(key, {});
      f.events.emit("filecomplete", key, "xml");
    }
    const queued = f.svg.mock.calls.map(([, asset]) => asset);
    expect(queued.map(({ id }) => id).sort()).toEqual(selected.map(({ id }) => id).sort());
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
  it("queues one optional pack and publishes the original payloads under all fifteen cache keys", () => {
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
    expect(f.craft).toHaveLength(15);
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

const commandSheet = "/art/enemies/capital-command-intact-sheet.svg";
const topSheet = "/art/enemies/capital-lance-top-sheet.svg";
const part = (id: string, path: string): Asset => ({
  ...(core.assets.find((asset) => asset.id === id) as Asset),
  path,
  svgSheet: true,
});
const [first, second, top] = [
  part("enemy-capital-command-intact-0", commandSheet),
  part("enemy-capital-command-intact-1", commandSheet),
  part("enemy-capital-lance-top-0", topSheet),
] as const;

describe("deferred core capital sheets", () => {
  it("extracts craft and debris at their authored intrinsic size and raw viewBox", () => {
    const f = fixture(undefined);
    const craft = core.assets.find(({ id }) => id === "craft-miner-0") as Asset;
    const stranded = cartwheel.assets.find(({ id }) => id === "craft-stranded-hauler-0") as Asset;
    const debris = cartwheel.assets.find(({ id }) => id === "cartwheel-debris-0") as Asset;
    const frames = [craft, stranded, debris];
    f.queueCore(f.scene, () => true, vi.fn(), frames);
    const document = {};
    for (const asset of frames) {
      const key = vectorSheetKey(asset.path);
      f.documents.set(key, document);
      f.events.emit(`filecomplete-xml-${key}`);
      expect(f.extract).toHaveBeenCalledWith(document, asset.path, {
        ...asset,
        intrinsicHeight: asset.displayHeight,
        intrinsicWidth: asset.displayWidth,
      });
    }
    expect(f.svg.mock.calls).toEqual(
      frames.map((asset) => [f.scene, { ...asset, path: `data:${asset.id}` }]),
    );
  });

  it.each(["enemy-frigate-0", "enemy-capital-0", "enemy-gadget-0"])(
    "passes the intrinsic size of the eager hull %s without rescaling its raw frame",
    (id) => {
      const f = fixture(undefined);
      const hull = core.assets.find((asset) => asset.id === id) as Asset;
      const fail = vi.fn();
      const document = {};
      const key = vectorSheetKey(hull.path);
      f.queueCore(f.scene, () => true, fail, [hull]);
      f.documents.set(key, document);
      f.events.emit(`filecomplete-xml-${key}`);
      expect(f.extract).toHaveBeenCalledExactlyOnceWith(document, hull.path, {
        ...hull,
        intrinsicHeight: hull.displayHeight,
        intrinsicWidth: hull.displayWidth,
      });
      expect(f.svg).toHaveBeenCalledExactlyOnceWith(f.scene, { ...hull, path: `data:${id}` });
      expect(fail).not.toHaveBeenCalled();
    },
  );

  it("queues the existing hull sheet at boot and leaves packed parts for the flight", () => {
    const f = fixture(undefined);
    const hull = core.assets.find(({ id }) => id === "enemy-fighter-0") as Asset;
    f.queueCore(f.scene, () => true, vi.fn(), [first, second, top, hull]);
    const key = vectorSheetKey(hull.path);
    expect(f.xml).toHaveBeenCalledExactlyOnceWith(key, hull.path);
    expect(f.svg).not.toHaveBeenCalled();
    const document = {};
    f.documents.set(key, document);
    f.events.emit(`filecomplete-xml-${key}`);
    expect(f.extract).toHaveBeenCalledExactlyOnceWith(document, hull.path, hull);
    expect(f.svg).toHaveBeenCalledExactlyOnceWith(f.scene, { ...hull, path: `data:${hull.id}` });
  });

  it("keeps m1's original demand-only extraction and reuses its physical sheet", () => {
    const f = fixture();
    const path = m1.svgSheet!;
    const key = vectorSheetKey(path);
    const first = m1.frames[0]!.file;
    const next = m1.frames[1]!.file;
    expect(f.rockTexture(f.scene, first)).toBe(false);
    expect(f.xml).toHaveBeenCalledExactlyOnceWith(key, path);
    expect(f.loadRaster).not.toHaveBeenCalled();
    const document = {};
    f.documents.set(key, document);
    f.events.emit(`filecomplete-xml-${key}`, key, "xml", document);
    expect(f.extract).toHaveBeenCalledExactlyOnceWith(document, path, {
      id: "asteroid-m1-0",
      path,
      ...m1.frame,
    });
    expect(f.loadRaster).toHaveBeenCalledExactlyOnceWith(first, "data:asteroid-m1-0", {
      scale: ASTEROID_ART.displayScale,
    });
    expect(f.rockTexture(f.scene, next)).toBe(false);
    expect(f.loadRaster).toHaveBeenCalledTimes(2);
    expect(f.loadRaster).toHaveBeenLastCalledWith(next, "data:asteroid-m1-1", {
      scale: ASTEROID_ART.displayScale,
    });
    expect(f.xml).toHaveBeenCalledOnce();
  });

  it("reuses cached XML, deduplicates requests and publishes the whole set after late file success", () => {
    const f = fixture();
    f.scene.family = undefined;
    const cachedKey = vectorSheetKey(topSheet);
    const commandKey = vectorSheetKey(commandSheet);
    const cached = { root: "cached tops" };
    const retried = { root: "command retry" };
    f.documents.set(cachedKey, cached);
    f.scene.partAssets = [first, second, top];

    f.loadParts(f.scene, "capital");
    f.loadParts(f.scene, "capital");
    expect(f.xml).toHaveBeenCalledExactlyOnceWith(commandKey, commandSheet);
    expect(f.extract).toHaveBeenCalledExactlyOnceWith(cached, topSheet, {
      ...top,
      intrinsicHeight: 52.5,
      intrinsicWidth: 52.5,
    });
    expect(f.scene.loads.waitFor).not.toHaveBeenCalled();
    f.textures.add(top.id);
    f.events.emit("filecomplete", top.id, "svg");
    // The first batch can complete before the optional XML or an extracted SVG is retried.
    f.events.emit("complete");
    expect(f.scene.shipAssets).toEqual([]);
    expect(f.readArt).not.toHaveBeenCalled();

    f.documents.set(commandKey, retried);
    f.events.emit("filecomplete", commandKey, "xml");
    f.events.emit("filecomplete", commandKey, "xml");
    expect(f.svg.mock.calls.map(([, asset]) => [asset.id, asset.path])).toEqual([
      [top.id, `data:${top.id}`],
      [first.id, `data:${first.id}`],
      [second.id, `data:${second.id}`],
    ]);
    for (const asset of [first, second]) {
      f.events.emit("filecomplete", asset.id, "svg");
      expect(f.readArt).not.toHaveBeenCalled();
      f.textures.add(asset.id);
      f.events.emit("filecomplete", asset.id, "svg");
    }
    expect(f.scene.shipAssets).toEqual([first, second, top]);
    expect(f.readArt).toHaveBeenCalledOnce();
    expect(f.events.listenerCount("filecomplete")).toBe(0);
    expect(f.life.listenerCount("shutdown")).toBe(0);
  });

  it("reuses the extracted SVG and replaces the original linear texture in place on resize", () => {
    const f = fixture(claim, true);
    f.scene.family = undefined;
    f.scene.partAssets = [top];
    const uri = "data:image/svg+xml;base64,PHN2Zy8+";
    f.extract.mockReturnValue(uri);
    f.documents.set(vectorSheetKey(topSheet), {});
    f.loadParts(f.scene, "capital");
    expect(f.loadRaster).toHaveBeenCalledExactlyOnceWith(top.id, uri, { height: 53, width: 53 });
    expect(fileFilter("svg")).toBe("linear");
    f.textures.add(top.id);
    f.scene.rasters.loaded(top.id);
    f.events.emit("filecomplete", top.id, "svg");

    const newImage = { height: 105, width: 105 };
    const source = {
      filter: fileFilter("svg"),
      height: newImage.height,
      updateSource: vi.fn(),
      width: newImage.width,
    };
    const resizeBase = vi.fn();
    const remove = vi.fn();
    const original = { get: () => ({ setSize: resizeBase }), source: [source] };
    const get = vi.fn((key: string) =>
      key === top.id ? original : { getSourceImage: () => newImage },
    );
    Object.assign(f.scene.textures, { get, remove });
    expect(f.scene.rasters.resize(2)).toBe(true);
    const due = f.scene.rasters.due((key) => key === top.id);
    f.rasterAgain(f.scene, due);
    const replacement = `${top.id}@2`;
    expect(f.loadRaster).toHaveBeenLastCalledWith(replacement, uri, { height: 105, width: 105 });
    f.events.emit(`filecomplete-svg-${replacement}`);
    expect(get.mock.calls).toEqual([[top.id], [replacement]]);
    expect(source.updateSource).toHaveBeenCalledExactlyOnceWith(newImage);
    expect(resizeBase).toHaveBeenCalledExactlyOnceWith(105, 105);
    expect(original.source[0]).toBe(source);
    expect(source.filter).toBe("linear");
    expect(remove).toHaveBeenCalledExactlyOnceWith(replacement);
    expect(f.xml).not.toHaveBeenCalled();
  });

  it("keeps a placeholder when one frame is invalid and cancels late events on shutdown", () => {
    const f = fixture();
    f.scene.family = undefined;
    f.scene.partAssets = [first, second, top];
    f.extract
      .mockImplementationOnce(() => "data:first")
      .mockImplementationOnce(() => {
        throw new Error("Wrong viewBox");
      });
    f.loadParts(f.scene, "capital");
    f.events.emit("filecomplete", vectorSheetKey(commandSheet), "xml");
    expect(f.svg).not.toHaveBeenCalled();
    expect(f.scene.shipAssets).toEqual([]);
    f.life.emit("shutdown");
    f.events.emit("filecomplete", vectorSheetKey(topSheet), "xml");
    expect(f.events.listenerCount("filecomplete")).toBe(0);
    expect(f.svg).not.toHaveBeenCalled();
    expect(f.readArt).not.toHaveBeenCalled();
  });
});
