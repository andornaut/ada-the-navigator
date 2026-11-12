// The scene's art loading: galaxy, rock, enemy, whale and ship textures and SVG rasters.
// Functions over the scene's AssetsContext.
import { setTextureFilters } from "@andornaut/game-kit/view/phaser/textureFilter";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import { GameObjects, Loader } from "phaser";

import { ASTEROID_ART, type AsteroidArt, readResourceRocks } from "../data/asteroidCatalog.ts";
import { ECONOMY } from "../data/economy.ts";
import { GALAXY_ID } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import {
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
  readHubArt,
  storyCraftSets,
  storyNoses,
} from "./cartwheelArt.ts";
import { readStreakSpec } from "./currentStreaks.ts";
import { type DebrisArt, readDebrisArt } from "./debrisArt.ts";
import { readShards } from "./destructionArt.ts";
import {
  composedArchetypes,
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
} from "./enemyArt.ts";
import { readJobArt } from "./jobArt.ts";
import { sceneFit } from "./playCamera.ts";
import type { GameScene } from "./scene.ts";
import { type Asset } from "./sceneShared.ts";
import { paintFrames } from "./shipArt.ts";
import { readGalaxyStationArt } from "./stationArt.ts";
import { type SvgRequest } from "./svgRasters.ts";
import { type TextureFilter, vectorRaster } from "./textures.ts";
import { readStrandedCraft, readTowLine } from "./towArt.ts";
import { readWhaleArt, whaleFrameAsset } from "./whaleArt.ts";
import { readWhirlpoolProjects } from "./whirlpoolProjects.ts";

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
 * and the backdrop sprites first, then each spin frame the first time it is drawn, so starting
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
  if (!galaxyLoadsAtOnce(asset) || scene.textures.exists(asset.id)) {
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
      assets: [...scene.manifest.assets, ...manifest.assets],
    };
    for (const { family } of GALAXY_FAMILIES) {
      scene.familyParts.set(family, [
        ...(scene.familyParts.get(family) ?? []),
        ...manifest.assets.filter((asset) => enemyPartFrame(asset) && asset.family === family),
      ]);
    }
  }
  const assets = manifest.assets;
  for (const asset of assets) {
    loadGalaxyAsset(scene, asset);
  }
  for (const [craft, frames] of craftFrameSets(assets)) {
    if (!scene.cache.json.exists(`craft-jets-${craft}`)) {
      scene.load.json(`craft-jets-${craft}`, enemyJetsPath(craft, frames[0]!));
    }
  }
  for (const { family, prefix, wired } of GALAXY_FAMILIES) {
    for (const [archetype, frames] of enemyFrameSets(assets, prefix)) {
      if (!wired.has(archetype)) {
        continue;
      }
      if (frames.length > 1) {
        scene.load.json(`${family}-jets-${archetype}`, enemyJetsPath(archetype, frames[0]!));
      }
      // Shards, as in coral, for the archetypes Art's destruction data covers.
      if (scene.destruction && Object.hasOwn(scene.destruction.archetypes, archetype)) {
        scene.load.json(`${family}-shards-${archetype}`, enemyShardsPath(archetype, frames[0]!));
      }
      if (composedArchetypes(scene.familyParts.get(family) ?? []).has(archetype)) {
        scene.load.json(
          `${family}-hardpoints-${archetype}`,
          enemyHardpointsPath(archetype, frames[0]!),
        );
      }
    }
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
  scene.whaleArt = readWhaleArt(
    scene.cache.json.get("whales"),
    scene.manifest.assets.filter(whaleFrameAsset),
  );
}

/** Whether a rock or backdrop SVG is ready; a missing one is queued for the next load. */
export function rockTexture(scene: AssetsContext, file: string): boolean {
  if (scene.textures.exists(file)) {
    return true;
  }
  if (!scene.rockRequests.has(file) && scene.asteroidArt) {
    scene.rockRequests.add(file);
    // Resource rocks are drawn at their own size; backdrop rocks at the art's display scale.
    const factor = scene.resourceFiles.has(file) ? 1 : scene.asteroidArt.displayScale;
    queueSvg(scene, { key: file, path: file, size: (scale) => ({ scale: scale * factor }) });
    scene.rockQueued = true;
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

/** The loaded texture for a rock frame: that frame, else frame 0, else none yet. */
export function rockFrameTexture(
  scene: AssetsContext,
  art: AsteroidArt,
  frame: number,
): string | undefined {
  const wanted = art.frames[frame]!.file;
  if (rockTexture(scene, wanted)) {
    return wanted;
  }
  const still = art.frames[0]!.file;
  return rockTexture(scene, still) ? still : undefined;
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
export function familyArt(scene: AssetsContext, archetype: string): EnemyArt<Asset> | undefined {
  const family = familyOf(scene, archetype);
  return family
    ? scene.familyArts.get(family.family)?.get(archetype)
    : scene.enemyArt.get(archetype);
}

/**
 * A heavy's hardpoint bases and turret tops load the first time that archetype is in flight, so
 * their hundreds of frames never delay a screen that shows none. Until they load, the craft
 * keeps its vector placeholder.
 */
export function loadEnemyParts(scene: AssetsContext, archetype: string): void {
  const family = familyOf(scene, archetype);
  const galaxy = scene.model.state.flight?.galaxy;
  // Coral parts are in the core manifest; a galaxy family's in its galaxy's, which may not
  // have loaded when the craft first draws.
  const parts = enemyPartsToLoad(
    !family || (galaxy !== undefined && scene.galaxyManifests.has(galaxy)),
    (id) => scene.textures.exists(id),
    family ? (scene.familyParts.get(family.family) ?? []) : scene.partAssets,
    archetype,
  );
  if (parts === null) {
    return;
  }
  scene.partLoads.add(`${family?.family ?? "coral"}:${archetype}`);
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
  const { displayHeight, displayWidth } = asset;
  queueSvg(scene, {
    key: asset.id,
    path: asset.path,
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

/** Whether a whale frame is ready; a missing one is queued (loadSvg). */
export function whaleTexture(scene: AssetsContext, frame: Asset): boolean {
  if (scene.textures.exists(frame.id)) {
    return true;
  }
  if (!scene.whaleRequests.has(frame.id) && frame.path) {
    scene.whaleRequests.add(frame.id);
    loadSvg(scene, frame);
    // Whale frames start with the next queued rock load.
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
