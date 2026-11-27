// The scene's art loading: galaxy, rock, enemy, whale and ship textures and SVG rasters.
// Functions over the scene's AssetsContext.
import { setTextureFilters } from "@andornaut/game-kit/runtime/view/phaser/textureFilter";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/runtime/view/renderScale";
import { GameObjects, Loader, Scenes, Textures } from "phaser";

import {
  BAND_AREA,
  type DebrisArt,
  decorationRasterSize,
  drawnRockId,
  paintBand,
  paintFrames,
  PHANTOM_ALLIES_ART,
  type Raster,
  readBackdropBand,
  readBackdropHaze,
  readBackdropRules,
  readDebrisArt,
  readGalaxyBackdrop,
  readGalaxyStationArt,
  readJobArt,
  readMarloArt,
  readStreakSpec,
  readWhaleArt,
  readWhirlpoolProjects,
  rockArt,
  RockFrames,
  whaleFrameAsset,
  whaleViewBox,
} from "../art/index.ts";
import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ENEMY_SIZE_RATIOS } from "../data/enemyDimensions.ts";
import { enemyAssetKey, hullDesign, INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { scenerySilhouette } from "../model/asteroids.ts";
import { flightWorldContext } from "../model/flightTopology.ts";
import { SHIP_HEADINGS } from "../model/shipHeadingContract.ts";
import type { FlightState, SpaceObject, Vec } from "../model/types.ts";
import { worldDelta } from "../model/worldContacts.ts";
import {
  type CoreManifest,
  galaxyLoadsAtOnce,
  type GalaxyManifest,
  galaxyManifestKey,
  galaxyTowKey,
  readGalaxyManifest,
} from "./artManifest.ts";
import {
  craftArt,
  craftFrameSets,
  readBuoyArt,
  readCraftNose,
  readHubArt,
  storyCraftSets,
  storyNoses,
} from "./cartwheelArt.ts";
import { readShards, type ShardData } from "./destructionArt.ts";
import {
  composedArchetypes,
  ENEMY_HEADINGS,
  type EnemyArt,
  enemyArt,
  type EnemyFamily,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyPartFrame,
  enemyPartsToLoad,
  enemyShardsPath,
  GALAXY_FAMILIES,
  galaxyFamily,
  mergeEnemyAssets,
  readSidecars,
  type Sidecars,
} from "./enemyArt.ts";
import { sceneFit } from "./playCamera.ts";
import { readQuantumJump } from "./quantumJump.ts";
import type { GameScene } from "./scene.ts";
import type { Asset } from "./sceneShared.ts";
import { readShardPalettePack } from "./shardPalettePack.ts";
import { readShipJets } from "./shipJets.ts";
import {
  readShipMaterialPalettes,
  readShipMaterials,
  ShipMaterialSources,
} from "./shipMaterials.ts";
import type { SvgRequest } from "./svgRasters.ts";
import { vectorSheetKey, vectorSheetSource } from "./svgSheet.ts";
import { type TextureFilter, vectorRaster } from "./textures.ts";
import { readStrandedCraft, readTowLine } from "./towArt.ts";

interface MaterialCache {
  readonly poses: Map<string, ReadonlyMap<string, string>>;
  readonly poseIds: readonly string[];
  readonly source: ShipMaterialSources;
  readonly sprites: Map<string, readonly string[]>;
}
const materialCaches = new WeakMap<object, MaterialCache>();

export function flightShipMask(scene: AssetsContext, heading: number) {
  return materialCaches.get(scene)?.source.flightMask(heading);
}

/** The legacy aliases and logical idle frames whose geometry is shared across paints. */
export function materialShipHeading(asset: Asset): number | undefined {
  const heading = asset.directionIndex;
  if (heading === undefined) {
    return undefined;
  }
  const id = asset.paint ? `ship-${asset.paint}-${heading}` : `ship-${heading}`;
  return asset.id === id || (asset.id === "ship" && asset.paint === undefined)
    ? heading
    : undefined;
}

/** Queue one pinned material package before the classic player textures finish preload. */
export function queueShipMaterialSources(
  scene: AssetsContext,
  manifest: CoreManifest<Asset>,
): void {
  materialCaches.delete(scene);
  if (!manifest.shipMaterials || !manifest.quantumJump) {
    return;
  }
  let queued = false;
  const prepare = () => {
    if (
      queued ||
      !scene.cache.json.exists("ship-materials") ||
      !scene.cache.json.exists("ship-material-palettes") ||
      !scene.cache.json.exists("quantum-jump")
    ) {
      return;
    }
    queued = true;
    const jump = readQuantumJump(scene.cache.json.get("quantum-jump"));
    const geometry = jump
      ? readShipMaterials(
          { poses: jump.warp.poses.map(({ id }) => id), warpHeading: jump.warp.heading },
          scene.cache.json.get("ship-materials"),
        )
      : undefined;
    const palettes = readShipMaterialPalettes(
      ECONOMY.paintOrder,
      scene.cache.json.get("ship-material-palettes"),
    );
    if (!geometry || !palettes || !jump) {
      return;
    }
    materialCaches.set(scene, {
      poseIds: jump.warp.poses.map(({ id }) => id),
      poses: new Map(),
      source: new ShipMaterialSources(geometry, palettes),
      sprites: new Map(),
    });
    for (const asset of manifest.assets) {
      if (asset.paint === undefined && materialShipHeading(asset) !== undefined) {
        loadSvg(scene, asset);
      }
    }
  };
  for (const key of ["ship-materials", "ship-material-palettes", "quantum-jump"]) {
    scene.load.once(`filecomplete-json-${key}`, prepare);
  }
  scene.load.json("ship-materials", manifest.shipMaterials);
  scene.load.json("ship-material-palettes", "/art/ship-paint.json");
}

function svgSheets(assets: readonly Asset[]): Map<string, Asset[]> {
  const sheets = new Map<string, Asset[]>();
  for (const asset of assets) {
    if (asset.svgSheet) {
      const frames = sheets.get(asset.path) ?? [];
      frames.push(asset);
      sheets.set(asset.path, frames);
    }
  }
  return sheets;
}

/** Load a vector sheet once, keeping the scale and lifetime of each named texture. */
function queueEagerSvgSheets(
  scene: AssetsContext,
  current: () => boolean,
  fail: (error: unknown) => void,
  assets: readonly Asset[],
  queued?: () => void,
): void {
  for (const [path, frames] of svgSheets(assets.filter(galaxyLoadsAtOnce))) {
    const key = vectorSheetKey(path);
    const queue = (xml: Document | undefined): void => {
      if (!current()) {
        return;
      }
      try {
        const sources = frames.map((asset): Asset => {
          // These shipped sheets retain authored display intrinsics. Art's model-layer frames
          // (the friendly objects and craft, their beacons, project props, the Needle ring
          // gates, the stations, outposts and settlements) have the ordinary raw-intrinsic
          // contract.
          const displaySized =
            asset.debris ||
            asset.archetype === "frigate" ||
            asset.archetype === "capital" ||
            asset.archetype === "archie";
          const size = displaySized
            ? {
                ...asset,
                intrinsicHeight: asset.displayHeight ?? asset.height,
                intrinsicWidth: asset.displayWidth ?? asset.width,
              }
            : asset;
          return { ...asset, path: vectorSheetSource(xml, path, size) };
        });
        for (const asset of sources) {
          loadSvg(scene, asset);
        }
        queued?.();
      } catch (error) {
        fail(error);
      }
    };
    const xml = scene.cache.xml.get(key) as Document | undefined;
    if (xml) {
      queue(xml);
      continue;
    }
    scene.load.once(
      `filecomplete-xml-${key}`,
      followArrivalLoad(scene, () => queue(scene.cache.xml.get(key) as Document | undefined)),
    );
    scene.load.xml(key, path);
  }
}

export { queueEagerSvgSheets as queueCoreSvgSheets };

/** Stable material-generated source URLs for the selected paint, including the route map. */
export function materialShipFrames(scene: object, paint: string | null): readonly string[] {
  const cache = materialCaches.get(scene);
  if (!cache) {
    return [];
  }
  const scheme = paint ?? ECONOMY.defaultPaint;
  let sprites = cache.sprites.get(scheme);
  if (!sprites) {
    sprites = Array.from(
      { length: SHIP_HEADINGS },
      (_, heading) =>
        cache.source.ship(scheme, heading)?.url ??
        cache.source.ship(ECONOMY.defaultPaint, heading)?.url ??
        "",
    );
    cache.sprites.set(scheme, sprites);
  }
  return sprites;
}

/** The Local Map and the Classic swatch fallback use standalone frame precision. */
export function materialClassicShipFrame(scene: object, heading: number): string | undefined {
  return materialCaches.get(scene)?.source.standaloneClassic(heading)?.url;
}

/** A shop swatch uses the same cached material source as heading 48 of its paint. */
function materialShipSwatch(scene: object, paint: string): string | undefined {
  return materialCaches.get(scene)?.source.ship(paint, 48)?.url;
}

/** A paint's swatch in the shop, the Paint card and the paint notice, Classic's from its frame. */
export function paintSwatch(scene: object, paint: string): string | undefined {
  return (
    materialShipSwatch(scene, paint) ??
    (paint === ECONOMY.defaultPaint ? materialClassicShipFrame(scene, 48) : undefined)
  );
}

/** Pose sources are assembled on paint selection, never during jump animation frames. */
export function materialWarpPoses(
  scene: object,
  paint: string,
): ReadonlyMap<string, string> | undefined {
  const cache = materialCaches.get(scene);
  if (!cache) {
    return undefined;
  }
  let poses = cache.poses.get(paint);
  if (!poses) {
    poses = new Map(
      cache.poseIds.flatMap((id) => {
        const source = cache.source.pose(paint, id);
        return source ? [[id, source.url] as const] : [];
      }),
    );
    cache.poses.set(paint, poses);
  }
  return poses;
}

/** The scene state and methods this module's functions use. */
export type AssetsContext = Pick<
  GameScene,
  | "asteroidArt"
  | "backdropRules"
  | "backdrops"
  | "buoyArt"
  | "cache"
  | "children"
  | "coreAssetIds"
  | "craftArt"
  | "debrisArt"
  | "destruction"
  | "enemyArt"
  | "familyArts"
  | "familyParts"
  | "familyShards"
  | "galaxyBackdrops"
  | "galaxyLoads"
  | "galaxyManifestPaths"
  | "galaxyManifests"
  | "galaxyStations"
  | "hubArt"
  | "jobArt"
  | "load"
  | "loads"
  | "manifest"
  | "model"
  | "paintAssets"
  | "paintLoads"
  | "partAssets"
  | "partLoads"
  | "rasters"
  | "rockQueued"
  | "rockRequests"
  | "scale"
  | "shell"
  | "shipAssets"
  | "storyNoses"
  | "strandedCraft"
  | "streakSpec"
  | "textures"
  | "towLine"
  | "whaleArt"
  | "whaleRequests"
  | "whirlpoolProjects"
>;

/**
 * Art's rock frames load after the scene starts, at display size times r: each plain and crystal
 * rock's frame 0 and the backdrop sprites first, then complete spin sets for visible variants,
 * so starting the scene never waits on every SVG.
 */
export function loadAsteroidArt(scene: AssetsContext): void {
  const catalog = ASTEROID_ART;
  scene.shell.setAsteroidArt(false);
  const first = [
    ...[...catalog.asteroids, ...catalog.crystals.rocks].map((rock) => rock.frames[0]!.file),
    ...catalog.backdrop.sprites.map((sprite) => sprite.file),
  ];
  const ready = (): void => {
    if (first.every((file) => scene.textures.exists(file))) {
      scene.shell.setAsteroidArt(true);
    }
  };
  first.forEach((file) => rockTexture(scene, file));
  if (!startRockLoads(scene)) {
    ready();
    return;
  }
  scene.load.once(Loader.Events.COMPLETE, ready);
}

type ShardScene = Pick<GameScene, "cache" | "familyShards" | "load" | "shards">;
const shardPacks = new WeakMap<
  object,
  { archetype: string; pack: NonNullable<ReturnType<typeof readShardPalettePack>> }
>();

function loadedShardView(value: unknown, archetype: string, family: string): ShardData | undefined {
  const legacy = readShards(value);
  if (legacy) {
    return legacy;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    (family !== "coral" && family !== "claim" && family !== "garnet" && family !== "needle")
  ) {
    return undefined;
  }
  const held = shardPacks.get(value);
  if (held) {
    return held.archetype === archetype ? held.pack.forFamily(family) : undefined;
  }
  const pack = readShardPalettePack(value, archetype);
  if (!pack) {
    return undefined;
  }
  shardPacks.set(value, { archetype, pack });
  return pack.forFamily(family);
}

function publishShards(
  scene: Pick<ShardScene, "cache" | "load">,
  key: string,
  destination: Map<string, ShardData>,
  archetype: string,
  family: string,
): void {
  const read = () => {
    const shards = loadedShardView(scene.cache.json.get(key), archetype, family);
    if (shards) {
      destination.set(archetype, shards);
    }
  };
  if (scene.cache.json.exists(key)) {
    read();
    return;
  }
  // The loader owns optional transport retries, including batches after its first COMPLETE.
  const fileEvent = `filecomplete-json-${key}`;
  const events = scene.load.scene.events;
  const cleanup = () => {
    scene.load.off(fileEvent, loaded);
    events.off(Scenes.Events.SHUTDOWN, cleanup);
    events.off(Scenes.Events.DESTROY, cleanup);
  };
  const loaded = () => {
    cleanup();
    read();
  };
  scene.load.once(fileEvent, loaded);
  events.once(Scenes.Events.SHUTDOWN, cleanup);
  events.once(Scenes.Events.DESTROY, cleanup);
}

export function publishCoreShards(scene: ShardScene, archetype: string): void {
  publishShards(scene, `shards-${archetype}`, scene.shards, archetype, "coral");
}

function queueFamilyShards(
  scene: Pick<ShardScene, "cache" | "familyShards" | "load">,
  family: string,
  archetype: string,
  path: string,
  corePath: string | undefined,
): void {
  let destination = scene.familyShards.get(family);
  if (!destination) {
    destination = new Map();
    scene.familyShards.set(family, destination);
  }
  const shared = path === corePath;
  const key = shared ? `shards-${archetype}` : `${family}-shards-${archetype}`;
  publishShards(scene, key, destination, archetype, family);
  if (!shared && !scene.cache.json.exists(key)) {
    scene.load.json(key, path);
  }
}

interface ArrivalQueue {
  readonly include: (keys: ReadonlySet<string>) => void;
  readonly run: (work: () => void) => void;
}
const arrivalQueues = new WeakMap<AssetsContext, ArrivalQueue>();

/** Track the file instances queued for this arrival, including their dependent SVG frames. */
export function arrivalLoads(scene: AssetsContext) {
  const loader = scene.load;
  const files = new Set<Loader.File>();
  const attempted = new Set<string>();
  let active = true;
  const add = (key: string, type: string, _loader: Loader.LoaderPlugin, file: Loader.File) => {
    const request = `${type}:${key}`;
    if (!attempted.has(request)) {
      attempted.add(request);
      files.add(file);
    }
  };
  const queue: ArrivalQueue = {
    include: (keys) => {
      for (const batch of [loader.list, loader.inflight, loader.queue]) {
        for (const file of batch) {
          if (keys.has(file.key)) {
            add(file.key, file.type, loader, file);
          }
        }
      }
    },
    run: (work) => {
      if (!active || arrivalQueues.get(scene) === queue) {
        work();
        return;
      }
      arrivalQueues.set(scene, queue);
      loader.on(Loader.Events.ADD, add);
      try {
        work();
      } finally {
        loader.off(Loader.Events.ADD, add);
        arrivalQueues.delete(scene);
      }
    },
  };
  return {
    dispose: () => {
      active = false;
      attempted.clear();
      files.clear();
    },
    pending: () => {
      for (const file of files) {
        if (!loader.list.has(file) && !loader.inflight.has(file) && !loader.queue.has(file)) {
          files.delete(file);
        }
      }
      return files.size > 0;
    },
    queue: queue.run,
    get requested() {
      return attempted.size > 0;
    },
  };
}

function followArrivalLoad<Args extends unknown[]>(
  scene: AssetsContext,
  callback: (...args: Args) => void,
): (...args: Args) => void {
  const queue = arrivalQueues.get(scene);
  return queue ? (...args) => queue.run(() => callback(...args)) : callback;
}

/**
 * Queues one galaxy's art on confirmed Jump or its first draw. Optional art keeps its normal
 * placeholders if unavailable.
 */
export function loadGalaxyArt(scene: AssetsContext, galaxy: GalaxyNumber): void {
  if (scene.galaxyLoads.has(galaxy)) {
    return;
  }
  scene.galaxyLoads.add(galaxy);
  // Any galaxy's rescue draws the tow line, so it loads with the first flight.
  for (const [key, path] of [
    ["tow", scene.manifest.tow],
    ["jobs", scene.manifest.jobs],
    ["backdrop-layers", scene.manifest.backdropLayers],
  ] as const) {
    if (path && !scene.cache.json.exists(key)) {
      scene.load.json(key, path);
    }
  }
  const path = scene.galaxyManifestPaths[galaxy];
  if (scene.galaxyManifests.has(galaxy) || !path) {
    queueGalaxyArt(scene, galaxy);
  } else {
    scene.load.once(
      `filecomplete-json-${galaxyManifestKey(galaxy)}`,
      followArrivalLoad(scene, () => queueGalaxyArt(scene, galaxy)),
    );
    scene.load.json(galaxyManifestKey(galaxy), path);
  }
  scene.load.once(Loader.Events.COMPLETE, () => readGalaxyArt(scene));
  // The galaxy's first flight waits on its own art.
  scene.loads?.waitFor("galaxy");
  scene.load.start();
}

/**
 * Warm visible art from the active region and the confirmed marker's retained actor, if any.
 * A remote region's other objects are available after the model places Ada there.
 */
export function preloadTravelArt(
  scene: AssetsContext,
  flight: FlightState,
  arrival: Vec,
  retained?: SpaceObject,
): void {
  const world = flightWorldContext(flight);
  const parts = new Set<string>();
  const rocks = new Set<AsteroidArt>();
  const objects = retained ? [...flight.objects, retained] : flight.objects;
  for (const object of objects) {
    const hullReach = object.enemy
      ? ENEMY_SIZE_RATIOS[object.enemy.archetype] * CONTENT.tuning.flight.shipRadius * 2
      : 0;
    const reach = Math.max(object.radius, hullReach, scenerySilhouette(object)?.reach ?? 0) + 60;
    const { x, y } = worldDelta(world, arrival, object);
    if (
      Math.abs(x - y) > SCREEN.width / 2 + reach ||
      Math.abs((x + y) / 2) > SCREEN.height / 2 + reach
    ) {
      continue;
    }
    if (object.enemy) {
      parts.add(
        object.id === PHANTOM_FLAGSHIP
          ? "archie"
          : enemyArtKey(scene, object.enemy.archetype, object.id),
      );
    }
    if (object.asteroid) {
      const art = rockArt(
        drawnRockId(scene.asteroidArt.crystals, {
          asteroid: object.asteroid,
          crystals: object.crystals,
        }),
      );
      if (art) {
        rocks.add(art);
      }
    }
  }
  const rockFiles = new Set<string>();
  for (const art of rocks) {
    rockFrameTexture(scene, art, 0);
    for (const { file } of art.frames) {
      if (!scene.textures.exists(file)) {
        rockFiles.add(file);
        const frame = rockSheetFrames.get(file);
        if (frame) {
          rockFiles.add(vectorSheetKey(frame.path));
        }
      }
    }
  }
  if (rockFiles.size) {
    arrivalQueues.get(scene)?.include(rockFiles);
  }
  for (const archetype of parts) {
    loadEnemyParts(scene, archetype);
  }
  startRockLoads(scene);
}

/** Queues one of a galaxy manifest's SVGs or sheets; whale frames and part frames wait. */
export function loadGalaxyAsset(scene: AssetsContext, asset: Asset): void {
  if (asset.svgSheet || !galaxyLoadsAtOnce(asset) || scene.textures.exists(asset.id)) {
    return;
  }
  if (asset.path.endsWith(".svg")) {
    loadSvg(scene, asset);
  } else if (asset.frameWidth && asset.frameHeight) {
    scene.load.spritesheet(asset.id, asset.path, {
      frameHeight: asset.frameHeight,
      frameWidth: asset.frameWidth,
    });
  }
}

/**
 * Adds a galaxy's loaded manifest to the known assets and data links, then queues its art:
 * its SVGs and sheets, its craft and claim jumper data and its own data files.
 */
export function queueGalaxyArt(scene: AssetsContext, galaxy: GalaxyNumber): void {
  queueGalaxyAssets(scene, undefined, galaxy);
}

const PHANTOM_CRAFT_JETS_PATH = "/art/phantom/friendly-craft-jets.json";
const PHANTOM_CRAFT_JETS_KEY = "phantom-friendly-craft-jets";

function queuePhantomCraftJets(scene: AssetsContext, craft: readonly string[]): void {
  if (craft.length === 0 || craft.every((id) => scene.cache.json.exists(`craft-jets-${id}`))) {
    return;
  }

  let initialLoadFinished = false;
  scene.load.once(Loader.Events.COMPLETE, () => {
    initialLoadFinished = true;
  });
  // The optional file watcher retries this same loader key after a transport failure.
  scene.load.once(
    `filecomplete-json-${PHANTOM_CRAFT_JETS_KEY}`,
    (_key: string, _type: string, value: unknown) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return;
      }
      const records = value as Readonly<Record<string, unknown>>;
      if (
        Object.keys(records).length !== craft.length ||
        !craft.every(
          (id) =>
            Object.hasOwn(records, id) &&
            readShipJets(records[id])?.headings.length === ENEMY_HEADINGS &&
            readCraftNose(records[id]),
        )
      ) {
        return;
      }
      for (const id of craft) {
        scene.cache.json.add(`craft-jets-${id}`, records[id]);
      }
      if (initialLoadFinished) {
        scene.load.once(Loader.Events.COMPLETE, () => readGalaxyArt(scene));
      }
    },
  );
  scene.load.json(PHANTOM_CRAFT_JETS_KEY, PHANTOM_CRAFT_JETS_PATH);
}

