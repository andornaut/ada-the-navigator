import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import { setTextureFilters } from "@andornaut/game-kit/view/phaser/textureFilter";
import { densityTexels, MAX_RENDER_SCALE } from "@andornaut/game-kit/view/renderScale";
import {
  BlendModes,
  GameObjects,
  Loader,
  Math as PhaserMath,
  Scale,
  ScaleModes,
  Scene,
  Scenes,
  Textures,
  TintModes,
} from "phaser";

import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import { ASTEROID_ART, type AsteroidArt, readResourceRocks } from "../data/asteroid-catalog.ts";
import { CHEAT_COPY } from "../data/cheat-copy.ts";
import { destinationDrawn } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import { EDGE_MARKER_GLYPHS, edgeMarkerInset } from "../data/edge-markers.ts";
import { enemyCatalog, enemyDefinition, MINE_LAYER } from "../data/enemy-catalog.ts";
import { BUILT, GALAXY_ID, ROUTE, ROUTE_POSITION } from "../data/galaxies.ts";
import { CURRENTS } from "../data/galaxy-features.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { resourceArtId } from "../data/resource-rocks.ts";
import { SCREEN } from "../data/screen.ts";
import { CARTWHEEL_STORY_SHIPS, STORY_SHIP_CRAFT } from "../data/story-ships.ts";
import { galaxyCard, OVERNIGHT_SLEEP } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import { coarsePointer } from "../input/coarse-pointer.ts";
import { createControls } from "../input/controls.ts";
import { loadingProgress, type WaitedLoad } from "../loading/progress.ts";
import { rockFrame, scenerySilhouette } from "../model/asteroids.ts";
import { grantAllWeapons } from "../model/cheats.ts";
import { type Current, currentsNear, flowFraction } from "../model/currents.ts";
import { carriesStardust } from "../model/drops.ts";
import { createEdgeMarkerTracker, edgePoint } from "../model/edge-markers.ts";
import { enemySpeedFraction } from "../model/enemy-ai.ts";
import {
  activeBeamFlashes,
  activeBlastFlashes,
  activeEnemyBeams,
  activeRingEmissions,
  type EnemyBeam,
  shipSpeedFraction,
} from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { type GainSnapshot, itemGains } from "../model/item-gains.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { projectileOpacity } from "../model/player-projectiles.ts";
import { newerSave } from "../model/save.ts";
import { hullOffset } from "../model/ship-physics.ts";
import { fill, itemAbout, itemName, type ShopItem } from "../model/shop.ts";
import {
  drawnHeading,
  hubBay,
  hubWorn,
  type StoryNoses,
  storyShips,
} from "../model/story-ships.ts";
import type { FlightInput, FlightState, SpaceObject, Vec } from "../model/types.ts";
import {
  coverStartScreen,
  exitGame,
  exitShown,
  installApp,
  installState,
  keepScreenOn,
  offersInstall,
  onInstallStateChange,
  requireNewerVersion,
  setBackArmed,
  startScreenShown,
  stepsKind,
  updateOffer,
} from "../pwa/index.ts";
import { backReleased } from "../ui/back-stack.ts";
import { type ConversationBox, createConversationBox } from "../ui/conversation.ts";
import { screenShakes } from "../ui/device-settings.ts";
import { createBannerLayer, type PlacedBanner } from "../ui/disabled-banner.ts";
import { createJumpOverlay, type JumpScene, type SheetArt } from "../ui/jump-overlay.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { fogColor } from "../ui/layout/mapScreen.ts";
import { type MapField, mapScreenLabels } from "../ui/map-screen.ts";
import { BOX_OCCUPANT, type BoxOccupant, boxOccupant } from "../ui/notice.ts";
import { galaxiesAvailable } from "../ui/pause.ts";
import { createRestartCard } from "../ui/restart-card.ts";
import { createRouteMap, type RouteMapView } from "../ui/route-map.ts";
import { aboardLabel, type ShipView } from "../ui/ship-card.ts";
import { createStationView } from "../ui/station.ts";
import { stardustCount } from "../ui/status-pill.ts";
import { createStorybook, storyPageView } from "../ui/storybook.ts";
import { readTitleScreen } from "../ui/title-screen.ts";
import { USE_CALLOUT_FADE_MS, useCalloutAlpha, useCalloutLift } from "../ui/touch-chrome.ts";
import {
  type CoreManifest,
  galaxyLoadsAtOnce,
  type GalaxyManifest,
  galaxyManifestKey,
  galaxyManifestPaths,
  readGalaxyManifest,
} from "./art-manifest.ts";
import {
  type AsteroidOutline,
  BACKDROP_FIELD,
  backdropRock,
  backdropTint,
  driftChips,
  footprintOutline,
  hexNumber,
  playDepth,
  rockArt,
} from "./asteroid-art.ts";
import { BAND_AREA, paintBand, readBackdropBand } from "./backdrop-band.ts";
import { type BackdropHaze, readBackdropHaze } from "./backdrop-haze.ts";
import {
  type BackdropRules,
  clusterReach,
  type GalaxyBackdrop,
  paintCluster,
  paintDisc,
  paintPlanet,
  paintSky,
  planetReach,
  type Raster,
  readBackdropRules,
  readGalaxyBackdrop,
  SKY_AREA,
  streakPieces,
  viewFar,
  viewPlanets,
  viewPlates,
  viewStars,
  viewStreaks,
} from "./backdrop-layers.ts";
import {
  craftArt,
  craftFrameSets,
  type HubArt,
  hubLayers,
  readBuoyArt,
  readHubArt,
  storyCraftSets,
  storyNoses,
} from "./cartwheel-art.ts";
import { readStreakSpec, streakMarks, type StreakSpec } from "./current-streaks.ts";
import {
  type DebrisArt,
  debrisFrame,
  debrisMarks,
  debrisPiece,
  readDebrisArt,
} from "./debris-art.ts";
import {
  type DestructionData,
  readDestruction,
  readShards,
  reducedAt,
  type ShardData,
  shardPolygons,
  wreckFlashAt,
} from "./destruction-art.ts";
import {
  ADA_LAYERS,
  adaDepth,
  BACKDROP_DEPTH,
  boxWith,
  drawnBox,
  EDGE_MARKER_DEPTH,
  type PassableDraw,
  type Placed,
  USE_CALLOUT_DEPTH,
} from "./draw-order.ts";
import {
  bannerOffset,
  composedArchetypes,
  composeEnemy,
  type EnemyArt,
  enemyArt,
  type EnemyFamily,
  type EnemyFrame,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyJetTriangles,
  enemyPartFrame,
  enemyPartsToLoad,
  enemyShardsPath,
  GALAXY_FAMILIES,
  galaxyFamily,
  HitFlashes,
  type PartPose,
  type PartSprite,
  selectEnemyFrame,
} from "./enemy-art.ts";
import {
  type EnemyEffect,
  enemyInkEdges,
  enemyPhaser,
  type EnemyWeaponsArt,
  type EnemyWeaponsView,
  lance,
  mine,
  readEnemyWeaponsArt,
  ringDart,
  ringEmission,
} from "./enemy-weapons-art.ts";
import { type FeedbackPulse, FeedbackSound, ModelFeedback, TELEPORT_DISTANCE } from "./feedback.ts";
import { SALVAGED, salvagedMatrix, showsBanner, spritesBounds } from "./heavy-states.ts";
import {
  beaconLandmarkFrame,
  dashes,
  glintFrame,
  glintPing,
  type JobArt,
  type JobFrame,
  nebulaTint,
  readJobArt,
} from "./job-art.ts";
import {
  alphaTopRow,
  blastEdges,
  inkEdges,
  KEYLINE_ALPHA,
  keylineOffsets,
  keylineWidth,
  LIGHT_FIELD,
  lightGalaxy,
  readLightGalaxies,
  thresholdSilhouette,
} from "./light-field.ts";
import { readSave, stopSaving, writeSave } from "./persistence.ts";
import { zipAt } from "./pickup-zip.ts";
import {
  canvasSize,
  fitPlayCamera,
  parentFit,
  sceneFit,
  shakeIntensity,
  viewShift,
} from "./play-camera.ts";
import {
  boundsOnScreen,
  type OutpostPart,
  outpostParts,
  partsBounds,
  type ProjectArtSet,
  readProjectArt,
  revealAlpha,
} from "./project-art.ts";
import { cockpitFocus, readQuantumJump } from "./quantum-jump.ts";
import {
  markerHue,
  readRouteArt,
  readRouteMarkers,
  routePreviews,
  routeShipFrames,
} from "./route-art.ts";
import { sceneryDetail } from "./scenery.ts";
import { StoryShell } from "./shell.ts";
import {
  hasShipHeadings,
  loadsOnDemand,
  paintFrames,
  selectPaintedShipAsset,
  type ShipAsset,
  shipDirection,
  thrustFrames,
} from "./ship-art.ts";
import { jetTriangles, readShipJets, type ShipJets } from "./ship-jets.ts";
import { stationRow } from "./shop-view.ts";
import { Silhouettes } from "./silhouettes.ts";
import {
  FALLBACK_SPACE_PALETTE,
  galaxyPalettes,
  readGalaxyFields,
  readSpacePalette,
  spaceObjectColor,
  type SpacePalette,
} from "./space-palette.ts";
import {
  BEACON_SUFFIX,
  FLASH_SUFFIX,
  hubBayKey,
  hubBuoyKey,
  hubStoryKey,
  partKey,
  spriteOwner,
  staleSpriteKeys,
} from "./sprite-keys.ts";
import {
  readStardustArt,
  type StardustArt,
  stardustDrawn,
  stardustFrame,
  stardustPhase,
  stardustShown,
} from "./stardust-art.ts";
import {
  type GalaxyStationArt,
  readGalaxyStationArt,
  readOutpostArt,
  readStationArt,
  type StationArt,
  type StationFrame,
  stationFrame,
  stationFrameIndex,
  stationLoopFrame,
} from "./station-art.ts";
import { RASTER_SCALE_EVENT, SvgRasters, type SvgRequest } from "./svg-rasters.ts";
import { fileFilter, type TextureFilter, vectorRaster } from "./textures.ts";
import { createUseCallout, preloadTouchChrome } from "./touch-chrome.ts";
import {
  craftFrame,
  craftHeading,
  readStrandedCraft,
  readTowLine,
  STRANDED_CRAFT,
  type StrandedCraftArt,
  towBeads,
  towCurve,
  type TowLine,
  towOffset,
} from "./tow-art.ts";
import {
  litChevron,
  readUpgradePickup,
  UPGRADE_CHEVRON,
  type UpgradePickupArt,
} from "./upgrade-pickup.ts";
import {
  AMBER_BEAM_GLOW,
  blast as blastEffect,
  type EffectShape,
  glowingBeam,
  heavyMissile,
  missileFrame,
  missileKind,
  rapidMissile,
  spark as sparkEffect,
  type TaperShape,
} from "./weapon-effects.ts";
import {
  familyMembers,
  readWhaleArt,
  type WhaleArt,
  whaleFrameAsset,
  type WhaleKind,
  whaleLoopFrame,
  whalePhase,
} from "./whale-art.ts";
import {
  buoyFrame,
  buoyPlaces,
  frameBounds,
  nurseryFrame,
  poolRings,
  readWhirlpoolProjects,
  whalesCurrent,
  type WhirlpoolProjects,
} from "./whirlpool-projects.ts";
import {
  BEACON_FRAMES,
  beaconFrame,
  CACHE_FRAMES,
  cacheApproached,
  cacheFrame,
  HOLODISK_FRAMES,
  holodiskFrame,
  holodiskWaypoint,
  isDiscoveryCache,
  type LoopArt,
  loopPhase,
  readLoopArt,
} from "./world-art.ts";

// Story craft darts while their frames load.
const STORY_SHIP = { blocker: 0x8a7f78, hull: 0xd9c7a6 } as const;
// Art's start screen placement, linked from the core manifest as titleScreen.
const TITLE_SCREEN_KEY = "title-screen";
// Art's destruction data; a wreck's flash sprite shares its id plus this suffix.
const DESTRUCTION_PATH = "/art/enemies/destruction.json";

interface Asset extends ShipAsset, EnemyFrame {
  path: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  dock?: NonNullable<StationFrame["dock"]>;
  frameMs?: number;
  frames?: Readonly<Record<string, number>>;
  loop?: readonly { readonly frame: number; readonly ms: number }[];
  outpost?: string;
  kind?: string;
  loopFrame?: number;
  craft?: string;
  debris?: string;
  destination?: string;
  frameIndex?: number;
  overlay?: boolean;
  project?: string;
  station?: string;
  variant?: string;
}

/** World axes project diagonally; controls continue to follow screen directions. */
function screenToWorld(vector: Vec): Vec {
  const x = vector.x / 2 + vector.y;
  const y = vector.y - vector.x / 2;
  const magnitude = Math.hypot(x, y);
  const strength = Math.min(1, Math.hypot(vector.x, vector.y));
  return magnitude === 0
    ? { x: 0, y: 0 }
    : { x: (x / magnitude) * strength, y: (y / magnitude) * strength };
}

/** A Projects row's project id from its shop key, "project:<id>"; null for a shop item. */
function projectId(key: string): string | null {
  return key.startsWith("project:") ? key.slice("project:".length) : null;
}

// The landmarks' ground layer (art/jobs.md): above the backdrop rocks (-1), under the field ink
// (0), which draws the specks, streaks and the search rim over them, and under every play object.
const LANDMARK_DEPTH = -0.5;
// A dust streak draws in this many pieces, each at its share of the half-sine fade.
const STREAK_PIECES = 8;

