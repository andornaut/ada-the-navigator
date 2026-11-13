import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import type { StoreLoadResult } from "@andornaut/game-kit/save/saveStore";
import { GameObjects, Loader, Scene, Scenes } from "phaser";

import { ASTEROID_ART, type AsteroidArt } from "../data/asteroidCatalog.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { PHANTOM_FLAGSHIP } from "../data/phantom.ts";
import { SCREEN } from "../data/screen.ts";
import { OVERNIGHT_SLEEP } from "../data/storybook.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { createControls } from "../input/controls.ts";
import { loadingProgress, type WaitedLoad } from "../loading/progress.ts";
import { heldActivity } from "../model/activities.ts";
import { type Current } from "../model/currents.ts";
import { createEdgeMarkerTracker } from "../model/edgeMarkers.ts";
import { activeBeamFlashes, activeBlastFlashes, shipSpeedFraction } from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { type GainSnapshot } from "../model/itemGains.ts";
import { shipHeading } from "../model/nose.ts";
import { projectileOpacity } from "../model/playerProjectiles.ts";
import { direction } from "../model/shipPhysics.ts";
import { type StoryNoses } from "../model/storyShips.ts";
import type { FlightInput, FlightState, GameSave, Vec } from "../model/types.ts";
import { shipTuning } from "../model/upgrades.ts";
import { type ConversationBox } from "../ui/conversation.ts";
import { createBannerLayer, type PlacedBanner } from "../ui/disabledBanner.ts";
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
  HitFlashes,
} from "./enemyArt.ts";
import { type EnemyWeaponsArt } from "./enemyWeaponsArt.ts";
import { FeedbackSound, ModelFeedback } from "./feedback.ts";
import { type JobArt } from "./jobArt.ts";
import { blastEdges, LIGHT_FIELD, lightGalaxy } from "./lightField.ts";
import { parentFit, sceneFit, viewShift } from "./playCamera.ts";
import { type ProjectArtSet } from "./projectArt.ts";
import { drawAndromeda } from "./sceneAndromeda.ts";
import {
  filterTexture,
  loadGalaxyArt,
  loadGalaxyAsset,
  loadSvg,
  paintInUse,
  queueSvg,
  rasterAgain,
  startRockLoads,
} from "./sceneAssets.ts";
import { drawBackdrop, drawBackdropLayer, drawBackdropLayers } from "./sceneBackdrop.ts";
import { drawRockBreaks, drawZips, startRockBreaks, startZips } from "./sceneEffects.ts";
import { drawEffect, drawEnemyWeapons, enemyWeaponsView } from "./sceneEnemies.ts";
import {
  drawCompromisedShield,
  drawEdgeMarkers,
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
import {
  buildScene,
  flushScene,
  observeFeedback,
  refreshScene,
  renderConversation,
} from "./sceneUi.ts";
import { drawCurrents, drawJobs, drawStoryShips, drawWhirlpoolProjects } from "./sceneWorld.ts";
import { StoryShell } from "./shell.ts";
import { loadsOnDemand, selectPaintedShipAsset } from "./shipArt.ts";
import { type EngineJets, engineJets, jetTriangles, levelLayers } from "./shipJets.ts";
import { Silhouettes } from "./silhouettes.ts";
import { FALLBACK_SPACE_PALETTE, type SpacePalette } from "./spacePalette.ts";
import { spriteOwner, staleSpriteKeys } from "./spriteKeys.ts";
import { type StardustArt } from "./stardustArt.ts";
import { type GalaxyStationArt, type StationArt } from "./stationArt.ts";
import { SvgRasters } from "./svgRasters.ts";
import { fileFilter } from "./textures.ts";
import { preloadTouchChrome } from "./touchChrome.ts";
import { type StrandedCraftArt, type TowLine } from "./towArt.ts";
import { type UpgradePickupArt } from "./upgradePickup.ts";
import {
  AMBER_BEAM_GLOW,
  blast as blastEffect,
  glowingBeam,
  heavyMissile,
  missileFrame,
  missileKind,
  rapidMissile,
  spark as sparkEffect,
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
  shipJets: EngineJets | undefined;
  /** Shots and feedback draw above enemy sprites. */
  overlay!: GameObjects.Graphics;
  edgeMarkerInk!: GameObjects.Graphics;
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
  light = false;
  // Which seen enemies, heavies and stations are off screen and marked (model/edgeMarkers.ts).
  readonly edgeMarkers = createEdgeMarkerTracker();
  keyed: {
    depth: number | undefined;
    key: string;
    sprite: GameObjects.Image;
    width: number;
  }[] = [];
  keylines = new Map<string, GameObjects.Image[]>();
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
  // The space background in use: the flight's galaxy field, else the base palette's.
  spaceBackground = FALLBACK_SPACE_PALETTE.background;
  station!: ReturnType<typeof createStationView>;
  storybook!: ReturnType<typeof createStorybook>;
  galaxies!: ReturnType<typeof createGalaxyMap>;
  // Each galaxy's route map marker hue and previews, from Art's galaxies.json and manifest.
  routeGalaxies: () => GalaxyMapView["galaxies"] = () => [];
  restartCard!: ReturnType<typeof createRestartCard>;
  conversationBox!: ConversationBox;
  // The loader runs the player waits for show the loading bar; on-demand art loads silently. The
  // kit's watch also gives every file the loader's timeout and retries failed loads in rounds.
  loads: LoaderWatch<WaitedLoad> | undefined;

  readonly initialSave: StoreLoadResult<GameSave>;
  constructor(initialSave: StoreLoadResult<GameSave>) {
    super("game");
    this.initialSave = initialSave;
  }

  preload(): void {
    // Each time the scene starts, before its files queue; scene shutdown disposes it.
    this.loads = watchLoader<WaitedLoad>(
      { console, progress: loadingProgress, timer: window },
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
      const filter = fileFilter(type);
      if (filter && this.textures.exists(key)) {
        filterTexture(this, key, filter);
      }
      const stale = type === "svg" ? this.rasters.loaded(key) : undefined;
      if (stale) {
        rasterAgain(this, [stale]);
      }
    });
    this.load.once("filecomplete-json-art-manifest", () => {
      const manifest = this.cache.json.get("art-manifest") as CoreManifest<Asset>;
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
      const composed = composedArchetypes(manifest.assets);
      for (const [archetype, frames] of enemyFrameSets(manifest.assets)) {
        this.load.json(`enemy-jets-${archetype}`, enemyJetsPath(archetype, frames[0]!));
        if (composed.has(archetype)) {
          this.load.json(
            `enemy-hardpoints-${archetype}`,
            enemyHardpointsPath(archetype, frames[0]!),
          );
        }
      }
      // Story craft that several galaxies fly are in core; their jets load with it.
      for (const [craft, frames] of craftFrameSets(manifest.assets)) {
        this.load.json(`craft-jets-${craft}`, enemyJetsPath(craft, frames[0]!));
      }
      for (const asset of manifest.assets) {
        // Painted ship frames load for the scheme in use, thrust frames only without valid jets,
        // a heavy's part frames when that craft first appears and whale frames for a whale. A
        // galaxy's own art is in its galaxy manifest, not here.
        if (loadsOnDemand(asset) || !galaxyLoadsAtOnce(asset)) {
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
    });
    this.load.once("filecomplete-json-destruction", () => {
      const data = readDestruction(this.cache.json.get("destruction"));
      if (!data) {
        return;
      }
      queueSvg(this, {
        key: "destruction-flash",
        path: data.flash.path,
        size: (scale) => ({ scale }),
      });
      for (const archetype of Object.keys(data.archetypes)) {
        this.load.json(`shards-${archetype}`, `/art/enemies/${archetype}-shards.json`);
      }
    });
    this.load.json("art-manifest", "/art/manifest.json");
    this.load.json("destruction", DESTRUCTION_PATH);
    this.load.json("ship-jets", "/art/ship-jets.json");
    preloadTouchChrome(this);
  }

  // The first screen, always the start screen, shows at once from the version on disk. A save
  // from a newer version is never read or overwritten: saving stops, Start stays closed and the
  // newer version installs (requireNewerVersion). update waits for the controls build makes.
  create(): void {
    this.jumping = false;
    this.holdSource = false;
    this.emergencyReturn.cancel();
    buildScene(this);
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
      project: (point) => this.project(point),
      textures: this.textures,
      viewport: SCREEN,
    });
    this.needleRenderer = renderer;
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      renderer.dispose();
      this.needleFlight = undefined;
      this.needleRenderer = undefined;
    });
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
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
        viewportWidth: this.cameras.main.width / this.cameras.main.zoom,
      };
      this.model.step(Math.min(milliseconds / 1000, 0.05), input);
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
      drawCompromisedShield(this);
      const source = this.emergencyReturn.advance(!document.hidden, milliseconds / 1000);
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
    if (!this.holdSource) {
      refreshScene(this);
      this.draw();
    }
    // The box follows the model even while a jump holds its source frame.
    renderConversation(this);
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

  private draw(): void {
    const flight = this.model.state.flight;
    if (flight !== this.needleFlight) {
      this.needleRenderer?.clear();
      this.needleFlight = flight ?? undefined;
    }
    this.ink.clear();
    this.jets.clear();
    this.overlay.clear();
    this.edgeMarkerInk.clear();
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
    drawBackdropLayer(this, flight && this.model.state.mode === "space" ? flight.galaxy : null);
    drawBackdropLayers(this, flight && this.model.state.mode === "space" ? flight : null);
    if (!flight || this.model.state.mode !== "space") {
      this.needleRenderer?.clear();
      // Leaving the flight forgets every seen object.
      this.edgeMarkers.update(null, new Set());
      drawKeylines(this);
      drawUseCallout(this, undefined);
      this.bannerLayer?.place([]);
      return;
    }
    this.light = lightGalaxy(this.lightGalaxies, flight.galaxy);
    drawBackdrop(this, flight);
    // Dust specks, the debris layer's motion cue at its parallax, in the galaxy's backdropSide.
    const cell = 160;
    const parallax = this.backdropRules?.specks.parallax ?? 1;
    const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
    const gx = Math.floor((flight.player.x * parallax) / cell);
    const gy = Math.floor((flight.player.y * parallax) / cell);
    this.specks = [];
    const speckColor = hexNumber(backdropTint(this.asteroidArt, flight.galaxy).backdropSide);
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const point = this.projectLayer(
          { x: x * cell + ((y * 37) % 83), y: y * cell + ((x * 53) % 79) },
          parallax,
        );
        if (point.x >= 0 && point.y >= 0 && point.x <= SCREEN.width && point.y <= SCREEN.height) {
          this.specks.push(point);
        }
        this.ink.fillStyle(speckColor, 0.6);
        this.ink.fillCircle(point.x, point.y, 1);
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
    this.shell.setEnemyArt(this.enemyPlaceholders === 0);
    drawStoryShips(this, flight);
    drawGuidedCalf(this);
    drawPhantomAllies(this);
    drawRockBreaks(this);
    drawZips(this);
    startRockLoads(this);
    // Art's missile blasts, each with its one flash (art/weapons.md "Missile blasts").
    for (const flash of activeBlastFlashes(flight)) {
      const shapes = blastEffect(
        this.project(flash),
        flash.radius,
        this.reducedMotion,
        flash.age * 1000,
      );
      // A light field edges only the ring stroke and the flash's outline, never the tint.
      const edged =
        this.light &&
        ["blastRing", "blastFlash"].some((kind) => LIGHT_FIELD.effects.includes(kind));
      drawEffect(
        this,
        shapes,
        edged ? blastEdges(LIGHT_FIELD.ink, LIGHT_FIELD.keyline, shapes) : [],
      );
    }
    // Art's Phaser beam from the nose, and a hit's spark at the contact.
    for (const flash of activeBeamFlashes(flight)) {
      const from = this.project(flash.from);
      const to = this.project(flash.to);
      const ms = flash.age * 1000;
      // On a light field the beam's outer glow and bloom are ink.
      const glow = this.light ? LIGHT_FIELD.phaser : AMBER_BEAM_GLOW;
      drawEffect(this, glowingBeam(glow, from, to, flash.hit, this.reducedMotion, ms));
      if (flash.hit) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const spark = sparkEffect(to, angle, this.reducedMotion, ms);
        drawEffect(this, spark, keylineEdges(this, ["hitSpark"], spark));
      }
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
          this.overlay.fillStyle(LIGHT_FIELD.ink, alpha);
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
          this.overlay.lineStyle(1.5 + 2 * edge, LIGHT_FIELD.ink, alpha);
          this.overlay.lineBetween(tail.x, tail.y, point.x, point.y);
        }
        this.overlay.lineStyle(1.5, color, alpha);
        this.overlay.lineBetween(tail.x, tail.y, point.x, point.y);
      }
    }
    drawEdgeMarkers(this, flight);
    drawIndicators(this);
    drawFeedback(this);
    this.ship.setPosition(SCREEN.width / 2, SCREEN.height / 2);
    // Jets and thrust frames share the 1 unit/s thrust threshold.
    const thrusting = Math.hypot(flight.velocity.x, flight.velocity.y) > 1;
    const speed = thrusting ? shipSpeedFraction(CONTENT, flight) : 0;
    const ship = selectPaintedShipAsset(
      this.shipAssets,
      paintInUse(this),
      !this.shipJets && speed > 0,
      flight.facing,
    );
    this.ship.setTexture(ship?.id ?? "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    // Authored direction frames already include perspective and must not rotate in screen space.
    this.ship.setRotation(0);
    keylineSprite(this, "ship", "player-ship", this.ship);
    const flames: Vec[] = [];
    if (this.shipJets && ship?.directionIndex !== undefined) {
      this.jets.setPosition(this.ship.x, this.ship.y);
      this.jetKeyline.setPosition(this.ship.x, this.ship.y);
      const display = {
        displayHeight: ship.displayHeight ?? 42,
        displayWidth: ship.displayWidth ?? 42,
        pivot: ship.pivot,
      };
      // Ada's jets take her Engine level's layers; a light field swaps in Art's dark layers for
      // that level, with no halo, keylined with the hull.
      const engine = flight.levels.engine;
      const level = engineJets(this.shipJets, engine);
      const jets = this.light
        ? { ...level, layers: levelLayers(LIGHT_FIELD.jets.shipLevels, engine) }
        : level;
      const keyline = this.light && LIGHT_FIELD.keylined.includes("ship");
      for (const { alpha, color, points } of jetTriangles(
        jets,
        display,
        ship.directionIndex,
        speed,
      )) {
        if (keyline) {
          this.jetKeyline.fillStyle(LIGHT_FIELD.ink, alpha);
          this.jetKeyline.lineStyle(2 * LIGHT_FIELD.keyline, LIGHT_FIELD.ink, alpha);
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
    this.placeAda(flames);
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

  /**
   * Ada's depth: her pivot's, raised above any fly-through object her hull and jet flames
   * overlap, with her jets, their keyline and her tow line just beneath her.
   */
  private placeAda(flames: readonly Vec[]): void {
    const pivot = playDepth(this.ship.y);
    const depth = adaDepth(this.passable, boxWith(drawnBox(this.ship), flames), pivot);
    this.ship.setDepth(depth);
    this.jets.setDepth(depth + ADA_LAYERS.jets);
    this.jetKeyline.setDepth(depth + ADA_LAYERS.jetKeyline);
    if (this.towDepth !== undefined) {
      // Lifted, the line rides above what Ada overlaps; otherwise behind both of its ends.
      this.towInk.setDepth(
        depth > pivot ? depth + ADA_LAYERS.towLine : Math.min(depth, this.towDepth) - 1e-6,
      );
    }
  }
}
