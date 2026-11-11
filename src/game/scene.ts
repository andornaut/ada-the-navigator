import Phaser from "phaser";

import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import { ASTEROID_ART, type AsteroidArt, readResourceRocks } from "../data/asteroid-catalog.ts";
import { CHEAT_COPY } from "../data/cheat-copy.ts";
import { destinationDrawn } from "../data/destinations.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { CURRENTS } from "../data/galaxy-features.ts";
import { JOB_TUNING } from "../data/jobs.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { resourceArtId } from "../data/resource-rocks.ts";
import { SCREEN } from "../data/screen.ts";
import { CARTWHEEL_STORY_SHIPS, STORY_SHIP_CRAFT } from "../data/story-ships.ts";
import { GALAXIES, galaxyPreview, OVERNIGHT_SLEEP, SELECTOR_BACKDROP } from "../data/storybook.ts";
import type { SectorId } from "../data/types.ts";
import { PICKUP_GLYPH, pickupGlyphKey, weaponGlyphPath } from "../data/weapon-glyphs.ts";
import { coarsePointer } from "../input/coarse-pointer.ts";
import { createControls } from "../input/controls.ts";
import { rockFrame } from "../model/asteroids.ts";
import { grantAllWeapons } from "../model/cheats.ts";
import { currentsNear, flowFraction } from "../model/currents.ts";
import { carriesStardust } from "../model/drops.ts";
import { enemySpeedFraction } from "../model/enemy-ai.ts";
import {
  activeBeamFlashes,
  activeBlastFlashes,
  shipSpeedFraction,
  stationDock,
} from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { projectileOpacity } from "../model/player-projectiles.ts";
import { hullOffset } from "../model/ship-physics.ts";
import { fill, itemAbout, itemName, type ShopItem } from "../model/shop.ts";
import { drawnHeading, hubBay, hubWorn, storyShips } from "../model/story-ships.ts";
import type { FlightInput, FlightState, SpaceObject, Vec } from "../model/types.ts";
import {
  beginStartUpdateVisit,
  coverStartScreen,
  installApp,
  installState,
  offersInstall,
  onInstallStateChange,
  setBackArmed,
  startScreenShown,
  stepsKind,
  updateOffer,
} from "../pwa/index.ts";
import { backReleased } from "../ui/back-stack.ts";
import { type ConversationBox, createConversationBox } from "../ui/conversation.ts";
import { screenShakes } from "../ui/device-settings.ts";
import { createGalaxySelect } from "../ui/galaxy-select.ts";
import { createJumpOverlay, type JumpScene, type SheetArt } from "../ui/jump-overlay.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { fogColor } from "../ui/layout/mapScreen.ts";
import { type MapField, mapScreenLabels } from "../ui/map-screen.ts";
import { BOX_OCCUPANT, type BoxOccupant, boxOccupant } from "../ui/notice.ts";
import { returnToEarthAvailable } from "../ui/pause.ts";
import { createRestartCard } from "../ui/restart-card.ts";
import { createStationView } from "../ui/station.ts";
import { createStorybook } from "../ui/storybook.ts";
import {
  type CoreManifest,
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
import {
  craftArt,
  craftFrameSets,
  type HubArt,
  hubLayers,
  readBuoyArt,
  readHubArt,
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
  CLAIM,
  CLAIM_WIRED,
  composedArchetypes,
  composeEnemy,
  type EnemyArt,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
  enemyHardpointsPath,
  enemyJetsPath,
  enemyJetTriangles,
  enemyPartFrame,
  enemyRasterSize,
  enemyShardsPath,
  enemySvg,
  HitFlashes,
  type PartPose,
  selectEnemyFrame,
} from "./enemy-art.ts";
import { type FeedbackPulse, FeedbackSound, ModelFeedback } from "./feedback.ts";
import {
  blastEdges,
  inkEdges,
  KEYLINE_ALPHA,
  keylineOffsets,
  LIGHT_FIELD,
  lightGalaxy,
  readLightGalaxies,
  thresholdSilhouette,
} from "./light-field.ts";
import { readSave, writeSave } from "./persistence.ts";
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
import { sceneryDetail } from "./scenery.ts";
import { StoryShell } from "./shell.ts";
import {
  hasShipHeadings,
  loadsOnDemand,
  paintFrames,
  selectPaintedShipAsset,
  type ShipAsset,
  thrustFrames,
} from "./ship-art.ts";
import { jetTriangles, readShipJets, type ShipJets } from "./ship-jets.ts";
import { stationRow } from "./shop-view.ts";
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
  readOutpostArt,
  readStationArt,
  type StationArt,
  type StationFrame,
  stationFrame,
  stationFrameIndex,
} from "./station-art.ts";
import { preloadTouchChrome } from "./touch-chrome.ts";
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
  readWhaleArt,
  type WhaleArt,
  whaleFrameAsset,
  type WhaleKind,
  whaleLoopFrame,
  whalePhase,
} from "./whale-art.ts";
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
  overlay?: boolean;
  project?: string;
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

