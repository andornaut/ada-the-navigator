// The scene's art loading: galaxy, rock, enemy, whale and ship textures and SVG rasters.
// Functions over the scene's AssetsContext.
import { setTextureFilters } from "@andornaut/game-kit/runtime/view/phaser/textureFilter";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/runtime/view/renderScale";
import { GameObjects, Loader, Scenes } from "phaser";

import {
  ASTEROID_ART,
  type AsteroidArt,
  readResourceRocks,
  RESOURCE_ART,
} from "../data/asteroidCatalog.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyAssetKey, INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { GALAXY_ID, GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { SHIP_HEADINGS } from "../model/shipHeadingContract.ts";
import {
  type CoreManifest,
  galaxyLoadsAtOnce,
  type GalaxyManifest,
  galaxyManifestKey,
  galaxyTowKey,
  readGalaxyManifest,
} from "./artManifest.ts";
import { BAND_AREA, paintBand, readBackdropBand } from "./backdropBand.ts";
import { readBackdropHaze } from "./backdropHaze.ts";
import { type Raster, readBackdropRules, readGalaxyBackdrop } from "./backdropLayers.ts";
import {
  craftArt,
  craftFrameSets,
  readBuoyArt,
  readCraftNose,
  readHubArt,
  storyCraftSets,
  storyNoses,
} from "./cartwheelArt.ts";
import { readStreakSpec } from "./currentStreaks.ts";
import { type DebrisArt, readDebrisArt } from "./debrisArt.ts";
import { readShards } from "./destructionArt.ts";
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
} from "./enemyArt.ts";
import { readJobArt } from "./jobArt.ts";
import { PHANTOM_ALLIES_ART } from "./phantomAllyArt.ts";
import { sceneFit } from "./playCamera.ts";
import { readQuantumJump } from "./quantumJump.ts";
import { decorationRasterSize } from "./rareDecorations.ts";
import { RockFrames } from "./rockFrames.ts";
import type { GameScene } from "./scene.ts";
import { type Asset } from "./sceneShared.ts";
import { paintFrames } from "./shipArt.ts";
import { readShipJets } from "./shipJets.ts";
import {
  readShipMaterialPalettes,
  readShipMaterials,
  ShipMaterialSources,
} from "./shipMaterials.ts";
import { readGalaxyStationArt } from "./stationArt.ts";
import { type SvgRequest } from "./svgRasters.ts";
import { vectorSheetKey, vectorSheetSource } from "./svgSheet.ts";
import { type TextureFilter, vectorRaster } from "./textures.ts";
import { readStrandedCraft, readTowLine } from "./towArt.ts";
import { readMarloArt, readWhaleArt, whaleFrameAsset, whaleViewBox } from "./whaleArt.ts";
import { readWhirlpoolProjects } from "./whirlpoolProjects.ts";