export class PrototypeScene extends Scene {
  // Read from the save once the launch's update check lets the first screen show (build).
  private model!: GameModel;
  private shell!: StoryShell;
  private controls!: ReturnType<typeof createControls>;
  private ink!: GameObjects.Graphics;
  private ship!: GameObjects.Image;
  private shipAssets: readonly Asset[] = [];
  // What Ada held last frame in this flight, for the item notices' gains.
  private held: { readonly flight: object; readonly snapshot: GainSnapshot } | undefined;
  private jets!: GameObjects.Graphics;
  private shipJets: ShipJets | undefined;
  /** Shots and feedback draw above enemy sprites. */
  private overlay!: GameObjects.Graphics;
  private edgeMarkerInk!: GameObjects.Graphics;
  private enemyJets!: GameObjects.Graphics;
  private enemyArt = new Map<string, EnemyArt<Asset>>();
  private enemySprites = new Map<string, GameObjects.Image>();
  private useCallout: GameObjects.Sprite | undefined;
  /** The Use callout's destination, whether it is showing, when its last fade began and where. */
  private calloutState: { at: Vec; edge: number; id: string; showing: boolean } = {
    at: { x: 0, y: 0 },
    edge: -Infinity,
    id: "",
    showing: false,
  };
  /** Each destination's drawn top above its pivot over the frames it has shown, by id. */
  private drawnTops = new Map<string, number>();
  /** Each texture frame's topmost row at alpha 0.5 or more, as a fraction of its height. */
  private frameTops = new Map<string, number>();
  /** The upgrade pickup's chevrons and climb, and when each pickup first drew, in ms. */
  private upgradePickupArt: UpgradePickupArt | undefined;
  private pickupSeen = new Map<string, number>();
  private hitFlashes = new HitFlashes();
  // A heavy's part frames load on demand, once per archetype.
  private partAssets: Asset[] = [];
  private partLoads = new Set<string>();
  // A light field (art/galaxies.md "Light fields"): this frame's keylined sprites, each keyline's
  // eight ink copies by key, the ship jets' ink edge and the indicators' ink stroke layer.
  private light = false;
  // Which seen enemies, heavies and stations are off screen and marked (model/edge-markers.ts).
  private readonly edgeMarkers = createEdgeMarkerTracker();
  private keyed: {
    depth: number | undefined;
    key: string;
    sprite: GameObjects.Image;
    width: number;
  }[] = [];
  private keylines = new Map<string, GameObjects.Image[]>();
  // This frame's fly-through objects as drawn, which Ada draws above while she overlaps them
  // (draw-order.ts), and the tow craft's pivot depth while its line is drawn.
  private passable: PassableDraw[] = [];
  private towDepth: number | undefined;
  private silhouettes = new Silhouettes();
  // Every SVG's raster scale (svg-rasters.ts), from the canvas's fit when preload starts.
  private rasters!: SvgRasters;
  private jetKeyline!: GameObjects.Graphics;
  private indicatorInk!: GameObjects.Graphics;
  private stationArt: StationArt<Asset> | undefined;
  /** Each galaxy's own station art; a galaxy without it draws the shared station. */
  private galaxyStations = new Map<SectorId, GalaxyStationArt<Asset>>();
  private outpostArt: ReadonlyMap<string, StationArt<Asset>> = new Map();
  // Funded projects' world changes at the outposts (art/projects.md "World changes"): each reveal
  // in play by project, from its start on the flight clock, and its after state's group texture.
  // The flight clock runs only while flight does, so the pause card, the full-screen Map, a
  // station card or a dialogue neither starts a reveal under it nor plays one out.
  private projectArt: ProjectArtSet<Asset> | undefined;
  private flightLive = false;
  private flightClock = 0;
  private reveals = new Map<string, number>();
  private revealGroups = new Map<string, GameObjects.RenderTexture>();
  /** The Disabled banners' HTML layer over the canvas, and this frame's banners. */
  private bannerLayer: ReturnType<typeof createBannerLayer> | undefined;
  private banners: PlacedBanner[] = [];
  /** Art's enemy-only weapon effects, once enemy-weapons.json loads and validates. */
  private enemyWeaponsArt: EnemyWeaponsArt | undefined;
  /** Each mine's graphics, sorted with the play objects by its centre's screen y, by mine id. */
  private mineInk = new Map<string, Phaser.GameObjects.Graphics>();
  /** Each salvaged heavy composed into one texture, dimmed as a group, by enemy id. */
  private salvagedGroups = new Map<string, GameObjects.RenderTexture>();
  // Whirlpool's nursery beacon and current-map buoys (whirlpool-projects.ts), the buoys' sprites
  // by buoy, and the whales' current with the family position it was found from.
  private whirlpoolProjects: WhirlpoolProjects<Asset> | undefined;
  // The station jobs' art (job-art.ts): the landmarks' layer sprites by landmark and layer, those
  // drawn this frame, and the hunt's lost-item glint.
  private jobArt: JobArt<Asset> | undefined;
  private landmarkSprites = new Map<string, GameObjects.Image>();
  private landmarksDrawn = new Set<string>();
  private glintSprite: GameObjects.Image | undefined;
  private buoySprites = new Map<string, GameObjects.Image>();
  private whalesCurrentFor: { current: Current | null; family: Vec } | undefined;
  // The core manifest's assets and every loaded galaxy manifest's, with their data links.
  // The core manifest's entry ids, apart from the galaxies' own.
  private coreAssetIds: readonly string[] = [];
  private manifest: {
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
  private galaxyManifestPaths: Partial<Record<SectorId, string>> = {};
  private galaxyManifests = new Map<SectorId, GalaxyManifest<Asset>>();
  private galaxyLoads = new Set<SectorId>();
  private hubArt: HubArt<Asset> | undefined;
  private buoyArt: StationArt<Asset> | undefined;
  private craftArt: ReadonlyMap<string, EnemyArt<Asset>> = new Map();
  /** Each story craft's nose distance by heading, for its docked spot (art/cartwheel.md). */
  private storyNoses: StoryNoses = {};
  // Every galaxy's tow line, and Cartwheel's stranded craft; a rescue keeps its placeholder
  // craft or line until its art loads.
  private towLine: TowLine | undefined;
  private strandedCraft: ReadonlyMap<string, StrandedCraftArt<Asset>> = new Map();
  private towInk!: GameObjects.Graphics;
  private towSprite!: GameObjects.Image;
  // The guided calf's heading, kept while it rests.
  private calfHeading = 0;
  // Cartwheel's claim jumpers; a claim archetype without loaded art draws the coral family's.
  // Each galaxy family's art, shards and part frames (GALAXY_FAMILIES), by family.
  private familyArts = new Map<string, Map<string, EnemyArt<Asset>>>();
  private familyShards = new Map<string, Map<string, NonNullable<ReturnType<typeof readShards>>>>();
  private familyParts = new Map<string, readonly Asset[]>();
  private debrisArt: ReadonlyMap<SectorId, DebrisArt> = new Map();
  private streakSpec: StreakSpec | undefined;
  private resourceRocks: ReadonlyMap<string, AsteroidArt> = new Map();
  // Resource rock SVGs declare their display size, so they load without the displayScale.
  private resourceFiles = new Set<string>();
  private stardustArt: StardustArt<Asset> | undefined;
  private cacheArt: LoopArt<Asset> | undefined;
  private holodiskArt: LoopArt<Asset> | undefined;
  private beaconArt: LoopArt<Asset> | undefined;
  // Discovery caches Ada has approached in this flight; a lit cache stays lit.
  private litCaches = new Set<string>();
  private litFlight: number | undefined;
  private destruction: DestructionData | undefined;
  private shards = new Map<string, ShardData>();
  // Art's rocks and backdrop; their frames load on demand.
  private readonly asteroidArt = ASTEROID_ART;
  private backdropSprites = new Map<string, GameObjects.Image>();
  // Each galaxy's fixed backdrop layer once loaded (its haze texture or its painted band) and the
  // one image that draws it.
  private backdrops = new Map<SectorId, Pick<BackdropHaze, "asset" | "height" | "width">>();
  private backdropImage: GameObjects.Image | null = null;
  // The backdrop layers (art/backdrop.md): Art's shared rules, each galaxy's backdrop once read,
  // and the objects that draw the sky, the far items and planets by key, the plates, the stars
  // and the dust streaks.
  private backdropRules: BackdropRules | undefined;
  private galaxyBackdrops = new Map<SectorId, GalaxyBackdrop>();
  private skyImage: GameObjects.Image | null = null;
  private backdropItems = new Map<string, GameObjects.Image>();
  private plateInk: Record<"multiply" | "screen", GameObjects.Graphics> | null = null;
  private starImages: GameObjects.Image[] = [];
  private streakInk: GameObjects.Graphics | null = null;
  // Rock SVGs requested from the loader, and whether new ones wait for a start.
  private rockRequests = new Set<string>();
  private rockQueued = false;
  private whaleArt: WhaleArt<Asset> | undefined;
  private whaleRequests = new Set<string>();
  // Destroyed rocks breaking at their pivot: the rock, its last frame, world position and start.
  // Collected pickups zipping into the ship: a copy of each one's sprite as last drawn.
  private zips: {
    readonly from: Vec;
    readonly height: number;
    readonly sprite: GameObjects.Image;
    readonly startedMs: number;
    readonly width: number;
  }[] = [];
  private rockBreaks: {
    art: AsteroidArt;
    at: Vec;
    frame: number;
    id: string;
    sprite?: GameObjects.Image;
    startedMs: number;
  }[] = [];
  private reducedMotion = false;
  /** Whether the last save failed, so the save status waits for a free box. */
  private savingUnavailable = false;
  private boxOccupant: BoxOccupant | null = null;
  // Art's quantum jump: the overlay, whether a jump is playing (flight pauses), whether the
  // presentation holds the source scene, and the last drawn space scene's specks.
  private quantum: ReturnType<typeof createJumpOverlay> | null = null;
  private jumping = false;
  private holdSource = false;
  private specks: Vec[] = [];
  // A galaxy jump hides the selector card and its dim, so the jump plays over the cockpit alone.
  private hideSelector = false;
  // Painted ship frames load only for the scheme in use.
  private paintAssets: Asset[] = [];
  private paintLoads = new Set<string>();
  private settingsOpen = false;
  private screenOn = false;
  // The local map's Galaxies: the galaxy map over the paused flight; refused in danger, never
  // while towing (pause.ts galaxiesAvailable). Set once the scene's commands are ready.
  private openGalaxies: () => void = () => {};
  private startShown = false;
  private enabled: boolean | undefined;
  private durable = "";
  private savedAt = 0;
  private feedback = new ModelFeedback();
  private feedbackSound = new FeedbackSound();
  private screenShake = true;
  private palette = FALLBACK_SPACE_PALETTE;
  // The palette at home and before a galaxy is set, and each galaxy's retinted field.
  private basePalette = FALLBACK_SPACE_PALETTE;
  private galaxyPalettes: ReadonlyMap<SectorId, SpacePalette> = new Map();
  // The galaxies whose field is light, from the same galaxies.json as their palettes.
  private lightGalaxies: ReadonlySet<SectorId> = new Set();
  // The space background in use: the flight's galaxy field, else the base palette's.
  private spaceBackground = FALLBACK_SPACE_PALETTE.background;
  private station!: ReturnType<typeof createStationView>;
  private storybook!: ReturnType<typeof createStorybook>;
  private galaxies!: ReturnType<typeof createRouteMap>;
  // Each galaxy's route map marker hue and previews, from Art's galaxies.json and manifest.
  private routeGalaxies: () => RouteMapView["galaxies"] = () => [];
  private restartCard!: ReturnType<typeof createRestartCard>;
  private conversationBox!: ConversationBox;
  // The loader runs the player waits for show the loading bar; on-demand art loads silently. The
  // kit's watch also gives every file the loader's timeout and retries failed loads in rounds.
  private loads: LoaderWatch<WaitedLoad> | undefined;

  constructor() {
    super("prototype");
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
        this.filterTexture(key, filter);
      }
      const stale = type === "svg" ? this.rasters.loaded(key) : undefined;
      if (stale) {
        this.rasterAgain([stale]);
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
            this.loadGalaxyAsset(asset);
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
          this.loadSvg(asset);
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
      this.queueSvg({
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
    this.build();
  }

  private build(): void {
    const saved = readSave();
    const newer = newerSave(saved);
    if (newer) {
      stopSaving();
    }
    this.model = new GameModel(PROTOTYPE, newer ? null : saved);
    this.basePalette =
      readSpacePalette(this.cache.json.get("space-palette")) ?? FALLBACK_SPACE_PALETTE;
    this.palette = this.basePalette;
    // Art's field colours by stable galaxy id; a galaxy Art has none for flies in the base field.
    this.galaxyPalettes = galaxyPalettes(
      this.basePalette,
      readGalaxyFields(this.cache.json.get("galaxy-fields")),
    );
    this.lightGalaxies = readLightGalaxies(this.cache.json.get("galaxy-fields"));
    const background = this.palette.background;
    this.game.config.backgroundColor.setTo(
      (background >> 16) & 255,
      (background >> 8) & 255,
      background & 255,
    );
    this.cameras.main.setBackgroundColor(background);
    this.spaceBackground = background;
    fitPlayCamera(this);
    // SVGs, and the touch chrome on RASTER_SCALE_EVENT, rasterise again once a resize moves the
    // camera's zoom far enough (svg-rasters.ts).
    const followZoom = (): void => {
      const before = this.rasters.scale;
      this.rasterAgain(this.rasters.resize(sceneFit(this).zoom));
      if (this.rasters.scale !== before) {
        this.events.emit(RASTER_SCALE_EVENT, this.rasters.scale);
      }
    };
    followZoom();
    this.scale.on(Scale.Events.RESIZE, followZoom);
    this.events.once(Scenes.Events.SHUTDOWN, () => this.scale.off(Scale.Events.RESIZE, followZoom));
    const host = document.getElementById(VIEW_HOST_ID);
    if (host) {
      const layer = createBannerLayer(document, host, PROTOTYPE.labels.disabledBanner ?? "");
      this.bannerLayer = layer;
      this.events.once(Scenes.Events.SHUTDOWN, () => layer.destroy());
    }
    this.ink = this.add.graphics();
    // Enemy jets draw behind enemy sprites; shots and feedback draw above both.
    this.enemyJets = this.add.graphics().setDepth(1);
    this.overlay = this.add.graphics().setDepth(3);
    this.indicatorInk = this.add.graphics().setDepth(3 - 1e-6);
    this.edgeMarkerInk = this.add.graphics().setDepth(EDGE_MARKER_DEPTH);
    this.jetKeyline = this.add.graphics();
    this.jets = this.add.graphics().setDepth(9);
    this.ship = this.add.image(0, 0, "ship").setDepth(10);
    this.towInk = this.add.graphics();
    this.towSprite = this.add.image(0, 0, "ship").setVisible(false);
    const manifest = this.cache.json.get("art-manifest") as CoreManifest<Asset> | undefined;
    // Sunflower's outposts come from Sunflower's manifest, loaded with the boot set.
    const sunflower = readGalaxyManifest<Asset>(this.cache.json.get(galaxyManifestKey(1)));
    if (sunflower) {
      this.galaxyManifests.set(1, sunflower);
    }
    const bootAssets = [...(manifest?.assets ?? []), ...(sunflower?.assets ?? [])];
    this.shipAssets = bootAssets.filter((asset) => this.textures.exists(asset.id));
    // Jets render behind the ship sprite. Missing, invalid or heading-mismatched metadata keeps
    // the authored thrust frames, which load only then; until they do, the idle frames draw.
    const jets = readShipJets(this.cache.json.get("ship-jets"));
    this.shipJets =
      jets?.headings.length === SHIP_HEADINGS && hasShipHeadings(this.shipAssets)
        ? jets
        : undefined;
    if (!this.shipJets) {
      this.loadShipFrames(thrustFrames(manifest?.assets ?? []));
    }
    this.partAssets = (manifest?.assets ?? []).filter(
      (asset) => enemyPartFrame(asset) && asset.family === undefined,
    );
    for (const { family } of GALAXY_FAMILIES) {
      this.familyParts.set(
        family,
        (manifest?.assets ?? []).filter(
          (asset) => enemyPartFrame(asset) && asset.family === family,
        ),
      );
    }
    this.readEnemyArt();
    this.enemyWeaponsArt = readEnemyWeaponsArt(this.cache.json.get("enemy-weapons"));
    // Art without its loaded textures or data keeps the placeholders.
    this.stationArt = readStationArt(this.shipAssets);
    this.outpostArt = readOutpostArt(this.shipAssets);
    this.projectArt = readProjectArt(this.shipAssets, this.outpostArt, PROJECTS_FILE);
    this.stardustArt = readStardustArt(this.shipAssets);
    this.cacheArt = readLoopArt(this.shipAssets, "discovery-cache", CACHE_FRAMES);
    this.upgradePickupArt = readUpgradePickup(manifest?.assets ?? []);
    this.holodiskArt = readLoopArt(this.shipAssets, "holodisk", HOLODISK_FRAMES);
    this.coreAssetIds = (manifest?.assets ?? []).map(({ id }) => id);
    this.manifest = {
      assets: bootAssets,
      ...(manifest?.resourceRocks ? { resourceRocks: manifest.resourceRocks } : {}),
      ...(manifest?.tow ? { tow: manifest.tow } : {}),
      ...(manifest?.jobs ? { jobs: manifest.jobs } : {}),
      ...(manifest?.backdropLayers ? { backdropLayers: manifest.backdropLayers } : {}),
    };
    this.beaconArt = readLoopArt(this.shipAssets, "holodisk-beacon", BEACON_FRAMES);
    this.destruction = readDestruction(this.cache.json.get("destruction"));
    for (const archetype of Object.keys(this.destruction?.archetypes ?? {})) {
      const shards = readShards(this.cache.json.get(`shards-${archetype}`));
      if (shards) {
        this.shards.set(archetype, shards);
      }
    }
    this.paintAssets = (manifest?.assets ?? []).filter((asset) => asset.paint !== undefined);
    const ship = this.shipAssets.find((asset) => asset.id === "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    const apply = (action: () => void): void => {
      action();
      this.observeFeedback();
      this.controls.reset();
      this.flush();
      this.refresh();
    };
    // Every quantum jump plays Art's effect; the game switches once the source is covered.
    const jumpThen = (action: () => void): void => {
      if (this.jumping) {
        return;
      }
      if (!this.quantum) {
        apply(action);
        return;
      }
      this.jumping = true;
      this.quantum.play({
        destination: () => this.jumpScene(),
        emergency: false,
        onDone: () => {
          this.jumping = false;
        },
        onSwitch: () => apply(action),
        reducedMotion: this.reducedMotion,
        source: this.jumpScene(),
      });
    };
    this.openGalaxies = () => {
      if (galaxiesAvailable(this.model.inDanger)) {
        apply(() => this.model.openGalaxyMap());
      }
    };
    // Leaving the flight from the galaxy map closes the Paused card and the local map under it, so
    // the jump plays over the flight.
    const leaveFlight = (action: () => void): void => {
      if (this.model.galaxyMapShownInFlight) {
        this.controls.closePause();
      }
      jumpThen(action);
    };
    // The galaxy map's close X, back and Escape: in flight the local map again, focus back on its
    // Galaxies; at boarding Ada's room, whose page focuses its own action.
    const closeGalaxyMap = (): void => {
      const inFlight = this.model.galaxyMapShownInFlight;
      apply(() => this.model.closeGalaxyMap());
      if (inFlight) {
        this.controls.focusGalaxies();
      }
    };
    this.shell = new StoryShell({
      choose: (id) => apply(() => this.model.choose(id)),
      continueGame: () => apply(() => this.model.continueGame()),
      // A tap on a notice dismisses it without touching flight input.
      dismissNotice: () => {
        this.model.dismissNotice();
        this.refresh();
      },
      reducedMotion: () => this.controls.reducedMotion(),
      restart: () => this.restartCard.open(),
      start: () => apply(() => this.model.start()),
    });
    // The start screen's art: its field, wordmark, each paint's ship frame and the speed jets.
    this.shell.setTitleArt(
      readTitleScreen(manifest?.assets ?? [], this.shipJets, this.cache.json.get(TITLE_SCREEN_KEY)),
    );
    this.controls = createControls(this, {
      achievements: {
        close: PROTOTYPE.labels.close ?? "",
        next: PROTOTYPE.labels.next ?? "",
        page: PROTOTYPE.labels.achievementsPage ?? "",
        previous: PROTOTYPE.labels.previous ?? "",
        progress: PROTOTYPE.labels.achievementProgress ?? "",
        title: PROTOTYPE.labels.achievements ?? "",
      },
      cheats: {
        actions: [
          {
            description: CHEAT_COPY.grantDescription,
            execute: ({ commit }) => {
              commit(() => {
                grantAllWeapons(this.model.state);
              });
            },
            id: "grant-all-weapons",
            label: CHEAT_COPY.grantAllWeapons,
            scope: "save",
          },
        ],
        canExecute: () => this.model.state.mode === "space" && !this.model.state.dialogue,
        labels: CHEAT_COPY,
        onSave: () => apply(() => {}),
        run: () => (this.model.state.mode === "space" ? this.model.state.flight : null),
      },
      exit: exitShown() ? { label: PROTOTYPE.labels.exit ?? "", onExit: exitGame } : undefined,
      install: {
        port: {
          install: installApp,
          offers: offersInstall,
          onChange: onInstallStateChange,
          state: installState,
          stepsKind,
        },
        steps: PROTOTYPE.installSteps,
      },
      labels: {
        aimControls: PROTOTYPE.labels.aimControls ?? "",
        close: PROTOTYPE.labels.close ?? "",
        controlsNote: PROTOTYPE.labels.controlsNote ?? "",
        install: PROTOTYPE.labels.install ?? "",
        installButton: PROTOTYPE.labels.installButton ?? "",
        installNote: PROTOTYPE.labels.installNote ?? "",
        motionNote: PROTOTYPE.labels.motionNote ?? "",
        moveControls: PROTOTYPE.labels.moveControls ?? "",
        reducedMotion: PROTOTYPE.labels.reducedMotion ?? "",
        settings: PROTOTYPE.labels.settings ?? "",
        sound: PROTOTYPE.labels.sound ?? "",
        soundNote: PROTOTYPE.labels.soundNote ?? "",
      },
      noticeLabels: PROTOTYPE.labels,
      onFeedbackChange: (settings) => {
        this.feedbackSound.enabled = settings.sound;
        this.screenShake = screenShakes(settings);
        this.reducedMotion = settings.reducedMotion;
        if (!this.screenShake) {
          this.cameras.main.shakeEffect.reset();
        }
      },
      onPauseChange: (paused) => {
        this.settingsOpen = paused;
        this.armBack();
        this.flush();
      },
      onStartCover: coverStartScreen,
      onWeaponSelect: (weapon) => {
        const state = this.model.state;
        let refused = false;
        if (!this.settingsOpen && state.mode === "space" && !state.dialogue && !state.docked) {
          apply(() => {
            refused = !this.model.selectWeapon(weapon);
          });
        }
        return refused;
      },
      // Navigation lives in the Paused card; the local map's Travel here and Galaxies refuse while
      // Ada is in danger, and Back to title never does.
      pause: {
        buttonLabel: PROTOTYPE.labels.pause ?? "",
        labels: {
          backToTitle: PROTOTYPE.labels.backToTitle ?? "",
          close: PROTOTYPE.labels.close ?? "",
          map: PROTOTYPE.labels.map ?? "",
          mapScreen: mapScreenLabels(PROTOTYPE.labels),
          resume: PROTOTYPE.labels.resume ?? "",
          settings: PROTOTYPE.labels.settings ?? "",
          ship: PROTOTYPE.labels.ship ?? "",
          shipHeadings: {
            cargo: PROTOTYPE.labels.cargo ?? "",
            equipment: PROTOTYPE.labels.equipment ?? "",
          },
          shipRows: PROTOTYPE.labels,
          title: PROTOTYPE.labels.pauseTitle ?? "",
        },
        // The start screen needs no quantum jump; it covers the flight at once.
        onBackToTitle: () => {
          if (!this.jumping) {
            apply(() => this.model.backToTitle());
          }
        },
        onGalaxies: () => this.openGalaxies(),
        onTravel: (id) => {
          if (!this.model.inDanger && !this.model.towing) {
            jumpThen(() => this.model.teleport(id));
          }
        },
      },
      rasterScale: this.rasters.scale,
      shieldLabel: PROTOTYPE.labels.shield ?? "",
      update: {
        labels: {
          accept: PROTOTYPE.update.accept,
          cancel: PROTOTYPE.update.cancel,
          close: PROTOTYPE.labels.close ?? "",
          title: PROTOTYPE.update.title,
        },
        offer: updateOffer,
        restoreFocus: () => this.shell.focusDefault(),
      },
      weaponLabels: {
        ammo: PROTOTYPE.labels.weaponAmmoLabel ?? "",
        group: PROTOTYPE.labels.weapon ?? "",
        names: {
          heavyMissile: PROTOTYPE.labels.weaponHeavyMissile ?? "",
          laser: PROTOTYPE.labels.weaponLaser ?? "",
          multiLaser: PROTOTYPE.labels.weaponMultiLaser ?? "",
          phaser: PROTOTYPE.labels.weaponPhaser ?? "",
          rapidMissile: PROTOTYPE.labels.weaponRapidMissile ?? "",
          scattershot: PROTOTYPE.labels.weaponScattershot ?? "",
        },
      },
    });
    const labels = PROTOTYPE.labels;
    const label = (key: string): string => labels[key] ?? "";
    const amount = (value: number): string => fill(label("stardustAmount"), { amount: value });
    const item = (key: string): ShopItem => JSON.parse(key) as ShopItem;
    // The conversation box never pauses play; a tap moves it on.
    this.conversationBox = createConversationBox(() => {
      this.model.advanceConversation();
      this.renderConversation();
    });
    this.station = createStationView(this.controls.overlay, {
      acceptJob: (id) => {
        let accepted = false;
        apply(() => {
          accepted = this.model.acceptJob(id) !== "busy";
        });
        return accepted;
      },
      balance: () => ({
        amount: this.model.state.economy.stardust,
        text: amount(this.model.state.economy.stardust),
      }),
      busyLine: () => this.model.jobBusyLine,
      buy: (key) =>
        apply(() => {
          if (projectId(key)) {
            this.model.donate(projectId(key)!);
          } else {
            this.model.buy(item(key));
          }
        }),
      dropJob: () => apply(() => this.model.dropJob()),
      jobs: () =>
        this.model.jobBoard().map((job) => ({
          ...job,
          rewardText: fill(label("jobReward"), { amount: job.reward }),
        })),
      labels: {
        activityDrop: label("activityDrop"),
        close: label("close"),
        confirmBuy: label("confirmBuy"),
        confirmCancel: label("confirmCancel"),
        inUse: label("inUse"),
        jobAccept: label("jobAccept"),
        jobActive: label("jobActive"),
        jobBoard: label("jobBoard"),
        jobBoardIntro: label("jobBoardIntro"),
        jobBusy: label("jobBusy"),
        jobDrop: label("jobDrop"),
        jobDropCancel: label("jobDropCancel"),
        jobDropTitle: label("jobDropTitle"),
        jobs: label("jobs"),
        owned: label("owned"),
        projectFunded: label("projectFunded"),
        projects: label("projects"),
        shipPaint: label("shipPaint"),
        shop: label("shop"),
        shopShip: label("shopShip"),
        shopWeapons: label("shopWeapons"),
        station: label("station"),
        stationWelcome: label("stationWelcome"),
        undock: label("undock"),
      },
      projectsShown: () => this.model.projects !== null,
      reducedMotion: () => this.controls.reducedMotion(),
      request: (key) => {
        const project = projectId(key);
        if (project) {
          const view = this.model.projects?.find(({ id }) => id === project);
          const donation = this.model.donationRequest(project);
          return donation.kind === "refused" || !view
            ? { kind: "refused" }
            : {
                about: label(`projectAbout${view.copy}`),
                action: label("donate"),
                kind: "confirm",
                left: fill(label("confirmLeft"), { amount: amount(donation.left) }),
                price: donation.amount,
                ...(donation.stillNeeded > 0
                  ? {
                      stillNeeded: fill(label("donateStillNeeded"), {
                        amount: amount(donation.stillNeeded),
                      }),
                    }
                  : {}),
                title: fill(label("donateTitle"), { name: view.name }),
              };
        }
        const request = this.model.requestPurchase(item(key));
        return request.kind === "refused"
          ? request
          : {
              about: itemAbout(ECONOMY, labels, item(key)),
              action: label("confirmBuy"),
              kind: "confirm",
              left: fill(label("confirmLeft"), { amount: amount(request.left) }),
              price: request.price,
              title: fill(label("confirmTitle"), { name: itemName(ECONOMY, labels, item(key)) }),
            };
      },
      rows: (tab) =>
        tab === "projects"
          ? // A project row: its effect line until something is paid, then its progress, and a
            // price showing what remains; unaffordable only at a balance of 0 (art/projects.md).
            (this.model.projects ?? []).map((project) => ({
              glyph: { key: project.icon, kind: "sprite" },
              group: "items",
              key: `project:${project.id}`,
              level:
                project.paid > 0
                  ? fill(label("projectProgress"), { paid: project.paid, price: project.cost })
                  : label(`projectEffect${project.copy}`),
              name: project.name,
              price: project.funded ? null : project.remaining,
              project: true,
              state: project.funded
                ? "owned"
                : this.model.state.economy.stardust > 0
                  ? "forSale"
                  : "unaffordable",
            }))
          : this.model
              .shopRows(tab)
              .map((row) => stationRow(ECONOMY, labels, this.model.state.economy.stardust, row)),
      select: (key) => {
        const chosen = item(key);
        if (chosen.kind === "paint") {
          apply(() => this.model.selectPaint(chosen.scheme));
        }
      },
      undock: () => apply(() => this.model.undock()),
    });
    // Back and Escape leave the shop for the station card, and the card undocks. Settings
    // opened over either closes first, as the innermost card.
    const { card, inner } = this.station.layers;
    const stationLayers = [card, inner].map((layer) =>
      this.controls.registerBack({
        back: layer.back,
        isOpen: () => layer.isOpen() && !this.settingsOpen,
      }),
    );
    const unregisterStation = () => stationLayers.forEach((unregister) => unregister());
    // Art's quantum jump, played over every layer.
    const artManifest = this.cache.json.get("art-manifest") as
      { assets?: (Asset & { frames?: Record<string, number> })[] } | undefined;
    const artAssets = artManifest?.assets ?? [];
    const sheet = (id: string): SheetArt | undefined => {
      const asset = artAssets.find((entry) => entry.id === id);
      return asset?.frameWidth && asset.frameHeight && asset.frames
        ? {
            frameHeight: asset.frameHeight,
            frameWidth: asset.frameWidth,
            frames: asset.frames,
            height: asset.height,
            url: asset.path,
            width: asset.width,
          }
        : undefined;
    };
    const jumpData = readQuantumJump(this.cache.json.get("quantum-jump"));
    const [field, glow, star] = [
      sheet("quantum-jump-field"),
      sheet("quantum-jump-glow"),
      sheet("quantum-jump-star"),
    ];
    this.quantum =
      jumpData && field && glow && star
        ? createJumpOverlay(this.controls.overlay, { field, glow, jump: jumpData, star })
        : null;
    // The home half: storybook pages, galaxy selection over the cockpit and Restart's confirm.
    this.storybook = createStorybook(this.controls.overlay, {
      labels: { next: label("next"), previous: label("previous"), skip: label("skip") },
      onChoose: (index) => apply(() => this.model.storyChoose(index)),
      onNext: () => apply(() => this.model.storyNext()),
      onPrevious: () => apply(() => this.model.storyPrevious()),
      onSkip: () => apply(() => this.model.storySkip()),
      reducedMotion: () => this.controls.reducedMotion(),
    });
    this.galaxies = createRouteMap(this.controls.overlay, {
      labels: {
        close: label("close"),
        development: label("galaxyInDevelopment"),
        home: label("homeButton"),
        jump: label("jump"),
        locked: label("galaxyLocked"),
        number: label("galaxyNumber"),
        stay: label("stayHere"),
      },
      // In flight, the local map it opened from; at boarding, Ada's room, as Earth.
      onClose: closeGalaxyMap,
      // In flight Earth ends the flight with the jump home; at boarding it is the room at once.
      onEarth: () => {
        if (this.model.galaxyMapShownInFlight) {
          leaveFlight(() => this.model.leaveCockpit());
        } else {
          apply(() => this.model.leaveCockpit());
        }
      },
      onFlightEnd: () => apply(() => this.model.finishRouteFlight()),
      onJump: () => {
        const selected = this.model.selectedGalaxy;
        if (this.model.galaxyMapStays) {
          // Stay here: both maps close and the same flight resumes, with no jump.
          apply(() => this.model.jump());
          this.controls.closePause();
        } else if (selected !== null && this.model.isUnlocked(selected)) {
          this.hideSelector = Boolean(this.quantum) && !this.jumping;
          leaveFlight(() => {
            this.hideSelector = false;
            this.model.jump();
          });
          this.refresh();
        } else {
          apply(() => this.model.jump());
        }
      },
      onStep: (delta) => apply(() => this.model.stepGalaxy(delta)),
      onView: (position) => apply(() => this.model.viewGalaxy(position)),
      reducedMotion: () => this.controls.reducedMotion(),
    });
    // The route map's art: the sky, ground and figures, the marker hues and Ada's frames.
    const routeAssets = manifest?.assets ?? [];
    const markers = readRouteMarkers(this.cache.json.get("galaxy-fields"));
    const routeArt = readRouteArt(routeAssets, markers, (thrust) =>
      routeShipFrames(routeAssets, this.paintInUse(), thrust),
    );
    if (routeArt) {
      this.galaxies.setArt(routeArt);
    }
    this.routeGalaxies = () =>
      ROUTE.map((galaxy) => {
        const card = galaxyCard(galaxy);
        return {
          flavor: card.flavor,
          hue: markerHue(markers, galaxy),
          name: card.name,
          placeholder: !BUILT.has(galaxy),
          preview: routePreviews(routeAssets, card),
          unlocked: this.model.isUnlocked(galaxy),
        };
      });
    this.restartCard = createRestartCard(this.controls.overlay, {
      labels: {
        cancel: label("confirmCancel"),
        close: label("close"),
        restart: label("restart"),
        title: label("restartTitle"),
      },
      onRestart: () => apply(() => this.model.restart()),
    });
    const homeLayers = [
      // Back on a storybook page acts as Previous, and does nothing on a scene's first page. On
      // Ada's room page, back and Escape open the Paused card instead.
      this.controls.registerBack({
        back: () => apply(() => this.model.storyPrevious()),
        isOpen: () => this.model.screen === "story" && !this.model.roomPage && !this.settingsOpen,
      }),
      // Back and Escape on the galaxy map: where it opened from, as its close X. In flight it opens
      // over the Paused card's local map, so it is the innermost card while that card is open.
      this.controls.registerBack({
        back: closeGalaxyMap,
        isOpen: () =>
          this.galaxies.isOpen() && (this.model.galaxyMapShownInFlight || !this.settingsOpen),
      }),
      this.controls.registerBack({
        back: () => this.restartCard.close(),
        isOpen: () => this.restartCard.isOpen() && !this.settingsOpen,
      }),
    ];
    const hide = (): void => {
      this.controls.reset();
      this.flush();
    };
    window.addEventListener("pointerdown", this.feedbackSound.unlock);
    window.addEventListener("keydown", this.feedbackSound.unlock);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.flush();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pointerdown", this.feedbackSound.unlock);
      window.removeEventListener("keydown", this.feedbackSound.unlock);
      this.feedbackSound.dispose();
      unregisterStation();
      homeLayers.forEach((unregister) => unregister());
      this.storybook.dispose();
      this.quantum?.dispose();
      this.galaxies.dispose();
      this.restartCard.dispose();
      this.station.dispose();
      this.conversationBox.dispose();
      this.controls.dispose();
      this.shell.dispose();
    });
    this.observeFeedback();
    if (newer) {
      requireNewerVersion((state) => this.shell.setRequiredUpdate(state));
    }
    this.refresh();
    this.loadAsteroidArt();
  }

  /**
   * Art's rock frames load after the scene starts, at display size times r: each rock's frame 0
   * and the backdrop sprites first, then each spin frame the first time it is drawn, so starting
   * the scene never waits on 202 SVGs.
   */
  private loadAsteroidArt(): void {
    const catalog = ASTEROID_ART;
    this.shell.setAsteroidArt(false);
    const first = [
      ...catalog.asteroids.map((rock) => rock.frames[0]!.file),
      ...catalog.backdrop.sprites.map((sprite) => sprite.file),
    ];
    const ready = (): void => {
      if (first.every((file) => this.textures.exists(file))) {
        this.shell.setAsteroidArt(true);
      }
    };
    first.forEach((file) => this.rockTexture(file));
    if (!this.startRockLoads()) {
      ready();
      return;
    }
    this.load.once(Loader.Events.COMPLETE, ready);
  }

  /**
   * Loads a galaxy's own art the first time one of its flights draws: SVGs (loadSvg), the nugget
   * sheet and the data files, then reads them. Until then its objects keep their placeholders.
   */
  private loadGalaxyArt(sector: SectorId): void {
    if (this.galaxyLoads.has(sector)) {
      return;
    }
    this.galaxyLoads.add(sector);
    // Resource rocks are in every galaxy's chunks, and any galaxy's rescue draws the tow line:
    // both load with the first flight.
    for (const [key, path] of [
      ["resource-rocks", this.manifest.resourceRocks],
      ["tow", this.manifest.tow],
      ["jobs", this.manifest.jobs],
      ["backdrop-layers", this.manifest.backdropLayers],
    ] as const) {
      if (path && !this.cache.json.exists(key)) {
        this.load.json(key, path);
      }
    }
    const path = this.galaxyManifestPaths[sector];
    if (this.galaxyManifests.has(sector) || !path) {
      this.queueGalaxyArt(sector);
    } else {
      this.load.once(`filecomplete-json-${galaxyManifestKey(sector)}`, () =>
        this.queueGalaxyArt(sector),
      );
      this.load.json(galaxyManifestKey(sector), path);
    }
    this.load.once(Loader.Events.COMPLETE, () => this.readGalaxyArt());
    // The galaxy's first flight waits on its own art.
    this.loads?.waitFor("galaxy");
    this.load.start();
  }

  /** Queues one of a galaxy manifest's SVGs or sheets; whale frames and part frames wait. */
  private loadGalaxyAsset(asset: Asset): void {
    if (!galaxyLoadsAtOnce(asset) || this.textures.exists(asset.id)) {
      return;
    }
    if (asset.path.endsWith(".svg")) {
      this.loadSvg(asset);
    } else if (asset.frameWidth && asset.frameHeight) {
      this.load.spritesheet(asset.id, asset.path, {
        frameHeight: asset.frameHeight,
        frameWidth: asset.frameWidth,
      });
    }
  }

  /**
   * Adds a galaxy's loaded manifest to the known assets and data links, then queues its art:
   * its SVGs and sheets, its craft and claim jumper data and its own data files.
   */
  private queueGalaxyArt(sector: SectorId): void {
    const galaxy =
      this.galaxyManifests.get(sector) ??
      readGalaxyManifest<Asset>(this.cache.json.get(galaxyManifestKey(sector)));
    if (!galaxy) {
      return;
    }
    if (!this.galaxyManifests.has(sector)) {
      this.galaxyManifests.set(sector, galaxy);
      this.manifest = {
        ...this.manifest,
        ...galaxy.links,
        assets: [...this.manifest.assets, ...galaxy.assets],
      };
      for (const { family } of GALAXY_FAMILIES) {
        this.familyParts.set(family, [
          ...(this.familyParts.get(family) ?? []),
          ...galaxy.assets.filter((asset) => enemyPartFrame(asset) && asset.family === family),
        ]);
      }
    }
    const assets = galaxy.assets;
    for (const asset of assets) {
      this.loadGalaxyAsset(asset);
    }
    for (const [craft, frames] of craftFrameSets(assets)) {
      if (!this.cache.json.exists(`craft-jets-${craft}`)) {
        this.load.json(`craft-jets-${craft}`, enemyJetsPath(craft, frames[0]!));
      }
    }
    for (const { family, prefix, wired } of GALAXY_FAMILIES) {
      for (const [archetype, frames] of enemyFrameSets(assets, prefix)) {
        if (!wired.has(archetype)) {
          continue;
        }
        if (frames.length > 1) {
          this.load.json(`${family}-jets-${archetype}`, enemyJetsPath(archetype, frames[0]!));
        }
        // Shards, as in coral, for the archetypes Art's destruction data covers.
        if (this.destruction && Object.hasOwn(this.destruction.archetypes, archetype)) {
          this.load.json(`${family}-shards-${archetype}`, enemyShardsPath(archetype, frames[0]!));
        }
        if (composedArchetypes(this.familyParts.get(family) ?? []).has(archetype)) {
          this.load.json(
            `${family}-hardpoints-${archetype}`,
            enemyHardpointsPath(archetype, frames[0]!),
          );
        }
      }
    }
    this.queueBackdrop(sector, galaxy);
    // The galaxy's own data files, named by its manifest's links.
    for (const [key, path] of [
      ["cartwheel-debris", galaxy.links.cartwheelDebris],
      ["whales", galaxy.links.whales],
      ["whirlpool-currents", galaxy.links.whirlpoolCurrents],
      ["whirlpool-debris", galaxy.links.whirlpoolDebris],
      ["whirlpool-projects", galaxy.links.whirlpoolProjects],
    ] as const) {
      if (path && !this.cache.json.exists(key)) {
        this.load.json(key, path);
      }
    }
  }

  /**
   * A galaxy's backdrop layers: its backdrop.json, then the fixed layers it names and its nebula
   * textures, which draw with linear filtering since at parallax 0.05 nearest texels would crawl.
   */
  private queueBackdrop(sector: SectorId, galaxy: GalaxyManifest<Asset>): void {
    const path = galaxy.links.backdrop;
    const key = `backdrop-${sector}`;
    if (!path || this.galaxyBackdrops.has(sector) || this.cache.json.exists(key)) {
      return;
    }
    this.load.once(`filecomplete-json-${key}`, () => {
      const backdrop = readGalaxyBackdrop(this.cache.json.get(key));
      if (!backdrop) {
        return;
      }
      this.galaxyBackdrops.set(sector, backdrop);
      if (backdrop.fixed.includes("backdropHaze")) {
        this.queueHaze(sector, galaxy);
      }
      if (backdrop.fixed.includes("needleBand")) {
        this.queueBand(sector, galaxy);
      }
      for (const id of backdrop.far.flatMap((far) => (far.look === "nebula" ? far.assets : []))) {
        const asset = galaxy.assets.find((entry) => entry.id === id);
        if (!asset || this.textures.exists(id)) {
          continue;
        }
        this.load.once(`filecomplete-image-${id}`, () => this.filterTexture(id, "linear"));
        this.load.image(id, asset.path);
      }
    });
    this.load.json(key, path);
  }

  /**
   * A galaxy's backdrop haze: its haze.json, then the texture it names, which draws with linear
   * filtering since its half-resolution texels must never show.
   */
  private queueHaze(sector: SectorId, galaxy: GalaxyManifest<Asset>): void {
    const path = galaxy.links.backdropHaze;
    const key = `backdrop-haze-${sector}`;
    if (!path || this.backdrops.has(sector) || this.cache.json.exists(key)) {
      return;
    }
    this.load.once(`filecomplete-json-${key}`, () => {
      const haze = readBackdropHaze(galaxy.assets, this.cache.json.get(key));
      if (!haze) {
        return;
      }
      const ready = () => {
        this.filterTexture(haze.asset, "linear");
        this.backdrops.set(sector, haze);
      };
      if (this.textures.exists(haze.asset)) {
        ready();
      } else {
        this.load.once(`filecomplete-image-${haze.asset}`, ready);
        this.load.image(haze.asset, haze.path);
      }
    });
    this.load.json(key, path);
  }

  /**
   * Needle's edge-on band: its band.json, painted once into a canvas texture over the haze's area
   * at the maximum render scale, so its 1.2 px core and point stars stay sharp.
   */
  private queueBand(sector: SectorId, galaxy: GalaxyManifest<Asset>): void {
    const path = galaxy.links.needleBand;
    const key = `backdrop-band-${sector}`;
    if (!path || this.backdrops.has(sector) || this.cache.json.exists(key)) {
      return;
    }
    this.load.once(`filecomplete-json-${key}`, () => {
      const band = readBackdropBand(this.cache.json.get(key));
      if (!band || this.textures.exists(key)) {
        return;
      }
      const texture = this.textures.createCanvas(
        key,
        BAND_AREA.width * MAX_RENDER_SCALE,
        BAND_AREA.height * MAX_RENDER_SCALE,
      );
      if (!texture) {
        return;
      }
      paintBand(band, texture.getContext(), MAX_RENDER_SCALE);
      texture.refresh();
      this.filterTexture(key, "linear");
      this.backdrops.set(sector, { asset: key, height: BAND_AREA.height, width: BAND_AREA.width });
    });
    this.load.json(key, path);
  }

  /** The flight's galaxy's fixed backdrop layer, on the play view's centre, or none. */
  private drawBackdropLayer(sector: SectorId | null): void {
    const layer = sector === null ? undefined : this.backdrops.get(sector);
    if (!layer) {
      this.backdropImage?.setVisible(false);
      return;
    }
    this.backdropImage ??= this.add.image(0, 0, layer.asset).setDepth(BACKDROP_DEPTH.fixed);
    this.backdropImage
      .setTexture(layer.asset)
      .setOrigin(0.5, 0.5)
      .setPosition(SCREEN.width / 2, SCREEN.height / 2)
      .setDisplaySize(layer.width, layer.height)
      .setVisible(true);
  }

  /** Reads the galaxy art whose textures and data have loaded. */
  private readGalaxyArt(): void {
    this.backdropRules ??= readBackdropRules(this.cache.json.get("backdrop-layers"));
    this.readEnemyArt();
    for (const { family, wired } of GALAXY_FAMILIES) {
      const read = new Map<string, NonNullable<ReturnType<typeof readShards>>>();
      for (const archetype of wired) {
        const shards = readShards(this.cache.json.get(`${family}-shards-${archetype}`));
        if (shards) {
          read.set(archetype, shards);
        }
      }
      this.familyShards.set(family, read);
    }
    const loaded = this.manifest.assets.filter((asset) => this.textures.exists(asset.id));
    for (const [sector, galaxy] of this.galaxyManifests) {
      const stations = readGalaxyStationArt(
        galaxy.assets.filter((asset) => this.textures.exists(asset.id)),
      );
      if (stations) {
        this.galaxyStations.set(sector, stations);
      }
    }
    this.towLine = readTowLine(this.cache.json.get("tow"));
    this.jobArt = readJobArt(this.shipAssets, this.cache.json.get("jobs"));
    this.strandedCraft = readStrandedCraft(this.cache.json.get("tow"), loaded);
    this.hubArt = readHubArt(loaded);
    this.buoyArt = readBuoyArt(loaded);
    // Each craft's frames from a galaxy manifest, else core's shared craft.
    const core = new Set(this.coreAssetIds);
    this.craftArt = craftArt(
      (craft) => this.cache.json.get(`craft-jets-${craft}`),
      storyCraftSets(
        loaded.filter(({ id }) => !core.has(id)),
        loaded.filter(({ id }) => core.has(id)),
      ),
    );
    this.storyNoses = storyNoses((craft) => this.cache.json.get(`craft-jets-${craft}`));
    const debris = new Map<SectorId, DebrisArt>();
    for (const [sector, key] of [
      [2, "cartwheel-debris"],
      [3, "whirlpool-debris"],
    ] as const) {
      const art = readDebrisArt(this.cache.json.get(key));
      const ready = art?.pieces.every((piece) =>
        piece.frames.every((_, k) => this.textures.exists(`${piece.id}-${k}`)),
      );
      if (art && ready) {
        debris.set(sector, art);
      }
    }
    this.debrisArt = debris;
    this.streakSpec = readStreakSpec(this.cache.json.get("whirlpool-currents"));
    this.whirlpoolProjects = readWhirlpoolProjects(
      loaded,
      this.cache.json.get("whirlpool-projects"),
    );
    const rocks = readResourceRocks(this.cache.json.get("resource-rocks"));
    this.resourceRocks = new Map((rocks?.rocks ?? []).map((rock) => [rock.id, rock]));
    this.resourceFiles = new Set(
      (rocks?.rocks ?? []).flatMap((rock) => rock.frames.map((frame) => frame.file)),
    );
    this.whaleArt = readWhaleArt(
      this.cache.json.get("whales"),
      this.manifest.assets.filter(whaleFrameAsset),
    );
  }

  /** Whether a rock or backdrop SVG is ready; a missing one is queued for the next load. */
  private rockTexture(file: string): boolean {
    if (this.textures.exists(file)) {
      return true;
    }
    if (!this.rockRequests.has(file) && this.asteroidArt) {
      this.rockRequests.add(file);
      // Resource rocks are drawn at their own size; backdrop rocks at the art's display scale.
      const factor = this.resourceFiles.has(file) ? 1 : this.asteroidArt.displayScale;
      this.queueSvg({ key: file, path: file, size: (scale) => ({ scale: scale * factor }) });
      this.rockQueued = true;
    }
    return false;
  }

  /** Starts loading any queued rock SVGs; false when none were queued. */
  private startRockLoads(): boolean {
    if (!this.rockQueued) {
      return false;
    }
    this.rockQueued = false;
    this.load.start();
    return true;
  }

  /** The loaded texture for a rock frame: that frame, else frame 0, else none yet. */
  private rockFrameTexture(art: AsteroidArt, frame: number): string | undefined {
    const wanted = art.frames[frame]!.file;
    if (this.rockTexture(wanted)) {
      return wanted;
    }
    const still = art.frames[0]!.file;
    return this.rockTexture(still) ? still : undefined;
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
      return;
    }
    const state = this.model.state;
    this.feedback.advance(Math.min(milliseconds / 1000, 0.05));
    const wasInSpace = state.mode === "space";
    this.flightLive =
      !this.jumping &&
      !this.settingsOpen &&
      !document.hidden &&
      state.mode === "space" &&
      !state.dialogue &&
      !state.docked;
    if (this.flightLive) {
      this.flightClock += milliseconds;
      const sampled = this.controls.sample();
      const input: FlightInput = {
        aim: screenToWorld(sampled.aim),
        move: screenToWorld(sampled.move),
        reducedMotion: this.reducedMotion,
        use: sampled.use,
        viewportWidth: this.cameras.main.width / this.cameras.main.zoom,
      };
      this.model.step(Math.min(milliseconds / 1000, 0.05), input);
      this.observeFeedback();
      this.startRockBreaks(time);
      this.startZips(time);
    }
    // The overnight sleep scene plays on while the page shows, as flight does.
    if (!this.jumping && !this.settingsOpen && !document.hidden) {
      // It lasts as long as Art's overnight sequence, or OVERNIGHT_SLEEP until that loads.
      this.model.storyTick(
        this.storybook.sleepSeconds() ?? OVERNIGHT_SLEEP.seconds,
        Math.min(milliseconds / 1000, 0.05),
      );
    }
    // A failed shield already sent Ada home; hold the last drawn flight as the source scene
    // until Astra's emergency jump covers it.
    if (wasInSpace && this.model.state.mode !== "space" && !this.jumping && this.quantum) {
      this.jumping = true;
      this.holdSource = true;
      this.quantum.play({
        destination: () => this.jumpScene(),
        emergency: true,
        onDone: () => {
          this.jumping = false;
        },
        onSwitch: () => {
          this.holdSource = false;
        },
        reducedMotion: this.reducedMotion,
        source: this.spaceJumpScene(),
      });
    }
    if (!this.holdSource) {
      this.refresh();
      this.draw();
    }
    // The box follows the model even while a jump holds its source frame.
    this.renderConversation();
    const durable = JSON.stringify([
      state.mode,
      state.selectedSector,
      state.progress,
      state.unlocked,
      state.dialogue,
      state.docked,
      state.economy,
      state.seenConversations,
    ]);
    if (durable !== this.durable || time - this.savedAt >= 1000) {
      this.flush();
      this.durable = durable;
      this.savedAt = time;
    }
  }