const enemyJetCacheKey = (path: string): string => `enemy-jet:${path}`;

/** Let Phaser share the pending, in-flight or cached JSON for this exact manifest URL. */
export function queueEnemyJets(scene: Pick<AssetsContext, "load">, path: string): void {
  scene.load.json(enemyJetCacheKey(path), path);
}

function queueGalaxyAssets(
  scene: AssetsContext,
  familySubset: { readonly family: string; readonly archetype: string } | undefined,
  galaxy: GalaxyNumber,
): void {
  const manifest =
    scene.galaxyManifests.get(galaxy) ??
    readGalaxyManifest<Asset>(scene.cache.json.get(galaxyManifestKey(galaxy)));
  if (!manifest) {
    return;
  }
  if (!scene.galaxyManifests.has(galaxy)) {
    scene.galaxyManifests.set(galaxy, manifest);
    scene.manifest = {
      ...scene.manifest,
      ...manifest.links,
      assets: mergeEnemyAssets(scene.manifest.assets, manifest.assets),
    };
    for (const { family } of GALAXY_FAMILIES) {
      scene.familyParts.set(
        family,
        mergeEnemyAssets(
          scene.familyParts.get(family) ?? [],
          manifest.assets.filter((asset) => enemyPartFrame(asset) && asset.family === family),
        ),
      );
    }
    // The galaxy's own coral (unprefixed) enemy rows join core's, with their data files.
    scene.partAssets = mergeEnemyAssets(
      scene.partAssets,
      manifest.assets.filter((asset) => enemyPartFrame(asset) && asset.family === undefined),
    );
    queueCoralEnemyData(scene, manifest.assets, manifest.sidecars);
  }
  const allies = manifest.links.allies;
  if (galaxy === 6 && !familySubset && allies && !scene.cache.json.exists(PHANTOM_ALLIES_ART)) {
    scene.load.json(PHANTOM_ALLIES_ART, allies);
  }
  const assets = familySubset
    ? manifest.assets.filter(
        (asset) =>
          asset.family === familySubset.family && asset.archetype === familySubset.archetype,
      )
    : manifest.assets;
  for (const asset of assets) {
    loadGalaxyAsset(scene, asset);
  }
  const packed = assets.filter(
    (asset) => asset.svgSheet && galaxyLoadsAtOnce(asset) && !scene.textures.exists(asset.id),
  );
  if (packed.length > 0) {
    const current = () => scene.load.scene.sys.isActive();
    let batchFinished = false;
    scene.load.once(Loader.Events.COMPLETE, () => {
      batchFinished = true;
    });
    queueEagerSvgSheets(
      scene,
      current,
      (error) => console.warn(error),
      packed,
      () => {
        if (batchFinished) {
          // A transport retry can deliver the sheet after the first galaxy read.
          batchFinished = false;
          scene.load.once(Loader.Events.COMPLETE, () => {
            batchFinished = true;
            if (current()) {
              readGalaxyArt(scene);
            }
          });
        }
      },
    );
  }
  // Data files come from the manifest's own sidecars map; a Phantom platform subset reads
  // Cartwheel's.
  const { sidecars } = manifest;
  const core = scene.cache.json.get("art-manifest") as CoreManifest<Asset> | undefined;
  const coreSidecars = readSidecars(core?.sidecars);
  const packedCraft: string[] = [];
  for (const craft of craftFrameSets(assets).keys()) {
    const jets = enemyJetsPath(sidecars, craft);
    if (jets === PHANTOM_CRAFT_JETS_PATH && galaxy === 6 && !familySubset) {
      packedCraft.push(craft);
    } else if (jets && !scene.cache.json.exists(`craft-jets-${craft}`)) {
      scene.load.json(`craft-jets-${craft}`, jets);
    }
  }
  queuePhantomCraftJets(scene, packedCraft);
  for (const { family, prefix, wired } of GALAXY_FAMILIES) {
    for (const [archetype, frames] of enemyFrameSets(assets, prefix)) {
      if (!wired.has(archetype)) {
        continue;
      }
      const jets = frames.length > 1 ? enemyJetsPath(sidecars, archetype) : undefined;
      if (jets) {
        queueEnemyJets(scene, jets);
      }
      // Shards, as in coral, for the archetypes Art's destruction data covers.
      const shards =
        scene.destruction &&
        Object.hasOwn(
          scene.destruction.archetypes,
          INDUSTRIAL_BODY_KEYS.some((key) => key === archetype) ? "retaliator" : archetype,
        )
          ? enemyShardsPath(sidecars, archetype)
          : undefined;
      if (shards) {
        queueFamilyShards(
          scene,
          family,
          archetype,
          shards,
          coreSidecars && enemyShardsPath(coreSidecars, archetype),
        );
      }
      const hardpoints = composedArchetypes(scene.familyParts.get(family) ?? []).has(archetype)
        ? enemyHardpointsPath(sidecars, archetype)
        : undefined;
      if (hardpoints) {
        scene.load.json(`${family}-hardpoints-${archetype}`, hardpoints);
      }
    }
  }
  if (familySubset) {
    return;
  }
  queueBackdrop(scene, galaxy, manifest);
  // The galaxy's own data files, named by its manifest's links, and its stranded craft data.
  for (const [key, path] of [
    [galaxyTowKey(galaxy), manifest.tow],
    ["cartwheel-debris", manifest.links.cartwheelDebris],
    ["whales", manifest.links.whales],
    ["whirlpool-currents", manifest.links.whirlpoolCurrents],
    ["whirlpool-debris", manifest.links.whirlpoolDebris],
    ["whirlpool-projects", manifest.links.whirlpoolProjects],
  ] as const) {
    if (path && !scene.cache.json.exists(key)) {
      scene.load.json(key, path);
    }
  }
}