interface MaterialCache {
  readonly poses: Map<string, ReadonlyMap<string, string>>;
  readonly poseIds: readonly string[];
  readonly source: ShipMaterialSources;
  readonly sprites: Map<string, readonly string[]>;
}
const materialCaches = new WeakMap<object, MaterialCache>();

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
        const sources = frames.map((asset): Asset => ({
          ...asset,
          path: vectorSheetSource(xml, path, asset),
        }));
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
    scene.load.once(`filecomplete-xml-${key}`, () =>
      queue(scene.cache.xml.get(key) as Document | undefined),
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
export function materialShipSwatch(scene: object, paint: string): string | undefined {
  return materialCaches.get(scene)?.source.ship(paint, 48)?.url;
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
  | "resourceFiles"
  | "resourceRocks"
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
 * Art's rock frames load after the scene starts, at display size times r: each rock's frame 0
 * and the backdrop sprites first, then complete spin sets for visible variants, so starting
 * the scene never waits on 202 SVGs.
 */
export function loadAsteroidArt(scene: AssetsContext): void {
  const catalog = ASTEROID_ART;
  scene.shell.setAsteroidArt(false);
  const first = [
    ...catalog.asteroids.map((rock) => rock.frames[0]!.file),
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

/**
 * Loads a galaxy's own art the first time one of its flights draws: SVGs (loadSvg), the nugget
 * sheet and the data files, then reads them. Until then its objects keep their placeholders.
 */
export function loadGalaxyArt(scene: AssetsContext, galaxy: GalaxyNumber): void {
  if (scene.galaxyLoads.has(galaxy)) {
    return;
  }
  scene.galaxyLoads.add(galaxy);
  // Resource rocks are in every galaxy's chunks, and any galaxy's rescue draws the tow line:
  // both load with the first flight.
  for (const [key, path] of [
    ["resource-rocks", scene.manifest.resourceRocks],
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
    scene.load.once(`filecomplete-json-${galaxyManifestKey(galaxy)}`, () =>
      queueGalaxyArt(scene, galaxy),
    );
    scene.load.json(galaxyManifestKey(galaxy), path);
  }
  scene.load.once(Loader.Events.COMPLETE, () => readGalaxyArt(scene));
  // The galaxy's first flight waits on its own art.
  scene.loads?.waitFor("galaxy");
  scene.load.start();
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

const PHANTOM_CRAFT_JETS_PATH = "/art/phantom/story-craft-jets.json";
const PHANTOM_CRAFT_JETS_KEY = "phantom-story-craft-jets";

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
        scene.load.json(`${family}-jets-${archetype}`, jets);
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
        scene.load.json(`${family}-shards-${archetype}`, shards);
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
 * A galaxy's backdrop layers: its backdrop.json, then the fixed layers it names and its nebula
 * textures, which draw with linear filtering since at parallax 0.05 nearest texels would crawl.
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
  scene.load.once(`filecomplete-json-${key}`, () => {
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
  });
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
  scene.load.once(`filecomplete-json-${key}`, () => {
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
  });
  scene.load.json(key, path);
}

/**
 * Needle's edge-on band: its band.json, painted once into a canvas texture over the haze's area
 * at the maximum render scale, so its 1.2 px core and point stars stay sharp.
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
  for (const { family, wired } of GALAXY_FAMILIES) {
    const read = new Map<string, NonNullable<ReturnType<typeof readShards>>>();
    for (const archetype of wired) {
      const shards = readShards(scene.cache.json.get(`${family}-shards-${archetype}`));
      if (shards) {
        read.set(archetype, shards);
      }
    }
    scene.familyShards.set(family, read);
  }
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
  const rocks = readResourceRocks(scene.cache.json.get("resource-rocks"));
  scene.resourceRocks = new Map((rocks?.rocks ?? []).map((rock) => [rock.id, rock]));
  scene.resourceFiles = new Set(
    (rocks?.rocks ?? []).flatMap((rock) => rock.frames.map((frame) => frame.file)),
  );
  const whaleData: unknown = scene.cache.json.get("whales");
  const whaleFrames = scene.manifest.assets.filter(whaleFrameAsset);
  const linkedPhantom =
    scene.model.state.flight?.galaxy === 6 && scene.galaxyManifests.get(6)?.links.whales;
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
registerRockSheets(ASTEROID_ART.asteroids, 1);
if (RESOURCE_ART) {
  // Resource SVGs already have a scaled intrinsic size, before rounding in the display metadata.
  registerRockSheets(RESOURCE_ART.rocks, RESOURCE_ART.displayScale);
}

function queueRockSvg(scene: AssetsContext, file: string, path: string): void {
  // Resource rocks are drawn at their own size; backdrop rocks at the art's display scale.
  const factor = scene.resourceFiles.has(file) ? 1 : scene.asteroidArt.displayScale;
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
  scene.load.once(`filecomplete-xml-${key}`, (_key: string, _type: string, source: Document) => {
    loading.delete(path);
    for (const logicalFile of requested) {
      queueFrame(logicalFile, source);
    }
  });
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

/** Archetypes without a complete loaded frame set keep their vector placeholders. */
export function readEnemyArt(scene: AssetsContext): void {
  scene.enemyArt = enemyArt(
    (archetype) => scene.cache.json.get(`enemy-jets-${archetype}`),
    (archetype) => scene.cache.json.get(`enemy-hardpoints-${archetype}`),
    composedArchetypes(scene.partAssets),
    scene.shipAssets,
    enemyFrameSets(scene.shipAssets),
  );
  for (const { family, prefix, wired } of GALAXY_FAMILIES) {
    const loaded = scene.manifest.assets.filter(
      (asset) => asset.family === family && scene.textures.exists(asset.id),
    );
    const art = enemyArt(
      (archetype) => scene.cache.json.get(`${family}-jets-${archetype}`),
      (archetype) => scene.cache.json.get(`${family}-hardpoints-${archetype}`),
      composedArchetypes(scene.familyParts.get(family) ?? []),
      loaded,
      enemyFrameSets(loaded, prefix),
      prefix,
    );
    scene.familyArts.set(family, new Map([...art].filter(([archetype]) => wired.has(archetype))));
  }
}

/**
 * The family the flight's galaxy draws a craft in: its own (Cartwheel's claim jumpers,
 * Andromeda's garnet drones), else Gadget's coral.
 */
export function familyOf(scene: AssetsContext, archetype: string): EnemyFamily | undefined {
  const galaxy = scene.model.state.flight?.galaxy;
  return galaxyFamily(galaxy === undefined ? undefined : GALAXY_ID[galaxy], archetype);
}

/** A craft's art in its galaxy's family, while that family's frames are loaded. */
export function familyArt(
  scene: AssetsContext,
  archetype: string,
  id?: string,
): EnemyArt<Asset> | undefined {
  const key =
    archetype === "capital" || archetype === "retaliator"
      ? enemyAssetKey({ archetype, ...(id === undefined ? {} : { id }) })
      : archetype;
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
    return false;
  }
  // Share the existing in-flight manifest marker; a later own flight still queues its world art.
  scene.galaxyLoads.add(galaxy);
  scene.load.once(`filecomplete-json-${key}`, () => {
    queueGalaxyAssets(scene, subset, galaxy);
    if (scene.galaxyManifests.has(galaxy)) {
      scene.galaxyLoads.delete(galaxy);
    }
  });
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
  const queueFrames = (key: string, xml: Document | undefined): void => {
    const sheet = sheets.get(key);
    if (!sheet) {
      return;
    }
    sheets.delete(key);
    try {
      // Validate the entire sheet before queuing any of its textures.
      const textures = sheet.frames.map((part) => ({
        ...part,
        path: vectorSheetSource(xml, sheet.path, {
          ...part,
          intrinsicHeight: part.displayHeight ?? part.height,
          intrinsicWidth: part.displayWidth ?? part.width,
        }),
      }));
      textures.forEach((part) => loadSvg(scene, part));
    } catch (error) {
      // Optional art keeps the heavy placeholder when a delivered sheet has invalid frames.
      console.warn(error);
    }
  };
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
  // A shared family can come from a different galaxy than the current flight.
  const parts = enemyPartsToLoad(
    ensureEnemyFamilyManifest(scene, family, archetype),
    (id) => scene.textures.exists(id),
    family ? (scene.familyParts.get(family.family) ?? []) : scene.partAssets,
    archetype,
  );
  if (parts === null) {
    return;
  }
  const key = `${family?.family ?? "coral"}:${archetype}`;
  if (parts.some((part) => part.svgSheet)) {
    if (!scene.partLoads.has(key)) {
      scene.partLoads.add(key);
      queueEnemyPartSheets(scene, parts);
    }
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
    scene.shipAssets = [
      ...scene.shipAssets,
      ...parts.filter((part) => scene.textures.exists(part.id)),
    ];
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
  source.updateSource(scene.textures.get(from).getSourceImage() as HTMLImageElement);
  texture.get("__BASE").setSize(source.width, source.height);
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

/**
 * Queues a manifest SVG at its display size times the raster scale (vectorRaster), or at its
 * own size times it when it declares none.
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
  queueSvg(scene, {
    key: asset.id,
    path,
    size: (scale) =>
      displayHeight !== undefined && displayWidth !== undefined
        ? vectorRaster(scale, { displayHeight, displayWidth })
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