export class PrototypeScene extends Phaser.Scene {
  private model = new GameModel(PROTOTYPE, readSave());
  private shell!: StoryShell;
  private controls!: ReturnType<typeof createControls>;
  private ink!: Phaser.GameObjects.Graphics;
  private ship!: Phaser.GameObjects.Image;
  private shipAssets: readonly Asset[] = [];
  private jets!: Phaser.GameObjects.Graphics;
  private shipJets: ShipJets | undefined;
  /** Shots and feedback draw above enemy sprites. */
  private overlay!: Phaser.GameObjects.Graphics;
  private enemyJets!: Phaser.GameObjects.Graphics;
  private enemyArt = new Map<string, EnemyArt<Asset>>();
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private hitFlashes = new HitFlashes();
  // A heavy's part frames load on demand, once per archetype.
  private partAssets: Asset[] = [];
  private partLoads = new Set<string>();
  // A light field (art/galaxies.md "Light fields"): this frame's keylined sprites, each keyline's
  // eight ink copies by key, the ship jets' ink edge and the indicators' ink stroke layer.
  private light = false;
  private keyed: { depth: number | undefined; key: string; sprite: Phaser.GameObjects.Image }[] =
    [];
  private keylines = new Map<string, Phaser.GameObjects.Image[]>();
  private jetKeyline!: Phaser.GameObjects.Graphics;
  private indicatorInk!: Phaser.GameObjects.Graphics;
  private stationArt: StationArt<Asset> | undefined;
  private outpostArt: ReadonlyMap<string, StationArt<Asset>> = new Map();
  // Funded projects' world changes at the outposts (art/projects.md "World changes"): each reveal
  // in play by project, from its start on the flight clock, and its after state's group texture.
  // The flight clock runs only while flight does, so the pause card, the full-screen Map, a
  // station card or a dialogue neither starts a reveal under it nor plays one out.
  private projectArt: ProjectArtSet<Asset> | undefined;
  private flightLive = false;
  private flightClock = 0;
  private reveals = new Map<string, number>();
  private revealGroups = new Map<string, Phaser.GameObjects.RenderTexture>();
  // The core manifest's assets and every loaded galaxy manifest's, with their data links.
  private manifest: {
    assets: readonly Asset[];
    cartwheelDebris?: string;
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
  // Every galaxy's tow line, and Cartwheel's stranded craft; a rescue keeps its placeholder
  // craft or line until its art loads.
  private towLine: TowLine | undefined;
  private strandedCraft: ReadonlyMap<string, StrandedCraftArt<Asset>> = new Map();
  private towInk!: Phaser.GameObjects.Graphics;
  private towSprite!: Phaser.GameObjects.Image;
  // Cartwheel's claim jumpers; a claim archetype without loaded art draws the coral family's.
  private claimArt = new Map<string, EnemyArt<Asset>>();
  private claimShards = new Map<string, NonNullable<ReturnType<typeof readShards>>>();
  private claimPartAssets: readonly Asset[] = [];
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
  private backdropSprites = new Map<string, Phaser.GameObjects.Image>();
  // Rock SVGs requested from the loader, and whether new ones wait for a start.
  private rockRequests = new Set<string>();
  private rockQueued = false;
  private whaleArt: WhaleArt<Asset> | undefined;
  private whaleRequests = new Set<string>();
  // Destroyed rocks breaking at their pivot: the rock, its last frame, world position and start.
  private rockBreaks: {
    art: AsteroidArt;
    at: Vec;
    frame: number;
    id: string;
    sprite?: Phaser.GameObjects.Image;
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
  // Return to Earth, one command wherever it is offered (the Map): refused in danger, never while
  // towing (pause.ts returnToEarthAvailable). Set once the quantum jump is ready.
  private returnToEarth: () => void = () => {};
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
  private galaxyPalettes: ReadonlyMap<number, SpacePalette> = new Map();
  // The galaxies whose field is light, from the same galaxies.json as their palettes.
  private lightGalaxies: ReadonlySet<number> = new Set();
  // The space background in use: the flight's galaxy field, else the base palette's.
  private spaceBackground = FALLBACK_SPACE_PALETTE.background;
  private station!: ReturnType<typeof createStationView>;
  private storybook!: ReturnType<typeof createStorybook>;
  private galaxies!: ReturnType<typeof createGalaxySelect>;
  private restartCard!: ReturnType<typeof createRestartCard>;
  private conversationBox!: ConversationBox;

  constructor() {
    super("prototype");
  }

  preload(): void {
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
      for (const asset of manifest.assets) {
        // Painted ship frames load for the scheme in use, thrust frames only without valid jets
        // and a heavy's part frames when that craft first appears. A galaxy's own art is in its
        // galaxy manifest, not here.
        if (loadsOnDemand(asset) || enemyPartFrame(asset)) {
          continue;
        }
        if (enemySvg(asset)) {
          this.loadEnemySvg(asset);
        } else if (asset.path.endsWith(".svg")) {
          this.load.svg(asset.id, asset.path);
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
      this.load.svg("destruction-flash", data.flash.path);
      for (const archetype of Object.keys(data.archetypes)) {
        this.load.json(`shards-${archetype}`, `/art/enemies/${archetype}-shards.json`);
      }
    });
    this.load.json("art-manifest", "/art/manifest.json");
    this.load.json("destruction", DESTRUCTION_PATH);
    this.load.json("ship-jets", "/art/ship-jets.json");
    // Weapon pickups draw their HUD glyphs rasterised at the pickup size, one canvas px each.
    for (const weapon of PICKUP_GLYPH.weapons) {
      this.load.svg(pickupGlyphKey(weapon), weaponGlyphPath(weapon), {
        height: PICKUP_GLYPH.size,
        width: PICKUP_GLYPH.size,
      });
    }
    preloadTouchChrome(this);
  }

  create(): void {
    this.basePalette =
      readSpacePalette(this.cache.json.get("space-palette")) ?? FALLBACK_SPACE_PALETTE;
    this.palette = this.basePalette;
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
    const fit = (): void => {
      this.cameras.main.setViewport(
        Math.floor((this.scale.gameSize.width - SCREEN.width) / 2),
        0,
        SCREEN.width,
        SCREEN.height,
      );
    };
    fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, fit),
    );
    this.ink = this.add.graphics();
    // Enemy jets draw behind enemy sprites; shots and feedback draw above both.
    this.enemyJets = this.add.graphics().setDepth(1);
    this.overlay = this.add.graphics().setDepth(3);
    this.indicatorInk = this.add.graphics().setDepth(3 - 1e-6);
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
    this.claimPartAssets = (manifest?.assets ?? []).filter(
      (asset) => enemyPartFrame(asset) && asset.family === "claim",
    );
    this.readEnemyArt();
    // Art without its loaded textures or data keeps the placeholders.
    this.stationArt = readStationArt(this.shipAssets);
    this.outpostArt = readOutpostArt(this.shipAssets);
    this.projectArt = readProjectArt(this.shipAssets, this.outpostArt, PROJECTS_FILE);
    this.stardustArt = readStardustArt(this.shipAssets);
    this.cacheArt = readLoopArt(this.shipAssets, "discovery-cache", CACHE_FRAMES);
    this.holodiskArt = readLoopArt(this.shipAssets, "holodisk", HOLODISK_FRAMES);
    this.manifest = {
      assets: bootAssets,
      ...(manifest?.resourceRocks ? { resourceRocks: manifest.resourceRocks } : {}),
      ...(manifest?.tow ? { tow: manifest.tow } : {}),
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
    this.returnToEarth = () => {
      if (returnToEarthAvailable(this.model.inDanger)) {
        jumpThen(() => this.model.returnHome());
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
      // Navigation lives in the Paused card; Travel here and Return to Earth refuse while Ada is
      // in danger, and Back to title never does.
      pause: {
        buttonLabel: PROTOTYPE.labels.pause ?? "",
        labels: {
          backToTitle: PROTOTYPE.labels.backToTitle ?? "",
          close: PROTOTYPE.labels.close ?? "",
          map: PROTOTYPE.labels.map ?? "",
          mapScreen: mapScreenLabels(PROTOTYPE.labels),
          resume: PROTOTYPE.labels.resume ?? "",
          settings: PROTOTYPE.labels.settings ?? "",
          title: PROTOTYPE.labels.pauseTitle ?? "",
        },
        // The start screen needs no quantum jump; it covers the flight at once.
        onBackToTitle: () => {
          if (!this.jumping) {
            apply(() => this.model.backToTitle());
          }
        },
        onReturnToEarth: () => this.returnToEarth(),
        onTravel: (id) => {
          if (!this.model.inDanger && !this.model.towing) {
            jumpThen(() => this.model.teleport(id));
          }
        },
      },
      shieldLabel: PROTOTYPE.labels.shield ?? "",
      update: {
        labels: {
          accept: PROTOTYPE.update.accept,
          cancel: PROTOTYPE.update.cancel,
          close: PROTOTYPE.labels.close ?? "",
          title: PROTOTYPE.update.title,
        },
        offer: updateOffer,
      },
      weaponLabels: {
        ammo: PROTOTYPE.labels.weaponAmmoLabel ?? "",
        group: PROTOTYPE.labels.weapon ?? "",
        names: {
          basic: PROTOTYPE.labels.weaponBasic ?? "",
          heavyMissile: PROTOTYPE.labels.weaponHeavyMissile ?? "",
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
    this.galaxies = createGalaxySelect(this.controls.overlay, {
      flavors: GALAXIES.map(({ flavor }) => flavor),
      labels: {
        close: label("close"),
        home: label("homeButton"),
        jump: label("jump"),
        locked: label("galaxyLocked"),
        next: label("next"),
        number: label("galaxyNumber"),
        previous: label("previous"),
      },
      onHome: () => apply(() => this.model.leaveCockpit()),
      onJump: () => {
        const selected = this.model.selectedGalaxy;
        if (selected !== null && this.model.isUnlocked(selected)) {
          this.hideSelector = Boolean(this.quantum) && !this.jumping;
          jumpThen(() => {
            this.hideSelector = false;
            this.model.jump();
          });
          this.refresh();
        } else {
          apply(() => this.model.jump());
        }
      },
      onPage: (delta) => apply(() => this.model.pageGalaxy(delta)),
      reducedMotion: () => this.controls.reducedMotion(),
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
      this.controls.registerBack({
        back: () => apply(() => this.model.leaveCockpit()),
        isOpen: () => this.galaxies.isOpen() && !this.settingsOpen,
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    this.refresh();
    this.loadAsteroidArt();
  }

  /**
   * Art's rock frames load after the scene starts, at display size (the canvas draws logical
   * px): each rock's frame 0 and the backdrop sprites first, then each spin frame the first
   * time it is drawn, so starting the scene never waits on 202 SVGs.
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
    this.load.once(Phaser.Loader.Events.COMPLETE, ready);
  }

  /**
   * Loads a galaxy's own art the first time one of its flights draws: SVGs at display size
   * times min(devicePixelRatio, 2), the nugget sheet and the data files, then reads them. Until
   * then its objects keep their placeholders.
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
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.readGalaxyArt());
    this.load.start();
  }

  /** Queues one of a galaxy manifest's SVGs or sheets; whale frames and part frames wait. */
  private loadGalaxyAsset(asset: Asset): void {
    if (whaleFrameAsset(asset) || enemyPartFrame(asset) || this.textures.exists(asset.id)) {
      return;
    }
    if (enemySvg(asset)) {
      this.loadEnemySvg(asset);
    } else if (asset.path.endsWith(".svg")) {
      this.load.svg(asset.id, asset.path, { scale: Math.min(window.devicePixelRatio || 1, 2) });
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
      this.claimPartAssets = [
        ...this.claimPartAssets,
        ...galaxy.assets.filter((asset) => enemyPartFrame(asset) && asset.family === "claim"),
      ];
    }
    const assets = galaxy.assets;
    for (const asset of assets) {
      this.loadGalaxyAsset(asset);
    }
    for (const [craft, frames] of craftFrameSets(assets)) {
      this.load.json(`craft-jets-${craft}`, enemyJetsPath(craft, frames[0]!));
    }
    for (const [archetype, frames] of enemyFrameSets(assets, CLAIM)) {
      if (!CLAIM_WIRED.has(archetype)) {
        continue;
      }
      if (frames.length > 1) {
        this.load.json(`claim-jets-${archetype}`, enemyJetsPath(archetype, frames[0]!));
      }
      // Shards, as in coral, for the archetypes Art's destruction data covers.
      if (this.destruction && Object.hasOwn(this.destruction.archetypes, archetype)) {
        this.load.json(`claim-shards-${archetype}`, enemyShardsPath(archetype, frames[0]!));
      }
      if (composedArchetypes(this.claimPartAssets).has(archetype)) {
        this.load.json(`claim-hardpoints-${archetype}`, enemyHardpointsPath(archetype, frames[0]!));
      }
    }
    // The galaxy's own data files, named by its manifest's links.
    for (const [key, path] of [
      ["cartwheel-debris", galaxy.links.cartwheelDebris],
      ["whales", galaxy.links.whales],
      ["whirlpool-currents", galaxy.links.whirlpoolCurrents],
      ["whirlpool-debris", galaxy.links.whirlpoolDebris],
    ] as const) {
      if (path && !this.cache.json.exists(key)) {
        this.load.json(key, path);
      }
    }
  }

  /** Reads the galaxy art whose textures and data have loaded. */
  private readGalaxyArt(): void {
    this.readEnemyArt();
    for (const archetype of CLAIM_WIRED) {
      const shards = readShards(this.cache.json.get(`claim-shards-${archetype}`));
      if (shards) {
        this.claimShards.set(archetype, shards);
      }
    }
    const loaded = this.manifest.assets.filter((asset) => this.textures.exists(asset.id));
    this.towLine = readTowLine(this.cache.json.get("tow"));
    this.strandedCraft = readStrandedCraft(this.cache.json.get("tow"), loaded);
    this.hubArt = readHubArt(loaded);
    this.buoyArt = readBuoyArt(loaded);
    this.craftArt = craftArt(
      (craft) => this.cache.json.get(`craft-jets-${craft}`),
      craftFrameSets(loaded),
    );
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
    if (this.textures.exists("ore-nugget")) {
      this.textures.get("ore-nugget").setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
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
      this.load.svg(
        file,
        file,
        this.resourceFiles.has(file) ? undefined : { scale: this.asteroidArt.displayScale },
      );
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
    const kinds = this.feedback.observe(PROTOTYPE.tuning.maxSpeed * 0.1, this.model.state);
    this.feedbackSound.play(kinds);
    if (this.screenShake && kinds.includes("damage")) {
      this.cameras.main.shake(100, 0.002);
    }
  }

  private refresh(): void {
    const state = this.model.state;
    const enabled = state.mode === "space" && !state.dialogue && !state.docked;
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      this.controls.setEnabled(enabled);
      this.controls.reset();
    }
    this.controls.setContext(enabled ? this.model.contextLabel : undefined);
    this.controls.setWeapons(this.model.weapons());
    this.controls.setStatus({
      capacity: this.model.shieldMax,
      lightField: lightGalaxy(
        this.lightGalaxies,
        state.mode === "space" ? state.flight?.sector : undefined,
      ),
      recharging: this.model.shieldRecharging,
      shield: state.flight?.shield ?? 0,
      stardust: state.economy.stardust,
      stardustLabel: fill(PROTOTYPE.labels.stardustAmount ?? "", {
        amount: state.economy.stardust,
      }),
    });
    this.station.setOpen(state.mode === "space" && Boolean(state.docked));
    // Each arrival at the start screen begins an update visit.
    const screen = this.model.screen;
    const start = screen === "start";
    if (start !== this.startShown) {
      this.startShown = start;
      if (start) {
        beginStartUpdateVisit();
      }
      startScreenShown(start);
    }
    this.armBack();
    this.controls.setSettingsButton(state.mode !== "space");
    this.controls.setAchievementsButton(start);
    this.controls.setPause({
      field: this.mapField(),
      inDanger: this.model.inDanger,
      job: this.model.jobObjective,
      map: this.model.map,
      place: enabled ? "flight" : this.model.roomPage ? "room" : null,
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
        background: story.page.background,
        canGoBack: story.canGoBack,
        text: story.page.text,
        ...(story.page.speaker ? { speaker: story.page.speaker } : {}),
        ...(story.choices.length ? { choices: story.choices } : {}),
        ...(story.page.action ? { action: story.page.action } : {}),
        ...(story.page.sleep ? { sleep: true } : {}),
        next: !story.page.choices,
      },
      selected === null ? null : SELECTOR_BACKDROP,
    );
    const galaxy = selected === null || this.hideSelector ? undefined : GALAXIES[selected - 1];
    this.galaxies.show(
      galaxy && selected !== null
        ? {
            first: selected === 1,
            flavor: galaxy.flavor,
            last: selected === GALAXIES.length,
            name: galaxy.name,
            number: selected,
            preview: galaxyPreview(galaxy, !this.model.isUnlocked(selected)),
            unlocked: this.model.isUnlocked(selected),
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
    const loaded = this.manifest.assets.filter(
      (asset) => asset.family === "claim" && this.textures.exists(asset.id),
    );
    const claim = enemyArt(
      (archetype) => this.cache.json.get(`claim-jets-${archetype}`),
      (archetype) => this.cache.json.get(`claim-hardpoints-${archetype}`),
      composedArchetypes(this.claimPartAssets),
      loaded,
      enemyFrameSets(loaded, CLAIM),
      CLAIM,
    );
    this.claimArt = new Map([...claim].filter(([archetype]) => CLAIM_WIRED.has(archetype)));
  }

  /** The family a galaxy's craft are drawn in: Cartwheel's claim jumpers, else Gadget's coral. */
  private claimed(archetype: string): boolean {
    return this.model.state.flight?.sector === 2 && CLAIM_WIRED.has(archetype);
  }

  /** A craft's art in its galaxy's family, while that family's frames are loaded. */
  private familyArt(archetype: string): EnemyArt<Asset> | undefined {
    return this.claimed(archetype) ? this.claimArt.get(archetype) : this.enemyArt.get(archetype);
  }

  /**
   * A heavy's hardpoint bases and turret tops load the first time that archetype is in flight, so
   * their hundreds of frames never delay a screen that shows none. Until they load, the craft
   * keeps its vector placeholder.
   */
  private loadEnemyParts(archetype: string): void {
    const claim = this.claimed(archetype);
    this.partLoads.add(`${claim ? "claim" : "coral"}:${archetype}`);
    const parts = (claim ? this.claimPartAssets : this.partAssets).filter(
      (asset) => asset.archetype === archetype && !this.textures.exists(asset.id),
    );
    if (parts.length === 0) {
      return;
    }
    for (const part of parts) {
      if (enemySvg(part)) {
        this.loadEnemySvg(part);
      } else {
        this.load.svg(part.id, part.path);
      }
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
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
      name: GALAXIES[sector - 1]?.name ?? "",
    };
  }

  /** Queues an enemy SVG at its display size times min(devicePixelRatio, 2) (enemy-art.ts). */
  private loadEnemySvg(asset: Asset & { displayHeight: number; displayWidth: number }): void {
    this.load.svg(asset.id, asset.path, enemyRasterSize(window.devicePixelRatio, asset));
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
      this.load.svg(frame.id, frame.path);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
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
    const center = this.model.state.flight?.player ?? { x: 0, y: 0 };
    const x = point.x - center.x;
    const y = point.y - center.y;
    return { x: SCREEN.width / 2 + x - y, y: SCREEN.height / 2 + (x + y) / 2 };
  }

  private draw(): void {
    const flight = this.model.state.flight;
    this.ink.clear();
    this.jets.clear();
    this.overlay.clear();
    this.enemyJets.clear();
    this.jetKeyline.clear();
    this.indicatorInk.clear();
    this.towInk.clear();
    this.towSprite.setVisible(false);
    this.keyed = [];
    for (const sprite of this.enemySprites.values()) {
      sprite.setVisible(false);
    }
    for (const sprite of this.backdropSprites.values()) {
      sprite.setVisible(false);
    }
    for (const group of this.revealGroups.values()) {
      group.setVisible(false);
    }
    for (const rock of this.rockBreaks) {
      rock.sprite?.setVisible(false);
    }
    this.ship.setVisible(Boolean(flight) && this.model.state.mode === "space");
    if (!flight || this.model.state.mode !== "space") {
      this.drawKeylines();
      return;
    }
    this.light = lightGalaxy(this.lightGalaxies, flight.sector);
    this.drawBackdrop(flight);
    // Stationary world markers provide motion cues without a navigation map.
    const cell = 160;
    const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
    const gx = Math.floor(flight.player.x / cell);
    const gy = Math.floor(flight.player.y / cell);
    this.specks = [];
    // Dust specks take the galaxy's backdropSide.
    const speckColor = hexNumber(backdropTint(this.asteroidArt, flight.sector).backdropSide);
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const point = this.project({
          x: x * cell + ((y * 37) % 83),
          y: y * cell + ((x * 53) % 79),
        });
        if (point.x >= 0 && point.y >= 0 && point.x <= SCREEN.width && point.y <= SCREEN.height) {
          this.specks.push(point);
        }
        this.ink.fillStyle(speckColor, 0.6);
        this.ink.fillCircle(point.x, point.y, 1);
      }
    }
    this.loadGalaxyArt(flight.sector);
    this.drawCurrents(flight);
    this.drawJobs();
    for (const object of flight.objects) {
      this.drawObject(object);
    }
    this.drawStoryShips(flight);
    this.drawRockBreaks();
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
    for (const shot of flight.shots) {
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
    this.drawIndicators();
    this.drawFeedback();
    this.ship.setPosition(SCREEN.width / 2, SCREEN.height / 2);
    // Ada sorts with the rocks by pivot screen y; her jets sit just behind her.
    this.ship.setDepth(playDepth(this.ship.y));
    this.jets.setDepth(playDepth(this.ship.y) - 1e-6);
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
    if (this.shipJets && ship?.directionIndex !== undefined) {
      this.jets.setPosition(this.ship.x, this.ship.y);
      this.jetKeyline.setPosition(this.ship.x, this.ship.y).setDepth(this.ship.depth - 2e-6);
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
      }
    }
    const activeIds = new Set(flight.objects.map((object) => object.id));
    this.hitFlashes.retain(activeIds, spriteOwner);
    for (const id of staleSpriteKeys(activeIds, this.enemySprites.keys())) {
      this.enemySprites.get(id)!.destroy();
      this.enemySprites.delete(id);
    }
    this.drawKeylines();
  }

  /**
   * On a light field, records a sprite of a keylined kind (`lightField.keylined`) for this
   * frame's ink keyline.
   */
  private keyline(
    kind: string,
    key: string,
    sprite: Phaser.GameObjects.Image,
    depth?: number,
  ): void {
    if (this.light && LIGHT_FIELD.keylined.includes(kind)) {
      this.keyed.push({ depth, key, sprite });
    }
  }

  /**
   * Each keylined sprite's ink keyline: eight copies of its frame's ink silhouette offset by
   * `keyline` px in every direction (a square kernel), just beneath it in its depth slot (or at
   * its group's keyline depth), at its alpha. Keylines not drawn this frame are destroyed.
   */
  private drawKeylines(): void {
    const used = new Set<string>();
    const offsets = keylineOffsets(LIGHT_FIELD.keyline);
    for (const { depth, key, sprite } of this.keyed) {
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
  }

  /**
   * A sprite frame's keyline source, made once per frame: opaque ink where the frame's alpha is
   * at least KEYLINE_ALPHA, clear elsewhere, so the grown edge is crisp.
   */
  private keylineSilhouette(sprite: { frame: Phaser.Textures.Frame }): string | undefined {
    const frame = sprite.frame;
    const key = `keyline:${frame.texture.key}#${String(frame.name)}`;
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
    const definition = enemyCatalog[enemy.archetype];
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
      return new Phaser.Math.Vector2(point.x, point.y);
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
   * tops at their aim, a hit hardpoint flashing white, and jets only from intact engines.
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
    // weapon and stands while the hull does.
    const pose: PartPose = {
      aim: (hardpoint) => state(hardpoint)?.aim ?? enemy.aim ?? enemy.facing,
      intact: (hardpoint) => (state(hardpoint)?.hp ?? 1) > 0,
    };
    composeEnemy(art, pose, frame).forEach((part, index) => {
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
        sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      }
    });
    const speed = enemySpeedFraction(
      enemyCatalog[enemy.archetype],
      PROTOTYPE.tuning.maxSpeed,
      enemyEncounterTuning.speedCapRatio,
      enemy,
    );
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
        this.objectSprite(hubBuoyKey(hub.id, group), frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y));
      }
    }
    const progress = this.model.state.progress[flight.sector];
    for (const ship of storyShips(
      hub,
      progress,
      hubBay(progress),
      flight.storyScene,
      flight.time,
    )) {
      const point = this.project(ship);
      const art = this.craftArt.get(STORY_SHIP_CRAFT[ship.id]);
      if (art) {
        const frame = selectEnemyFrame(art, ship.heading);
        this.objectSprite(hubStoryKey(hub.id, ship.id), frame.id)
          .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setDepth(playDepth(point.y));
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
            return new Phaser.Math.Vector2(at.x, at.y);
          }),
          false,
          false,
        );
      }
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
   * (gameplay/quests.md), in the galaxy's palette. Placeholders until Art's landmark, craft and
   * lost-item art.
   */
  private drawJobs(): void {
    const scenery = this.model.jobScenery;
    const margin = 160;
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
      if (landmark.kind === "nebula") {
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
        ].map(([x, y]) => new Phaser.Math.Vector2(point.x + x!, point.y + y!));
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
      const points = Array.from({ length: 48 }, (_, index) => {
        const angle = (index / 48) * Math.PI * 2;
        const at = this.project({
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        });
        return new Phaser.Math.Vector2(at.x, at.y);
      });
      this.ink.lineStyle(1, this.palette.pointOfInterest, 0.45);
      this.ink.strokePoints(points, true);
    }
    if (scenery.craft) {
      this.drawTow(scenery.craft, scenery.towing);
    }
    if (scenery.glint) {
      const glint = this.project(scenery.glint);
      const size = 4 + pulse * 4;
      this.overlay.lineStyle(2, this.palette.active, 1 - pulse * 0.5);
      this.overlay.lineBetween(glint.x - size, glint.y, glint.x + size, glint.y);
      this.overlay.lineBetween(glint.x, glint.y - size, glint.x, glint.y + size);
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
        this.towInk.setDepth(Math.min(playDepth(ship.y), playDepth(point.y)) - 1e-6);
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
        points.map((point) => new Phaser.Math.Vector2(point.x, point.y)),
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
    const view = this.scale.gameSize;
    const center = { x: view.width / 2, y: view.height / 2 };
    const background = this.model.storyView?.page.background;
    const cockpit = this.model.selectedGalaxy !== null || background?.startsWith("cockpit");
    return { center: cockpit ? cockpitFocus(view) : center, ship: null, specks: [] };
  }

  /** The flight as last drawn: the ship at the play view's centre and the visible specks. */
  private spaceJumpScene(): JumpScene {
    const offset = Math.floor((this.scale.gameSize.width - SCREEN.width) / 2);
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
          new Phaser.Math.Vector2(at.x, at.y - radius),
          new Phaser.Math.Vector2(at.x + radius, at.y),
          new Phaser.Math.Vector2(at.x, at.y + radius),
          new Phaser.Math.Vector2(at.x - radius, at.y),
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
  private objectSprite(id: string, texture: string, frame?: number): Phaser.GameObjects.Image {
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

  /** Art's station blinks between frames A and B; reduced motion holds A. Stations draw no name label. */
  private drawStation(object: SpaceObject, point: Vec, radius: number): void {
    if (!this.stationArt) {
      this.drawStationPlaceholder(object, point, radius);
      return;
    }
    this.drawBlink(this.stationArt, "station", object, point);
  }

  /** A fixed-facing station or outpost frame at its pivot, blinking A and B. */
  private drawBlink(
    art: StationArt<Asset>,
    kind: "outpost" | "station",
    object: SpaceObject,
    point: Vec,
    key = object.id,
  ): void {
    const frame = stationFrame(art, this.reducedMotion, this.time.now);
    const sprite = this.objectSprite(key, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y);
    this.keyline(kind, key, sprite);
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
    const depth = 2;
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
    }
  }

  /**
   * The after state drawn into one texture, its keyline beneath its sprites, then shown over the
   * before state at the reveal's alpha, so the group fades as one.
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
    let group = this.revealGroups.get(id);
    if (!group || group.width !== width || group.height !== height) {
      group?.destroy();
      group = this.add.renderTexture(0, 0, width, height).setOrigin(0, 0);
      this.revealGroups.set(id, group);
    }
    group.clear();
    const stamps = parts.map((part) => {
      const frame = this.textures.getFrame(part.frame.id);
      return {
        config: {
          originX: part.frame.pivot.x,
          originY: part.frame.pivot.y,
          scaleX: part.frame.displayWidth! / frame.width,
          scaleY: part.frame.displayHeight! / frame.height,
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
          group.stamp(silhouette!, undefined, x + offset.x, y + offset.y, config);
        }
      }
    }
    for (const { config, frame, x, y } of stamps) {
      group.stamp(frame.texture.key, undefined, x, y, config);
    }
    group.render();
    group
      .setPosition(left, top)
      .setDepth(2 + parts[parts.length - 1]!.order * 1e-7 + 1e-7)
      .setAlpha(alpha)
      .setVisible(true);
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
        this.drawBlink(layer, "outpost", object, point, index ? hubBayKey(object.id) : object.id);
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
      this.whaleArt?.family.every(({ kind, offset }) =>
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
   * A stationary whale at its world position, pivot on the world plane, in its fixed heading and
   * idle loop from its own phase. Its loop's frames load on first draw; false until frame 0 has.
   */
  private drawWhale(kind: WhaleKind, id: string, at: Vec): boolean {
    const art = this.whaleArt?.kinds.get(kind);
    if (!art || !this.whaleArt) {
      return false;
    }
    const frames = art.frames[art.stationaryHeading]!;
    const wanted =
      frames[
        whaleLoopFrame(
          this.whaleArt,
          art,
          false,
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
    const key = id.includes(":") ? `${id.split(":")[0]}#${kind}` : id;
    this.objectSprite(key, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setDepth(playDepth(point.y));
    return true;
  }

  /** Whether a whale frame is ready; a missing one is queued, rastered at up to 2x display. */
  private whaleTexture(frame: Asset): boolean {
    if (this.textures.exists(frame.id)) {
      return true;
    }
    if (!this.whaleRequests.has(frame.id) && frame.path) {
      this.whaleRequests.add(frame.id);
      this.load.svg(frame.id, frame.path, { scale: Math.min(window.devicePixelRatio || 1, 2) });
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
      .setDepth(2);
    this.keyline("holodisk", object.id, sprite);
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

  /** Fallback without the station art: a ring hull, its dock and its safe-area outline. */
  private drawStationPlaceholder(object: SpaceObject, point: Vec, radius: number): void {
    const safe = ECONOMY.station.safeRadius;
    const mouth = ECONOMY.station.dockMouthRadius * Math.SQRT2;
    this.ink.lineStyle(1, this.palette.pointOfInterest, 0.35);
    this.ink.strokeEllipse(point.x, point.y, safe * 2, safe);
    this.ink.fillStyle(this.palette.environment);
    this.ink.lineStyle(2, this.palette.pointOfInterest);
    this.ink.fillEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
    this.ink.strokeEllipse(point.x, point.y, radius * 2.4, radius * 1.2);
    const dockAt = this.project(stationDock(object));
    this.ink.lineStyle(1.5, this.palette.active, 0.8);
    this.ink.strokeEllipse(dockAt.x, dockAt.y, mouth * 2, mouth);
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
    const shards = (this.claimed(wreck.archetype) ? this.claimShards : this.shards).get(
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
          .setAlpha(state.alpha)
          .setTint(state.tint);
        this.keyline(wreck.archetype, object.id, sprite);
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
    const family = object.enemy && this.claimed(object.enemy.archetype) ? "claim" : "coral";
    if (object.enemy && !this.partLoads.has(`${family}:${object.enemy.archetype}`)) {
      this.loadEnemyParts(object.enemy.archetype);
    }
    const point = this.project(object);
    const definition = object.enemy ? enemyCatalog[object.enemy.archetype] : undefined;
    const radius = definition
      ? Math.max(object.radius, definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2)
      : object.radius;
    const rock = object.asteroid ? rockArt(object.asteroid) : undefined;
    // Art's rocks reach past their footprint; cull by the drawn reach.
    const reach = rock ? Math.max(radius, rock.radius * this.asteroidArt.displayScale) : radius;
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
        if (this.light && object.weapon && LIGHT_FIELD.keylined.includes("weaponPickup")) {
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
        } else if (object.weapon && this.textures.exists(pickupGlyphKey(object.weapon))) {
          // The weapon's HUD glyph at 14px, filled in the square's amber.
          const glyph = this.objectSprite(object.id, pickupGlyphKey(object.weapon))
            .setDisplaySize(PICKUP_GLYPH.size, PICKUP_GLYPH.size)
            .setOrigin(0.5)
            .setPosition(point.x, point.y)
            .setTint(color)
            .setTintMode(Phaser.TintModes.FILL);
          this.keyline("weaponPickup", object.id, glyph);
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
              (at) => new Phaser.Math.Vector2(point.x + at.x * radius, point.y + at.y * radius),
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
   * Backdrop rocks under every play object: one greyscale sprite per filled field cell,
   * multiplied by the galaxy's backdropLit, at 0.6 to 1 times its display size.
   */
  private drawBackdrop(flight: NonNullable<typeof this.model.state.flight>): void {
    const catalog = this.asteroidArt;
    if (!catalog) {
      return;
    }
    const tint = hexNumber(backdropTint(catalog, flight.sector).backdropLit);
    const { cell } = BACKDROP_FIELD;
    const span = Math.ceil((Math.max(SCREEN.width, SCREEN.height) * 1.5) / cell) + 1;
    const gx = Math.floor(flight.player.x / cell);
    const gy = Math.floor(flight.player.y / cell);
    const used = new Set<string>();
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const rock = backdropRock(catalog, flight.sector, flight.seed, x, y);
        if (!rock || !this.rockTexture(rock.sprite.file)) {
          continue;
        }
        const point = this.project(rock);
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
  private drawEffect(shapes: readonly EffectShape[], edges: readonly EffectShape[] = []): void {
    const graphics = this.overlay;
    for (const shape of [...edges, ...shapes]) {
      switch (shape.kind) {
        case "polygon":
          graphics.fillStyle(shape.colour, shape.alpha);
          graphics.fillPoints(
            shape.points.map((point) => new Phaser.Math.Vector2(point.x, point.y)),
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
          this.drawTaper(shape);
          break;
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
  private drawTaper(shape: TaperShape): void {
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
    const graphics = this.overlay;
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
        part.map((at) => new Phaser.Math.Vector2(point.x + at.x, point.y + at.y)),
        true,
      );
    }
    this.ink.lineStyle(1.5, hexNumber(stone[1]!));
    for (const [start, end] of outline.edges) {
      this.ink.lineBetween(point.x + start.x, point.y + start.y, point.x + end.x, point.y + end.y);
    }
  }
}