/**
 * A galaxy's backdrop layers: its backdrop-lattice.json, then the fixed layers it names and its
 * nebula textures, which draw with linear filtering since at parallax 0.05 nearest texels would
 * crawl.
 */
export function queueBackdrop(
  scene: AssetsContext,
  galaxy: GalaxyNumber,
  manifest: GalaxyManifest<Asset>,
): void {
  const path = manifest.links.backdrop;
  const key = `backdrop-${galaxy}`;
  if (!path || scene.galaxyBackdrops.has(galaxy) || scene.cache.json.exists(key)) {
    return;
  }
  scene.load.once(
    `filecomplete-json-${key}`,
    followArrivalLoad(scene, () => {
      const backdrop = readGalaxyBackdrop(scene.cache.json.get(key));
      if (!backdrop) {
        return;
      }
      scene.galaxyBackdrops.set(galaxy, backdrop);
      if (backdrop.fixed.includes("backdropHaze")) {
        queueHaze(scene, galaxy, manifest);
      }
      if (backdrop.fixed.includes("needleBand")) {
        queueBand(scene, galaxy, manifest);
      }
      for (const id of backdrop.far.flatMap((far) => (far.look === "nebula" ? far.assets : []))) {
        const asset = manifest.assets.find((entry) => entry.id === id);
        if (!asset || scene.textures.exists(id)) {
          continue;
        }
        scene.load.once(`filecomplete-image-${id}`, () => filterTexture(scene, id, "linear"));
        scene.load.image(id, asset.path);
      }
    }),
  );
  scene.load.json(key, path);
}

