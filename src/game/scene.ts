import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import type { StoreLoadResult } from "@andornaut/game-kit/runtime/save/saveStore";
import { GameObjects, Loader, Scene, Scenes } from "phaser";

import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { HIT_SHAKE } from "../data/layout.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { createControls } from "../input/controls.ts";
import { type WaitedLoad, waitedProgress } from "../loading/progress.ts";
import { requiredReady } from "../loading/required.ts";
import { requiredSceneFile } from "../loading/requiredFiles.ts";
import { heldActivity } from "../model/activities.ts";
import { type Current } from "../model/currents.ts";
import {
  activeBeamFlashes,
  activeWeaponImpacts,
  drawnBeamFlash,
  shipSpeedFraction,
} from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { type GainSnapshot } from "../model/itemGains.ts";
import { SHIP_HEADINGS, shipHeading } from "../model/nose.ts";
import { projectileOpacity } from "../model/playerProjectiles.ts";
import { direction } from "../model/shipPhysics.ts";
import { type StoryNoses } from "../model/storyShips.ts";
import type { FlightInput, FlightState, GameSave, Vec } from "../model/types.ts";
import { shipTuning } from "../model/upgrades.ts";
import { type ConversationBox } from "../ui/conversation.ts";
import { createBannerLayer, type PlacedBanner } from "../ui/disabledBanner.ts";
import { createFpsCounter } from "../ui/fpsCounter.ts";
import { createGalaxyMap, type GalaxyMapView } from "../ui/galaxyMap.ts";
import { createJumpOverlay, type WarpPaint } from "../ui/jumpOverlay.ts";
import { type BoxOccupant } from "../ui/notice.ts";
import { createRestartCard } from "../ui/restartCard.ts";
import { createStationView } from "../ui/station.ts";
import { createStorybook } from "../ui/storybook.ts";
import {
  type CoreManifest,
  galaxyLoadsAtOnce,
  type GalaxyManifest,
  galaxyManifestKey,
  galaxyManifestPaths,
  readGalaxyManifest,
} from "./artManifest.ts";
import { backdropTint, hexNumber, playDepth } from "./asteroidArt.ts";
import { type BackdropHaze } from "./backdropHaze.ts";
import { type BackdropRules, type GalaxyBackdrop } from "./backdropLayers.ts";
import { craftFrameSets, type HubArt } from "./cartwheelArt.ts";
import { type CheatSession, NO_CHEAT_SESSION } from "./cheatSession.ts";
import { type StreakSpec } from "./currentStreaks.ts";
import { type DebrisArt } from "./debrisArt.ts";
import {
  type DestructionData,
  readDestruction,
  readShards,
  type ShardData,
} from "./destructionArt.ts";
import {
  ADA_LAYERS,
  adaDepth,
  boxWith,
  drawnBox,
  type PassableDraw,
  type Placed,
} from "./drawOrder.ts";
import { EmergencyReturn, returnedOnDepletion } from "./emergencyReturn.ts";
import {
  composedArchetypes,
  type EnemyArt,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyShardsPath,
  HitFlashes,
  readSidecars,
  type Sidecars,
} from "./enemyArt.ts";
import { type EnemyWeaponsArt } from "./enemyWeaponsArt.ts";
import {
  FeedbackSound,
  HIT_FLASH_FILL,
  hitFlashAlpha,
  hitFlashBands,
  ModelFeedback,
} from "./feedback.ts";
import { type JobArt } from "./jobArt.ts";
import { blastEdges, foregroundEdge, LIGHT_FIELD, lightGalaxy } from "./lightField.ts";
import { cameraWorldView, parentFit, sceneFit, viewShift } from "./playCamera.ts";
import { hasPlayerHeadingPackage } from "./playerHeadingPackage.ts";
import { type ProjectArtSet } from "./projectArt.ts";
import { setRendering } from "./renderLoop.ts";
import { drawAndromeda } from "./sceneAndromeda.ts";
import {
  filterTexture,
  loadGalaxyArt,
  loadGalaxyAsset,
  loadSvg,
  materialShipHeading,
  paintInUse,
  queueShipMaterialSources,
  queueSvg,
  rasterAgain,
  rasterDrawn,
  startRockLoads,
} from "./sceneAssets.ts";
import { drawBackdrop, drawBackdropLayer, drawBackdropLayers } from "./sceneBackdrop.ts";
import { drawRockBreaks, drawZips, startRockBreaks, startZips } from "./sceneEffects.ts";
import { drawEffect, drawEnemyWeapons, enemyWeaponsView } from "./sceneEnemies.ts";
import {
  drawCompromisedShield,
  drawFeedback,
  drawIndicators,
  drawKeylines,
  drawUseCallout,
  keylineEdges,
  keylineSprite,
} from "./sceneHud.ts";
import { coverShip, endJump, jumpScene, spaceJumpScene } from "./sceneJump.ts";
import { createNeedleRenderer, needleRenderFrame } from "./sceneNeedle.ts";
import { drawGuidedCalf, drawObject } from "./sceneObjects.ts";
import { drawPhantomAllies, drawPhantomFlagship, drawPhantomSettlement } from "./scenePhantom.ts";
import { type Asset, DESTRUCTION_PATH, screenToWorld, TITLE_SCREEN_KEY } from "./sceneShared.ts";
import { acknowledgeTargetDraws } from "./sceneTargetMarkers.ts";
import {
  buildScene,
  flushScene,
  observeFeedback,
  refreshScene,
  renderConversation,
} from "./sceneUi.ts";
import { drawCurrents, drawJobs, drawStoryShips, drawWhirlpoolProjects } from "./sceneWorld.ts";
import { StoryShell } from "./shell.ts";
import { hasShipHeadings, loadsOnDemand, selectPaintedShipAsset } from "./shipArt.ts";
import {
  type EngineJets,
  jetTriangles,
  normalJetsInFront,
  normalJetTailRegions,
  readEngineJets,
  shipJetDirection,
  travelJets,
} from "./shipJets.ts";
import { Silhouettes } from "./silhouettes.ts";
import { FALLBACK_SPACE_PALETTE, type SpacePalette } from "./spacePalette.ts";
import { SPECK_RADIUS, speckField } from "./speckField.ts";
import { spriteOwner, staleSpriteKeys } from "./spriteKeys.ts";
import { type StardustArt } from "./stardustArt.ts";
import { type GalaxyStationArt, type StationArt } from "./stationArt.ts";
import { aboardGalaxy, storyCoversScene } from "./storyPresentation.ts";
import { SvgRasters } from "./svgRasters.ts";
import { fileFilter } from "./textures.ts";
import { preloadTouchChrome } from "./touchChrome.ts";
import { type StrandedCraftArt, type TowLine } from "./towArt.ts";
import { type UpgradePickupArt } from "./upgradePickup.ts";
import {
  AMBER_BEAM_GLOW,
  glowingBeam,
  heavyMissile,
  impactEffect,
  missileFrame,
  missileKind,
  rapidMissile,
} from "./weaponEffects.ts";
import { type WhaleArt } from "./whaleArt.ts";
import { type WhirlpoolProjects } from "./whirlpoolProjects.ts";
import { type LoopArt } from "./worldArt.ts";