  /**
   * Traveling debris, ballistic or in a river, in a galaxy with Art's debris: its tumbling piece
   * over the trailing coral dashes (art/cartwheel-props.md, art/whirlpool.md). False without
   * that art, so the placeholder draws.
   */
  private drawTravelingDebris(object: SpaceObject, point: Vec): boolean {
    const flight = this.model.state.flight!;
    const art = this.debrisArt.get(flight.sector);
    if (!art || !object.velocity || object.orbit) {
      return false;
    }
    const piece = debrisPiece(art, object.id);
    const frame = debrisFrame(art, piece, object.id, this.reducedMotion, flight.time);
    const velocity = {
      x: object.velocity.x - object.velocity.y,
      y: (object.velocity.x + object.velocity.y) / 2,
    };
    const mark = hexNumber(art.marks.color);
    for (const dash of debrisMarks(art, piece, frame, velocity)) {
      this.ink.lineStyle(art.marks.width, mark, dash.alpha);
      this.ink.lineBetween(
        point.x + dash.from.x,
        point.y + dash.from.y,
        point.x + dash.to.x,
        point.y + dash.to.y,
      );
    }
    this.objectSprite(object.id, `${piece.id}-${frame}`)
      .setDisplaySize(piece.display.width, piece.display.height)
      .setOrigin(piece.pivot.x, piece.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y));
    return true;
  }

  /**
   * Each pickup collected this step zips into the ship as it last showed (its sprite copied);
   * reduced motion, or a pickup drawn without a sprite, shows none.
   */
  private startZips(nowMs: number): void {
    if (this.reducedMotion) {
      return;
    }
    for (const event of this.model.flightEvents) {
      if (event.type !== "collected") {
        continue;
      }
      const source = event.lostItem ? this.glintSprite : this.enemySprites.get(event.id);
      if (!source?.visible) {
        continue;
      }
      const sprite = this.add
        .image(source.x, source.y, source.texture.key, source.frame.name)
        .setOrigin(source.originX, source.originY)
        .setDisplaySize(source.displayWidth, source.displayHeight)
        .setDepth(source.depth);
      if (source.isTinted) {
        sprite.setTint(source.tintTopLeft).setTintMode(source.tintMode);
      }
      this.zips.push({
        from: { x: event.x, y: event.y },
        height: source.displayHeight,
        sprite,
        startedMs: nowMs,
        width: source.displayWidth,
      });
    }
  }

  /** Moves each zipping pickup toward Ada for PROTOTYPE's pickupZip, then removes it. */
  private drawZips(): void {
    const flight = this.model.state.flight;
    this.zips = this.zips.filter((zip) => {
      const state =
        flight &&
        zipAt(
          PROTOTYPE.tuning.flight.pickupZip,
          (this.time.now - zip.startedMs) / 1000,
          zip.from,
          flight.player,
        );
      if (!state) {
        zip.sprite.destroy();
        return false;
      }
      const point = this.project(state.at);
      zip.sprite
        .setPosition(point.x, point.y)
        .setDisplaySize(zip.width * state.scale, zip.height * state.scale)
        .setVisible(true);
      return true;
    });
  }

  /** Each rock destroyed this step breaks where it stood, in the frame it last showed. */
  private startRockBreaks(nowMs: number): void {
    const flight = this.model.state.flight;
    const catalog = this.asteroidArt;
    if (!flight || !catalog) {
      return;
    }
    for (const event of this.model.flightEvents) {
      const art =
        event.type === "asteroidDestroyed" &&
        (event.resource
          ? this.resourceRocks.get(resourceArtId(event.asteroid))
          : rockArt(event.asteroid));
      if (art && event.type === "asteroidDestroyed") {
        this.rockBreaks.push({
          art,
          at: { x: event.x, y: event.y },
          frame: rockFrame(art, flight.seed, this.reducedMotion, event.id, flight.time),
          id: event.id,
          startedMs: nowMs,
        });
      }
    }
  }

  /** The conversation box, in the desktop wording without a coarse pointer. */
  private renderConversation(): void {
    this.conversationBox.render(
      this.model.conversation,
      !coarsePointer(window),
      this.reducedMotion,
    );
    // One box at a time: a line, else the game notice, else the save status (notice.ts). A card
    // over the play view covers the line or notice under it, which frees the slot for the save
    // status, drawn above cards.
    const { dialogue, docked, notice } = this.model.state;
    const covered = this.settingsOpen || Boolean(dialogue) || Boolean(docked);
    const occupant = boxOccupant({
      line: this.model.conversation !== null && !covered,
      notice: notice !== "" && !covered,
      saveStatus: this.savingUnavailable,
    });
    // Written only on a change: an attribute write restyles the whole play area.
    if (occupant !== this.boxOccupant) {
      this.boxOccupant = occupant;
      const host = document.getElementById(VIEW_HOST_ID);
      if (occupant) {
        host?.setAttribute(BOX_OCCUPANT, occupant);
      } else {
        host?.removeAttribute(BOX_OCCUPANT);
      }
    }
  }

  private observeFeedback(): void {
    const kinds = this.feedback.observe(TELEPORT_DISTANCE, this.model.state);
    this.feedbackSound.play(kinds);
    if (this.screenShake && kinds.includes("damage")) {
      const camera = this.cameras.main;
      camera.shake(100, shakeIntensity(camera.zoom, 0.002));
    }
  }

  /** The Ship card's facts with the paint named. */
  private shipView(): ShipView {
    const ship = this.model.ship;
    const paint = ECONOMY.paints[ship.paint]?.label;
    return { ...ship, paint: (paint && PROTOTYPE.labels[paint]) ?? "" };
  }

  // Queues item notices for what Ada gained since last frame; a new flight starts from what she
  // holds, and leaving flight clears them.
  private noticeGains(): void {
    const { flight, mode } = this.model.state;
    if (mode !== "space" || !flight) {
      if (this.held) {
        this.held = undefined;
        this.controls.setGains(null);
      }
      return;
    }
    const ship = this.model.ship;
    const snapshot: GainSnapshot = {
      aboard: ship.aboard,
      holodisks: ship.holodisks,
      weapons: ship.weapons.map(({ ammo, id }) => ({ ammo, id })),
    };
    if (this.held?.flight === flight) {
      const gains = itemGains(Boolean(this.model.state.docked), this.held.snapshot, snapshot);
      if (gains.length > 0) {
        this.controls.setGains(gains);
      }
    } else if (this.held) {
      this.controls.setGains(null);
    }
    this.held = { flight, snapshot };
  }

  private refresh(): void {
    const state = this.model.state;
    const enabled = state.mode === "space" && !state.dialogue && !state.docked;
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      this.controls.setEnabled(enabled);
      this.controls.reset();
    }
    const action = enabled ? this.model.contextAction : undefined;
    this.controls.setContext(action && { action, label: this.model.contextLabel ?? "" });
    this.controls.setWeapons(this.model.weapons());
    this.noticeGains();
    const aboard = this.model.aboard;
    this.controls.setStatus({
      aboard: aboard && { kind: aboard.kind, label: aboardLabel(PROTOTYPE.labels, aboard) },
      capacity: this.model.shieldMax,
      lightField: lightGalaxy(
        this.lightGalaxies,
        state.mode === "space" ? state.flight?.sector : undefined,
      ),
      ore: this.model.ship.ore,
      oreLabel: PROTOTYPE.labels.ore ?? "",
      recharging: this.model.shieldRecharging,
      shield: state.flight?.shield ?? 0,
      stardust: state.economy.stardust,
      stardustLabel: fill(PROTOTYPE.labels.stardustAmount ?? "", {
        amount: stardustCount(state.economy.stardust),
      }),
    });
    this.station.setOpen(state.mode === "space" && Boolean(state.docked));
    // Each arrival at the start screen shows the offer there, which checks for a new version.
    const screen = this.model.screen;
    const start = screen === "start";
    if (start !== this.startShown) {
      this.startShown = start;
      startScreenShown(start);
    }
    // Play keeps the screen on; the start screen and the Paused card let it sleep.
    const playing = !start && !this.settingsOpen;
    if (playing !== this.screenOn) {
      this.screenOn = playing;
      keepScreenOn(playing);
    }
    this.armBack();
    this.controls.setSettingsButton(state.mode !== "space");
    this.controls.setAchievementsButton(start);
    this.controls.setExitButton(start);
    this.controls.setPause({
      field: this.mapField(),
      inDanger: this.model.inDanger,
      job: this.model.jobObjective,
      map: this.model.map,
      place: enabled ? "flight" : this.model.roomPage ? "room" : null,
      ship: enabled ? this.shipView() : null,
      towing: this.model.towing,
    });
    this.controls.setAchievements(this.model.achievements);
    this.shell.render(state, screen);
    const flightGalaxy = state.mode === "space" ? state.flight?.sector : undefined;
    this.palette = (flightGalaxy && this.galaxyPalettes.get(flightGalaxy)) || this.basePalette;
    const background = this.palette.background;
    if (background !== this.spaceBackground) {
      this.spaceBackground = background;
      this.cameras.main.setBackgroundColor(background);
    }
    const story = this.model.storyView;
    const selected = this.model.selectedGalaxy;
    this.storybook.show(
      story && {
        ...storyPageView(story.page, story.choices, story.canGoBack, story.canSkip),
        run: story.run,
      },
      null,
    );
    const panel = this.model.selectedPosition;
    const ship = this.model.shipPosition;
    this.galaxies.show(
      selected !== null && panel !== null && ship !== null && !this.hideSelector
        ? {
            flight: this.model.routeFlight,
            galaxies: this.routeGalaxies(),
            panel,
            ship,
            stay: this.model.galaxyMapStays,
          }
        : null,
    );
    if (screen !== "start") {
      this.restartCard.close();
    }
  }

  /** Archetypes without a complete loaded frame set keep their vector placeholders. */
  private readEnemyArt(): void {
    this.enemyArt = enemyArt(
      (archetype) => this.cache.json.get(`enemy-jets-${archetype}`),
      (archetype) => this.cache.json.get(`enemy-hardpoints-${archetype}`),
      composedArchetypes(this.partAssets),
      this.shipAssets,
      enemyFrameSets(this.shipAssets),
    );
    for (const { family, prefix, wired } of GALAXY_FAMILIES) {
      const loaded = this.manifest.assets.filter(
        (asset) => asset.family === family && this.textures.exists(asset.id),
      );
      const art = enemyArt(
        (archetype) => this.cache.json.get(`${family}-jets-${archetype}`),
        (archetype) => this.cache.json.get(`${family}-hardpoints-${archetype}`),
        composedArchetypes(this.familyParts.get(family) ?? []),
        loaded,
        enemyFrameSets(loaded, prefix),
        prefix,
      );
      this.familyArts.set(family, new Map([...art].filter(([archetype]) => wired.has(archetype))));
    }
  }

  /**
   * The family the flight's galaxy draws a craft in: its own (Cartwheel's claim jumpers,
   * Andromeda's garnet drones), else Gadget's coral.
   */
  private familyOf(archetype: string): EnemyFamily | undefined {
    const sector = this.model.state.flight?.sector;
    return galaxyFamily(sector === undefined ? undefined : GALAXY_ID[sector], archetype);
  }

  /** A craft's art in its galaxy's family, while that family's frames are loaded. */
  private familyArt(archetype: string): EnemyArt<Asset> | undefined {
    const family = this.familyOf(archetype);
    return family
      ? this.familyArts.get(family.family)?.get(archetype)
      : this.enemyArt.get(archetype);
  }

  /**
   * A heavy's hardpoint bases and turret tops load the first time that archetype is in flight, so
   * their hundreds of frames never delay a screen that shows none. Until they load, the craft
   * keeps its vector placeholder.
   */
  private loadEnemyParts(archetype: string): void {
    const family = this.familyOf(archetype);
    const sector = this.model.state.flight?.sector;
    // Coral parts are in the core manifest; a galaxy family's in its galaxy's, which may not
    // have loaded when the craft first draws.
    const parts = enemyPartsToLoad(
      !family || (sector !== undefined && this.galaxyManifests.has(sector)),
      (id) => this.textures.exists(id),
      family ? (this.familyParts.get(family.family) ?? []) : this.partAssets,
      archetype,
    );
    if (parts === null) {
      return;
    }
    this.partLoads.add(`${family?.family ?? "coral"}:${archetype}`);
    if (parts.length === 0) {
      return;
    }
    for (const part of parts) {
      this.loadSvg(part);
    }
    this.load.once(Loader.Events.COMPLETE, () => {
      this.shipAssets = [
        ...this.shipAssets,
        ...parts.filter((part) => this.textures.exists(part.id)),
      ];
      this.readEnemyArt();
    });
    this.load.start();
  }

  /** The flight's galaxy for the map: its name, its field's background and its fog. */
  private mapField(): MapField | null {
    const sector = this.model.state.mode === "space" ? this.model.state.flight?.sector : undefined;
    if (!sector) {
      return null;
    }
    const palette = this.galaxyPalettes.get(sector) ?? this.basePalette;
    return {
      background: `#${palette.background.toString(16).padStart(6, "0")}`,
      fog: fogColor(palette.environment, palette.environmentDetail),
      name: galaxyCard(sector).name,
    };
  }

  /** Queues an SVG at the current raster scale (svg-rasters.ts). */
  private queueSvg(request: SvgRequest): void {
    this.load.svg(request.key, request.path, this.rasters.request(request));
  }

  /**
   * Rasterises loaded SVGs again at the current raster scale: each loads under a scale-suffixed
   * key, then replaces its texture's image in place, and every image drawing it keeps its display
   * size and origin. A raster for a scale replaced meanwhile is dropped.
   */
  private rasterAgain(requests: readonly SvgRequest[]): void {
    if (requests.length === 0) {
      return;
    }
    const scale = this.rasters.scale;
    for (const request of requests) {
      const raster = `${request.key}@${scale}`;
      if (this.textures.exists(raster)) {
        continue;
      }
      this.load.once(`filecomplete-svg-${raster}`, () => {
        if (scale === this.rasters.scale && this.textures.exists(request.key)) {
          this.replaceImage(request.key, raster);
        }
        this.textures.remove(raster);
      });
      this.load.svg(raster, request.path, request.size(scale));
    }
    this.load.start();
  }

  /** Puts the image of texture from into texture key, keeping every user's display size. */
  private replaceImage(key: string, from: string): void {
    const texture = this.textures.get(key);
    const users = this.children.list.filter(
      (child): child is GameObjects.Image =>
        child instanceof GameObjects.Image && child.texture === texture,
    );
    const sizes = users.map((user) => [user.displayWidth, user.displayHeight] as const);
    const source = texture.source[0]!;
    source.updateSource(this.textures.get(from).getSourceImage() as HTMLImageElement);
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
  private filterTexture(key: string, filter: TextureFilter): void {
    setTextureFilters(this.textures, new Map([[key, filter]]));
  }

  /**
   * Queues a manifest SVG at its display size times the raster scale (vectorRaster), or at its
   * own size times it when it declares none.
   */
  private loadSvg(asset: Asset): void {
    const { displayHeight, displayWidth } = asset;
    this.queueSvg({
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
  private paintInUse(): string | null {
    const paint = this.model.state.economy.paint;
    if (paint === ECONOMY.defaultPaint) {
      return null;
    }
    if (!this.paintLoads.has(paint)) {
      this.paintLoads.add(paint);
      this.loadShipFrames(paintFrames(this.paintAssets, paint));
    }
    return paint;
  }

  /** Loads ship frames after preload; each joins the selectable frames once its texture exists. */
  private loadShipFrames(frames: readonly Asset[]): void {
    if (!frames.length) {
      return;
    }
    for (const frame of frames) {
      this.loadSvg(frame);
    }
    this.load.once(Loader.Events.COMPLETE, () => {
      this.shipAssets = [
        ...this.shipAssets,
        ...frames.filter((frame) => this.textures.exists(frame.id)),
      ];
    });
    this.load.start();
  }

  // Back stays on the game except on the start screen with nothing open, where it is the browser's.
  private armBack(): void {
    setBackArmed(!backReleased(this.startShown, this.settingsOpen));
  }

  private flush(): void {
    const available = writeSave(this.model.save());
    this.shell.setSavingAvailable(available);
    this.savingUnavailable = !available;
  }

  private project(point: Vec): Vec {
    return this.projectLayer(point, 1);
  }

  /**
   * A point of a backdrop layer that keeps the world's layout (art/backdrop.md, Coordinates):
   * projected about the camera's world position times the layer's parallax.
   */
  private projectLayer(point: Vec, parallax: number): Vec {
    const camera = this.model.state.flight?.player ?? { x: 0, y: 0 };
    const x = point.x - camera.x * parallax;
    const y = point.y - camera.y * parallax;
    return { x: SCREEN.width / 2 + x - y, y: SCREEN.height / 2 + (x + y) / 2 };
  }

  private draw(): void {
    const flight = this.model.state.flight;
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
    this.ship.setVisible(Boolean(flight) && this.model.state.mode === "space");
    this.drawBackdropLayer(flight && this.model.state.mode === "space" ? flight.sector : null);
    this.drawBackdropLayers(flight && this.model.state.mode === "space" ? flight : null);
    if (!flight || this.model.state.mode !== "space") {
      // Leaving the flight forgets every seen object.
      this.edgeMarkers.update(null, new Set());
      this.drawKeylines();
      this.drawUseCallout(undefined);
      this.bannerLayer?.place([]);
      return;
    }
    this.light = lightGalaxy(this.lightGalaxies, flight.sector);
    this.drawBackdrop(flight);
    // Dust specks, the debris layer's motion cue at its parallax, in the galaxy's backdropSide.
    const cell = 160;
    const parallax = this.backdropRules?.specks.parallax ?? 1;
    const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
    const gx = Math.floor((flight.player.x * parallax) / cell);
    const gy = Math.floor((flight.player.y * parallax) / cell);
    this.specks = [];
    const speckColor = hexNumber(backdropTint(this.asteroidArt, flight.sector).backdropSide);
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
    this.loadGalaxyArt(flight.sector);
    this.drawCurrents(flight);
    this.drawWhirlpoolProjects(flight);
    this.drawJobs();
    for (const [key, sprite] of this.landmarkSprites) {
      if (!this.landmarksDrawn.has(key)) {
        sprite.destroy();
        this.landmarkSprites.delete(key);
      }
    }
    for (const object of flight.objects) {
      this.drawObject(object);
    }
    this.drawStoryShips(flight);
    this.drawGuidedCalf();
    this.drawRockBreaks();
    this.drawZips();
    this.startRockLoads();
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
      this.drawEffect(
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
      this.drawEffect(glowingBeam(glow, from, to, flash.hit, this.reducedMotion, ms));
      if (flash.hit) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const spark = sparkEffect(to, angle, this.reducedMotion, ms);
        this.drawEffect(spark, this.edges(["hitSpark"], spark));
      }
    }
    this.drawEnemyWeapons(this.enemyWeaponsView(flight));
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
        this.drawEffect(
          shapes,
          this.edges(
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
    this.drawEdgeMarkers(flight);
    this.drawIndicators();
    this.drawFeedback();
    this.ship.setPosition(SCREEN.width / 2, SCREEN.height / 2);
    // Jets and thrust frames share the 1 unit/s thrust threshold.
    const thrusting = Math.hypot(flight.velocity.x, flight.velocity.y) > 1;
    const speed = thrusting ? shipSpeedFraction(PROTOTYPE, flight) : 0;
    const ship = selectPaintedShipAsset(
      this.shipAssets,
      this.paintInUse(),
      !this.shipJets && speed > 0,
      flight.facing,
    );
    this.ship.setTexture(ship?.id ?? "ship");
    this.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
    this.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
    // Authored direction frames already include perspective and must not rotate in screen space.
    this.ship.setRotation(0);
    this.keyline("ship", "player-ship", this.ship);
    const flames: Vec[] = [];
    if (this.shipJets && ship?.directionIndex !== undefined) {
      this.jets.setPosition(this.ship.x, this.ship.y);
      this.jetKeyline.setPosition(this.ship.x, this.ship.y);
      const display = {
        displayHeight: ship.displayHeight ?? 42,
        displayWidth: ship.displayWidth ?? 42,
        pivot: ship.pivot,
      };
      // A light field swaps in Art's dark jet layers, with no halo, keylined with the hull.
      const jets = this.light ? { ...this.shipJets, layers: LIGHT_FIELD.jets.ship } : this.shipJets;
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

    this.drawKeylines();
    this.drawUseCallout(flight);
    this.bannerLayer?.place(this.banners);
  }

  /**
   * The Use callout above the destination Use acts on (art/destinations.md "Use callout"): its
   * action's symbol, O on the pivot's vertical with the tail tip 3 px above the drawn top, fading
   * in and out over 150 ms with cubicOut, at once under reduced motion. It holds its place while
   * it fades out.
   */
  private drawUseCallout(flight: FlightState | null | undefined): void {
    this.useCallout ??= createUseCallout(this, this.rasters.scale).setDepth(USE_CALLOUT_DEPTH);
    const target = flight ? this.model.useTarget : undefined;
    const object =
      target && flight?.objects.find((entry) => entry.id === target.id && entry.kind !== "enemy");
    const now = this.time.now;
    const state = this.calloutState;
    if (object && target) {
      if (!state.showing || state.id !== target.id) {
        state.edge = state.showing ? now : now - this.calloutRemaining(now);
        state.showing = true;
        state.id = target.id;
      }
      const point = this.project(object);
      const top = this.drawnTop(target.id, point);
      state.at = { x: point.x, y: point.y - useCalloutLift(top) };
      this.useCallout.setFrame(target.action);
    } else if (state.showing) {
      state.edge = now - this.calloutRemaining(now);
      state.showing = false;
    }
    const alpha = useCalloutAlpha(now - state.edge, this.reducedMotion, state.showing);
    this.useCallout
      .setPosition(state.at.x, state.at.y)
      .setAlpha(alpha)
      .setVisible(alpha > 0);
  }

  /**
   * How far into the opposite fade the callout's current alpha already is, so a reversed fade
   * continues from where it stands: fading in, 1 - (1 - t)^3 = a; fading out, (1 - t)^3 = a.
   */
  private calloutRemaining(now: number): number {
    const state = this.calloutState;
    const alpha = useCalloutAlpha(now - state.edge, this.reducedMotion, state.showing);
    const t = state.showing ? 1 - Math.cbrt(alpha) : 1 - Math.cbrt(1 - alpha);
    return t * USE_CALLOUT_FADE_MS;
  }

  /**
   * A drawn object's top in display px above its pivot at `point`: the topmost pixel at alpha 0.5
   * or more over its sprites and every frame they have shown this flight.
   */
  private drawnTop(id: string, point: Vec): number {
    let top = this.drawnTops.get(id) ?? 0;
    for (const [key, sprite] of this.enemySprites) {
      if ((key === id || key.startsWith(`${id}#`)) && sprite.visible) {
        const fraction = this.frameTop(sprite.frame);
        const drawn =
          sprite.y - sprite.originY * sprite.displayHeight + fraction * sprite.displayHeight;
        top = Math.max(top, point.y - drawn);
      }
    }
    this.drawnTops.set(id, top);
    return top;
  }

  /** The topmost row of a frame with alpha 0.5 or more, as a fraction of its height. */
  private frameTop(frame: Textures.Frame): number {
    const key = `${frame.texture.key}#${String(frame.name)}@${frame.cutWidth}`;
    const known = this.frameTops.get(key);
    if (known !== undefined) {
      return known;
    }
    const width = Math.max(1, frame.cutWidth);
    const height = Math.max(1, frame.cutHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let row = height;
    if (context) {
      context.drawImage(
        frame.source.image as CanvasImageSource,
        frame.cutX,
        frame.cutY,
        width,
        height,
        0,
        0,
        width,
        height,
      );
      const data = context.getImageData(0, 0, width, height).data;
      row = alphaTopRow(data, width, height, KEYLINE_ALPHA);
    }
    const fraction = row / height;
    this.frameTops.set(key, fraction);
    return fraction;
  }

  /** Records a drawn fly-through object, which Ada draws above while she overlaps it. */
  private passes(sprite: Placed & { readonly depth: number }): void {
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

  /**
   * On a light field, records a sprite of a keylined kind (`lightField.keylined`) for this
   * frame's ink keyline.
   */
  private keyline(kind: string, key: string, sprite: GameObjects.Image, depth?: number): void {
    if (
      this.light &&
      (LIGHT_FIELD.keylined.includes(kind) || LIGHT_FIELD.destinationKeyline.kinds.includes(kind))
    ) {
      this.keyed.push({ depth, key, sprite, width: keylineWidth(LIGHT_FIELD, kind) });
    }
  }

  /**
   * Each keylined sprite's ink keyline: eight copies of its frame's ink silhouette offset by
   * its kind's keyline width in every direction (a square kernel), just beneath it in its depth
   * slot (or at its group's keyline depth), at its alpha. Keylines not drawn this frame are
   * destroyed.
   */
  private drawKeylines(): void {
    const used = new Set<string>();
    for (const { depth, key, sprite, width } of this.keyed) {
      const offsets = keylineOffsets(width);
      if (!sprite.visible) {
        continue;
      }
      used.add(key);
      const silhouette = this.keylineSilhouette(sprite);
      if (!silhouette) {
        continue;
      }
      let copies = this.keylines.get(key);
      if (!copies) {
        copies = offsets.map(() => this.add.image(0, 0, silhouette));
        this.keylines.set(key, copies);
      }
      copies.forEach((copy, index) => {
        copy
          .setTexture(silhouette)
          .setOrigin(sprite.originX, sprite.originY)
          .setDisplaySize(sprite.displayWidth, sprite.displayHeight)
          .setPosition(sprite.x + offsets[index]!.x, sprite.y + offsets[index]!.y)
          .setDepth(depth ?? sprite.depth - 2e-6)
          .setAlpha(sprite.alpha)
          .setVisible(true);
      });
    }
    for (const [key, copies] of this.keylines) {
      if (!used.has(key)) {
        for (const copy of copies) {
          copy.destroy();
        }
        this.keylines.delete(key);
      }
    }
    // Every copy now draws its frame's current silhouette; replaced ones nothing draws go.
    this.silhouettes.sweep(
      (key) =>
        this.children.list.some(
          (child) => child instanceof GameObjects.Image && child.texture.key === key,
        ),
      (key) => this.textures.remove(key),
    );
  }

  /**
   * A sprite frame's keyline source, made once per frame: opaque ink where the frame's alpha is
   * at least KEYLINE_ALPHA, clear elsewhere, so the grown edge is crisp.
   */
  private keylineSilhouette(sprite: { frame: Textures.Frame }): string | undefined {
    const frame = sprite.frame;
    // Keyed by the frame's raster size too, so a frame rasterised again gets a new silhouette and
    // the old one is swept once nothing draws it (silhouettes.ts).
    const traced = `${frame.texture.key}#${String(frame.name)}`;
    const key = `keyline:${traced}@${frame.cutWidth}`;
    this.silhouettes.use(traced, key);
    if (this.textures.exists(key)) {
      return key;
    }
    const width = Math.max(1, frame.cutWidth);
    const height = Math.max(1, frame.cutHeight);
    const canvas = this.textures.createCanvas(key, width, height);
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext();
    context.drawImage(
      frame.source.image as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      width,
      height,
      0,
      0,
      width,
      height,
    );
    const pixels = context.getImageData(0, 0, width, height);
    thresholdSilhouette(LIGHT_FIELD.ink, KEYLINE_ALPHA, pixels.data);
    context.putImageData(pixels, 0, 0);
    canvas.refresh();
    // The silhouette samples as its source does.
    this.filterTexture(key, frame.source.scaleMode === ScaleModes.NEAREST ? "nearest" : "linear");
    return key;
  }

  /** On a light field, the ink edges beneath an effect whose kind takes them (`lightField.effects`). */
  private edges(kinds: readonly string[], shapes: readonly EffectShape[]): EffectShape[] {
    return this.light && kinds.some((kind) => LIGHT_FIELD.effects.includes(kind))
      ? inkEdges(LIGHT_FIELD.ink, LIGHT_FIELD.keyline, shapes)
      : [];
  }

  private drawEnemy(point: Vec, object: SpaceObject): void {
    const enemy = object.enemy;
    if (!enemy) {
      this.ink.strokeTriangle(
        point.x,
        point.y + object.radius,
        point.x - object.radius,
        point.y - object.radius,
        point.x + object.radius,
        point.y - object.radius,
      );
      return;
    }
    const definition = enemyDefinition(this.model.state.flight!.sector, enemy.archetype);
    const art = this.familyArt(enemy.archetype);
    if (art) {
      this.drawEnemySprite(art, point, object.id, enemy);
      return;
    }
    const width = definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2;
    // Hull and hardpoints share the hull's rotating local frame.
    const local = (x: number, y: number): Vec => {
      const offset = hullOffset(enemy.facing, { x: x * width, y: y * width });
      return this.project({ x: object.x + offset.x, y: object.y + offset.y });
    };
    const large = enemy.archetype === "capital";
    const frigate = enemy.archetype === "frigate";
    const pack = enemy.packId !== null;
    const hull: [number, number][] = large
      ? [
          [-0.28, -0.5],
          [0.28, -0.5],
          [0.5, -0.25],
          [0.5, 0.4],
          [0.25, 0.5],
          [-0.25, 0.5],
          [-0.5, 0.4],
          [-0.5, -0.25],
        ]
      : frigate
        ? [
            [0, -0.6],
            [0.42, -0.25],
            [0.42, 0.4],
            [0, 0.55],
            [-0.42, 0.4],
            [-0.42, -0.25],
          ]
        : pack
          ? [
              [0, -0.6],
              [0.5, 0],
              [0.32, 0.4],
              [0, 0.2],
              [-0.32, 0.4],
              [-0.5, 0],
            ]
          : [
              [0, -0.6],
              [0.5, 0.45],
              [0, 0.2],
              [-0.5, 0.45],
            ];
    const polygon = hull.map(([x, y]) => {
      const point = local(x, y);
      return new PhaserMath.Vector2(point.x, point.y);
    });
    this.ink.fillStyle(this.palette.environment);
    this.ink.fillPoints(polygon, true);
    this.ink.lineStyle(1.5, this.palette.obstacle);
    this.ink.strokePoints(polygon, true);
    if (large) {
      const a = local(-0.16, -0.5);
      const b = local(-0.16, 0.5);
      const c = local(0.16, -0.5);
      const d = local(0.16, 0.5);
      this.ink.lineStyle(1, this.palette.environmentDetail);
      this.ink.lineBetween(a.x, a.y, b.x, b.y);
      this.ink.lineBetween(c.x, c.y, d.x, d.y);
    }
    if (pack) {
      this.ink.lineStyle(1, this.palette.obstacle);
      this.ink.strokeCircle(point.x, point.y, 3);
    }
    for (const part of definition.hardpoints) {
      const at = local(part.offset.x, part.offset.y);
      const hp = enemy.hardpoints.find((value) => value.id === part.id)?.hp ?? 0;
      const size = Math.max(7, Math.min(18, width * 0.065));
      const accent = part.kind === "weapon" ? this.palette.weapon : this.palette.shipHardpoint;
      this.ink.fillStyle(hp > 0 ? this.palette.environment : this.spaceBackground);
      this.ink.lineStyle(2, hp > 0 ? accent : this.palette.environmentDetail);
      if (part.kind === "command") {
        this.ink.fillTriangle(
          at.x,
          at.y - size,
          at.x - size,
          at.y + size,
          at.x + size,
          at.y + size,
        );
        this.ink.strokeTriangle(
          at.x,
          at.y - size,
          at.x - size,
          at.y + size,
          at.x + size,
          at.y + size,
        );
      } else if (part.kind === "engine") {
        this.ink.fillRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
        this.ink.strokeRect(at.x - size, at.y - size * 0.6, size * 2, size * 1.2);
        if (hp > 0) {
          this.ink.lineBetween(at.x - size / 2, at.y + size, at.x - size / 2, at.y + size * 1.5);
          this.ink.lineBetween(at.x + size / 2, at.y + size, at.x + size / 2, at.y + size * 1.5);
        }
      } else {
        this.ink.fillCircle(at.x, at.y, size);
        this.ink.strokeCircle(at.x, at.y, size);
        this.ink.lineBetween(at.x, at.y, at.x, at.y - size * 1.5);
      }
      if (hp <= 0) {
        this.ink.lineBetween(at.x - size, at.y - size, at.x + size, at.y + size);
        this.ink.lineBetween(at.x + size, at.y - size, at.x - size, at.y + size);
      }
      this.ink.lineStyle(3, this.palette.environmentDetail);
      this.ink.lineBetween(at.x - size, at.y + size + 5, at.x + size, at.y + size + 5);
      if (hp > 0) {
        this.ink.lineStyle(3, accent);
        this.ink.lineBetween(
          at.x - size,
          at.y + size + 5,
          at.x - size + size * 2 * Math.min(1, hp / part.hp),
          at.y + size + 5,
        );
      }
    }
  }

  /**
   * Authored frames already include perspective; jets are not clipped to the frame. A composed
   * craft draws its hull and hardpoint bases in the heading's layer order with intact turret
   * tops at their aim, a hit hardpoint flashing white, and jets only from intact engines. A
   * disabled heavy shows the Disabled banner above every layer; a salvaged one draws dimmed as
   * one group with no jets.
   */
  private drawEnemySprite(
    art: EnemyArt<Asset>,
    point: Vec,
    id: string,
    enemy: NonNullable<SpaceObject["enemy"]>,
  ): void {
    const frame = selectEnemyFrame(art, enemy.facing);
    const state = (hardpoint: string) => enemy.hardpoints.find((part) => part.id === hardpoint);
    // A turret mount without hardpoint state, such as the retaliator's, aims with the hull
    // weapon and stands while the hull does. The galaxy's route position picks the mount tier.
    const sector = this.model.state.flight?.sector;
    const pose: PartPose = {
      aim: (hardpoint) => state(hardpoint)?.aim ?? enemy.aim ?? enemy.facing,
      intact: (hardpoint) => (state(hardpoint)?.hp ?? 1) > 0,
      position: sector === undefined ? 1 : ROUTE_POSITION[sector],
    };
    const sprites = composeEnemy(art, pose, frame);
    if (enemy.salvaged) {
      this.drawSalvaged(id, enemy.archetype, sprites, point);
      return;
    }
    const banner = showsBanner(enemy) ? bannerOffset(art, frame) : undefined;
    if (banner) {
      this.banners.push({ at: { x: point.x + banner.x, y: point.y + banner.y }, id });
    }
    sprites.forEach((part, index) => {
      const key = part.hardpoint === null ? id : `${id}#${part.layer}:${part.hardpoint}`;
      const sprite = this.objectSprite(key, part.frame.id)
        .setDisplaySize(part.frame.displayWidth!, part.frame.displayHeight!)
        .setOrigin(part.frame.pivot.x, part.frame.pivot.y)
        .setPosition(point.x + part.offset.x, point.y + part.offset.y)
        // Parts keep the heading's layer order within the hull's screen depth.
        .setDepth(playDepth(point.y) + index * 1e-7);
      this.keyline(enemy.archetype, key, sprite);
      const hp = part.hardpoint === null ? undefined : state(part.hardpoint)?.hp;
      if (
        hp !== undefined &&
        this.hitFlashes.observe(`${id}#${part.layer}:${part.hardpoint}`, hp, this.time.now)
      ) {
        sprite.setTint(0xffffff).setTintMode(TintModes.FILL);
      }
    });
    const speed = enemySpeedFraction(enemyCatalog[enemy.archetype], enemy);
    // A light field swaps in Art's dark enemy jet layers.
    const jets =
      this.light && art.jets
        ? { ...art, jets: { ...art.jets, layers: LIGHT_FIELD.jets.enemy } }
        : art;
    for (const { alpha, color, points } of enemyJetTriangles(jets, frame, speed, pose.intact)) {
      this.enemyJets.fillStyle(color, alpha);
      this.enemyJets.fillTriangle(
        point.x + points[0].x,
        point.y + points[0].y,
        point.x + points[1].x,
        point.y + points[1].y,
        point.x + points[2].x,
        point.y + points[2].y,
      );
    }
  }

  /**
   * A salvaged heavy (art/heavies.md "Salvaged dimming"): its composed frame, with its keyline on
   * a light field, drawn into one texture at the raster scale, mixed toward its grey and shown at
   * the group alpha, so overlapping layers never show through each other.
   */
  private drawSalvaged(
    id: string,
    archetype: string,
    sprites: readonly PartSprite<Asset>[],
    point: Vec,
  ): void {
    const grow = this.light && LIGHT_FIELD.keylined.includes(archetype) ? LIGHT_FIELD.keyline : 0;
    const bounds = spritesBounds(sprites);
    const left = Math.floor(point.x + bounds.left - grow - 1);
    const top = Math.floor(point.y + bounds.top - grow - 1);
    const width = Math.ceil(point.x + bounds.right + grow + 1) - left;
    const height = Math.ceil(point.y + bounds.bottom + grow + 1) - top;
    const r = this.rasters.scale;
    const texels = { height: densityTexels(r, height), width: densityTexels(r, width) };
    let group = this.salvagedGroups.get(id);
    if (!group || group.width !== texels.width || group.height !== texels.height) {
      group?.destroy();
      group = this.add.renderTexture(0, 0, texels.width, texels.height).setOrigin(0, 0);
      this.filterTexture(group.texture.key, "linear");
      group.enableFilters().filters?.internal.addColorMatrix().colorMatrix.set(salvagedMatrix());
      this.salvagedGroups.set(id, group);
    }
    group.clear();
    const stamps = sprites.map((part) => {
      const frame = this.textures.getFrame(part.frame.id);
      return {
        config: {
          originX: part.frame.pivot.x,
          originY: part.frame.pivot.y,
          scaleX: (r * part.frame.displayWidth!) / frame.width,
          scaleY: (r * part.frame.displayHeight!) / frame.height,
        },
        frame,
        x: point.x + part.offset.x - left,
        y: point.y + part.offset.y - top,
      };
    });
    if (grow > 0) {
      for (const { config, frame, x, y } of stamps) {
        const silhouette = this.keylineSilhouette({ frame });
        for (const offset of silhouette ? keylineOffsets(grow) : []) {
          group.stamp(silhouette!, undefined, r * (x + offset.x), r * (y + offset.y), config);
        }
      }
    }
    for (const { config, frame, x, y } of stamps) {
      group.stamp(frame.texture.key, undefined, r * x, r * y, config);
    }
    group.render();
    group
      .setDisplaySize(width, height)
      .setPosition(left, top)
      .setDepth(playDepth(point.y))
      .setAlpha(SALVAGED.alpha)
      .setVisible(true);
    this.passes(group);
  }

  /**
   * Cartwheel's buoys and story ships around the hub. Each craft draws Art's frame for the
   * nearest of its 16 headings, with its speed jets while it moves; a craft whose frames are not
   * loaded yet draws as a vector dart.
   */
  private drawStoryShips(flight: FlightState): void {
    const hub =
      flight.sector === CARTWHEEL_STORY_SHIPS.sector
        ? flight.objects.find((object) => object.kind === "destination" && object.id === "hub")
        : undefined;
    if (!hub) {
      return;
    }
    if (this.buoyArt) {
      for (const [group, offset] of Object.entries(CARTWHEEL_STORY_SHIPS.buoys)) {
        const at = { x: hub.x + offset.x, y: hub.y + offset.y };
        const point = this.project(at);
        const frame = stationFrame(this.buoyArt, this.reducedMotion, this.time.now);
        this.passes(
          this.objectSprite(hubBuoyKey(hub.id, group), frame.id)
            .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
            .setOrigin(frame.pivot.x, frame.pivot.y)
            .setPosition(point.x, point.y)
            .setDepth(playDepth(point.y)),
        );
      }
    }
    const progress = this.model.state.progress[flight.sector];
    for (const ship of storyShips(
      hub,
      progress,
      { bay: hubBay(progress), noses: this.storyNoses },
      flight.storyScene,
      flight.time,
    )) {
      const point = this.project(ship);
      const art = this.craftArt.get(STORY_SHIP_CRAFT[ship.id]);
      if (art) {
        const frame = selectEnemyFrame(art, ship.heading);
        this.passes(
          this.objectSprite(hubStoryKey(hub.id, ship.id), frame.id)
            .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
            .setOrigin(frame.pivot.x, frame.pivot.y)
            .setPosition(point.x, point.y)
            .setDepth(playDepth(point.y)),
        );
        for (const { alpha, color, points } of enemyJetTriangles(art, frame, ship.thrust ? 1 : 0)) {
          this.enemyJets.fillStyle(color, alpha);
          this.enemyJets.fillTriangle(
            point.x + points[0].x,
            point.y + points[0].y,
            point.x + points[1].x,
            point.y + points[1].y,
            point.x + points[2].x,
            point.y + points[2].y,
          );
        }
        continue;
      }
      const heading = drawnHeading(ship.heading);
      const at = (along: number, across: number) =>
        this.project({
          x: ship.x + heading.x * along - heading.y * across,
          y: ship.y + heading.y * along + heading.x * across,
        });
      const nose = at(10, 0);
      const left = at(-8, 7);
      const right = at(-8, -7);
      this.ink.fillStyle(ship.id === "blocker" ? STORY_SHIP.blocker : STORY_SHIP.hull);
      this.ink.fillTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);
      this.ink.lineStyle(1, this.palette.environmentDetail);
      this.ink.strokeTriangle(nose.x, nose.y, left.x, left.y, right.x, right.y);
    }
  }

  /**
   * Whirlpool's current streaks from Art's spec (current-streaks.ts): chevrons on the world
   * plane in each lane, moving with the lane's flow and fading with it, on the field above the
   * specks and backdrop rocks and below every play object.
   */
  private drawCurrents(flight: FlightState): void {
    const spec = this.streakSpec;
    if (!spec) {
      return;
    }
    const reach = Math.max(SCREEN.width, SCREEN.height) * 1.5;
    const color = hexNumber(spec.color);
    const margin = 24;
    const near = (point: Vec) => {
      const at = this.project(point);
      return (
        at.x > -margin &&
        at.y > -margin &&
        at.x < SCREEN.width + margin &&
        at.y < SCREEN.height + margin
      );
    };
    for (const current of currentsNear(flight.sector, reach, flight.player)) {
      const marks = streakMarks(
        spec,
        current,
        CURRENTS.peakFlow,
        (arc, offset) => flowFraction(current, arc, offset),
        flight.time,
        this.reducedMotion,
        near,
      );
      for (const mark of marks) {
        this.ink.lineStyle(mark.width, color, mark.alpha);
        this.ink.strokePoints(
          mark.points.map((point) => {
            const at = this.project(point);
            return new PhaserMath.Vector2(at.x, at.y);
          }),
          false,
          false,
        );
      }
    }
  }

  /**
   * Whirlpool's funded world changes (art/whirlpool.md "Project world changes"): the nursery
   * beacon at the family with its light pool on the field below every play object, and the
   * current-map buoys along both edges of the whales' current. Both are passable decoration that
   * Ada draws in front of while she overlaps them. A change not yet revealed stays unseen until
   * the first frame its site is on screen in live flight, then fades in (reduced motion cuts).
   */
  private drawWhirlpoolProjects(flight: FlightState): void {
    const art = this.whirlpoolProjects;
    const family = flight.objects.find(
      (object) => object.kind === "destination" && object.id === "family",
    );
    if (!art || !family) {
      this.pruneBuoys(new Set());
      return;
    }
    const funded = new Map(
      this.model.worldChanges(flight.sector).map((change) => [change.project, change]),
    );
    const now = this.flightClock;
    const revealMs = this.projectArt?.revealMs ?? 0;
    // A funded change's opacity this frame, recording its reveal the first frame its site shows;
    // undefined while it stays unseen.
    const alphaOf = (project: string, onScreen: boolean): number | undefined => {
      const change = funded.get(project);
      if (!change) {
        return undefined;
      }
      if (!change.revealed) {
        if (!onScreen || !this.flightLive) {
          return undefined;
        }
        this.model.revealWorldChange(flight.sector, project);
        if (!this.reducedMotion) {
          this.reveals.set(project, now);
        }
      }
      const start = this.reveals.get(project);
      if (start === undefined) {
        return 1;
      }
      if (now - start >= revealMs) {
        this.reveals.delete(project);
        return 1;
      }
      return revealAlpha(revealMs, now - start);
    };
    const beacon = art.nurseryBeacon;
    if (beacon) {
      const index = nurseryFrame(art, beacon, this.reducedMotion, this.time.now);
      const frame = beacon.frames[index];
      const point = this.project({ x: family.x + beacon.offset.x, y: family.y + beacon.offset.y });
      const rings = poolRings(beacon, family, index);
      const pool = this.project(rings[0]!.centre);
      // The outermost ring bounds the pool, which reaches past the lantern.
      const reach = Math.max(...rings.map(({ radius }) => radius));
      const onScreen =
        boundsOnScreen(SCREEN, point, frameBounds(frame)) ||
        boundsOnScreen(SCREEN, pool, {
          bottom: reach / Math.SQRT2,
          left: -reach * Math.SQRT2,
          right: reach * Math.SQRT2,
          top: -reach / Math.SQRT2,
        });
      const alpha = alphaOf("nurseryBeacon", onScreen);
      if (alpha !== undefined) {
        const color = hexNumber(beacon.pool.color);
        for (const ring of rings) {
          this.ink.fillStyle(color, ring.alpha * alpha);
          // A world circle on the projected plane: sqrt 2 r across and r / sqrt 2 down.
          this.ink.fillEllipse(
            pool.x,
            pool.y,
            2 * Math.SQRT2 * ring.radius,
            Math.SQRT2 * ring.radius,
          );
        }
        const sprite = this.objectSprite(partKey(family.id, "nurseryBeacon"), frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y))
          .setAlpha(alpha);
        this.passes(sprite);
      }
    }
    const buoys = art.currentBuoys;
    const drawn = new Set<string>();
    if (buoys) {
      if (
        this.whalesCurrentFor?.family.x !== family.x ||
        this.whalesCurrentFor.family.y !== family.y
      ) {
        this.whalesCurrentFor = {
          current: whalesCurrent(flight.sector, family),
          family: { x: family.x, y: family.y },
        };
      }
      const current = this.whalesCurrentFor.current;
      const visible = current
        ? buoyPlaces(buoys, current)
            .map((place) => ({
              ...place,
              frame:
                buoys.frames[buoyFrame(art, buoys, place.k, this.reducedMotion, this.time.now)],
              screen: this.project(place.point),
            }))
            .filter(({ frame, screen }) => boundsOnScreen(SCREEN, screen, frameBounds(frame)))
        : [];
      const alpha = alphaOf("currentBuoys", visible.length > 0);
      for (const { frame, k, screen, side } of alpha === undefined ? [] : visible) {
        const key = `${current!.id}:${side}:${k}`;
        drawn.add(key);
        let sprite = this.buoySprites.get(key);
        if (!sprite) {
          sprite = this.add.image(0, 0, frame.id);
          this.buoySprites.set(key, sprite);
        }
        sprite
          .setTexture(frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(screen.x, screen.y)
          .setDepth(playDepth(screen.y))
          .setAlpha(alpha!)
          .setVisible(true);
        this.passes(sprite);
      }
    }
    this.pruneBuoys(drawn);
  }

  /** Destroys the buoy sprites not drawn this frame. */
  private pruneBuoys(drawn: ReadonlySet<string>): void {
    for (const [key, sprite] of this.buoySprites) {
      if (!drawn.has(key)) {
        sprite.destroy();
        this.buoySprites.delete(key);
      }
    }
  }

  /**
   * A marker at the game area's edge toward each seen enemy, heavy and station off screen and
   * within range (model/edge-markers.ts); a direction indicator on the same object wins. Discs in
   * the palette's threat, the station diamond in pointOfInterest; a light field adds an ink outline
   * (lightField.markerOutline) under each, as the indicators' ink does.
   */
  private drawEdgeMarkers(flight: FlightState): void {
    const indicated = new Set(this.model.indicatorTargets.map(({ id }) => id));
    const centre = this.project(flight.player);
    const outline = LIGHT_FIELD.markerOutline;
    for (const marker of this.edgeMarkers.update(flight, indicated)) {
      // The outermost drawn pixel, the ink outline included on a light field, sits 1 in.
      const at = edgePoint(
        edgeMarkerInset(this.light ? outline : 0, marker.kind),
        centre,
        this.project(marker),
      );
      if (marker.kind === "station") {
        const { diamond, stroke } = EDGE_MARKER_GLYPHS.station;
        // The stroke sits inside the diamond's extent.
        const half = (diamond - stroke) / 2;
        const points = [
          new PhaserMath.Vector2(at.x, at.y - half),
          new PhaserMath.Vector2(at.x + half, at.y),
          new PhaserMath.Vector2(at.x, at.y + half),
          new PhaserMath.Vector2(at.x - half, at.y),
        ];
        if (this.light) {
          this.edgeMarkerInk.lineStyle(stroke + 2 * outline, LIGHT_FIELD.ink, 1);
          this.edgeMarkerInk.strokePoints(points, true, true);
        }
        this.edgeMarkerInk.lineStyle(stroke, this.palette.pointOfInterest, 1);
        this.edgeMarkerInk.strokePoints(points, true, true);
        continue;
      }
      const radius = EDGE_MARKER_GLYPHS[marker.kind].disc / 2;
      if (this.light) {
        this.edgeMarkerInk.fillStyle(LIGHT_FIELD.ink, 1);
        this.edgeMarkerInk.fillCircle(at.x, at.y, radius + outline);
      }
      this.edgeMarkerInk.fillStyle(this.palette.threat, 1);
      this.edgeMarkerInk.fillCircle(at.x, at.y, radius);
    }
  }

  /**
   * An arrow at the view's edge toward each marked place off screen, at any distance
   * (model/indicators.ts), and the holodisk's placeholder beacon ring while it is on screen.
   */
  private drawIndicators(): void {
    const cx = SCREEN.width / 2;
    const cy = SCREEN.height / 2;
    for (const target of this.model.indicatorTargets) {
      const point = this.project(target);
      const onScreen =
        point.x >= 0 && point.y >= 0 && point.x <= SCREEN.width && point.y <= SCREEN.height;
      if (onScreen) {
        if (target.kind === "holodisk") {
          // Placeholder until Art's beacon ring sprite.
          const pulse = (this.time.now / 1000) % 1;
          this.overlay.lineStyle(2, this.palette.pointOfInterest, 0.9 - pulse * 0.6);
          this.overlay.strokeCircle(point.x, point.y, 24 + pulse * 16);
        }
        continue;
      }
      const dx = point.x - cx;
      const dy = point.y - cy;
      const length = Math.hypot(dx, dy);
      const ux = dx / length;
      const uy = dy / length;
      const scale = Math.min((cx - 44) / Math.abs(dx), (cy - 100) / Math.abs(dy));
      const x = cx + dx * Math.max(0, scale);
      const y = cy + dy * Math.max(0, scale);
      const arrow = [
        { x: x + ux * 8, y: y + uy * 8 },
        { x: x - ux * 5 - uy * 5, y: y - uy * 5 + ux * 5 },
        { x: x - ux * 5 + uy * 5, y: y - uy * 5 - ux * 5 },
      ] as const;
      const ring = { x: x - ux * 13, y: y - uy * 13 };
      if (this.light) {
        this.drawIndicatorInk(arrow, ring);
      }
      this.overlay.lineStyle(2, this.palette.pointOfInterest, 0.8);
      this.overlay.strokeTriangle(
        arrow[0].x,
        arrow[0].y,
        arrow[1].x,
        arrow[1].y,
        arrow[2].x,
        arrow[2].y,
      );
      this.overlay.strokeCircle(ring.x, ring.y, 3);
    }
  }

  /**
   * A light field's ink stroke under an indicator (`lightField.indicatorStroke`), round joined.
   * It draws opaque on a layer at alpha 0.8, so the joins do not stack.
   */
  private drawIndicatorInk(arrow: readonly [Vec, Vec, Vec], ring: Vec): void {
    const width = LIGHT_FIELD.indicatorStroke;
    const ink = this.indicatorInk.setAlpha(0.8);
    ink.lineStyle(width, LIGHT_FIELD.ink, 1);
    ink.strokeTriangle(arrow[0].x, arrow[0].y, arrow[1].x, arrow[1].y, arrow[2].x, arrow[2].y);
    ink.strokeCircle(ring.x, ring.y, 3);
    ink.fillStyle(LIGHT_FIELD.ink, 1);
    for (const corner of arrow) {
      ink.fillCircle(corner.x, corner.y, width / 2);
    }
  }

  /**
   * Landmarks, a rescue's craft on its tow line, a hunt's search area and its lost item's glint
   * (gameplay/quests.md, art/jobs.md). Landmarks and the search rim lie on the ground layer under
   * play objects, and Ada flies through the landmarks; a part whose art is missing keeps its
   * placeholder.
   */
  private drawJobs(): void {
    const scenery = this.model.jobScenery;
    const sector = this.model.state.flight?.sector;
    const art = this.jobArt;
    const margin = 200;
    const near = (point: Vec) =>
      point.x >= -margin &&
      point.y >= -margin &&
      point.x <= SCREEN.width + margin &&
      point.y <= SCREEN.height + margin;
    const pulse = this.reducedMotion ? 0.5 : (this.time.now / 1200) % 1;
    for (const landmark of scenery.landmarks) {
      const point = this.project(landmark);
      if (!near(point)) {
        continue;
      }
      const key = `landmark:${landmark.x},${landmark.y}`;
      if (landmark.kind === "nebula" && art?.nebula && sector) {
        art.nebula.forEach((layer, index) =>
          this.drawLandmarkLayer(`${key}#${index}`, layer.frame, point, index, {
            ...(layer.keyline ? { keyline: layer.keyline } : {}),
            ...(layer.tint ? { tint: nebulaTint(art, sector, layer.tint) } : {}),
          }),
        );
      } else if (landmark.kind === "wreck" && art?.wreck) {
        art.wreck.forEach((layer, index) =>
          this.drawLandmarkLayer(`${key}#${index}`, layer.frame, point, index, {
            ...(layer.keyline ? { keyline: layer.keyline } : {}),
          }),
        );
      } else if (landmark.kind === "beacon" && art?.beacon) {
        const frame =
          art.beacon.frames[beaconLandmarkFrame(art.beacon, this.reducedMotion, this.time.now)];
        this.drawLandmarkLayer(key, frame, point, 0, {
          ...(art.beacon.keyline ? { keyline: art.beacon.keyline } : {}),
        });
      } else if (landmark.kind === "nebula") {
        this.ink.fillStyle(this.palette.environmentDetail, 0.22);
        this.ink.fillEllipse(point.x, point.y, 220, 110);
        this.ink.fillEllipse(point.x + 46, point.y - 16, 130, 64);
        this.ink.fillEllipse(point.x - 52, point.y + 12, 110, 52);
      } else if (landmark.kind === "wreck") {
        this.ink.lineStyle(2, this.palette.environmentDetail, 0.9);
        const hull = [
          [-34, 4],
          [-10, -12],
          [18, -8],
          [4, 2],
          [30, 12],
          [-6, 16],
        ].map(([x, y]) => new PhaserMath.Vector2(point.x + x!, point.y + y!));
        this.ink.strokePoints(hull, true);
      } else {
        this.ink.fillStyle(this.palette.pointOfInterest, 0.9);
        this.ink.fillCircle(point.x, point.y, 4);
        this.ink.lineStyle(1, this.palette.pointOfInterest, 0.7 - pulse * 0.5);
        this.ink.strokeCircle(point.x, point.y, 10 + pulse * 18);
      }
    }
    if (scenery.area) {
      const { radius, x, y } = scenery.area;
      const points = Array.from({ length: 96 }, (_, index) => {
        const angle = (index / 96) * Math.PI * 2;
        return this.project({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
      });
      const rim = art?.searchArea;
      if (rim) {
        const runs = dashes(points, rim.dash);
        const stroke = (width: number, colour: number, alpha: number) => {
          this.ink.lineStyle(width, colour, alpha);
          for (const run of runs) {
            this.ink.strokePoints(
              run.map(({ x: px, y: py }) => new PhaserMath.Vector2(px, py)),
              false,
              false,
            );
          }
        };
        // On a light field the rim draws over an ink dash on the same path.
        if (this.light) {
          stroke(rim.lightInk.width, LIGHT_FIELD.ink, rim.lightInk.alpha);
        }
        stroke(rim.width, this.palette.pointOfInterest, rim.alpha);
      } else {
        this.ink.lineStyle(1, this.palette.pointOfInterest, 0.45);
        this.ink.strokePoints(
          points.map(({ x: px, y: py }) => new PhaserMath.Vector2(px, py)),
          true,
        );
      }
    }
    if (scenery.craft) {
      this.drawTow(scenery.craft, scenery.towing);
    }
    if (scenery.glint) {
      const glint = this.project(scenery.glint);
      const sprite = art?.glint;
      if (sprite) {
        const ping = glintPing(sprite, this.reducedMotion, this.time.now);
        if (ping) {
          // The ping is on the world plane, under the glint; a light field draws it over ink.
          if (this.light) {
            this.ink.lineStyle(sprite.ping.lightInk, LIGHT_FIELD.ink, ping.alpha);
            this.ink.strokeEllipse(glint.x, glint.y, ping.width, ping.height);
          }
          this.ink.lineStyle(sprite.ping.width, this.palette.pointOfInterest, ping.alpha);
          this.ink.strokeEllipse(glint.x, glint.y, ping.width, ping.height);
        }
        this.glintSprite ??= this.add.image(0, 0, sprite.asset.id);
        const image = this.glintSprite
          .setTexture(sprite.asset.id, glintFrame(sprite, this.reducedMotion, this.time.now))
          .setDisplaySize(sprite.asset.displayWidth!, sprite.asset.displayHeight!)
          .setOrigin(sprite.asset.pivot.x, sprite.asset.pivot.y)
          .setPosition(glint.x, glint.y)
          .setDepth(playDepth(glint.y))
          .setVisible(true);
        if (sprite.keyline) {
          this.keyline(sprite.keyline, "hunt-glint", image);
        }
      } else {
        const size = 4 + pulse * 4;
        this.overlay.lineStyle(2, this.palette.active, 1 - pulse * 0.5);
        this.overlay.lineBetween(glint.x - size, glint.y, glint.x + size, glint.y);
        this.overlay.lineBetween(glint.x, glint.y - size, glint.x, glint.y + size);
      }
    }
  }

  /**
   * One landmark layer on the ground layer, under every play object: its frame at the landmark's
   * point, multiplied by its galaxy tint, keylined on a light field when its kind is.
   */
  private drawLandmarkLayer(
    key: string,
    frame: JobFrame,
    point: Vec,
    layer: number,
    style: { keyline?: string; tint?: number },
  ): void {
    let sprite = this.landmarkSprites.get(key);
    if (!sprite) {
      sprite = this.add.image(0, 0, frame.id);
      this.landmarkSprites.set(key, sprite);
    }
    sprite
      .setTexture(frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(LANDMARK_DEPTH + layer * 1e-7)
      .setVisible(true);
    if (style.tint === undefined) {
      sprite.clearTint();
    } else {
      sprite.setTint(style.tint);
    }
    this.landmarksDrawn.add(key);
    if (style.keyline) {
      this.keyline(style.keyline, key, sprite);
    }
  }

  /**
   * A rescue's craft facing Ada, and its tow line while attached: Art's stranded craft and
   * cable, else the placeholder ellipse and line.
   */
  private drawTow(craft: Vec & { readonly item: string }, towing: boolean): void {
    const flight = this.model.state.flight!;
    const point = this.project(craft);
    const id = STRANDED_CRAFT[craft.item];
    const art = id === undefined ? undefined : this.strandedCraft.get(id);
    const heading = craftHeading(craft, flight.player);
    const frame = art && craftFrame(art, heading, this.reducedMotion, this.time.now);
    const offset = art && frame ? towOffset(art, frame, heading) : { x: 0, y: 0 };
    if (towing) {
      const ship = this.project(flight.player);
      if (this.towLine) {
        this.drawTowLine(this.towLine, flight, craft, offset);
        // placeAda sets the line's depth once Ada's is known.
        this.towDepth = playDepth(point.y);
      } else {
        this.ink.lineStyle(1, this.palette.pointOfInterest, 0.8);
        this.ink.lineBetween(ship.x, ship.y, point.x, point.y);
      }
    }
    if (frame) {
      this.towSprite
        .setTexture(frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y))
        .setVisible(true);
      this.passes(this.towSprite);
      return;
    }
    this.ink.fillStyle(this.palette.environmentDetail, 1);
    this.ink.fillEllipse(point.x, point.y, 22, 12);
    this.ink.lineStyle(1, this.palette.active, 0.9);
    this.ink.strokeEllipse(point.x, point.y, 22, 12);
  }

  /**
   * The cable from Ada's pivot to the craft's tow point, `offset` display px from its pivot:
   * Art's layered stroke with round joins and caps, its beads and the tow point's cap.
   */
  private drawTowLine(
    line: TowLine,
    flight: NonNullable<typeof this.model.state.flight>,
    craft: Vec,
    offset: Vec,
  ): void {
    const curve = towCurve(JOB_TUNING.tow.line, flight.velocity, flight.player, craft);
    // The craft end moves onto the tow point, the offset easing in along the line.
    const points = curve.map((world, index) => {
      const at = this.project(world);
      const t = index / (curve.length - 1);
      return { x: at.x + offset.x * t, y: at.y + offset.y * t };
    });
    for (const layer of line.layers) {
      const color = hexNumber(layer.color);
      this.towInk.lineStyle(layer.width, color, 1);
      this.towInk.strokePoints(
        points.map((point) => new PhaserMath.Vector2(point.x, point.y)),
        false,
      );
      this.towInk.fillStyle(color, 1);
      for (const point of points) {
        this.towInk.fillCircle(point.x, point.y, layer.width / 2);
      }
    }
    this.towInk.fillStyle(hexNumber(line.beads.color), 1);
    for (const bead of towBeads(line.beads, points)) {
      this.towInk.fillCircle(bead.x, bead.y, line.beads.radius);
    }
    const end = points[points.length - 1]!;
    for (const disc of line.cap) {
      this.towInk.fillStyle(hexNumber(disc.color), 1);
      this.towInk.fillCircle(end.x, end.y, disc.radius);
    }
  }

  /** The scene the quantum jump plays over now: the flight, the cockpit or the home page. */
  private jumpScene(): JumpScene {
    if (this.model.state.mode === "space" && this.model.state.flight) {
      return this.spaceJumpScene();
    }
    const view = canvasSize(sceneFit(this));
    const center = { x: view.width / 2, y: view.height / 2 };
    const background = this.model.storyView?.page.background;
    const cockpit = this.model.selectedGalaxy !== null || background?.startsWith("cockpit");
    return { center: cockpit ? cockpitFocus(view) : center, ship: null, specks: [] };
  }

  /** The flight as last drawn: the ship at the play view's centre and the visible specks. */
  private spaceJumpScene(): JumpScene {
    const offset = viewShift(sceneFit(this)).x;
    const center = { x: offset + SCREEN.width / 2, y: SCREEN.height / 2 };
    const source = this.ship.texture.getSourceImage() as CanvasImageSource;
    return {
      center,
      ship: this.ship.visible
        ? {
            height: this.ship.displayHeight,
            image: source,
            width: this.ship.displayWidth,
            x: center.x - this.ship.displayWidth * this.ship.originX,
            y: center.y - this.ship.displayHeight * this.ship.originY,
          }
        : null,
      specks: this.specks.map((speck) => ({ x: speck.x + offset, y: speck.y })),
    };
  }

  /**
   * Feedback pulses; on a light field each stroke first draws in ink 2 keyline wider on the same
   * path, its 1 px ink edge.
   */
  private drawFeedback(): void {
    const grow = this.light ? LIGHT_FIELD.keyline : 0;
    for (const edge of grow ? [true, false] : [false]) {
      for (const pulse of this.feedback.pulses) {
        this.drawPulse(edge ? grow : 0, pulse);
      }
    }
  }

  /** One feedback pulse, or with `grow` its ink edge: the same strokes `2 grow` wider in ink. */
  private drawPulse(grow: number, pulse: FeedbackPulse): void {
    // Travel plays the quantum jump; the old teleport ring is retired with it.
    if (pulse.kind === "teleport" && this.quantum) {
      return;
    }
    const at = this.project(pulse);
    const radius = 12 + pulse.age * (pulse.kind === "teleport" ? 140 : 55);
    this.overlay.lineStyle(
      (pulse.kind === "damage" ? 3 : 1.5) + 2 * grow,
      grow
        ? LIGHT_FIELD.ink
        : pulse.kind === "damage"
          ? this.palette.obstacle
          : pulse.kind === "shield" || pulse.kind === "pickup"
            ? this.palette.active
            : pulse.kind === "hit"
              ? this.palette.weapon
              : this.palette.pointOfInterest,
      Math.max(0, 1 - pulse.age / 0.65),
    );
    if (pulse.kind === "hit" || pulse.kind === "disabled") {
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        this.overlay.lineBetween(
          at.x + Math.cos(angle) * radius,
          at.y + Math.sin(angle) * radius,
          at.x + Math.cos(angle) * (radius + 7),
          at.y + Math.sin(angle) * (radius + 7),
        );
      }
      if (pulse.kind === "disabled") {
        this.overlay.strokeRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
      }
    } else if (pulse.kind === "pickup" || pulse.kind === "deposit") {
      this.overlay.strokePoints(
        [
          new PhaserMath.Vector2(at.x, at.y - radius),
          new PhaserMath.Vector2(at.x + radius, at.y),
          new PhaserMath.Vector2(at.x, at.y + radius),
          new PhaserMath.Vector2(at.x - radius, at.y),
        ],
        true,
      );
      if (pulse.kind === "deposit") {
        this.overlay.strokeCircle(at.x, at.y, radius * 0.65);
      }
    } else {
      this.overlay.strokeCircle(at.x, at.y, radius);
      if (pulse.kind === "damage") {
        this.overlay.lineBetween(
          at.x - radius,
          at.y - radius,
          at.x - radius * 0.65,
          at.y - radius * 0.65,
        );
        this.overlay.lineBetween(
          at.x + radius,
          at.y + radius,
          at.x + radius * 0.65,
          at.y + radius * 0.65,
        );
      }
      if (pulse.kind === "teleport") {
        this.overlay.strokeCircle(at.x, at.y, radius * 0.6);
      }
    }
  }

  /** A reusable sprite for an object, reset to opaque and untinted each frame. */
  private objectSprite(id: string, texture: string, frame?: number): GameObjects.Image {
    let sprite = this.enemySprites.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, texture, frame).setDepth(2);
      this.enemySprites.set(id, sprite);
    }
    return sprite
      .setTexture(texture, frame)
      .setAlpha(1)
      .clearTint()
      .setRotation(0)
      .setVisible(true);
  }

  /**
   * The upgrade pickup's two chevrons in the square's amber (art/weapons.md "Pickups"): the
   * climb loops from the still frame when the pickup first draws, lighting each chevron white
   * for its step; reduced motion holds the still frame.
   */
  private drawUpgradeChevrons(object: SpaceObject, point: Vec, color: number): void {
    const art = this.upgradePickupArt;
    if (!art || !this.textures.exists(UPGRADE_CHEVRON)) {
      return;
    }
    const since = this.pickupSeen.get(object.id) ?? this.time.now;
    this.pickupSeen.set(object.id, since);
    const lit = litChevron(art, this.reducedMotion, this.time.now - since);
    for (const chevron of art.chevrons) {
      const key = partKey(object.id, `chevron:${chevron.name}`);
      const sprite = this.objectSprite(key, UPGRADE_CHEVRON)
        .setOrigin(0.5)
        .setDisplaySize(art.size.width, art.size.height)
        .setPosition(point.x + chevron.offset.x, point.y + chevron.offset.y)
        .setDepth(playDepth(point.y))
        .setTint(chevron.name === lit ? 0xffffff : color)
        .setTintMode(TintModes.FILL);
      this.keyline("upgradePickup", key, sprite);
    }
  }


  /**
   * A station in its galaxy's own art where it has some, its funded replacement swapped in (the
   * Loom hall), else the shared station's A/B blink; reduced motion holds frame 0. Stations draw
   * no name label.
   */
  private drawStation(object: SpaceObject, point: Vec, radius: number): void {
    const sector = this.model.state.flight?.sector;
    const galaxy = sector === undefined ? undefined : this.galaxyStations.get(sector);
    if (galaxy && sector !== undefined) {
      const funded = new Set(this.model.worldChanges(sector).map(({ project }) => project));
      const replaced = [...galaxy.projects].find(([project]) => funded.has(project))?.[1];
      const frame = stationLoopFrame(replaced ?? galaxy.base, this.reducedMotion, this.time.now);
      this.placeStationFrame(frame, "station", object, point);
      return;
    }
    if (!this.stationArt) {
      this.drawStationPlaceholder(point, radius);
      return;
    }
    this.drawBlink(this.stationArt, "station", object, point);
  }

  /**
   * A fixed-facing station or outpost frame at its pivot, blinking A and B, sorted by its pivot;
   * `layer` orders a layered outpost's frames within that slot.
   */
  private drawBlink(
    art: StationArt<Asset>,
    kind: "outpost" | "station",
    object: SpaceObject,
    point: Vec,
    key = object.id,
    layer = 0,
  ): void {
    this.placeStationFrame(
      stationFrame(art, this.reducedMotion, this.time.now),
      kind,
      object,
      point,
      key,
      layer,
    );
  }

  /** One fixed-facing station or outpost frame at its pivot, sorted by its pivot. */
  private placeStationFrame(
    frame: Asset,
    kind: "outpost" | "station",
    object: SpaceObject,
    point: Vec,
    key = object.id,
    layer = 0,
  ): void {
    const sprite = this.objectSprite(key, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y) + layer * 1e-7);
    this.keyline(kind, key, sprite);
    this.passes(sprite);
  }

  /**
   * An outpost with its galaxy's funded world changes. A change not yet revealed stays unseen until
   * the first frame the outpost is on screen in live flight, which records the reveal and fades
   * the after state in over the before state as one group (reduced motion cuts to it).
   */
  private drawOutpost(art: StationArt<Asset>, object: SpaceObject, point: Vec): void {
    const index = stationFrameIndex(art, this.reducedMotion, this.time.now);
    const sector = this.model.state.flight?.sector;
    const projects = this.projectArt?.projects;
    const changes =
      sector && projects
        ? this.model
            .worldChanges(sector)
            .filter(({ project, site }) => site === object.id && projects.has(project))
        : [];
    const changeArt = (ids: readonly string[]) => ids.map((id) => projects!.get(id)!);
    const all = changes.map(({ project }) => project);
    const now = this.flightClock;
    let unseen = changes.filter(({ revealed }) => !revealed).map(({ project }) => project);
    if (
      unseen.length > 0 &&
      this.flightLive &&
      boundsOnScreen(SCREEN, point, partsBounds(outpostParts(art, changeArt(all), index)))
    ) {
      for (const project of unseen) {
        this.model.revealWorldChange(sector!, project);
        if (!this.reducedMotion) {
          this.reveals.set(project, now);
        }
      }
      unseen = [];
    }
    const revealMs = this.projectArt?.revealMs ?? 0;
    const elapsed = all.flatMap((project) => {
      const start = this.reveals.get(project);
      if (start !== undefined && now - start >= revealMs) {
        this.reveals.delete(project);
      }
      return this.reveals.has(project) ? [{ ms: now - start!, project }] : [];
    });
    const fading = new Set(elapsed.map(({ project }) => project));
    const after = all.filter((project) => !unseen.includes(project));
    const before = after.filter((project) => !fading.has(project));
    this.drawOutpostParts(object.id, outpostParts(art, changeArt(before), index), point);
    if (elapsed.length === 0) {
      this.revealGroups.get(object.id)?.destroy();
      this.revealGroups.delete(object.id);
      return;
    }
    const alpha = revealAlpha(revealMs, Math.min(...elapsed.map(({ ms }) => ms)));
    this.drawRevealGroup(object.id, outpostParts(art, changeArt(after), index), point, alpha);
  }

  /**
   * An outpost's sprites in its depth slot, behind parts first, keylined on a light field as one
   * silhouette beneath them all.
   */
  private drawOutpostParts(id: string, parts: readonly OutpostPart<Asset>[], point: Vec): void {
    const depth = playDepth(point.y);
    const keylineDepth = depth + parts[0]!.order * 1e-7 - 2e-6;
    for (const part of parts) {
      // Under the outpost's id (spriteOwner), so each part lives as long as its outpost.
      const key = part.order === 0 ? id : `${id}#part${part.order}`;
      const sprite = this.objectSprite(key, part.frame.id)
        .setDisplaySize(part.frame.displayWidth!, part.frame.displayHeight!)
        .setOrigin(part.frame.pivot.x, part.frame.pivot.y)
        .setPosition(point.x + part.offset.x, point.y + part.offset.y)
        .setDepth(depth + part.order * 1e-7);
      this.keyline("outpost", key, sprite, keylineDepth);
      this.passes(sprite);
    }
  }

  /**
   * The after state drawn into one texture at the raster scale, its keyline beneath its
   * sprites, then shown over the before state at the reveal's alpha, so the group fades as one.
   */
  private drawRevealGroup(
    id: string,
    parts: readonly OutpostPart<Asset>[],
    point: Vec,
    alpha: number,
  ): void {
    const grow = this.light && LIGHT_FIELD.keylined.includes("outpost") ? LIGHT_FIELD.keyline : 0;
    const bounds = partsBounds(parts);
    const left = Math.floor(point.x + bounds.left - grow - 1);
    const top = Math.floor(point.y + bounds.top - grow - 1);
    const width = Math.ceil(point.x + bounds.right + grow + 1) - left;
    const height = Math.ceil(point.y + bounds.bottom + grow + 1) - top;
    const r = this.rasters.scale;
    const texels = { height: densityTexels(r, height), width: densityTexels(r, width) };
    let group = this.revealGroups.get(id);
    if (!group || group.width !== texels.width || group.height !== texels.height) {
      group?.destroy();
      group = this.add.renderTexture(0, 0, texels.width, texels.height).setOrigin(0, 0);
      this.filterTexture(group.texture.key, "linear");
      this.revealGroups.set(id, group);
    }
    group.clear();
    const stamps = parts.map((part) => {
      const frame = this.textures.getFrame(part.frame.id);
      return {
        config: {
          originX: part.frame.pivot.x,
          originY: part.frame.pivot.y,
          scaleX: (r * part.frame.displayWidth!) / frame.width,
          scaleY: (r * part.frame.displayHeight!) / frame.height,
        },
        frame,
        x: point.x + part.offset.x - left,
        y: point.y + part.offset.y - top,
      };
    });
    if (grow > 0) {
      for (const { config, frame, x, y } of stamps) {
        const silhouette = this.keylineSilhouette({ frame });
        for (const offset of silhouette ? keylineOffsets(grow) : []) {
          group.stamp(silhouette!, undefined, r * (x + offset.x), r * (y + offset.y), config);
        }
      }
    }
    for (const { config, frame, x, y } of stamps) {
      group.stamp(frame.texture.key, undefined, r * x, r * y, config);
    }
    group.render();
    group
      .setDisplaySize(width, height)
      .setPosition(left, top)
      .setDepth(playDepth(point.y) + parts[parts.length - 1]!.order * 1e-7 + 1e-7)
      .setAlpha(alpha)
      .setVisible(true);
    this.passes(group);
  }

  /**
   * A destination: its outpost or holodisk art, else the placeholder rings; nothing for one its
   * data marks undrawn (data/destinations.ts), which its buoy and craft stand for.
   */
  private drawDestination(object: SpaceObject, point: Vec, radius: number): void {
    if (!destinationDrawn(object.id)) {
      return;
    }
    if (object.id === "hub" && this.hubArt) {
      const progress = this.model.state.progress[this.model.state.flight!.sector];
      hubLayers(this.hubArt, hubWorn(progress), hubBay(progress)).forEach((layer, index) => {
        this.drawBlink(
          layer,
          "outpost",
          object,
          point,
          index ? hubBayKey(object.id) : object.id,
          index,
        );
      });
      return;
    }
    const outpost = this.outpostArt.get(object.id);
    if (outpost) {
      this.drawOutpost(outpost, object, point);
      return;
    }
    if (object.id === "holodisk" && this.holodiskArt) {
      this.drawHolodisk(object, point);
      return;
    }
    if (object.id === "whale" && this.drawWhale("whale", object.id, object)) {
      return;
    }
    // The family: the smaller adult at the destination with its calves at their offsets.
    if (
      object.id === "family" &&
      this.whaleArt &&
      familyMembers(this.model.calfAway, this.whaleArt.family).every(({ kind, offset }) =>
        this.drawWhale(kind, `${object.id}:${kind}`, {
          x: object.x + offset.x,
          y: object.y + offset.y,
        }),
      )
    ) {
      return;
    }
    this.ink.fillEllipse(point.x, point.y, radius * 2, radius);
    this.ink.strokeEllipse(point.x, point.y, radius * 2, radius);
    this.ink.strokeEllipse(point.x, point.y - 7, radius, radius * 0.6);
  }

  /**
   * Guide a calf's calf, owned by the family destination: Art's `calf` frames in the heading of
   * its travel, swimming while it moves and idling while it waits (art/whales.md "Placement").
   */
  private drawGuidedCalf(): void {
    const calf = this.model.guidedCalf;
    if (!calf) {
      return;
    }
    const speed = Math.hypot(calf.velocity.x, calf.velocity.y);
    const kind = this.whaleArt?.kinds.get("calf");
    // A resting calf keeps the heading it last swam in.
    if (speed > 1) {
      this.calfHeading = shipDirection(kind?.frames.length ?? 16, calf.velocity);
    }
    this.drawWhale("calf", partKey("family", "guidedCalf"), calf, {
      heading: this.calfHeading,
      moving: speed > 1,
    });
  }

  /**
   * A whale at its world position, pivot on the world plane: stationary in its fixed heading and
   * idle loop from its own phase, or in `motion`'s heading with the swim loop while it moves. Its
   * loop's frames load on first draw; false until frame 0 has.
   */
  private drawWhale(
    kind: WhaleKind,
    id: string,
    at: Vec,
    motion?: { readonly heading: number; readonly moving: boolean },
  ): boolean {
    const art = this.whaleArt?.kinds.get(kind);
    if (!art || !this.whaleArt) {
      return false;
    }
    const frames = art.frames[motion?.heading ?? art.stationaryHeading]!;
    const wanted =
      frames[
        whaleLoopFrame(
          this.whaleArt,
          art,
          motion?.moving ?? false,
          this.reducedMotion,
          whalePhase(id, art.idleMs * frames.length),
          this.time.now,
        )
      ]!;
    const ready = frames.map((frame) => this.whaleTexture(frame));
    const frame = ready[frames.indexOf(wanted)] ? wanted : ready[0] ? frames[0]! : undefined;
    if (!frame) {
      return false;
    }
    const point = this.project(at);
    const key = id.includes("#") || !id.includes(":") ? id : `${id.split(":")[0]}#${kind}`;
    this.passes(
      this.objectSprite(key, frame.id)
        .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
        .setOrigin(frame.pivot.x, frame.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y)),
    );
    return true;
  }

  /** Whether a whale frame is ready; a missing one is queued (loadSvg). */
  private whaleTexture(frame: Asset): boolean {
    if (this.textures.exists(frame.id)) {
      return true;
    }
    if (!this.whaleRequests.has(frame.id) && frame.path) {
      this.whaleRequests.add(frame.id);
      this.loadSvg(frame);
      // Whale frames start with the next queued rock load.
      this.rockQueued = true;
    }
    return false;
  }

  /**
   * The holodisk turns from its own phase over the beacon, which pulses on its waypoint while
   * the holodisk's location is known and it is not yet recovered.
   */
  private drawHolodisk(object: SpaceObject, point: Vec): void {
    const flight = this.model.state.flight;
    const art = this.holodiskArt!;
    const beacon = this.beaconArt;
    if (
      beacon &&
      flight &&
      holodiskWaypoint(this.model.state.progress[flight.sector].holodisk, [object])
    ) {
      // A light field holds the beacon on its base frame, with no pulse.
      const held = this.light ? beacon.frames[LIGHT_FIELD.holodiskBeacon] : undefined;
      this.objectSprite(
        `${object.id}${BEACON_SUFFIX}`,
        beacon.asset.id,
        held ?? beaconFrame(beacon, this.reducedMotion, this.time.now),
      )
        .setDisplaySize(beacon.asset.displayWidth!, beacon.asset.displayHeight!)
        .setOrigin(beacon.asset.pivot.x, beacon.asset.pivot.y)
        .setPosition(point.x, point.y)
        .setDepth(1.5);
    }
    const frame = holodiskFrame(
      art,
      this.reducedMotion,
      loopPhase(object.id, art.loopMs),
      this.time.now,
    );
    const sprite = this.objectSprite(object.id, art.asset.id, frame)
      .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
      .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y));
    this.keyline("holodisk", object.id, sprite);
    this.passes(sprite);
  }

  /** A discovery cache stays hidden until Ada first approaches it, then loops its lights. */
  private drawCache(object: SpaceObject, point: Vec): void {
    const flight = this.model.state.flight!;
    const art = this.cacheArt!;
    if (this.litFlight !== flight.seed) {
      this.litFlight = flight.seed;
      this.litCaches.clear();
    }
    if (cacheApproached(PROTOTYPE.tuning.safeRadius, flight.player, object)) {
      this.litCaches.add(object.id);
    }
    const frame = cacheFrame(art, this.litCaches.has(object.id), this.reducedMotion, this.time.now);
    const sprite = this.objectSprite(object.id, art.asset.id, frame)
      .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
      .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
      .setPosition(point.x, point.y);
    this.keyline("discoveryCache", object.id, sprite);
  }

  /** Fallback without the station art: a ring hull and its safe-area outline. */
  private drawStationPlaceholder(point: Vec, radius: number): void {
    const safe = ECONOMY.station.safeRadius;
    this.ink.lineStyle(1, this.palette.pointOfInterest, 0.35);
    this.ink.strokeEllipse(point.x, point.y, safe * 2, safe);
    this.ink.fillStyle(this.palette.environment);
    this.ink.lineStyle(2, this.palette.pointOfInterest);
    this.ink.fillEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
    this.ink.strokeEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
  }

  /**
   * Art's Stardust gem with its glint loop from a per-pickup phase. A released pickup draws from
   * its release time and settles out from its wreck; a rock's appears in place; reduced motion
   * shows the rest frame where it lands.
   */
  private drawStardust(object: SpaceObject, point: Vec, radius: number): void {
    const art = this.stardustArt;
    const flight = this.model.state.flight;
    if (flight && !stardustShown(object.release, flight.time)) {
      return;
    }
    if (!art || !flight) {
      this.ink.fillStyle(this.palette.active);
      this.ink.fillCircle(point.x, point.y, radius / 2);
      return;
    }
    const at = stardustDrawn(
      this.destruction?.pickups.settleMs ?? 110,
      this.reducedMotion,
      object.release?.from && this.project(object.release.from),
      object.release ? (flight.time - object.release.at) * 1000 : 0,
      point,
    );
    const frame = stardustFrame(
      art,
      this.reducedMotion,
      stardustPhase(object.id, art.loopMs),
      this.time.now,
    );
    const sprite = this.objectSprite(object.id, art.asset.id, frame)
      .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
      .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
      .setPosition(at.x, at.y);
    this.keyline("stardust", object.id, sprite);
  }

  /**
   * Art's destruction: shards and a flash, or under reduced motion the idle frame tinting,
   * shrinking and fading. Frigates and capitals, without shard art, keep the placeholder.
   */
  private drawWreck(object: SpaceObject, point: Vec): void {
    const wreck = object.wreck;
    if (!wreck) {
      return;
    }
    const data = this.destruction;
    const family = this.familyOf(wreck.archetype);
    const shards = (family ? this.familyShards.get(family.family) : this.shards)?.get(
      wreck.archetype,
    );
    const timing = data?.archetypes[wreck.archetype];
    const art = this.familyArt(wreck.archetype);
    if (!data || !shards || !timing || !art) {
      this.drawWreckPlaceholder(wreck, point);
      return;
    }
    const time = wreck.age * 1000;
    const frame = selectEnemyFrame(art, wreck.facing);
    const width = frame.width ?? 96;
    const height = frame.height ?? 96;
    const scale = (frame.displayWidth ?? 42) / width;
    if (this.reducedMotion) {
      const state = reducedAt(data, timing, time);
      if (state) {
        const sprite = this.objectSprite(object.id, frame.id)
          .setDisplaySize(
            (frame.displayWidth ?? 42) * state.scale,
            (frame.displayHeight ?? 42) * state.scale,
          )
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y))
          .setAlpha(state.alpha)
          .setTint(state.tint);
        this.keyline(wreck.archetype, object.id, sprite);
        this.passes(sprite);
      }
      return;
    }
    const pivot = { x: frame.pivot.x * width, y: frame.pivot.y * height };
    const pieces: EffectShape[] = [];
    for (const polygon of shardPolygons(
      data,
      shards,
      timing.durationMs,
      frame.directionIndex ?? 0,
      time,
    )) {
      if (polygon.alpha <= 0) {
        continue;
      }
      const points: Vec[] = [];
      for (let index = 0; index + 1 < polygon.points.length; index += 2) {
        points.push({
          x: point.x + (polygon.points[index]! - pivot.x) * scale,
          y: point.y + (polygon.points[index + 1]! - pivot.y) * scale,
        });
      }
      pieces.push({ alpha: polygon.alpha, colour: polygon.color, kind: "polygon", points });
    }
    this.drawEffect(pieces, this.edges(["destructionShards"], pieces));
    const flash = wreckFlashAt(data, timing, wreck);
    if (flash && this.textures.exists("destruction-flash")) {
      const flashWidth = flash.width * scale;
      this.objectSprite(`${object.id}${FLASH_SUFFIX}`, "destruction-flash")
        .setDisplaySize(flashWidth, (flashWidth * data.flash.height) / data.flash.width)
        .setOrigin(0.5, 0.5)
        .setPosition(point.x, point.y)
        .setAlpha(flash.alpha)
        .setDepth(4);
    }
  }

  /** Fallback without shard art: hull fragments flying outward. */
  private drawWreckPlaceholder(wreck: NonNullable<SpaceObject["wreck"]>, point: Vec): void {
    const timing = ECONOMY.destruction[wreck.archetype];
    const progress = Math.min(1, wreck.age / timing.durationSeconds);
    const size = Math.max(6, enemyCatalog[wreck.archetype].sizeRatio * 10);
    this.ink.lineStyle(1.5, this.palette.obstacle, 1 - progress);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + Math.atan2(wreck.facing.y, wreck.facing.x);
      const reach = size * (0.3 + progress * 1.4);
      const x = point.x + Math.cos(angle) * reach;
      const y = point.y + Math.sin(angle) * reach * 0.5;
      this.ink.lineBetween(
        x - Math.cos(angle + 1) * size * 0.3,
        y - Math.sin(angle + 1) * size * 0.15,
        x + Math.cos(angle + 1) * size * 0.3,
        y + Math.sin(angle + 1) * size * 0.15,
      );
    }
  }

  private drawObject(object: SpaceObject): void {
    // A heavy anywhere in the loaded region starts loading its parts before it comes into view.
    const family = (object.enemy && this.familyOf(object.enemy.archetype)?.family) ?? "coral";
    if (object.enemy && !this.partLoads.has(`${family}:${object.enemy.archetype}`)) {
      this.loadEnemyParts(object.enemy.archetype);
    }
    const point = this.project(object);
    const definition = object.enemy ? enemyCatalog[object.enemy.archetype] : undefined;
    const radius = definition
      ? Math.max(object.radius, definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2)
      : object.radius;
    const rock = object.asteroid ? rockArt(object.asteroid) : undefined;
    // Art's rocks reach past their footprint; cull by the drawn silhouette's reach.
    const reach = Math.max(radius, scenerySilhouette(object)?.reach ?? 0);
    if (
      point.x < -reach - 60 ||
      point.y < -reach - 60 ||
      point.x > SCREEN.width + reach + 60 ||
      point.y > SCREEN.height + reach + 60
    ) {
      return;
    }
    const color = spaceObjectColor(this.palette, object);
    this.ink.lineStyle(1.5, color);
    this.ink.fillStyle(this.palette.environment);
    switch (object.kind) {
      case "destination":
        this.drawDestination(object, point, radius);
        break;
      case "station":
        this.drawStation(object, point, radius);
        break;
      case "wreck":
        this.drawWreck(object, point);
        break;
      case "hazard":
        this.ink.strokeCircle(point.x, point.y, radius);
        this.ink.lineBetween(
          point.x - radius / 2,
          point.y - radius / 2,
          point.x + radius / 2,
          point.y + radius / 2,
        );
        this.ink.lineBetween(
          point.x + radius / 2,
          point.y - radius / 2,
          point.x - radius / 2,
          point.y + radius / 2,
        );
        break;
      case "enemy":
        this.drawEnemy(point, object);
        break;
      case "pickup":
        if (this.cacheArt && isDiscoveryCache(object)) {
          this.drawCache(object, point);
          break;
        }
        if (carriesStardust(object)) {
          this.drawStardust(object, point, radius);
          break;
        }
        if (this.light && object.upgrade && LIGHT_FIELD.keylined.includes("upgradePickup")) {
          // The square's ink keyline: a stroke 2 keyline wider on the same path.
          this.ink.lineStyle(1.5 + 2 * LIGHT_FIELD.keyline, LIGHT_FIELD.ink);
          this.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
          this.ink.lineStyle(1.5, color);
        }
        if (object.role === "cargo" && this.textures.exists("ore-nugget")) {
          // Art's 11 px ore nugget, nearest-neighbour filtered.
          this.objectSprite(object.id, "ore-nugget", 0)
            .setDisplaySize(11, 11)
            .setOrigin(0.5)
            .setPosition(point.x, point.y)
            .setDepth(playDepth(point.y));
          break;
        }
        this.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        if (object.role === "cargo") {
          this.ink.fillStyle(color);
          this.ink.fillCircle(point.x, point.y, radius / 3);
        } else if (object.upgrade) {
          this.drawUpgradeChevrons(object, point, color);
        }
        break;
      case "resource": {
        const art = object.asteroid && this.resourceRocks.get(resourceArtId(object.asteroid));
        if (art) {
          this.drawAsteroidSprite(object, point, art);
          break;
        }
        this.ink.fillStyle(color);
        this.ink.fillCircle(point.x, point.y, radius);
        break;
      }
      case "rock":
      case "debris": {
        if (object.kind === "debris" && this.drawTravelingDebris(object, point)) {
          break;
        }
        if (rock) {
          this.drawAsteroidSprite(object, point, rock);
          break;
        }
        this.ink.fillEllipse(point.x, point.y, radius * 2, radius * 1.4);
        this.ink.strokeEllipse(point.x, point.y, radius * 2, radius * 1.4);
        if (object.kind === "rock") {
          const detail = sceneryDetail(object.id);
          this.ink.lineStyle(1, this.palette.environmentDetail);
          this.ink.strokePoints(
            detail.outline.map(
              (at) => new PhaserMath.Vector2(point.x + at.x * radius, point.y + at.y * radius),
            ),
            true,
          );
          for (const [start, end] of detail.seams) {
            this.ink.lineBetween(
              point.x + start.x * radius,
              point.y + start.y * radius,
              point.x + end.x * radius,
              point.y + end.y * radius,
            );
          }
        }
        break;
      }
    }
  }

  /**
   * Art's rock at its pivot, in the spin frame for flight time, sorted by pivot screen y; a
   * drifting rock trails its stone chips (art/asteroids.md "Drift cue").
   */
  private drawAsteroidSprite(object: SpaceObject, point: Vec, art: AsteroidArt): void {
    const flight = this.model.state.flight!;
    const frame = rockFrame(
      art,
      flight.seed,
      this.reducedMotion,
      object.id,
      flight.time,
      object.spinStart,
    );
    const texture = this.rockFrameTexture(art, frame);
    if (!texture) {
      this.drawAsteroid(point, footprintOutline(art, frame));
      return;
    }
    const sprite = this.objectSprite(object.id, texture)
      .setOrigin(art.pivot.x, art.pivot.y)
      .setDisplaySize(art.display.width, art.display.height)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y));
    this.keyline("asteroid", object.id, sprite);
    const velocity = object.orbit ? object.velocity : undefined;
    if (!velocity) {
      return;
    }
    // The reverse drift, projected to screen.
    const behind = { x: velocity.y - velocity.x, y: -(velocity.x + velocity.y) / 2 };
    for (const chip of driftChips(art, flight.seed, frame, object.id, behind)) {
      this.ink.fillStyle(hexNumber(this.asteroidArt!.stone[1]!), chip.alpha);
      this.ink.fillRect(
        point.x + chip.x - chip.size / 2,
        point.y + chip.y - chip.size / 2,
        chip.size,
        chip.size,
      );
    }
  }

  /**
   * The flight galaxy's backdrop layers under every play object (art/backdrop.md), or none: the
   * sky, the far items and planets, the plates, the stars and the dust streaks, for the camera at
   * Ada's world position. The fixed layers draw with drawBackdropLayer.
   */
  private drawBackdropLayers(flight: FlightState | null): void {
    const rules = this.backdropRules;
    const galaxy = flight ? this.galaxyBackdrops.get(flight.sector) : undefined;
    this.skyImage?.setVisible(false);
    this.plateInk?.multiply.clear();
    this.plateInk?.screen.clear();
    this.streakInk?.clear();
    for (const image of this.starImages) {
      image.setVisible(false);
    }
    const used = new Set<string>();
    if (flight && rules && galaxy) {
      const camera = [flight.player.x, flight.player.y] as const;
      this.drawSky(flight.sector, galaxy);
      this.drawFarItems(rules, flight.sector, galaxy, camera, used);
      this.drawPlates(rules, galaxy, camera);
      this.drawStars(rules, galaxy, camera);
      this.drawStreaks(rules, galaxy, camera);
    }
    for (const [key, image] of this.backdropItems) {
      if (!used.has(key)) {
        image.destroy();
        this.backdropItems.delete(key);
        // Baked planets and clusters are released with their image; nebulae keep their texture.
        if (this.textures.exists(key)) {
          this.textures.remove(key);
        }
      }
    }
  }

  /** A raster as a linear-filtered canvas texture under `key`, once. */
  private bakeTexture(key: string, paint: () => Raster): void {
    if (this.textures.exists(key)) {
      return;
    }
    const raster = paint();
    const texture = this.textures.createCanvas(key, raster.width, raster.height);
    if (!texture) {
      return;
    }
    texture
      .getContext()
      .putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
    texture.refresh();
    this.filterTexture(key, "linear");
  }

  /** Texels per logical px for a baked layer: the view's, at most MAX_RENDER_SCALE. */
  private bakeScale(): number {
    return Math.min(sceneFit(this).zoom, MAX_RENDER_SCALE);
  }

  /** L0: the galaxy's sky, one quad over the view, baked once at a quarter texel per px. */
  private drawSky(sector: SectorId, galaxy: GalaxyBackdrop): void {
    const key = `backdrop-sky-${sector}`;
    this.bakeTexture(key, () => paintSky(galaxy.sky, 1 / 4));
    this.skyImage ??= this.add
      .image(0, 0, key)
      .setDepth(BACKDROP_DEPTH.sky)
      .setOrigin(0, 0)
      .setVertexRoundMode("off");
    this.skyImage
      .setTexture(key)
      .setPosition(SKY_AREA.x, SKY_AREA.y)
      .setDisplaySize(SKY_AREA.width, SKY_AREA.height)
      .setVisible(true);
  }

  /** The image drawing backdrop item `key` this frame, made on first use. */
  private backdropItem(key: string, texture: string, depth: number, used: Set<string>) {
    used.add(key);
    let image = this.backdropItems.get(key);
    if (!image) {
      image = this.add.image(0, 0, texture).setDepth(depth).setVertexRoundMode("off");
      this.backdropItems.set(key, image);
    }
    return image.setVisible(true);
  }

  /**
   * L2: the far items (nebula textures and baked star clusters) and the baked planets in view,
   * each released once it leaves.
   */
  private drawFarItems(
    rules: BackdropRules,
    sector: SectorId,
    galaxy: GalaxyBackdrop,
    camera: readonly [number, number],
    used: Set<string>,
  ): void {
    const scale = this.bakeScale();
    for (const item of viewFar(rules, galaxy, camera)) {
      const { recipe } = item;
      if (recipe.look === "nebula") {
        const asset = recipe.assets[item.variant]!;
        if (this.textures.exists(asset)) {
          this.backdropItem(`backdrop-nebula-${sector}-${item.id}`, asset, BACKDROP_DEPTH.far, used)
            .setPosition(item.x, item.y)
            .setDisplaySize(rules.nebula.display[0], rules.nebula.display[1]);
        }
        continue;
      }
      const key = `backdrop-cluster-${sector}-${item.id}`;
      this.bakeTexture(key, () => paintCluster(rules, galaxy.seed, item, recipe, scale));
      const [width, height] = clusterReach(rules);
      this.backdropItem(key, key, BACKDROP_DEPTH.far, used)
        .setPosition(item.x, item.y)
        .setDisplaySize(2 * width, 2 * height);
    }
    for (const planet of viewPlanets(rules, galaxy, camera)) {
      const key = `backdrop-planet-${sector}-${planet.id}`;
      this.bakeTexture(key, () => paintPlanet(rules, planet, scale));
      const size = 2 * planetReach(planet.r);
      this.backdropItem(key, key, BACKDROP_DEPTH.planets, used)
        .setPosition(planet.x, planet.y)
        .setDisplaySize(size, size);
    }
  }

  /** L1: the plates in view, darker steps multiplied by their grey, lighter ones screened. */
  private drawPlates(
    rules: BackdropRules,
    galaxy: GalaxyBackdrop,
    camera: readonly [number, number],
  ): void {
    this.plateInk ??= {
      multiply: this.add
        .graphics()
        .setDepth(BACKDROP_DEPTH.multiply)
        .setBlendMode(BlendModes.MULTIPLY)
        .setVertexRoundMode("off"),
      screen: this.add
        .graphics()
        .setDepth(BACKDROP_DEPTH.screen)
        .setBlendMode(BlendModes.SCREEN)
        .setVertexRoundMode("off"),
    };
    for (const plate of viewPlates(rules, galaxy, camera)) {
      const points = plate.points.map(([x, y]) => new PhaserMath.Vector2(x, y));
      if (plate.multiply !== undefined) {
        const grey = Math.round(plate.multiply * 255);
        this.plateInk.multiply.fillStyle((grey << 16) | (grey << 8) | grey, 1);
        this.plateInk.multiply.fillPoints(points, true);
      } else if (plate.screen) {
        this.plateInk.screen.fillStyle(hexNumber(plate.screen), 1);
        this.plateInk.screen.fillPoints(points, true);
      }
    }
  }

  /** L3: both star depths as tinted antialiased discs, unsnapped, with their twinkle. */
  private drawStars(
    rules: BackdropRules,
    galaxy: GalaxyBackdrop,
    camera: readonly [number, number],
  ): void {
    const tint = hexNumber(galaxy.stars.color);
    const stars = viewStars(rules, galaxy, camera, this.time.now / 1000, this.reducedMotion);
    for (const [index, star] of stars.entries()) {
      const key = `backdrop-star-${star.r}`;
      this.bakeTexture(key, () => paintDisc(star.r, MAX_RENDER_SCALE));
      let image = this.starImages[index];
      if (!image) {
        image = this.add.image(0, 0, key).setDepth(BACKDROP_DEPTH.stars).setVertexRoundMode("off");
        this.starImages.push(image);
      }
      const size = this.textures.get(key).source[0]!.width / MAX_RENDER_SCALE;
      image
        .setTexture(key)
        .setPosition(star.x, star.y)
        .setDisplaySize(size, size)
        .setTint(tint)
        .setAlpha(star.alpha)
        .setVisible(true);
    }
  }

  /** L4: the dust streaks, 1 px lines fading to clear at both ends along a half sine. */
  private drawStreaks(
    rules: BackdropRules,
    galaxy: GalaxyBackdrop,
    camera: readonly [number, number],
  ): void {
    this.streakInk ??= this.add
      .graphics()
      .setDepth(BACKDROP_DEPTH.streaks)
      .setVertexRoundMode("off");
    const color = hexNumber(galaxy.streaks.color);
    for (const streak of viewStreaks(rules, galaxy, camera)) {
      for (const piece of streakPieces(streak, STREAK_PIECES)) {
        this.streakInk.lineStyle(rules.streaks.width, color, galaxy.streaks.alpha * piece.fade);
        this.streakInk.lineBetween(piece.from[0], piece.from[1], piece.to[0], piece.to[1]);
      }
    }
  }

  /**
   * Backdrop rocks under every play object, at the debris layer's rock parallax: one greyscale
   * sprite per filled field cell, multiplied by the galaxy's backdropLit, at 0.6 to 1 times its
   * display size.
   */
  private drawBackdrop(flight: NonNullable<typeof this.model.state.flight>): void {
    const catalog = this.asteroidArt;
    if (!catalog) {
      return;
    }
    const tint = hexNumber(backdropTint(catalog, flight.sector).backdropLit);
    const { cell } = BACKDROP_FIELD;
    const parallax = this.backdropRules?.rocks.parallax ?? 1;
    const span = Math.ceil((Math.max(SCREEN.width, SCREEN.height) * 1.5) / cell) + 1;
    const gx = Math.floor((flight.player.x * parallax) / cell);
    const gy = Math.floor((flight.player.y * parallax) / cell);
    const used = new Set<string>();
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const rock = backdropRock(catalog, flight.seed, x, y);
        if (!rock || !this.rockTexture(rock.sprite.file)) {
          continue;
        }
        const point = this.projectLayer(rock, parallax);
        const width = rock.sprite.display.width * rock.scale;
        const height = rock.sprite.display.height * rock.scale;
        if (
          point.x < -width ||
          point.y < -height ||
          point.x > SCREEN.width + width ||
          point.y > SCREEN.height + height
        ) {
          continue;
        }
        const key = `${x},${y}`;
        used.add(key);
        let sprite = this.backdropSprites.get(key);
        if (!sprite) {
          sprite = this.add.image(0, 0, rock.sprite.file).setDepth(-1);
          this.backdropSprites.set(key, sprite);
        }
        sprite
          .setTexture(rock.sprite.file)
          .setOrigin(rock.sprite.pivot.x, rock.sprite.pivot.y)
          .setDisplaySize(width, height)
          .setPosition(point.x, point.y)
          .setTint(tint)
          .setVisible(true);
      }
    }
    for (const [key, sprite] of this.backdropSprites) {
      if (!used.has(key)) {
        sprite.destroy();
        this.backdropSprites.delete(key);
      }
    }
  }

  /**
   * Fills and strokes Art's weapon effect shapes on the overlay, in order, over their ink
   * edges, if any.
   */
  private drawEffect(
    shapes: readonly EffectShape[],
    edges: readonly EffectShape[] = [],
    graphics: Phaser.GameObjects.Graphics = this.overlay,
  ): void {
    for (const shape of [...edges, ...shapes]) {
      switch (shape.kind) {
        case "polygon":
          graphics.fillStyle(shape.colour, shape.alpha);
          graphics.fillPoints(
            shape.points.map((point) => new PhaserMath.Vector2(point.x, point.y)),
            true,
          );
          break;
        case "disc":
          graphics.fillStyle(shape.colour, shape.alpha);
          graphics.fillCircle(shape.at.x, shape.at.y, shape.radius);
          break;
        case "ellipse":
          if (shape.stroke === undefined) {
            graphics.fillStyle(shape.colour, shape.alpha);
            graphics.fillEllipse(shape.at.x, shape.at.y, shape.halfWidth * 2, shape.halfHeight * 2);
          } else {
            graphics.lineStyle(shape.stroke, shape.colour, shape.alpha);
            graphics.strokeEllipse(
              shape.at.x,
              shape.at.y,
              shape.halfWidth * 2,
              shape.halfHeight * 2,
            );
          }
          break;
        case "line":
          graphics.lineStyle(shape.width, shape.colour, shape.alpha);
          graphics.lineBetween(shape.from.x, shape.from.y, shape.to.x, shape.to.y);
          if (shape.round) {
            graphics.fillStyle(shape.colour, shape.alpha);
            graphics.fillCircle(shape.from.x, shape.from.y, shape.width / 2);
            graphics.fillCircle(shape.to.x, shape.to.y, shape.width / 2);
          }
          break;
        case "taper":
          this.drawTaper(shape, graphics);
          break;
      }
    }
  }

  /** The model's enemy Phaser and enemy-only weapon state for this frame, in ms. */
  private enemyWeaponsView(flight: FlightState): EnemyWeaponsView {
    const tells = (kind: EnemyBeam["kind"]) =>
      activeEnemyBeams(flight)
        .filter((beam) => beam.kind === kind)
        .map((beam) => ({
          ageMs: beam.age * 1000,
          end: beam.end,
          muzzle: beam.muzzle,
          stopped: beam.stopped,
        }));
    return {
      lances: tells("lance"),
      mines: flight.mines.map((laid) => ({
        ageMs: Math.max(0, laid.age) * 1000,
        at: { x: laid.x, y: laid.y },
        ...(laid.end ? { end: { ageMs: laid.end.age * 1000, kind: laid.end.kind } } : {}),
        id: laid.id,
        lifeMs: MINE_LAYER.lifeSeconds * 1000,
      })),
      phasers: tells("phaser"),
      ringBolts: flight.shots
        .filter((shot) => shot.enemyWeapon === "ringBurst")
        .map((shot) => ({ at: { x: shot.x, y: shot.y }, velocity: shot.velocity })),
      rings: activeRingEmissions(flight).map((ring) => ({ ...ring, ageMs: ring.age * 1000 })),
    };
  }

  /**
   * Art's enemy-only weapon effects and the enemy Phaser in the effect layer, each over its ink
   * edges on a light field; each mine sorts with the play objects by its centre's screen y.
   */
  private drawEnemyWeapons(view: EnemyWeaponsView): void {
    const art = this.enemyWeaponsArt;
    const used = new Set<string>();
    if (art) {
      const light = this.light;
      const motion = this.reducedMotion;
      const draw = (effect: EnemyEffect, graphics?: Phaser.GameObjects.Graphics) =>
        this.drawEffect(
          effect.shapes,
          light ? enemyInkEdges(art.colours.ink, art.lightField.edge, effect.edged) : [],
          graphics,
        );
      for (const ring of view.rings) {
        const origins = ring.origins.map((origin) => this.project(origin));
        draw(
          ringEmission(art, this.project(ring.at), ring.spawnRadius, origins, motion, ring.ageMs),
        );
      }
      for (const bolt of view.ringBolts) {
        draw(ringDart(art, this.project(bolt.at), bolt.velocity));
      }
      const screen = (tell: EnemyWeaponsView["lances"][number]) => ({
        ...tell,
        end: this.project(tell.end),
        muzzle: this.project(tell.muzzle),
      });
      for (const tell of view.lances) {
        draw(lance(art, screen(tell), light, motion));
      }
      for (const tell of view.phasers) {
        draw(enemyPhaser(art, screen(tell), light, motion));
      }
      for (const dropped of view.mines) {
        const centre = this.project(dropped.at);
        let graphics = this.mineInk.get(dropped.id);
        if (!graphics) {
          graphics = this.add.graphics();
          this.mineInk.set(dropped.id, graphics);
        }
        graphics.clear().setDepth(playDepth(centre.y)).setVisible(true);
        draw(mine(art, centre, dropped, motion), graphics);
        used.add(dropped.id);
      }
    }
    for (const [id, graphics] of this.mineInk) {
      if (!used.has(id)) {
        graphics.destroy();
        this.mineInk.delete(id);
      }
    }
  }

  /**
   * Destroyed rocks take the archetype-independent destruction (art/asteroids.md
   * "Destruction"): shrink about the pivot, multiply darken and fade linearly, at every motion
   * setting. Asteroid timings are not authored; the fighter's reduced timing stands in.
   */
  private drawRockBreaks(): void {
    const data = this.destruction;
    const timing = data?.archetypes.fighter;
    this.rockBreaks = this.rockBreaks.filter((rock) => {
      const state = data && timing ? reducedAt(data, timing, this.time.now - rock.startedMs) : null;
      const texture = this.rockFrameTexture(rock.art, rock.frame);
      if (!state || !texture) {
        rock.sprite?.destroy();
        return false;
      }
      const point = this.project(rock.at);
      rock.sprite ??= this.add.image(0, 0, texture);
      rock.sprite
        .setOrigin(rock.art.pivot.x, rock.art.pivot.y)
        .setDisplaySize(rock.art.display.width * state.scale, rock.art.display.height * state.scale)
        .setPosition(point.x, point.y)
        .setDepth(playDepth(point.y))
        .setAlpha(state.alpha)
        .setTint(state.tint)
        .setVisible(true);
      this.keyline("asteroid", `break:${rock.id}`, rock.sprite);
      return true;
    });
  }

  /** A taper as two triangles whose vertex alphas run linearly from tail to head. */
  private drawTaper(shape: TaperShape, graphics: Phaser.GameObjects.Graphics = this.overlay): void {
    const { colour, head, tail } = shape;
    const dx = head.at.x - tail.at.x;
    const dy = head.at.y - tail.at.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return;
    }
    const nx = -dy / length;
    const ny = dx / length;
    const side = (end: TaperShape["head"], sign: number) => ({
      x: end.at.x + (sign * nx * end.width) / 2,
      y: end.at.y + (sign * ny * end.width) / 2,
    });
    const tailLeft = side(tail, 1);
    const tailRight = side(tail, -1);
    const headLeft = side(head, 1);
    const headRight = side(head, -1);
    // Each triangle takes its three corners' alphas from the first three gradient slots.
    graphics.fillGradientStyle(colour, colour, colour, colour, tail.alpha, head.alpha, tail.alpha);
    graphics.fillTriangle(tailLeft.x, tailLeft.y, headLeft.x, headLeft.y, tailRight.x, tailRight.y);
    graphics.fillGradientStyle(colour, colour, colour, colour, head.alpha, head.alpha, tail.alpha);
    graphics.fillTriangle(
      headLeft.x,
      headLeft.y,
      headRight.x,
      headRight.y,
      tailRight.x,
      tailRight.y,
    );
    graphics.fillStyle(colour, 1);
  }

  /** A rock whose frame has not loaded: its footprint in shadow stone, outlined on the union. */
  private drawAsteroid(point: Vec, outline: AsteroidOutline): void {
    const stone = this.asteroidArt.stone;
    this.ink.fillStyle(hexNumber(stone.at(-1)!));
    for (const part of outline.parts) {
      this.ink.fillPoints(
        part.map((at) => new PhaserMath.Vector2(point.x + at.x, point.y + at.y)),
        true,
      );
    }
    this.ink.lineStyle(1.5, hexNumber(stone[1]!));
    for (const [start, end] of outline.edges) {
      this.ink.lineBetween(point.x + start.x, point.y + start.y, point.x + end.x, point.y + end.y);
    }
  }
}