/**
 * A galaxy's backdrop haze: its haze.json, then the texture it names, which draws with linear
 * filtering since its half-resolution texels must never show.
 */
export function queueHaze(
  scene: AssetsContext,
  galaxy: GalaxyNumber,
  manifest: GalaxyManifest<Asset>,
): void {
  const path = manifest.links.backdropHaze;
  const key = `backdrop-haze-${galaxy}`;
  if (!path || scene.backdrops.has(galaxy) || scene.cache.json.exists(key)) {
    return;
  }
  scene.load.once(
    `filecomplete-json-${key}`,
    followArrivalLoad(scene, () => {
      const haze = readBackdropHaze(manifest.assets, scene.cache.json.get(key));
      if (!haze) {
        return;
      }
      const ready = () => {
        filterTexture(scene, haze.asset, "linear");
        scene.backdrops.set(galaxy, haze);
      };
      if (scene.textures.exists(haze.asset)) {
        ready();
      } else {
        scene.load.once(`filecomplete-image-${haze.asset}`, ready);
        scene.load.image(haze.asset, haze.path);
      }
    }),
  );
  scene.load.json(key, path);
}

/**
 * Needle's edge-on band: its band.json, painted once into a canvas texture over the haze's area
 * at the maximum render scale, so its strip edges and point stars stay sharp.
 */