export class GameScene extends Scene {
  // Read from the save once the launch's update check lets the first screen show (build).
  model!: GameModel;
  shell!: StoryShell;
  controls!: ReturnType<typeof createControls>;
  ink!: GameObjects.Graphics;
  ship!: GameObjects.Image;
  shipAssets: readonly Asset[] = [];
  // What Ada held last frame in this flight, for the item notices' gains.
  held: { readonly flight: object; readonly snapshot: GainSnapshot } | undefined;
  jets!: GameObjects.Graphics;
  private normalTail: { image: GameObjects.Image; shape: GameObjects.Graphics } | undefined;
  shipJets: EngineJets | undefined;
  shipRetroJets: EngineJets | undefined;
  /** Shots and feedback draw above enemy sprites. */
  overlay!: GameObjects.Graphics;
  edgeMarkerInk!: GameObjects.Graphics;
  /** The hit flash's band around the game area, redrawn each frame while it fades. */
  hitFlashInk!: GameObjects.Graphics;
  /** When Ada's shield last took damage, in scene time ms. */
  hitAt = -Infinity;
  enemyJets!: GameObjects.Graphics;
  enemyArt = new Map<string, EnemyArt<Asset>>();
  enemySprites = new Map<string, GameObjects.Image>();
  useCallout: GameObjects.Sprite | undefined;
  /** The Use callout's destination, whether it is showing, when its last fade began and where. */
  calloutState: { at: Vec; edge: number; id: string; showing: boolean } = {
    at: { x: 0, y: 0 },
    edge: -Infinity,
    id: "",
    showing: false,
  };
  /** Each destination's drawn top above its pivot over the frames it has shown, by id. */
  drawnTops = new Map<string, number>();
  /** Each texture frame's topmost row at alpha 0.5 or more, as a fraction of its height. */
  frameTops = new Map<string, number>();
  /** Enemies drawn as vector placeholders this frame, while their frames load. */
  enemyPlaceholders = 0;
  /** The upgrade pickup's chevrons and climb, and when each pickup first drew, in ms. */
  upgradePickupArt: UpgradePickupArt | undefined;
  pickupSeen = new Map<string, number>();
  hitFlashes = new HitFlashes();
  // A heavy's part frames load on demand, once per archetype.
  partAssets: Asset[] = [];
  partLoads = new Set<string>();
  // A light field (art/galaxies.md "Light fields"): this frame's keylined sprites, each keyline's
  // eight ink copies by key, the ship jets' ink edge and the indicators' ink stroke layer.
  /** Whether a foreground boundary treatment is enabled, including explicit Art ink. */
  light = false;
  fieldLight = false;
  edgeInk = LIGHT_FIELD.ink;
  keyed: {
    depth: number | undefined;
    key: string;
    sprite: GameObjects.Image;
    width: number;
  }[] = [];
  keylines = new Map<string, GameObjects.Image[]>();
  /** Craft whose jets join their keyline: each one's jets in its own depth slot, by key. */
  craftJets = new Map<string, GameObjects.Graphics>();
  craftJetsDrawn = new Set<string>();
  // This frame's fly-through objects as drawn, which Ada draws above while she overlaps them
  // (drawOrder.ts), and the tow craft's pivot depth while its line is drawn.
  private passable: PassableDraw[] = [];
  towDepth: number | undefined;
  silhouettes = new Silhouettes();
  // Every SVG's raster scale (svgRasters.ts), from the canvas's fit when preload starts.
  rasters!: SvgRasters;
  jetKeyline!: GameObjects.Graphics;
  indicatorInk!: GameObjects.Graphics;
  stationArt: StationArt<Asset> | undefined;
  /** Each galaxy's own station art; a galaxy without it draws the shared station. */
  galaxyStations = new Map<GalaxyNumber, GalaxyStationArt<Asset>>();
  outpostArt: ReadonlyMap<string, StationArt<Asset>> = new Map();
  // Funded projects' world changes at the outposts (art/projects.md "World changes"): each reveal
  // in play by project, from its start on the flight clock, and its after state's group texture.
  // The flight clock runs only while flight does, so the pause card, the full-screen Map, a
  // station card or a dialogue neither starts a reveal under it nor plays one out.
  projectArt: ProjectArtSet<Asset> | undefined;
  flightLive = false;
  /** Last frame's storybook cover, so the conversation box settles once as a page covers it. */
  storyCovered = false;
  flightClock = 0;
  reveals = new Map<string, number>();
  revealGroups = new Map<string, GameObjects.RenderTexture>();
  /** The Disabled banners' HTML layer over the canvas, and this frame's banners. */
  bannerLayer: ReturnType<typeof createBannerLayer> | undefined;
  banners: PlacedBanner[] = [];
  /** Art's enemy-only weapon effects, once enemy-weapons.json loads and validates. */
  enemyWeaponsArt: EnemyWeaponsArt | undefined;
  /** Each mine's graphics, sorted with the play objects by its centre's screen y, by mine id. */
  mineInk = new Map<string, Phaser.GameObjects.Graphics>();
  /** Each salvaged heavy composed into one texture, dimmed as a group, by enemy id. */
  salvagedGroups = new Map<string, GameObjects.RenderTexture>();
  // Whirlpool's nursery beacon and current-map buoys (whirlpoolProjects.ts), the buoys' sprites
  // by buoy, and the whales' current with the family position it was found from.
  whirlpoolProjects: WhirlpoolProjects<Asset> | undefined;
  // The station jobs' art (jobArt.ts): the landmarks' layer sprites by landmark and layer, those
  // drawn this frame, and the hunt's lost-item glint.
  jobArt: JobArt<Asset> | undefined;
  landmarkSprites = new Map<string, GameObjects.Image>();
  landmarksDrawn = new Set<string>();
  glintSprite: GameObjects.Image | undefined;
  buoySprites = new Map<string, GameObjects.Image>();
  whalesCurrentFor: { current: Current | null; family: Vec } | undefined;
  // The core manifest's assets and every loaded galaxy manifest's, with their data links.
  // The core manifest's entry ids, apart from the galaxies' own.
  coreAssetIds: readonly string[] = [];
  manifest: {
    assets: readonly Asset[];
    backdropLayers?: string;
    cartwheelDebris?: string;
    jobs?: string;
    resourceRocks?: string;
    tow?: string;
    whales?: string;
    whirlpoolCurrents?: string;
    whirlpoolDebris?: string;
  } = { assets: [] };
  // Each galaxy's manifest path from the core manifest, and the galaxy manifests loaded so far:
  // Sunflower's at boot, every other galaxy's with its art on its first flight.
  galaxyManifestPaths: Partial<Record<GalaxyNumber, string>> = {};
  galaxyManifests = new Map<GalaxyNumber, GalaxyManifest<Asset>>();
  galaxyLoads = new Set<GalaxyNumber>();
  hubArt: HubArt<Asset> | undefined;
  buoyArt: StationArt<Asset> | undefined;
  craftArt: ReadonlyMap<string, EnemyArt<Asset>> = new Map();
  /** Each story craft's nose distance by heading, for its docked spot (art/cartwheel.md). */
  storyNoses: StoryNoses = {};
  // Every galaxy's tow line, and each galaxy's stranded craft by id; a rescue keeps its
  // placeholder craft or line until its art loads.
  towLine: TowLine | undefined;
  strandedCraft = new Map<GalaxyNumber, ReadonlyMap<string, StrandedCraftArt<Asset>>>();
  towInk!: GameObjects.Graphics;
  towSprite!: GameObjects.Image;
  // The guided calf's heading, kept while it rests.
  calfHeading = 0;
  // Cartwheel's claim jumpers; a claim archetype without loaded art draws the coral family's.
  // Each galaxy family's art, shards and part frames (GALAXY_FAMILIES), by family.
  familyArts = new Map<string, Map<string, EnemyArt<Asset>>>();
  familyShards = new Map<string, Map<string, NonNullable<ReturnType<typeof readShards>>>>();
  familyParts = new Map<string, readonly Asset[]>();
  debrisArt: ReadonlyMap<GalaxyNumber, DebrisArt> = new Map();
  streakSpec: StreakSpec | undefined;
  resourceRocks: ReadonlyMap<string, AsteroidArt> = new Map();
  // Resource rock SVGs declare their display size, so they load without the displayScale.
  resourceFiles = new Set<string>();
  stardustArt: StardustArt<Asset> | undefined;
  cacheArt: LoopArt<Asset> | undefined;
  holodiskArt: LoopArt<Asset> | undefined;
  beaconArt: LoopArt<Asset> | undefined;
  ammoPackArt: LoopArt<Asset> | undefined;
  // Discovery caches Ada has approached in this flight; a lit cache stays lit.
  litCaches = new Set<string>();
  litFlight: number | undefined;
  destruction: DestructionData | undefined;
  shards = new Map<string, ShardData>();
  // Art's rocks and backdrop; their frames load on demand.
  readonly asteroidArt = ASTEROID_ART;
  backdropSprites = new Map<string, GameObjects.Image>();
  // Each galaxy's fixed backdrop layer once loaded (its haze texture or its painted band) and the
  // one image that draws it.
  backdrops = new Map<GalaxyNumber, Pick<BackdropHaze, "asset" | "height" | "width">>();
  backdropImage: GameObjects.Image | null = null;
  // The backdrop layers (art/backdrop.md): Art's shared rules, each galaxy's backdrop once read,
  // and the objects that draw the sky, the far items and planets by key, the plates, the stars
  // and the dust streaks.
  backdropRules: BackdropRules | undefined;
  galaxyBackdrops = new Map<GalaxyNumber, GalaxyBackdrop>();
  skyImage: GameObjects.Image | null = null;
  backdropItems = new Map<string, GameObjects.Image>();
  plateInk: Record<"multiply" | "screen", GameObjects.Graphics> | null = null;
  starImages: GameObjects.Image[] = [];
  streakInk: GameObjects.Graphics | null = null;
  // Rock SVGs requested from the loader, and whether new ones wait for a start.
  rockRequests = new Set<string>();
  rockQueued = false;
  whaleArt: WhaleArt<Asset> | undefined;
  whaleRequests = new Set<string>();
  // Destroyed rocks breaking at their pivot: the rock, its last frame, world position and start.
  // Collected pickups zipping into the ship: a copy of each one's sprite as last drawn.
  zips: {
    readonly from: Vec;
    readonly height: number;
    readonly sprite: GameObjects.Image;
    readonly startedMs: number;
    readonly width: number;
  }[] = [];
  rockBreaks: {
    art: AsteroidArt;
    at: Vec;
    frame: number;
    id: string;
    sprite?: GameObjects.Image;
    startedMs: number;
  }[] = [];
  reducedMotion = false;
  /** Whether the last save failed, so the save status waits for a free box. */
  savingUnavailable = false;
  boxOccupant: BoxOccupant | null = null;
  // Art's quantum jump: the overlay, whether a jump is playing (flight pauses), whether the
  // presentation holds the source scene, whether the warp ship covers Ada's, the last drawn space
  // scene's specks, and the warp ship's paint: its source and the scheme last loaded.
  quantum: ReturnType<typeof createJumpOverlay> | null = null;
  jumping = false;
  readonly emergencyReturn = new EmergencyReturn();
  private holdSource = false;
  private needleFlight: FlightState | undefined;
  private needleRenderer: ReturnType<typeof createNeedleRenderer> | undefined;
  warpCover = false;
  specks: Vec[] = [];
  warpPaint: (() => WarpPaint) | null = null;
  warpScheme = "";
  // Painted ship frames load only for the scheme in use.
  paintAssets: Asset[] = [];
  paintLoads = new Set<string>();
  settingsOpen = false;
  screenOn = false;
  // The local map's Galaxies: the galaxy map over the paused flight; refused in danger, never
  // while towing (pause.ts galaxiesAvailable). Set once the scene's commands are ready.
  openGalaxies: () => void = () => {};
  startShown = false;
  enabled: boolean | undefined;
  private durable = "";
  private savedAt = 0;
  feedback = new ModelFeedback();
  feedbackSound = new FeedbackSound();
  screenShake = true;
  palette = FALLBACK_SPACE_PALETTE;
  // The palette at home and before a galaxy is set, and each galaxy's retinted field.
  basePalette = FALLBACK_SPACE_PALETTE;
  galaxyPalettes: ReadonlyMap<GalaxyNumber, SpacePalette> = new Map();
  // The galaxies whose field is light, from the same galaxies.json as their palettes.
  lightGalaxies: ReadonlySet<GalaxyNumber> = new Set();
  foregroundEdges: ReadonlyMap<GalaxyNumber, number> = new Map();
  // The space background in use: the flight's galaxy field, else the base palette's.
  spaceBackground = FALLBACK_SPACE_PALETTE.background;
  station!: ReturnType<typeof createStationView>;
  storybook!: ReturnType<typeof createStorybook>;
  galaxies!: ReturnType<typeof createGalaxyMap>;
  // Each galaxy's route map marker hue and previews, from Art's galaxies.json and manifest.
  routeGalaxies: () => GalaxyMapView["galaxies"] = () => [];
  restartCard!: ReturnType<typeof createRestartCard>;
  resetSaveCard!: ReturnType<typeof createRestartCard>;
  fpsCounter!: ReturnType<typeof createFpsCounter>;
  // The current cheat session: from the first cheat nothing is saved until play returns to Start.
  cheatSession: CheatSession = NO_CHEAT_SESSION;
  conversationBox!: ConversationBox;
  // The loader runs the player waits for show the loading bar; on-demand art loads silently. The
  // kit's watch also gives every file the loader's timeout and retries failed loads in rounds.
  loads: LoaderWatch<WaitedLoad> | undefined;