export function queueBand(
  scene: AssetsContext,
  galaxy: GalaxyNumber,
  manifest: GalaxyManifest<Asset>,
): void {
  const path = manifest.links.needleBand;
  const key = `backdrop-band-${galaxy}`;
  if (!path || scene.backdrops.has(galaxy) || scene.cache.json.exists(key)) {
    return;
  }
  scene.load.once(`filecomplete-json-${key}`, () => {
    const band = readBackdropBand(scene.cache.json.get(key));
    if (!band || scene.textures.exists(key)) {
      return;
    }
    const texture = scene.textures.createCanvas(
      key,
      BAND_AREA.width * MAX_RENDER_SCALE,
      BAND_AREA.height * MAX_RENDER_SCALE,
    );
    if (!texture) {
      return;
    }
    paintBand(band, texture.getContext(), MAX_RENDER_SCALE);
    texture.refresh();
    filterTexture(scene, key, "linear");
    scene.backdrops.set(galaxy, { asset: key, height: BAND_AREA.height, width: BAND_AREA.width });
  });
  scene.load.json(key, path);
}

/** Reads the galaxy art whose textures and data have loaded. */
export function readGalaxyArt(scene: AssetsContext): void {
  scene.backdropRules ??= readBackdropRules(scene.cache.json.get("backdrop-layers"));
  readEnemyArt(scene);
  const loaded = scene.manifest.assets.filter((asset) => scene.textures.exists(asset.id));
  for (const [galaxy, manifest] of scene.galaxyManifests) {
    const own = manifest.assets.filter((asset) => scene.textures.exists(asset.id));
    const stations = readGalaxyStationArt(own);
    if (stations) {
      scene.galaxyStations.set(galaxy, stations);
    }
    scene.strandedCraft.set(
      galaxy,
      readStrandedCraft(scene.cache.json.get(galaxyTowKey(galaxy)), own),
    );
  }
  scene.towLine = readTowLine(scene.cache.json.get("tow"));
  scene.jobArt = readJobArt(scene.shipAssets, scene.cache.json.get("jobs"));
  scene.hubArt = readHubArt(loaded);
  scene.buoyArt = readBuoyArt(loaded);
  // Each craft's frames from a galaxy manifest, else core's shared craft.
  const core = new Set(scene.coreAssetIds);
  scene.craftArt = craftArt(
    (craft) => scene.cache.json.get(`craft-jets-${craft}`),
    storyCraftSets(
      loaded.filter(({ id }) => !core.has(id)),
      loaded.filter(({ id }) => core.has(id)),
    ),
  );
  scene.storyNoses = storyNoses((craft) => scene.cache.json.get(`craft-jets-${craft}`));
  const debris = new Map<GalaxyNumber, DebrisArt>();
  for (const [galaxy, key] of [
    [2, "cartwheel-debris"],
    [3, "whirlpool-debris"],
  ] as const) {
    const art = readDebrisArt(scene.cache.json.get(key));
    const ready = art?.pieces.every((piece) =>
      piece.frames.every((_, k) => scene.textures.exists(`${piece.id}-${k}`)),
    );
    if (art && ready) {
      debris.set(galaxy, art);
    }
  }
  scene.debrisArt = debris;
  scene.streakSpec = readStreakSpec(scene.cache.json.get("whirlpool-currents"));
  scene.whirlpoolProjects = readWhirlpoolProjects(
    loaded,
    scene.cache.json.get("whirlpool-projects"),
  );
  const whaleData: unknown = scene.cache.json.get("whales");
  const whaleFrames = scene.manifest.assets.filter(whaleFrameAsset);
  const linkedPhantom = scene.galaxyManifests.get(6)?.links.whales;
  scene.whaleArt =
    readWhaleArt(whaleData, whaleFrames) ??
    (linkedPhantom ? readMarloArt(whaleData, whaleFrames) : undefined);
}

interface RockSheetFrame {
  readonly path: string;
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
}

const rockSheetFrames = new Map<string, RockSheetFrame>();
function registerRockSheets(rocks: readonly AsteroidArt[], intrinsicScale: number): void {
  for (const rock of rocks) {
    const path = rock.svgSheet;
    if (!path) {
      continue;
    }
    const { height, width } = rock.frame;
    rock.frames.forEach(({ file }, index) => {
      rockSheetFrames.set(file, {
        height,
        id: `${rock.id}-${index}`,
        intrinsicHeight: height * intrinsicScale,
        intrinsicWidth: width * intrinsicScale,
        path,
        width,
      });
    });
  }
}
registerRockSheets([...ASTEROID_ART.asteroids, ...ASTEROID_ART.crystals.rocks], 1);

function queueRockSvg(scene: AssetsContext, file: string, path: string): void {
  const factor = scene.asteroidArt.displayScale;
  queueSvg(scene, { key: file, path, size: (scale) => ({ scale: scale * factor }) });
}

const loadingRockSheets = new WeakMap<AssetsContext, Map<string, string[]>>();

function queueRockSheetFrame(scene: AssetsContext, file: string, frame: RockSheetFrame): void {
  const { path } = frame;
  const key = vectorSheetKey(path);
  const queueFrame = (logicalFile: string, xml: Document): void => {
    try {
      const source = vectorSheetSource(xml, path, rockSheetFrames.get(logicalFile)!);
      queueRockSvg(scene, logicalFile, source);
    } catch (error) {
      // Malformed optional art keeps the same fallback as a missing individual rock frame.
      console.warn(error);
    }
  };
  const xml = scene.cache.xml.get(key) as Document | undefined;
  if (xml) {
    queueFrame(file, xml);
    scene.rockQueued = true;
    return;
  }
  let loading = loadingRockSheets.get(scene);
  if (!loading) {
    loading = new Map();
    loadingRockSheets.set(scene, loading);
  }
  const pending = loading.get(path);
  if (pending) {
    pending.push(file);
    return;
  }
  const requested = [file];
  loading.set(path, requested);
  // The loader's existing automatic retry repeats the XML request with the same key.
  scene.load.once(
    `filecomplete-xml-${key}`,
    followArrivalLoad(scene, (_key: string, _type: string, source: Document) => {
      loading.delete(path);
      for (const logicalFile of requested) {
        queueFrame(logicalFile, source);
      }
    }),
  );
  scene.load.xml(key, path);
  scene.rockQueued = true;
}

/** Whether a rock or backdrop SVG is ready; a missing one is queued for the next load. */
export function rockTexture(scene: AssetsContext, file: string): boolean {
  if (scene.textures.exists(file)) {
    return true;
  }
  if (!scene.rockRequests.has(file) && scene.asteroidArt) {
    scene.rockRequests.add(file);
    const frame = rockSheetFrames.get(file);
    if (frame) {
      queueRockSheetFrame(scene, file, frame);
    } else {
      queueRockSvg(scene, file, file);
      scene.rockQueued = true;
    }
  }
  return false;
}

/** Starts loading any queued rock SVGs; false when none were queued. */
export function startRockLoads(scene: AssetsContext): boolean {
  if (!scene.rockQueued) {
    return false;
  }
  scene.rockQueued = false;
  scene.load.start();
  return true;
}

const rockFrames = new WeakMap<AssetsContext, RockFrames>();

/** Use the exact requested pose only after the visible variant's full spin set is loaded. */
export function rockFrameTexture(
  scene: AssetsContext,
  art: AsteroidArt,
  frame: number,
): string | undefined {
  let frames = rockFrames.get(scene);
  if (!frames) {
    frames = new RockFrames();
    rockFrames.set(scene, frames);
  }
  return frames.frame((file) => rockTexture(scene, file), art, frame);
}