  entryCurrent: () => boolean = () => true;
  entryFailure: ((error: unknown) => void) | undefined;
  entryCreate: ((create: () => void) => void) | undefined;
  registerEntryCleanup: ((cleanup: () => void) => () => void) | undefined;
  disposeEntryResources: (() => void) | undefined;

  readonly initialSave: StoreLoadResult<GameSave>;
  bootUiManifest?: unknown;

  constructor(initialSave: StoreLoadResult<GameSave>) {
    super("game");
    this.initialSave = initialSave;
  }

  preload(): void {
    if (!this.entryCurrent()) {
      return;
    }
    try {
      this.preloadEntry();
    } catch (error) {
      if (this.entryFailure) {
        this.entryFailure(error);
      } else {
        throw error;
      }
    }
  }

  private preloadEntry(): void {
    // Each time the scene starts, before its files queue; scene shutdown disposes it.
    this.loads = watchLoader<WaitedLoad>(
      {
        console,
        progress: waitedProgress,
        retryMode: (failure) => (requiredSceneFile(failure) ? "manual" : "automatic"),
        timer: window,
      },
      this,
    );
    this.loads.waitFor("boot");
    // Preload runs before followFrameTurn sizes the canvas, so the raster scale starts from the
    // fit the canvas's parent will give.
    const parent = this.game.canvas.parentElement;
    this.rasters = new SvgRasters(parent ? parentFit(window.devicePixelRatio, parent).zoom : 1);
    // Each texture file samples by its kind (textures.ts) once it loads; an SVG asked for at a
    // raster scale since replaced rasterises again.
    this.load.on(Loader.Events.FILE_COMPLETE, (key: string, type: string) => {
      if (!this.entryCurrent()) {
        return;
      }

      const filter = fileFilter(type);
      if (filter && this.textures.exists(key)) {
        filterTexture(this, key, filter);
      }
      const stale = type === "svg" ? this.rasters.loaded(key) : undefined;
      if (stale) {
        rasterAgain(this, [stale]);
      }
    });
    // Coral's shards need the destruction data's archetypes and core's sidecars map, so whichever
    // of the two files completes second queues them.
    let shardArchetypes: readonly string[] | undefined;
    let coreSidecars: Sidecars | undefined;
    const queueShards = () => {
      if (!shardArchetypes || !coreSidecars) {
        return;
      }
      for (const archetype of shardArchetypes) {
        const path = enemyShardsPath(coreSidecars, archetype);
        if (path) {
          this.load.json(`shards-${archetype}`, path);
        }
      }
      shardArchetypes = undefined;
    };
    this.load.once("filecomplete-json-art-manifest", () => {
      if (!this.entryCurrent()) {
        return;
      }
      try {
        const manifest = this.cache.json.get("art-manifest") as CoreManifest<Asset>;
        if (
          !hasPlayerHeadingPackage(
            ECONOMY.paintOrder.filter((paint) => paint !== ECONOMY.defaultPaint),
            manifest,
          )
        ) {
          throw new Error("Player art requires the complete active heading package");
        }
        if (manifest.spacePalette) {
          this.load.json("space-palette", manifest.spacePalette);
        }
        if (typeof manifest.galaxyFields === "string") {
          this.load.json("galaxy-fields", manifest.galaxyFields);
        }
        // The galaxies map is paths, never inline data: only a string path is loaded.
        this.galaxyManifestPaths = galaxyManifestPaths(manifest.galaxies);
        const sunflower = this.galaxyManifestPaths[1];
        if (sunflower) {
          this.load.once(`filecomplete-json-${galaxyManifestKey(1)}`, () => {
            if (!this.entryCurrent()) {
              return;
            }
            const galaxy = readGalaxyManifest<Asset>(this.cache.json.get(galaxyManifestKey(1)));
            for (const asset of galaxy?.assets ?? []) {
              loadGalaxyAsset(this, asset);
            }
          });
          this.load.json(galaxyManifestKey(1), sunflower);
        }
        if (manifest.quantumJump) {
          this.load.json("quantum-jump", manifest.quantumJump);
        }
        if (manifest.enemyWeapons) {
          this.load.json("enemy-weapons", manifest.enemyWeapons);
        }
        if (manifest.titleScreen) {
          this.load.json(TITLE_SCREEN_KEY, manifest.titleScreen);
        }
        const sidecars = readSidecars(manifest.sidecars);
        if (!sidecars) {
          throw new Error("The art manifest's sidecars map is malformed");
        }
        const materialFrames = queueShipMaterialSources(this, manifest);
        const composed = composedArchetypes(manifest.assets);
        for (const archetype of enemyFrameSets(manifest.assets).keys()) {
          const jets = enemyJetsPath(sidecars, archetype);
          if (jets) {
            this.load.json(`enemy-jets-${archetype}`, jets);
          }
          const hardpoints = composed.has(archetype)
            ? enemyHardpointsPath(sidecars, archetype)
            : undefined;
          if (hardpoints) {
            this.load.json(`enemy-hardpoints-${archetype}`, hardpoints);
          }
        }
        // Story craft that several galaxies fly are in core; their jets load with it.
        for (const craft of craftFrameSets(manifest.assets).keys()) {
          const jets = enemyJetsPath(sidecars, craft);
          if (jets) {
            this.load.json(`craft-jets-${craft}`, jets);
          }
        }
        coreSidecars = sidecars;
        queueShards();
        for (const asset of manifest.assets) {
          // Painted ship frames load for the scheme in use, thrust frames only without valid jets,
          // a heavy's part frames when that craft first appears and whale frames for a whale. A
          // galaxy's own art is in its galaxy manifest, not here.
          if (
            loadsOnDemand(asset) ||
            !galaxyLoadsAtOnce(asset) ||
            (materialFrames && materialShipHeading(asset) !== undefined)
          ) {
            continue;
          }
          if (asset.path.endsWith(".svg")) {
            loadSvg(this, asset);
          } else if (asset.frameWidth && asset.frameHeight) {
            this.load.spritesheet(asset.id, asset.path, {
              frameHeight: asset.frameHeight,
              frameWidth: asset.frameWidth,
            });
          }
        }
      } catch (error) {
        if (this.entryFailure) {
          this.entryFailure(error);
        } else {
          throw error;
        }
      }
    });
    this.load.once("filecomplete-json-destruction", () => {
      if (!this.entryCurrent()) {
        return;
      }
      const data = readDestruction(this.cache.json.get("destruction"));
      if (!data) {
        return;
      }
      queueSvg(this, {
        key: "destruction-flash",
        path: data.flash.path,
        size: (scale) => ({ scale }),
      });
      shardArchetypes = [...Object.keys(data.archetypes), ...INDUSTRIAL_BODY_KEYS];
      queueShards();
    });
    this.load.json("art-manifest", "/art/manifest.json");
    this.load.json("destruction", DESTRUCTION_PATH);
    this.load.json("ship-jets", "/art/ship-jets.json");
    this.load.json("ship-retro-jets", "/art/ship-retro-jets.json");
    preloadTouchChrome(this, this.bootUiManifest);
  }