/**
 * Queues the jets and hardpoints files of a manifest's coral (unprefixed) enemy rows from that
 * manifest's sidecars, under the coral keys: core's at boot, and a galaxy's own when it loads.
 */
export function queueCoralEnemyData(
  scene: Pick<AssetsContext, "load">,
  assets: readonly Asset[],
  sidecars: Sidecars,
): void {
  const coral = assets.filter((asset) => asset.family === undefined);
  const composed = composedArchetypes(coral);
  for (const archetype of enemyFrameSets(coral).keys()) {
    const jets = enemyJetsPath(sidecars, archetype);
    if (jets) {
      queueEnemyJets(scene, jets);
    }
    const hardpoints = composed.has(archetype)
      ? enemyHardpointsPath(sidecars, archetype)
      : undefined;
    if (hardpoints) {
      scene.load.json(`enemy-hardpoints-${archetype}`, hardpoints);
    }
  }
}

/**
 * The sidecars the coral family reads: core's, then each loaded galaxy manifest's entries for
 * the coral (unprefixed) hull sets it carries itself.
 */
function coralSidecars(scene: AssetsContext): Sidecars | undefined {
  const core = scene.cache.json.get("art-manifest") as CoreManifest<Asset> | undefined;
  const sidecars = readSidecars(core?.sidecars);
  if (!sidecars) {
    return undefined;
  }
  const merged = new Map(sidecars);
  for (const manifest of scene.galaxyManifests.values()) {
    const coral = manifest.assets.filter((asset) => asset.family === undefined);
    for (const archetype of enemyFrameSets(coral).keys()) {
      const own = manifest.sidecars.get(archetype);
      if (own) {
        merged.set(archetype, own);
      }
    }
  }
  return merged;
}

/** Archetypes without a complete loaded frame set keep their vector placeholders. */
export function readEnemyArt(scene: AssetsContext): void {
  const cachedJets = (sidecars: Sidecars | undefined, archetype: string): unknown => {
    const path = sidecars && enemyJetsPath(sidecars, archetype);
    return path === undefined ? undefined : scene.cache.json.get(enemyJetCacheKey(path));
  };
  const coral = coralSidecars(scene);
  // Core's loaded frames and parts, and the coral rows of each loaded galaxy manifest.
  const coralAssets = mergeEnemyAssets(
    scene.shipAssets,
    [...scene.galaxyManifests.values()].flatMap(({ assets }) =>
      assets.filter((asset) => asset.family === undefined && scene.textures.exists(asset.id)),
    ),
  );
  scene.enemyArt = enemyArt(
    (archetype) => cachedJets(coral, archetype),
    (archetype) => scene.cache.json.get(`enemy-hardpoints-${archetype}`),
    composedArchetypes(scene.partAssets),
    coralAssets,
    enemyFrameSets(coralAssets),
  );
  for (const { family, galaxy, prefix, wired } of GALAXY_FAMILIES) {
    const owner = GALAXY_NUMBERS.find((id) => GALAXY_ID[id] === galaxy);
    const sidecars = owner === undefined ? undefined : scene.galaxyManifests.get(owner)?.sidecars;
    const loaded = scene.manifest.assets.filter(
      (asset) => asset.family === family && scene.textures.exists(asset.id),
    );
    const art = enemyArt(
      (archetype) => cachedJets(sidecars, archetype),
      (archetype) => scene.cache.json.get(`${family}-hardpoints-${archetype}`),
      composedArchetypes(scene.familyParts.get(family) ?? []),
      loaded,
      enemyFrameSets(loaded, prefix),
      prefix,
      family,
    );
    scene.familyArts.set(family, new Map([...art].filter(([archetype]) => wired.has(archetype))));
  }
}

/**
 * The family the flight's galaxy draws a craft in: its own (Cartwheel's claim jumpers,
 * Andromeda's garnet drones), else Archie's coral.
 */
export function familyOf(scene: AssetsContext, archetype: string): EnemyFamily | undefined {
  const galaxy = scene.model.state.flight?.galaxy;
  return galaxyFamily(galaxy === undefined ? undefined : GALAXY_ID[galaxy], archetype);
}

/**
 * The key a craft's art draws under in the flight's galaxy. A frigate or capital flying its
 * galaxy's own design draws its family's class frames, which are that family's design, else the
 * coral design's frame key (`frigateTwin`, `capitalManta`, `capitalForked`).
 */
export function enemyArtKey(scene: AssetsContext, archetype: string, id?: string): string {
  if (archetype === "capital" || archetype === "frigate") {
    const galaxy = scene.model.state.flight?.galaxy;
    const design = hullDesign(
      { archetype, id },
      galaxy === undefined ? undefined : GALAXY_ID[galaxy],
    );
    if (design) {
      return familyOf(scene, archetype) ? archetype : design;
    }
  }
  return archetype === "capital" || archetype === "retaliator"
    ? enemyAssetKey({ archetype, id })
    : archetype;
}

/** A craft's art in its galaxy's family, while that family's frames are loaded. */
export function familyArt(
  scene: AssetsContext,
  archetype: string,
  id?: string,
): EnemyArt<Asset> | undefined {
  const key = enemyArtKey(scene, archetype, id);
  const family = familyOf(scene, key);
  return family ? scene.familyArts.get(family.family)?.get(key) : scene.enemyArt.get(key);
}

/** Source-family metadata uses the scene's canonical manifest cache and loader, without world art. */
export function ensureEnemyFamilyManifest(
  scene: AssetsContext,
  family: EnemyFamily | undefined,
  archetype: string,
): boolean {
  if (!family) {
    return true;
  }
  const galaxy = GALAXY_NUMBERS.find((id) => GALAXY_ID[id] === family.galaxy);
  if (galaxy === undefined) {
    return false;
  }
  if (scene.galaxyManifests.has(galaxy)) {
    return true;
  }
  const key = galaxyManifestKey(galaxy);
  const subset = { archetype, family: family.family };
  if (scene.cache.json.exists(key)) {
    queueGalaxyAssets(scene, subset, galaxy);
    if (!scene.galaxyManifests.has(galaxy)) {
      return false;
    }
    scene.load.once(Loader.Events.COMPLETE, () => readGalaxyArt(scene));
    scene.load.start();
    return scene.galaxyManifests.has(galaxy);
  }
  const path = scene.galaxyManifestPaths[galaxy];
  if (!path || scene.galaxyLoads.has(galaxy)) {
    arrivalQueues.get(scene)?.include(new Set([key]));
    return false;
  }
  // Share the existing in-flight manifest marker; a later own flight still queues its world art.
  scene.galaxyLoads.add(galaxy);
  scene.load.once(
    `filecomplete-json-${key}`,
    followArrivalLoad(scene, () => {
      queueGalaxyAssets(scene, subset, galaxy);
      if (scene.galaxyManifests.has(galaxy)) {
        scene.galaxyLoads.delete(galaxy);
      }
    }),
  );
  scene.load.once(Loader.Events.COMPLETE, () => readGalaxyArt(scene));
  scene.load.json(key, path);
  scene.load.start();
  return false;
}