  // The first screen, always the start screen, shows at once from the version on disk. A save
  // from a newer version is never read or overwritten: saving stops, Start stays closed and the
  // newer version installs (requireNewerVersion). update waits for the controls build makes.
  create(): void {
    if (!this.entryCurrent()) {
      return;
    }
    try {
      if (this.entryCreate) {
        this.entryCreate(() => this.createEntry());
      } else {
        this.createEntry();
      }
    } catch (error) {
      if (this.entryFailure) {
        this.entryFailure(error);
      } else {
        throw error;
      }
    }
  }

  private createEntry(): void {
    this.jumping = false;
    this.holdSource = false;
    this.emergencyReturn.cancel();
    buildScene(this);
    const retro = readEngineJets(this.cache.json.get("ship-retro-jets"));
    this.shipRetroJets =
      retro?.headings.length === SHIP_HEADINGS && hasShipHeadings(this.shipAssets)
        ? retro
        : undefined;
    const chipColor = () => {
      const color = this.asteroidArt?.stone[1];
      return color ? hexNumber(color) : this.palette.obstacle;
    };
    const renderer = createNeedleRenderer({
      add: this.add,
      get chipColor() {
        return chipColor();
      },
      ink: this.ink,
      keyline: (kind, key, image) => keylineSprite(this, kind, key, image as GameObjects.Image),
      project: (point) => this.project(point),
      textures: this.textures,
      viewport: SCREEN,
    });
    this.needleRenderer = renderer;
    let disposedRenderer = false;
    const disposeRenderer = () => {
      if (disposedRenderer) {
        return;
      }
      disposedRenderer = true;
      this.events.off(Scenes.Events.SHUTDOWN, disposeRenderer);
      this.events.off(Scenes.Events.DESTROY, disposeRenderer);
      renderer.dispose();
      this.normalTail?.image.destroy();
      this.normalTail?.shape.destroy();
      this.normalTail = undefined;
      this.needleFlight = undefined;
      this.needleRenderer = undefined;
      // Phaser destroys these scene-owned objects; restarted scenes recreate their draw caches.
      this.backdropImage = null;
      this.skyImage = null;
      this.plateInk = null;
      this.streakInk = null;
      this.backdropSprites.clear();
      this.craftJets.clear();
      this.backdropItems.clear();
      this.starImages = [];
    };
    this.events.once(Scenes.Events.SHUTDOWN, disposeRenderer);
    this.events.once(Scenes.Events.DESTROY, disposeRenderer);
    this.registerEntryCleanup?.(disposeRenderer);
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
      return;
    }
    if (!this.entryCurrent() || !requiredReady()) {
      this.controls.setEnabled(false);
      this.controls.reset();
      return;
    }
    const state = this.model.state;
    this.feedback.advance(Math.min(milliseconds / 1000, 0.05));
    const wasInSpace = state.mode === "space";
    const returnHeading = state.flight ? shipHeading(state.flight.facing) : null;
    this.flightLive =
      !this.jumping &&
      !this.settingsOpen &&
      !document.hidden &&
      state.mode === "space" &&
      !state.dialogue &&
      !state.docked;
    if (this.flightLive) {
      this.flightClock += milliseconds;
      const flight = state.flight!;
      const point = this.project(flight.player);
      const shift = viewShift(sceneFit(this));
      const sampled = this.controls.sample({
        facing: direction({
          x: flight.facing.x - flight.facing.y,
          y: (flight.facing.x + flight.facing.y) / 2,
        }),
        ship: { x: point.x + shift.x, y: point.y + shift.y },
      });
      const input: FlightInput = {
        aim: screenToWorld(sampled.aim),
        ...(sampled.fire === undefined ? {} : { fire: sampled.fire }),
        ...(sampled.turn === undefined
          ? {}
          : {
              throttle: Math.min(1, Math.hypot(sampled.move.x, sampled.move.y)),
              turn: sampled.turn,
            }),
        move: screenToWorld(sampled.move),
        reducedMotion: this.reducedMotion,
        use: sampled.use,
        viewportHeight: this.cameras.main.height / this.cameras.main.zoom,
        viewportWidth: this.cameras.main.width / this.cameras.main.zoom,
      };
      // Use can open a quest modal while this frame consumes its input.
      if (!this.settingsOpen) {
        this.model.step(Math.min(milliseconds / 1000, 0.05), input);
      }
      observeFeedback(this);
      startRockBreaks(this, time);
      startZips(this, time);
    }
    // The overnight sleep scene plays on while the page shows, as flight does.
    if (!this.jumping && !this.settingsOpen && !document.hidden) {
      // It lasts as long as Art's overnight sequence, or OVERNIGHT_SLEEP until that loads.
      this.model.storyTick(
        this.storybook.sleepSeconds() ?? OVERNIGHT_SLEEP.seconds,
        Math.min(milliseconds / 1000, 0.05),
      );
    }
    // Outcomes are already durable. Only the presentation waits over the last flight frame.
    if (
      !this.jumping &&
      returnedOnDepletion(wasInSpace, this.model.state, this.model.flightEvents) &&
      this.emergencyReturn.begin(true, { ...spaceJumpScene(this), heading: returnHeading })
    ) {
      this.jumping = true;
      this.holdSource = true;
      this.enabled = false;
      this.controls.setEnabled(false);
      this.controls.reset();
      this.controls.overlay.inert = true;
      this.feedbackSound.play(["damage"]);
      flushScene(this);
    }
    if (this.emergencyReturn.pending) {
      this.overlay.clear();
      drawCompromisedShield(this, this.emergencyReturn.line!.elapsed);
      const source = this.emergencyReturn.advance(
        !document.hidden && !this.settingsOpen,
        milliseconds / 1000,
      );
      if (source) {
        this.overlay.clear();
        const done = () => {
          this.emergencyReturn.cancel();
          endJump(this);
          this.controls.overlay.inert = false;
        };
        if (this.quantum) {
          this.quantum.play({
            destination: () => jumpScene(this),
            emergency: true,
            onCover: () => coverShip(this),
            onDone: done,
            onSwitch: () => {
              this.holdSource = false;
            },
            reducedMotion: this.reducedMotion,
            source,
          });
        } else {
          this.holdSource = false;
          done();
        }
      }
    }
    // A storybook page that covers the game area hides the flight scene: it is neither drawn nor
    // rendered, so the canvas is not presented again until the page closes. The story clock above
    // and the save below keep running, and refreshScene keeps showing the page and navigation.
    const covered = !this.jumping && storyCoversScene(this.model.state, this.model.storyView?.page);
    setRendering(this.game, !covered);
    if (!this.holdSource) {
      refreshScene(this, covered);
      if (!covered) {
        this.draw();
        rasterDrawn(this);
      }
    }
    // The box follows the model even while a jump holds its source frame. As a page covers it, it
    // settles once (a finished return's line clears) and is not laid out again under the page.
    if (!covered || !this.storyCovered) {
      renderConversation(this);
    }
    this.storyCovered = covered;
    const durable = JSON.stringify([
      state.mode,
      state.selectedGalaxy,
      state.progress,
      state.unlocked,
      state.dialogue,
      state.docked,
      state.economy,
      state.seenConversations,
    ]);
    if (durable !== this.durable || time - this.savedAt >= 1000) {
      flushScene(this);
      this.durable = durable;
      this.savedAt = time;
    }
  }

  project(point: Vec): Vec {
    return this.projectLayer(point, 1);
  }

  /**
   * A point of a backdrop layer that keeps the world's layout (art/backdrop.md, Coordinates):
   * projected about the camera's world position times the layer's parallax.
   */
  projectLayer(point: Vec, parallax: number): Vec {
    const camera = this.model.state.flight?.player ?? { x: 0, y: 0 };
    const x = point.x - camera.x * parallax;
    const y = point.y - camera.y * parallax;
    return { x: SCREEN.width / 2 + x - y, y: SCREEN.height / 2 + (x + y) / 2 };
  }

  /** The hit flash over the game area in flight, fading from the latest shield hit. */
  private drawHitFlash(): void {
    this.hitFlashInk.clear();
    const alpha =
      this.model.state.mode === "space"
        ? hitFlashAlpha(this.reducedMotion, this.time.now - this.hitAt)
        : 0;
    if (alpha <= 0) {
      return;
    }
    this.hitFlashInk.fillStyle(HIT_FLASH_FILL, alpha);
    const area = { height: SCREEN.height, width: SCREEN.width, x: 0, y: 0 };
    for (const band of hitFlashBands(area)) {
      this.hitFlashInk.fillRect(band.x, band.y, band.width, band.height);
    }
  }

  private draw(): void {
    // A storybook page over the flight, such as an ordinary ABOARD page, shows only the backdrop.
    const flight = this.model.storyView ? null : this.model.state.flight;
    const galaxy = this.model.state.mode === "space" ? flight?.galaxy : undefined;
    this.fieldLight = lightGalaxy(this.lightGalaxies, galaxy);
    const edge = foregroundEdge(this.lightGalaxies, this.foregroundEdges, galaxy);
    this.light = edge !== undefined;
    this.edgeInk = edge ?? LIGHT_FIELD.ink;
    if (flight !== this.needleFlight) {
      this.needleRenderer?.clear();
      this.needleFlight = flight ?? undefined;
    }
    this.ink.clear();
    this.jets.clear();
    this.normalTail?.image.setVisible(false);
    this.normalTail?.shape.clear();
    this.overlay.clear();
    this.edgeMarkerInk.clear();
    this.drawHitFlash();
    this.enemyJets.clear();
    this.jetKeyline.clear();
    this.indicatorInk.clear();
    this.towInk.clear();
    this.towSprite.setVisible(false);
    this.keyed = [];
    this.banners = [];
    this.passable = [];
    this.towDepth = undefined;
    for (const sprite of this.enemySprites.values()) {
      sprite.setVisible(false);
    }
    for (const sprite of this.backdropSprites.values()) {
      sprite.setVisible(false);
    }
    for (const group of this.revealGroups.values()) {
      group.setVisible(false);
    }
    for (const sprite of this.buoySprites.values()) {
      sprite.setVisible(false);
    }
    for (const sprite of this.landmarkSprites.values()) {
      sprite.setVisible(false);
    }
    this.landmarksDrawn.clear();
    this.glintSprite?.setVisible(false);
    for (const group of this.salvagedGroups.values()) {
      group.setVisible(false);
    }

    for (const rock of this.rockBreaks) {
      rock.sprite?.setVisible(false);
    }
    this.ship.setVisible(Boolean(flight) && this.model.state.mode === "space" && !this.warpCover);
    const presentationGalaxy = aboardGalaxy(this.model.state, this.model.storyView?.page);
    if (presentationGalaxy !== null) {
      loadGalaxyArt(this, presentationGalaxy);
    }
    drawBackdropLayer(
      this,
      flight && this.model.state.mode === "space" ? flight.galaxy : presentationGalaxy,
      presentationGalaxy !== null,
    );
    drawBackdropLayers(
      this,
      flight && this.model.state.mode === "space" ? flight : null,
      presentationGalaxy,
    );
    if (!flight || this.model.state.mode !== "space") {
      this.needleRenderer?.clear();
      drawKeylines(this);
      drawUseCallout(this, undefined);
      this.bannerLayer?.place([]);
      return;
    }
    drawBackdrop(this, flight);
    // Dust specks, the debris layer's motion cue at its parallax and cell, in the galaxy's
    // backdropSide. Only specks the camera can show are drawn, its view grown past a hit shake's
    // reach (about HIT_SHAKE.offset).
    this.specks = [];
    const specks = this.backdropRules?.specks;
    if (specks) {
      const field = speckField(
        specks,
        flight.player,
        cameraWorldView(this.cameras.main, 2 * HIT_SHAKE.offset),
      );
      this.specks = field.inScreen;
      const speckColor = hexNumber(backdropTint(this.asteroidArt, flight.galaxy).backdropSide);
      this.ink.fillStyle(speckColor, specks.alpha);
      for (const speck of field.drawn) {
        this.ink.fillCircle(speck.x, speck.y, SPECK_RADIUS);
      }
    }
    loadGalaxyArt(this, flight.galaxy);
    drawCurrents(this, flight);
    drawWhirlpoolProjects(this, flight);
    drawJobs(this);
    for (const [key, sprite] of this.landmarkSprites) {
      if (!this.landmarksDrawn.has(key)) {
        sprite.destroy();
        this.landmarkSprites.delete(key);
      }
    }
    this.enemyPlaceholders = 0;
    const activity = heldActivity(flight.galaxy, this.model.state);
    const needleFrame =
      flight.galaxy === 4 && flight.needle
        ? needleRenderFrame(
            {
              activityLit: activity?.id === "threadNeedle" ? (activity.lit ?? 0) : 0,
              playerDepth: this.ship.depth,
              progress: this.model.state.progress[4].needle,
              reducedMotion: this.reducedMotion,
              topSpeed: shipTuning(ECONOMY, CONTENT, flight.levels).physics.maxSpeed,
            },
            flight,
          )
        : null;
    const needleHandled = needleFrame ? this.needleRenderer?.draw(needleFrame) : undefined;
    if (!needleFrame) {
      this.needleRenderer?.clear();
    }
    for (const object of flight.objects) {
      if (needleHandled?.has(object.id)) {
        continue;
      }
      if (object.id === PHANTOM_FLAGSHIP && object.enemy) {
        drawPhantomFlagship(this, object);
      } else if (!drawAndromeda(this, object) && !drawPhantomSettlement(this, object)) {
        drawObject(this, object);
      }
    }
    acknowledgeTargetDraws(this);
    this.shell.setEnemyArt(this.enemyPlaceholders === 0);
    drawStoryShips(this, flight);
    drawGuidedCalf(this);
    drawPhantomAllies(this);
    drawRockBreaks(this);
    drawZips(this);
    startRockLoads(this);
    for (const impact of activeWeaponImpacts(flight)) {
      const shapes = impactEffect(
        { at: this.project(impact), reducedMotion: this.reducedMotion },
        impact,
      );
      const edges =
        impact.family === "missile"
          ? this.light &&
            ["blastRing", "blastFlash"].some((kind) => LIGHT_FIELD.effects.includes(kind))
            ? blastEdges(this.edgeInk, LIGHT_FIELD.keyline, shapes)
            : []
          : keylineEdges(this, ["hitSpark"], shapes);
      drawEffect(this, shapes, edges);
    }
    // The Phaser body stays on Ada's nose and aim; its contact uses the family dispatcher above.
    for (const flash of activeBeamFlashes(flight)) {
      const drawn = drawnBeamFlash(flight, flash);
      const from = this.project(drawn.from);
      const to = this.project(drawn.to);
      const glow = this.light ? { ...LIGHT_FIELD.phaser, colour: this.edgeInk } : AMBER_BEAM_GLOW;
      drawEffect(
        this,
        glowingBeam(glow, from, to, flash.hit, this.reducedMotion, flash.age * 1000),
      );
    }
    drawEnemyWeapons(this, enemyWeaponsView(flight));
    // Ring burst bolts draw as Art's darts with the enemy weapons.
    for (const shot of flight.shots.filter((entry) => entry.enemyWeapon !== "ringBurst")) {
      const color = shot.enemy ? this.palette.obstacle : this.palette.weapon;
      const point = this.project(shot);
      const tail = this.project({
        x: shot.x - shot.velocity.x * 0.035,
        y: shot.y - shot.velocity.y * 0.035,
      });
      const alpha = shot.fade ? projectileOpacity(shot.fade, shot.life) : 1;
      // On a light field each bolt and dot draws over an ink edge.
      const edge = this.light ? LIGHT_FIELD.shotEdge : 0;
      if (shot.projectile === "dot") {
        if (edge) {
          this.overlay.fillStyle(this.edgeInk, alpha);
          this.overlay.fillCircle(point.x, point.y, 1.5 + edge);
        }
        this.overlay.fillStyle(color, alpha);
        this.overlay.fillCircle(point.x, point.y, 1.5);
      } else if (shot.projectile === "missile" && !shot.enemy && shot.blast !== undefined) {
        // Art's Rapid or Heavy missile, its exhaust flickering unless motion is reduced. On a
        // light field the dart and fins take an ink edge and the streak stays as it is.
        const kind = missileKind(shot.blast);
        const frame = missileFrame(kind, this.reducedMotion, this.time.now);
        const shapes = (kind === "rapid" ? rapidMissile : heavyMissile)(
          point,
          shot.velocity,
          frame,
        );
        drawEffect(
          this,
          shapes,
          keylineEdges(
            this,
            ["missile"],
            shapes.filter((shape) => shape.kind !== "taper"),
          ),
        );
      } else if (shot.projectile === "missile") {
        const angle = Math.atan2(point.y - tail.y, point.x - tail.x);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        this.overlay.lineStyle(3, shot.enemy ? color : 0xffffff, alpha);
        this.overlay.lineBetween(point.x - dx * 9, point.y - dy * 9, point.x, point.y);
        this.overlay.lineStyle(1, color, alpha);
        this.overlay.lineBetween(
          point.x - dx * 17,
          point.y - dy * 17,
          point.x - dx * 11,
          point.y - dy * 11,
        );
        this.overlay.lineBetween(
          point.x - dx * 7 - dy * 4,
          point.y - dy * 7 + dx * 4,
          point.x,
          point.y,
        );
        this.overlay.lineBetween(
          point.x - dx * 7 + dy * 4,
          point.y - dy * 7 - dx * 4,
          point.x,
          point.y,
        );
      } else {
        if (edge) {
          this.overlay.lineStyle(1.5 + 2 * edge, this.edgeInk, alpha);
          this.overlay.lineBetween(tail.x, tail.y, point.x, point.y);
        }
        this.overlay.lineStyle(1.5, color, alpha);
        this.overlay.lineBetween(tail.x, tail.y, point.x, point.y);
      }
    }
    drawIndicators(this);
    drawFeedback(this);
    this.ship.setPosition(SCREEN.width / 2, SCREEN.height / 2);
    // Jets and thrust frames share the 1 unit/s thrust threshold.
    const travel = shipJetDirection(flight.facing, flight.velocity);
    const activeJets = travelJets(
      this.shipJets,
      this.shipRetroJets,
      this.light ? LIGHT_FIELD.jets.shipLevels : undefined,
      flight.levels.engine,
      travel,
    );
    const speed = travel ? shipSpeedFraction(CONTENT, flight) : 0;
    const ship = selectPaintedShipAsset(
      this.shipAssets,
      paintInUse(this),
      !activeJets && travel === "forward" && speed > 0,
      flight.facing,
    );
    this.ship.setTexture(ship?.id ?? "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    // Authored direction frames already include perspective and must not rotate in screen space.
    this.ship.setRotation(0);
    keylineSprite(this, "ship", "player-ship", this.ship);
    const flames: Vec[] = [];
    let tailRegions: readonly (readonly Vec[])[] = [];
    if (activeJets && ship?.directionIndex !== undefined) {
      this.jets.setPosition(this.ship.x, this.ship.y);
      this.jetKeyline.setPosition(this.ship.x, this.ship.y);
      const display = {
        displayHeight: ship.displayHeight ?? 42,
        displayWidth: ship.displayWidth ?? 42,
        pivot: ship.pivot,
      };
      if (travel === "forward") {
        tailRegions = normalJetTailRegions(activeJets, display, ship.directionIndex);
      }
      const keyline =
        this.light &&
        LIGHT_FIELD.keylined.includes("ship") &&
        !(travel === "forward" && normalJetsInFront(activeJets, ship.directionIndex)) &&
        !(travel === "reverse" && this.shipRetroJets?.reverseStyle === "centered-main");
      for (const { alpha, color, points } of jetTriangles(
        activeJets,
        display,
        ship.directionIndex,
        speed,
      )) {
        if (keyline) {
          this.jetKeyline.fillStyle(this.edgeInk, alpha);
          this.jetKeyline.lineStyle(2 * LIGHT_FIELD.keyline, this.edgeInk, alpha);
          this.jetKeyline.fillTriangle(
            points[0].x,
            points[0].y,
            points[1].x,
            points[1].y,
            points[2].x,
            points[2].y,
          );
          this.jetKeyline.strokeTriangle(
            points[0].x,
            points[0].y,
            points[1].x,
            points[1].y,
            points[2].x,
            points[2].y,
          );
        }
        this.jets.fillStyle(color, alpha);
        this.jets.fillTriangle(
          points[0].x,
          points[0].y,
          points[1].x,
          points[1].y,
          points[2].x,
          points[2].y,
        );
        for (const corner of points) {
          flames.push({ x: this.ship.x + corner.x, y: this.ship.y + corner.y });
        }
      }
    }
    this.placeAda(
      flames,
      travel === "forward" && normalJetsInFront(activeJets, ship?.directionIndex ?? -1),
    );
    if (tailRegions.length) {
      this.drawNormalTail(tailRegions);
    }
    const activeIds = new Set(flight.objects.map((object) => object.id));
    for (const ally of flight.phantom?.allies ?? []) {
      activeIds.add(`phantomAlly:${ally.id}`);
    }
    for (const ally of flight.phantom?.departures ?? []) {
      activeIds.add(`phantomAlly:${ally.id}`);
    }
    this.hitFlashes.retain(activeIds, spriteOwner);
    for (const id of staleSpriteKeys(activeIds, this.enemySprites.keys())) {
      this.enemySprites.get(id)!.destroy();
      this.enemySprites.delete(id);
    }
    for (const id of this.pickupSeen.keys()) {
      if (!activeIds.has(id)) {
        this.pickupSeen.delete(id);
      }
    }
    for (const [id, group] of this.salvagedGroups) {
      if (!activeIds.has(id)) {
        group.destroy();
        this.salvagedGroups.delete(id);
      }
    }

    drawKeylines(this);
    drawUseCallout(this, flight);
    this.bannerLayer?.place(this.banners);
  }

  /** Records a drawn fly-through object, which Ada draws above while she overlaps it. */
  passes(sprite: Placed & { readonly depth: number }): void {
    this.passable.push({ box: drawnBox(sprite), depth: sprite.depth });
  }

  /** Composite actual painted tail pixels after the unchanged normal flame geometry. */
  private drawNormalTail(regions: readonly (readonly Vec[])[]): void {
    if (!regions.length) {
      return;
    }
    const ship = this.ship;
    if (!this.normalTail) {
      const image = this.add.image(ship.x, ship.y, ship.texture.key).setVisible(false);
      const shape = this.make.graphics({ x: 0, y: 0 }, false);
      image.enableFilters();
      image.filters!.internal.addMask(shape, false, image.filters!.internal.camera);
      this.normalTail = { image, shape };
    }
    const { image, shape } = this.normalTail;
    shape.setPosition(ship.x, ship.y);
    shape.clear();
    shape.fillStyle(0xffffff, 1);
    for (const region of regions) {
      shape.beginPath();
      for (const [index, point] of region.entries()) {
        if (index === 0) {
          shape.moveTo(point.x, point.y);
        } else {
          shape.lineTo(point.x, point.y);
        }
      }
      shape.closePath();
      shape.fillPath();
    }
    image.setTexture(ship.texture.key, ship.frame.name);
    image.setPosition(ship.x, ship.y);
    image.setOrigin(ship.originX, ship.originY);
    image.setDisplaySize(ship.displayWidth, ship.displayHeight);
    image.setRotation(ship.rotation);
    image.setAlpha(ship.alpha);
    image.setDepth(ship.depth - ADA_LAYERS.towLine);
    image.setVisible(true);
  }

  /**
   * Ada's depth: her pivot's, raised above any fly-through object her hull and jet flames
   * overlap. Normal aperture jets draw above her hull; legacy jets and the tow line stay below.
   */
  private placeAda(flames: readonly Vec[], normalFront = false): void {
    const pivot = playDepth(this.ship.y);
    const depth = adaDepth(this.passable, boxWith(drawnBox(this.ship), flames), pivot);
    this.ship.setDepth(depth);
    this.jets.setDepth(depth + (normalFront ? -ADA_LAYERS.jetKeyline : ADA_LAYERS.jets));
    this.jetKeyline.setDepth(depth + (normalFront ? -ADA_LAYERS.jets : ADA_LAYERS.jetKeyline));
    if (this.towDepth !== undefined) {
      // Lifted, the line rides above what Ada overlaps; otherwise behind both of its ends.
      this.towInk.setDepth(
        depth > pivot ? depth + ADA_LAYERS.towLine : Math.min(depth, this.towDepth) - 1e-6,
      );
    }
  }
}