/** Publish a packed heavy only after every missing part texture is available, including retries. */
function queueEnemyPartSheets(scene: AssetsContext, parts: readonly Asset[]): void {
  const sheets = new Map(
    [...svgSheets(parts)].map(([path, frames]) => [vectorSheetKey(path), { frames, path }]),
  );
  const pending = new Set(parts.map(({ id }) => id));
  const events = scene.load.scene.events;
  const dispose = (): void => {
    events.off(Scenes.Events.SHUTDOWN, dispose);
    events.off(Scenes.Events.DESTROY, dispose);
    scene.load.off(Loader.Events.FILE_COMPLETE, complete);
  };
  const queueFrames = followArrivalLoad(scene, (key: string, xml: Document | undefined): void => {
    const sheet = sheets.get(key);
    if (!sheet) {
      return;
    }
    sheets.delete(key);
    try {
      // Validate the entire sheet before queuing any of its textures. Part roots keep their
      // authored display size, except the bases of Art's model-layer hostile stations and Claim
      // platform, which have the raw-intrinsic contract.
      const textures = sheet.frames.map((part) => ({
        ...part,
        path: vectorSheetSource(
          xml,
          sheet.path,
          part.hardpoint !== undefined &&
            (part.archetype === "hostileStation" || part.archetype === "platform")
            ? part
            : {
                ...part,
                intrinsicHeight: part.displayHeight ?? part.height,
                intrinsicWidth: part.displayWidth ?? part.width,
              },
        ),
      }));
      textures.forEach((part) => loadSvg(scene, part));
    } catch (error) {
      // Optional art keeps the heavy placeholder when a delivered sheet has invalid frames.
      console.warn(error);
    }
  });
  const complete = (key: string, type: string): void => {
    if (type === "xml" && sheets.has(key)) {
      queueFrames(key, scene.cache.xml.get(key) as Document | undefined);
    } else if (
      type === "svg" &&
      scene.textures.exists(key) &&
      pending.delete(key) &&
      pending.size === 0
    ) {
      dispose();
      scene.shipAssets = mergeEnemyAssets(scene.shipAssets, parts);
      readEnemyArt(scene);
    }
  };
  events.once(Scenes.Events.SHUTDOWN, dispose);
  events.once(Scenes.Events.DESTROY, dispose);
  // A retry can complete after the original loader batch ends. Observe file success, not the batch.
  scene.load.on(Loader.Events.FILE_COMPLETE, complete);
  for (const [key, { path }] of sheets) {
    const xml = scene.cache.xml.get(key) as Document | undefined;
    if (xml) {
      queueFrames(key, xml);
    } else {
      scene.load.xml(key, path);
    }
  }
  for (const part of parts) {
    if (!part.svgSheet) {
      loadSvg(scene, part);
    }
  }
  scene.load.start();
}

/**
 * A heavy's hardpoint bases and turret tops load the first time that archetype is in flight, so
 * their hundreds of frames never delay a screen that shows none. Until they load, the craft
 * keeps its vector placeholder.
 */
export function loadEnemyParts(scene: AssetsContext, archetype: string): void {
  const family = familyOf(scene, archetype);
  // A shared family can come from a different galaxy than the current flight. Coral parts are
  // known once the flight's galaxy manifest, which can carry its own coral rows, has loaded.
  const galaxy = scene.model.state.flight?.galaxy;
  const parts = enemyPartsToLoad(
    family
      ? ensureEnemyFamilyManifest(scene, family, archetype)
      : galaxy === undefined ||
          scene.galaxyManifests.has(galaxy) ||
          !scene.galaxyManifestPaths[galaxy],
    (id) => scene.textures.exists(id),
    family ? (scene.familyParts.get(family.family) ?? []) : scene.partAssets,
    archetype,
  );
  if (parts === null) {
    return;
  }
  const key = `${family?.family ?? "coral"}:${archetype}`;
  const arrival = arrivalQueues.get(scene);
  if (arrival && parts.length) {
    arrival.include(
      new Set(
        parts.flatMap((part) => (part.svgSheet ? [part.id, vectorSheetKey(part.path)] : [part.id])),
      ),
    );
  }
  if (parts.some((part) => part.svgSheet)) {
    if (!scene.partLoads.has(key)) {
      scene.partLoads.add(key);
      queueEnemyPartSheets(scene, parts);
    }
    return;
  }
  if (arrival && scene.partLoads.has(key)) {
    return;
  }
  scene.partLoads.add(key);
  if (parts.length === 0) {
    return;
  }
  for (const part of parts) {
    loadSvg(scene, part);
  }
  scene.load.once(Loader.Events.COMPLETE, () => {
    scene.shipAssets = mergeEnemyAssets(
      scene.shipAssets,
      parts.filter(({ id }) => scene.textures.exists(id)),
    );
    readEnemyArt(scene);
  });
  scene.load.start();
}

/** Queues an SVG at the current raster scale (svgRasters.ts). */
export function queueSvg(scene: AssetsContext, request: SvgRequest): void {
  scene.load.svg(request.key, request.path, scene.rasters.request(request));
}

/**
 * Rasterises loaded SVGs again at the current raster scale: each loads under a scale-suffixed
 * key, then replaces its texture's image in place, and every image drawing it keeps its display
 * size and origin. A raster for a scale replaced meanwhile is dropped.
 */
export function rasterAgain(scene: AssetsContext, requests: readonly SvgRequest[]): void {
  if (requests.length === 0) {
    return;
  }
  const scale = scene.rasters.scale;
  for (const request of requests) {
    const raster = `${request.key}@${scale}`;
    if (scene.textures.exists(raster)) {
      continue;
    }
    scene.load.once(`filecomplete-svg-${raster}`, () => {
      if (scale === scene.rasters.scale && scene.textures.exists(request.key)) {
        replaceImage(scene, request.key, raster);
      }
      scene.textures.remove(raster);
    });
    scene.load.svg(raster, request.path, request.size(scale));
  }
  scene.load.start();
}

/**
 * Rasterises again, at the current scale, each stale SVG the scene draws this frame: a visible
 * display object's texture, or one stamped into a group (SvgRasters.mark). Stale SVGs nothing
 * draws keep their old raster until their first draw.
 */
export function rasterDrawn(scene: AssetsContext): void {
  if (!scene.rasters.pending) {
    return;
  }
  const shown = new Set<string>();
  for (const child of scene.children.list) {
    const texture = (child as Partial<GameObjects.Image>).texture;
    if (texture && (child as Partial<GameObjects.Image>).visible !== false) {
      shown.add(texture.key);
    }
  }
  rasterAgain(
    scene,
    scene.rasters.due((key) => shown.has(key)),
  );
}

/** Puts the image of texture from into texture key, keeping every user's display size. */
export function replaceImage(scene: AssetsContext, key: string, from: string): void {
  const texture = scene.textures.get(key);
  const users = scene.children.list.filter(
    (child): child is GameObjects.Image =>
      child instanceof GameObjects.Image && child.texture === texture,
  );
  const sizes = users.map((user) => [user.displayWidth, user.displayHeight] as const);
  const source = texture.source[0]!;
  const before = { height: source.height, width: source.width };
  source.updateSource(scene.textures.get(from).getSourceImage() as HTMLImageElement);
  texture.get("__BASE").setSize(source.width, source.height);
  // A sliced strip's frames keep their share of the new raster.
  const sx = source.width / before.width;
  const sy = source.height / before.height;
  for (const name of texture.getFrameNames()) {
    const frame = texture.get(name);
    frame.setSize(frame.cutWidth * sx, frame.cutHeight * sy, frame.cutX * sx, frame.cutY * sy);
  }
  users.forEach((user, index) => {
    const [width, height] = sizes[index]!;
    user
      .setFrame(user.frame.name)
      .setOrigin(user.originX, user.originY)
      .setDisplaySize(width, height);
  });
}

/** Sets a texture's filter on every source it draws from. */
export function filterTexture(scene: AssetsContext, key: string, filter: TextureFilter): void {
  setTextureFilters(scene.textures, new Map([[key, filter]]));
}

/** Selects linear sampling for a freshly uploaded SVG image without uploading its pixels again. */
export function filterLoadedSvg(scene: AssetsContext, key: string): void {
  const sources = scene.textures.get(key).source;
  const source = sources.length === 1 ? sources[0] : undefined;
  const renderer = source?.renderer;
  const texture = source?.glTexture;
  if (
    source?.image instanceof HTMLImageElement &&
    renderer &&
    "gl" in renderer &&
    texture?.webGLTexture &&
    texture.pixels === source.image &&
    !renderer.gl.isContextLost() &&
    !texture.needsMipmapRegeneration &&
    texture.minFilter === renderer.gl.NEAREST &&
    texture.magFilter === renderer.gl.NEAREST
  ) {
    const { gl, glTextureUnits } = renderer;
    const previous = glTextureUnits.units[0];
    glTextureUnits.bind(texture, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Keep Phaser's records current for raster replacement and WebGL context restoration.
    texture.minFilter = gl.LINEAR;
    texture.magFilter = gl.LINEAR;
    source.scaleMode = Textures.FilterMode.LINEAR;
    if (previous) {
      glTextureUnits.bind(previous, 0);
    }
  } else {
    filterTexture(scene, key, "linear");
  }
}

/**
 * A vector strip's grid: an SVG row with `frameWidth` and `frameHeight` holds its frames left
 * to right in rows, and its display size is one frame's.
 */
export function vectorStrip(
  asset: Pick<Asset, "frameHeight" | "frameWidth" | "height" | "width">,
): { readonly columns: number; readonly rows: number } | undefined {
  const { frameHeight, frameWidth, height, width } = asset;
  if (!(frameWidth! > 0) || !(frameHeight! > 0)) {
    return undefined;
  }
  return {
    columns: Math.max(1, Math.round(width / frameWidth!)),
    rows: Math.max(1, Math.round(height / frameHeight!)),
  };
}

/** Cuts a loaded strip texture into numbered frames, as a spritesheet's are. */
function sliceStrip(
  scene: AssetsContext,
  key: string,
  { columns, rows }: { readonly columns: number; readonly rows: number },
): void {
  const texture = scene.textures.get(key);
  const base = texture.get("__BASE");
  const width = base.width / columns;
  const height = base.height / rows;
  for (let index = 0; index < columns * rows; index++) {
    const x = (index % columns) * width;
    const y = Math.floor(index / columns) * height;
    texture.add(index, 0, x, y, width, height);
  }
}

/**
 * Queues a manifest SVG at its display size times the raster scale (vectorRaster), or at its
 * own size times it when it declares none. A vector strip rasters every frame at the row's
 * display size and is cut into numbered frames once loaded.
 */
export function loadSvg(scene: AssetsContext, asset: Asset): void {
  if (asset.kind === "backdrop-decoration") {
    const size = decorationRasterSize(asset.width, asset.height);
    if (size) {
      scene.load.svg(asset.id, asset.path, size);
    }
    return;
  }
  const { displayHeight, displayWidth } = asset;
  const heading = materialShipHeading(asset);
  const path =
    heading === undefined
      ? asset.path
      : materialCaches.get(scene)?.source.ship(asset.paint ?? ECONOMY.defaultPaint, heading)?.url;
  if (!path) {
    return;
  }
  const strip = vectorStrip(asset);
  if (strip) {
    scene.load.once(`filecomplete-svg-${asset.id}`, () => sliceStrip(scene, asset.id, strip));
  }
  const { columns, rows } = strip ?? { columns: 1, rows: 1 };
  queueSvg(scene, {
    key: asset.id,
    path,
    size: (scale) =>
      displayHeight !== undefined && displayWidth !== undefined
        ? vectorRaster(scale, {
            displayHeight: displayHeight * rows,
            displayWidth: displayWidth * columns,
          })
        : { scale },
  });
}

/**
 * The painted scheme in use, or null for Classic. A scheme's idle frames load the first
 * time it is used; until then the ship keeps Classic's frames.
 */
export function paintInUse(scene: AssetsContext): string | null {
  const paint = scene.model.state.economy.paint;
  if (paint === ECONOMY.defaultPaint) {
    return null;
  }
  if (!scene.paintLoads.has(paint)) {
    scene.paintLoads.add(paint);
    loadShipFrames(scene, paintFrames(scene.paintAssets, paint));
  }
  return paint;
}

/** Loads ship frames after preload; each joins the selectable frames once its texture exists. */
export function loadShipFrames(scene: AssetsContext, frames: readonly Asset[]): void {
  if (!frames.length) {
    return;
  }
  for (const frame of frames) {
    loadSvg(scene, frame);
  }
  scene.load.once(Loader.Events.COMPLETE, () => {
    scene.shipAssets = [
      ...scene.shipAssets,
      ...frames.filter((frame) => scene.textures.exists(frame.id)),
    ];
  });
  scene.load.start();
}

type WhaleTextureContext = AssetsContext & Pick<GameScene, "events">;

const whaleSheets = new WeakMap<
  WhaleTextureContext,
  { readonly pending: Map<string, Asset[]>; readonly requested: Set<string> }
>();

function queueWhaleSheetFrame(scene: WhaleTextureContext, frame: Asset): void {
  let loading = whaleSheets.get(scene);
  if (!loading) {
    loading = { pending: new Map(), requested: new Set() };
    whaleSheets.set(scene, loading);
    scene.events.once(Scenes.Events.SHUTDOWN, () => whaleSheets.delete(scene));
  }
  if (loading.requested.has(frame.id)) {
    return;
  }
  loading.requested.add(frame.id);
  const { path } = frame;
  const { pending } = loading;
  const key = vectorSheetKey(path);
  const queueFrame = (asset: Asset, xml: Document): void => {
    try {
      const viewBox = whaleViewBox(scene.whaleArt, asset);
      if (!viewBox) {
        throw new Error(`Missing whale heading dimensions: ${asset.id}`);
      }
      loadSvg(scene, {
        ...asset,
        path: vectorSheetSource(xml, path, {
          ...viewBox,
          id: asset.id,
          intrinsicHeight: asset.height,
          intrinsicWidth: asset.width,
        }),
      });
    } catch (error) {
      // A malformed optional frame keeps the usual whale fallback.
      console.warn(error);
    }
  };
  const xml = scene.cache.xml.get(key) as Document | undefined;
  if (xml) {
    queueFrame(frame, xml);
    scene.rockQueued = true;
    return;
  }
  const requested = pending.get(path);
  if (requested) {
    requested.push(frame);
    return;
  }
  const batch = [frame];
  pending.set(path, batch);
  // Keep the batch pending while the optional loader retries the same physical key.
  scene.load.once(`filecomplete-xml-${key}`, (_key: string, _type: string, source: Document) => {
    if (whaleSheets.get(scene) !== loading) {
      return;
    }
    pending.delete(path);
    for (const asset of batch) {
      queueFrame(asset, source);
    }
  });
  scene.load.xml(key, path);
  scene.rockQueued = true;
}

/** Whether a whale frame is ready. Missing frames share the existing rock loader start. */
export function whaleTexture(scene: WhaleTextureContext, frame: Asset): boolean {
  if (scene.textures.exists(frame.id)) {
    return true;
  }
  if (frame.svgSheet && frame.path) {
    queueWhaleSheetFrame(scene, frame);
  } else if (!scene.whaleRequests.has(frame.id) && frame.path) {
    scene.whaleRequests.add(frame.id);
    loadSvg(scene, frame);
    scene.rockQueued = true;
  }
  return false;
}

/** A raster as a linear-filtered canvas texture under `key`, once. */
export function bakeTexture(scene: AssetsContext, key: string, paint: () => Raster): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const raster = paint();
  const texture = scene.textures.createCanvas(key, raster.width, raster.height);
  if (!texture) {
    return;
  }
  texture.getContext().putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  texture.refresh();
  filterTexture(scene, key, "linear");
}

/** Texels per logical px for a baked layer: the view's, at most MAX_RENDER_SCALE. */
export function bakeScale(scene: AssetsContext): number {
  return Math.min(sceneFit(scene).zoom, MAX_RENDER_SCALE);
}
