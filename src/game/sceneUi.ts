// The scene's DOM interface: building the controls, cards and screens, and refreshing them.
// Functions over the scene's UiContext.
import { Scale, type Scene, Scenes } from "phaser";

import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { BUILT, ROUTE } from "../data/galaxies.ts";
import { HIT_SHAKE } from "../data/layout.ts";
import { galaxyCard } from "../data/storybook.ts";
import { coarsePointer } from "../input/coarsePointer.ts";
import { createControls } from "../input/controls.ts";
import { requiredLoading, requiredReady } from "../loading/required.ts";
import { CHEAT_IDS, type CheatId } from "../model/cheats.ts";
import type { ImmediateExchangeOrder, ImmediateExchangeResult } from "../model/exchange.ts";
import { GameModel, withoutSeenLessons } from "../model/game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "../model/itemGains.ts";
import { landmarkById } from "../model/landmarks.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { fill, itemAbout, itemName, type ShopItem, weaponName } from "../model/shop.ts";
import type { FlightState, GameSave } from "../model/types.ts";
import {
  coverStartScreen,
  exitGame,
  exitShown,
  installApp,
  installState,
  keepScreenOn,
  offersInstall,
  onInstallStateChange,
  recordGalaxyUnlocks,
  requireNewerVersion,
  setBackArmed,
  startScreenShown,
  stepsKind,
  updateOffer,
} from "../pwa/index.ts";
import { backReleased } from "../ui/backStack.ts";
import { createConversationBox, createInteractionCard } from "../ui/conversation.ts";
import { screenShakes } from "../ui/deviceSettings.ts";
import { createBannerLayer } from "../ui/disabledBanner.ts";
import { createFpsCounter } from "../ui/fpsCounter.ts";
import { createGalaxyMap } from "../ui/galaxyMap.ts";
import { createJumpOverlay, type SheetArt } from "../ui/jumpOverlay.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { fogColor } from "../ui/layout/mapScreen.ts";
import { safeGameArea } from "../ui/layout/playView.ts";
import { scanFeedbackArea } from "../ui/layout/scanFeedback.ts";
import { type MapField, mapScreenLabels } from "../ui/mapScreen.ts";
import { markerFootprints } from "../ui/markerFootprints.ts";
import { createCoveredPaint } from "../ui/modalScenePaint.ts";
import { navigationEntry } from "../ui/navigationEntry.ts";
import { BOX_OCCUPANT, boxOccupant } from "../ui/notice.ts";
import { galaxiesAvailable } from "../ui/pause.ts";
import { createPennyMarkerLayer } from "../ui/pennyMarkers.ts";
import { questContextIcon } from "../ui/questsScreen.ts";
import { createRestartCard } from "../ui/restartCard.ts";
import {
  createScanFeedbackView,
  scanFeedbackDialogue,
  scanFeedbackFootprints,
  scanFeedbackHudRow,
} from "../ui/scanFeedbackView.ts";
import { aboardLabel, type ShipView } from "../ui/shipCard.ts";
import { createStationView } from "../ui/station.ts";
import { stardustCount } from "../ui/statusPill.ts";
import { loadStoryArt } from "../ui/storyArt.ts";
import { createStorybook, storyPageView } from "../ui/storybook.ts";
import { readTitleScreen, type TitleScreenArt } from "../ui/titleScreen.ts";
import { type CoreManifest, galaxyManifestKey, readGalaxyManifest } from "./artManifest.ts";
import { beginCheatSession, endsCheatSession, NO_CHEAT_SESSION } from "./cheatSession.ts";
import { readDestruction, readShards } from "./destructionArt.ts";
import { EDGE_MARKER_DEPTH, HIT_FLASH_DEPTH } from "./drawOrder.ts";
import { enemyPartFrame, GALAXY_FAMILIES } from "./enemyArt.ts";
import { readEnemyWeaponsArt } from "./enemyWeaponsArt.ts";
import { type CameraShake, HIT_SHAKE_SHARE, shakeCounter, TELEPORT_DISTANCE } from "./feedback.ts";
import { LIGHT_FIELD, lightGalaxy, readForegroundEdges, readLightGalaxies } from "./lightField.ts";
import { saves } from "./persistence.ts";
import { fitPlayCamera, sceneFit, shakeIntensity } from "./playCamera.ts";
import { readProjectArt } from "./projectArt.ts";
import { readQuantumJump } from "./quantumJump.ts";
import { markerHue, readRouteArt, readRouteMarkers, routePreviews } from "./routeArt.ts";
import type { GameScene } from "./scene.ts";
import {
  loadAsteroidArt,
  loadShipFrames,
  materialShipFrames,
  materialShipHeading,
  materialShipSwatch,
  materialWarpPoses,
  paintInUse,
  rasterAgain,
  readEnemyArt,
} from "./sceneAssets.ts";
import { coverShip, endJump, jumpScene } from "./sceneJump.ts";
import { type Asset, projectId, TITLE_SCREEN_KEY } from "./sceneShared.ts";
import { StoryShell } from "./shell.ts";
import { hasShipHeadings, thrustFrames } from "./shipArt.ts";
import { engineJets, readEngineJets } from "./shipJets.ts";
import { stationRow } from "./shopView.ts";
import {
  FALLBACK_SPACE_PALETTE,
  galaxyPalettes,
  readGalaxyFields,
  readSpacePalette,
} from "./spacePalette.ts";
import { readStardustArt } from "./stardustArt.ts";
import { staticShipJets } from "./staticShipJets.ts";
import { readOutpostArt, readStationArt } from "./stationArt.ts";
import { aboardGalaxy } from "./storyPresentation.ts";
import { RASTER_SCALE_EVENT } from "./svgRasters.ts";
import { readUpgradePickup } from "./upgradePickup.ts";
import {
  AMMO_PACK_FRAMES,
  BEACON_FRAMES,
  CACHE_FRAMES,
  HOLODISK_FRAMES,
  readLoopArt,
} from "./worldArt.ts";

const scanViews = new WeakMap<
  object,
  {
    view: ReturnType<typeof createScanFeedbackView>;
    state: GameModel["state"];
    time: number;
  }
>();

const pennyLayers = new WeakMap<object, ReturnType<typeof createPennyMarkerLayer>>();
const interactionCards = new WeakMap<object, ReturnType<typeof createInteractionCard>>();
const titleArts = new WeakMap<object, TitleScreenArt | null>();

const shieldOreFlights = new WeakMap<object, FlightState | null>();

/** The scene state and methods this module's functions use. */
export type UiContext = Partial<Pick<GameScene, "edgeInk" | "fieldLight">> &
  Scene &
  Pick<
    GameScene,
    | "add"
    | "ammoPackArt"
    | "asteroidArt"
    | "backdropRules"
    | "backdrops"
    | "bannerLayer"
    | "basePalette"
    | "beaconArt"
    | "boxOccupant"
    | "buoyArt"
    | "cache"
    | "cacheArt"
    | "cameras"
    | "cheatSession"
    | "children"
    | "controls"
    | "conversationBox"
    | "coreAssetIds"
    | "craftArt"
    | "debrisArt"
    | "destruction"
    | "edgeMarkerInk"
    | "emergencyReturn"
    | "enabled"
    | "entryCurrent"
    | "registerEntryCleanup"
    | "disposeEntryResources"
    | "enemyArt"
    | "enemyJets"
    | "enemyWeaponsArt"
    | "events"
    | "familyArts"
    | "familyParts"
    | "familyShards"
    | "feedback"
    | "feedbackSound"
    | "foregroundEdges"
    | "fpsCounter"
    | "galaxies"
    | "galaxyBackdrops"
    | "galaxyLoads"
    | "galaxyManifestPaths"
    | "galaxyManifests"
    | "galaxyPalettes"
    | "galaxyStations"
    | "game"
    | "held"
    | "hitAt"
    | "hitFlashInk"
    | "holodiskArt"
    | "hubArt"
    | "indicatorInk"
    | "ink"
    | "jetKeyline"
    | "jets"
    | "jobArt"
    | "jumping"
    | "lightGalaxies"
    | "litCaches"
    | "light"
    | "load"
    | "loads"
    | "manifest"
    | "model"
    | "openGalaxies"
    | "outpostArt"
    | "overlay"
    | "paintAssets"
    | "paintLoads"
    | "palette"
    | "partAssets"
    | "partLoads"
    | "project"
    | "projectArt"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "resetSaveCard"
    | "resourceFiles"
    | "resourceRocks"
    | "restartCard"
    | "rockQueued"
    | "rockRequests"
    | "routeGalaxies"
    | "initialSave"
    | "savingUnavailable"
    | "scale"
    | "screenOn"
    | "screenShake"
    | "settingsOpen"
    | "shards"
    | "shell"
    | "ship"
    | "shipAssets"
    | "shipJets"
    | "spaceBackground"
    | "specks"
    | "stardustArt"
    | "startShown"
    | "station"
    | "stationArt"
    | "storyNoses"
    | "storybook"
    | "strandedCraft"
    | "streakSpec"
    | "textures"
    | "towInk"
    | "towLine"
    | "towSprite"
    | "upgradePickupArt"
    | "warpCover"
    | "warpPaint"
    | "warpScheme"
    | "whaleArt"
    | "whaleRequests"
    | "whirlpoolProjects"
  >;

export function buildScene(scene: UiContext): void {
  const partial: (() => void)[] = [];
  let disposedPartial = false;
  const disposePartial = () => {
    if (disposedPartial) {
      return;
    }
    disposedPartial = true;
    for (const dispose of [...partial].reverse()) {
      dispose();
    }
  };
  const stopPartial = scene.registerEntryCleanup?.(disposePartial);
  const saved = scene.initialSave;
  const newer = saved.status === "newer";
  scene.savingUnavailable = newer || saved.status === "unavailable";
  scene.model = new GameModel(CONTENT, newer ? undefined : saved.save);
  scene.basePalette =
    readSpacePalette(scene.cache.json.get("space-palette")) ?? FALLBACK_SPACE_PALETTE;
  scene.palette = scene.basePalette;
  // Art's field colours by stable galaxy id; a galaxy Art has none for flies in the base field.
  scene.galaxyPalettes = galaxyPalettes(
    scene.basePalette,
    readGalaxyFields(scene.cache.json.get("galaxy-fields")),
  );
  scene.lightGalaxies = readLightGalaxies(scene.cache.json.get("galaxy-fields"));
  scene.foregroundEdges = readForegroundEdges(scene.cache.json.get("galaxy-fields"));
  const background = scene.palette.background;
  scene.game.config.backgroundColor.setTo(
    (background >> 16) & 255,
    (background >> 8) & 255,
    background & 255,
  );
  scene.cameras.main.setBackgroundColor(background);
  scene.spaceBackground = background;
  fitPlayCamera(
    scene,
    scene.cameras.main,
    () => aboardGalaxy(scene.model.state, scene.model.storyView?.page) !== null,
  );
  // SVGs, and the touch chrome on RASTER_SCALE_EVENT, rasterise again once a resize moves the
  // camera's zoom far enough (svgRasters.ts).
  const followZoom = (): void => {
    const before = scene.rasters.scale;
    rasterAgain(scene, scene.rasters.resize(sceneFit(scene).zoom));
    if (scene.rasters.scale !== before) {
      scene.events.emit(RASTER_SCALE_EVENT, scene.rasters.scale);
    }
  };
  followZoom();
  scene.scale.on(Scale.Events.RESIZE, followZoom);
  partial.push(() => scene.scale.off(Scale.Events.RESIZE, followZoom));
  const host = document.getElementById(VIEW_HOST_ID);
  if (host) {
    const penny = createPennyMarkerLayer(document, host);
    pennyLayers.set(scene, penny);
    partial.push(() => {
      penny.destroy();
      pennyLayers.delete(scene);
    });
    const layer = createBannerLayer(document, host, CONTENT.labels.disabledBanner ?? "");
    scene.bannerLayer = layer;
    partial.push(() => layer.destroy());
  }
  scene.ink = scene.add.graphics();
  // Enemy jets draw behind enemy sprites; shots and feedback draw above both.
  scene.enemyJets = scene.add.graphics().setDepth(1);
  scene.overlay = scene.add.graphics().setDepth(3);
  scene.indicatorInk = scene.add.graphics().setDepth(3 - 1e-6);
  scene.edgeMarkerInk = scene.add.graphics().setDepth(EDGE_MARKER_DEPTH);
  scene.hitFlashInk = scene.add.graphics().setDepth(HIT_FLASH_DEPTH);
  // The hit flash stays on the play view's edge while the view shakes: just before the camera
  // applies each frame's shake, the band moves by that shake's offset reversed.
  const holdHitFlash = (): void => {
    const counter = shakeCounter(scene.cameras.main.shakeEffect as unknown as CameraShake);
    scene.hitFlashInk.setPosition(counter.x, counter.y);
  };
  scene.events.on(Scenes.Events.PRE_RENDER, holdHitFlash);
  partial.push(() => scene.events.off(Scenes.Events.PRE_RENDER, holdHitFlash));
  scene.jetKeyline = scene.add.graphics();
  scene.jets = scene.add.graphics().setDepth(9);
  scene.ship = scene.add.image(0, 0, "ship").setDepth(10);
  scene.towInk = scene.add.graphics();
  scene.towSprite = scene.add.image(0, 0, "ship").setVisible(false);
  const manifest = scene.cache.json.get("art-manifest") as CoreManifest<Asset> | undefined;
  // Sunflower's outposts come from Sunflower's manifest, loaded with the boot set.
  const sunflower = readGalaxyManifest<Asset>(scene.cache.json.get(galaxyManifestKey(1)));
  if (sunflower) {
    scene.galaxyManifests.set(1, sunflower);
  }
  const bootAssets = [...(manifest?.assets ?? []), ...(sunflower?.assets ?? [])];
  scene.shipAssets = bootAssets.filter((asset) => scene.textures.exists(asset.id));
  // Jets render behind the ship sprite. Missing, invalid or heading-mismatched metadata keeps
  // the authored thrust frames, which load only then; until they do, the idle frames draw.
  const jets = readEngineJets(scene.cache.json.get("ship-jets"));
  scene.shipJets =
    jets?.headings.length === SHIP_HEADINGS && hasShipHeadings(scene.shipAssets) ? jets : undefined;
  if (!scene.shipJets) {
    loadShipFrames(scene, thrustFrames(manifest?.assets ?? []));
  }
  scene.partAssets = (manifest?.assets ?? []).filter(
    (asset) => enemyPartFrame(asset) && asset.family === undefined,
  );
  for (const { family } of GALAXY_FAMILIES) {
    scene.familyParts.set(
      family,
      (manifest?.assets ?? []).filter((asset) => enemyPartFrame(asset) && asset.family === family),
    );
  }
  readEnemyArt(scene);
  scene.enemyWeaponsArt = readEnemyWeaponsArt(scene.cache.json.get("enemy-weapons"));
  // Art without its loaded textures or data keeps the placeholders.
  scene.stationArt = readStationArt(scene.shipAssets);
  scene.outpostArt = readOutpostArt(scene.shipAssets);
  scene.projectArt = readProjectArt(scene.shipAssets, scene.outpostArt, PROJECTS_FILE);
  scene.stardustArt = readStardustArt(scene.shipAssets);
  scene.cacheArt = readLoopArt(scene.shipAssets, "discovery-cache", CACHE_FRAMES);
  scene.upgradePickupArt = readUpgradePickup(manifest?.assets ?? []);
  scene.holodiskArt = readLoopArt(scene.shipAssets, "holodisk", HOLODISK_FRAMES);
  scene.ammoPackArt = readLoopArt(scene.shipAssets, "ammo-pack", AMMO_PACK_FRAMES);
  scene.coreAssetIds = (manifest?.assets ?? []).map(({ id }) => id);
  scene.manifest = {
    assets: bootAssets,
    ...(manifest?.resourceRocks ? { resourceRocks: manifest.resourceRocks } : {}),
    ...(manifest?.tow ? { tow: manifest.tow } : {}),
    ...(manifest?.jobs ? { jobs: manifest.jobs } : {}),
    ...(manifest?.backdropLayers ? { backdropLayers: manifest.backdropLayers } : {}),
  };
  scene.beaconArt = readLoopArt(scene.shipAssets, "holodisk-beacon", BEACON_FRAMES);
  scene.destruction = readDestruction(scene.cache.json.get("destruction"));
  for (const archetype of [
    ...Object.keys(scene.destruction?.archetypes ?? {}),
    ...INDUSTRIAL_BODY_KEYS,
  ]) {
    const shards = readShards(scene.cache.json.get(`shards-${archetype}`));
    if (shards) {
      scene.shards.set(archetype, shards);
    }
  }
  scene.paintAssets = (manifest?.assets ?? []).filter((asset) => asset.paint !== undefined);
  const ship = scene.shipAssets.find((asset) => asset.id === "ship");
  scene.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
  scene.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
  const apply = (action: () => void): void => {
    if (!scene.entryCurrent() || !requiredReady()) {
      return;
    }
    if (newer || scene.emergencyReturn.active || scene.cheatSession.ending) {
      return;
    }
    const before = scene.model.screen;
    action();
    observeFeedback(scene);
    scene.controls.reset();
    flushScene(scene);
    if (endsCheatSession(scene.cheatSession, before, scene.model.screen)) {
      void endCheatSession(scene);
    }
    refreshScene(scene);
  };
  // A cheat joins the cheat session, starting it after saving play so far (cheatSession.ts).
  const cheat = (id: CheatId) => ({
    available: () => !scene.cheatSession.ending && scene.model.cheatAvailable(id),
    id,
    label: CHEAT_COPY[id],
    run: () =>
      apply(() => {
        scene.cheatSession = beginCheatSession(
          () => void flushScene(scene),
          scene.model,
          scene.cheatSession,
        );
        if (scene.model.cheat(id) && id === "unlockAllGalaxies") {
          scheduleCheatGalaxies(scene);
        }
      }),
  });
  scene.fpsCounter = createFpsCounter(
    document.getElementById(VIEW_HOST_ID) ?? document.body,
    () => scene.game.loop.actualFps,
  );
  partial.push(() => scene.fpsCounter.dispose());
  // Every quantum jump plays Art's effect; the game switches once the source is covered.
  const jumpThen = (action: () => void): void => {
    if (scene.jumping) {
      return;
    }
    if (!scene.quantum) {
      apply(action);
      return;
    }
    scene.jumping = true;
    scene.quantum.play({
      destination: () => jumpScene(scene),
      emergency: false,
      onCover: () => coverShip(scene),
      onDone: () => endJump(scene),
      onSwitch: () => apply(action),
      reducedMotion: scene.reducedMotion,
      source: jumpScene(scene),
    });
  };
  scene.openGalaxies = () => {
    if (galaxiesAvailable(scene.model.inDanger)) {
      apply(() => scene.model.openGalaxyMap());
    }
  };
  // Leaving the flight from the galaxy map closes the Paused card and the local map under it, so
  // the jump plays over the flight.
  const leaveFlight = (action: () => void): void => {
    if (scene.model.galaxyMapShownInFlight) {
      scene.controls.closePause();
    }
    jumpThen(action);
  };
  // The galaxy map's back and Escape, and Stay, one step back: in flight the local map again, focus
  // back on its Galaxies; at boarding the Welcome back page, whose page focuses its Next.
  const closeGalaxyMap = (): void => {
    const inFlight = scene.model.galaxyMapShownInFlight;
    apply(() => scene.model.closeGalaxyMap());
    if (inFlight) {
      scene.controls.focusGalaxies();
    }
  };
  scene.shell = new StoryShell({
    choose: (id) => apply(() => scene.model.choose(id)),
    continueGame: () => apply(() => scene.model.continueGame()),
    // A tap on a notice dismisses it without touching flight input.
    dismissNotice: () => {
      scene.model.dismissNotice();
      refreshScene(scene);
    },
    reducedMotion: () => scene.controls.reducedMotion(),
    restart: () => scene.restartCard.open(),
    start: () => apply(() => scene.model.start()),
  });
  partial.push(() => scene.shell.dispose());
  // The start screen's art: its field, wordmark, each paint's ship frame and the speed jets at
  // Engine level 1.
  const titleArt = readTitleScreen(
    (manifest?.assets ?? []).map((asset) => {
      const heading = materialShipHeading(asset);
      return heading === undefined
        ? asset
        : {
            ...asset,
            path:
              materialShipFrames(scene, manifest?.assets ?? [], asset.paint ?? null)[heading] ??
              asset.path,
          };
    }),
    scene.shipJets && engineJets(scene.shipJets, 1),
    scene.cache.json.get(TITLE_SCREEN_KEY),
  );
  if (!titleArt || !scene.shipJets) {
    throw new Error("Required first-screen art or normal jets are invalid");
  }
  titleArts.set(scene, titleArt);
  scene.shell.setTitleArt(titleArt);
  scene.controls = createControls(scene, {
    aboardResource: () => {
      const aboard = scene.model.aboard;
      if (!aboard) {
        return null;
      }
      const kind = scene.model.carrying || scene.model.towing ? "job" : "story";
      const quest = scene.model.map?.quests.find((entry) => entry.kind === kind);
      if (!quest || (quest.kind !== "job" && quest.kind !== "story")) {
        return null;
      }
      const questId = scene.model.aboardQuestId;
      return {
        kind: aboard.kind,
        ...(questId ? { questId } : {}),
        text: quest.description || quest.text,
        title: aboard.name,
      };
    },
    achievements: {
      close: CONTENT.labels.close ?? "",
      next: CONTENT.labels.next ?? "",
      page: CONTENT.labels.achievementsPage ?? "",
      previous: CONTENT.labels.previous ?? "",
      progress: CONTENT.labels.achievementProgress ?? "",
      title: CONTENT.labels.achievements ?? "",
    },
    cheats: {
      labels: CHEAT_COPY,
      rows: [
        ...CHEAT_IDS.map(cheat),
        // Not cheats: they start no session (gameplay/cheats.md "Other actions").
        {
          available: () => !scene.cheatSession.ending,
          id: "showTipsAgain",
          label: CHEAT_COPY.showTipsAgain,
          run: () => apply(() => showTipsAgain(scene)),
        },
        {
          id: "fpsCounter",
          label: CHEAT_COPY.fpsCounter,
          on: () => scene.fpsCounter.shown(),
          set: (on) => scene.fpsCounter.set(on),
        },
        {
          available: () => true,
          id: "resetSave",
          label: CHEAT_COPY.resetSave,
          run: () => scene.resetSaveCard.open(),
        },
      ],
    },
    contextQuestDetails: () => scene.model.contextQuestDetails,
    exit: exitShown() ? { label: CONTENT.labels.exit ?? "", onExit: exitGame } : undefined,
    install: {
      port: {
        install: installApp,
        offers: offersInstall,
        onChange: onInstallStateChange,
        state: installState,
        stepsKind,
      },
      steps: CONTENT.installSteps,
    },
    labels: {
      aimControls: CONTENT.labels.aimControls ?? "",
      close: CONTENT.labels.close ?? "",
      controlsNote: CONTENT.labels.controlsNote ?? "",
      install: CONTENT.labels.install ?? "",
      installButton: CONTENT.labels.installButton ?? "",
      installNote: CONTENT.labels.installNote ?? "",
      motionNote: CONTENT.labels.motionNote ?? "",
      moveControls: CONTENT.labels.moveControls ?? "",
      reducedMotion: CONTENT.labels.reducedMotion ?? "",
      settings: CONTENT.labels.settings ?? "",
      sound: CONTENT.labels.sound ?? "",
      soundNote: CONTENT.labels.soundNote ?? "",
    },
    noticeLabels: CONTENT.labels,
    onFeedbackChange: (settings) => {
      scene.feedbackSound.enabled = settings.sound;
      scene.screenShake = screenShakes(settings);
      scene.reducedMotion = settings.reducedMotion;
      if (!scene.screenShake) {
        scene.cameras.main.shakeEffect.reset();
      }
    },
    onPauseChange: (paused) => {
      scene.settingsOpen = paused;
      armBack(scene);
      flushScene(scene);
    },
    onStartCover: coverStartScreen,
    onWeaponSelect: (weapon) => {
      const state = scene.model.state;
      let refused = false;
      if (!scene.settingsOpen && state.mode === "space" && !state.dialogue && !state.docked) {
        apply(() => {
          refused = !scene.model.selectWeapon(weapon);
        });
      }
      return refused;
    },
    // Navigation lives in the Paused card; the local map's Travel here and Galaxies refuse while
    // Ada is in danger, and Back to title never does.
    pause: {
      buttonLabel: CONTENT.labels.pause ?? "",
      labels: {
        backToTitle: CONTENT.labels.backToTitle ?? "",
        close: CONTENT.labels.close ?? "",
        map: CONTENT.labels.map ?? "",
        mapScreen: mapScreenLabels(CONTENT.labels),
        resume: CONTENT.labels.resume ?? "",
        settings: CONTENT.labels.settings ?? "",
        ship: CONTENT.labels.ship ?? "",
        shipHeadings: {
          ammo: CONTENT.labels.ammo ?? "",
          cargo: CONTENT.labels.cargo ?? "",
          equipment: CONTENT.labels.equipment ?? "",
          weapons: CONTENT.labels.shopWeapons ?? "",
        },
        shipRows: CONTENT.labels,
        title: CONTENT.labels.pauseTitle ?? "",
      },
      menuLabel: CONTENT.labels.menu ?? "Menu",
      // The start screen needs no quantum jump; it covers the flight at once.
      onBackToTitle: () => {
        if (!scene.jumping) {
          apply(() => scene.model.backToTitle());
        }
      },
      onGalaxies: () => scene.openGalaxies(),
      onTravel: (id) => {
        if (!scene.model.inDanger && !scene.model.towing && !scene.model.carrying) {
          jumpThen(() => scene.model.teleport(id));
        }
      },
    },
    rasterScale: scene.rasters.scale,
    requiredReady,
    shieldLabel: CONTENT.labels.shield ?? "",
    subscribeRequired: (invalidate) => requiredLoading.subscribe(invalidate),
    update: {
      labels: {
        accept: CONTENT.update.accept,
        cancel: CONTENT.update.cancel,
        close: CONTENT.labels.close ?? "",
        title: CONTENT.update.title,
      },
      offer: updateOffer,
      restoreFocus: () => scene.shell.focusDefault(),
    },
    weaponLabels: {
      ammo: CONTENT.labels.weaponAmmoLabel ?? "",
      group: CONTENT.labels.weapon ?? "",
      names: {
        heavyMissile: CONTENT.labels.weaponHeavyMissile ?? "",
        laser: CONTENT.labels.weaponLaser ?? "",
        multiLaser: CONTENT.labels.weaponMultiLaser ?? "",
        phaser: CONTENT.labels.weaponPhaser ?? "",
        rapidMissile: CONTENT.labels.weaponRapidMissile ?? "",
        scattershot: CONTENT.labels.weaponScattershot ?? "",
      },
    },
  });
  partial.push(() => scene.controls.dispose());
  const scanView = createScanFeedbackView(
    document.getElementById(VIEW_HOST_ID) ?? scene.controls.overlay,
  );
  scanViews.set(scene, { state: scene.model.state, time: scene.time.now, view: scanView });
  partial.push(() => {
    scanView.dispose();
    scanViews.delete(scene);
  });
  const labels = CONTENT.labels;
  const label = (key: string): string => labels[key] ?? "";
  const amount = (value: number): string => fill(label("stardustAmount"), { amount: value });
  const item = (key: string): ShopItem => JSON.parse(key) as ShopItem;
  // The conversation box never pauses play; a tap dismisses it.
  const finishConversation = (): void =>
    apply(() => {
      for (let count = 0; count < 20; count++) {
        const panel = scene.model.state.dialogue;
        if (
          !panel ||
          panel.choices.some(({ id }) => id !== "continue" && id !== "optional") ||
          !panel.choices.some(({ id }) => id === "continue")
        ) {
          break;
        }
        scene.model.choose("continue");
        if (scene.model.state.dialogue === panel) {
          break;
        }
      }
    });
  const interaction = createInteractionCard(scene.controls.overlay, {
    choose: (id) => apply(() => scene.model.choose(id)),
    close: () => apply(() => scene.model.closeInteraction()),
    skip: finishConversation,
  });
  interactionCards.set(scene, interaction);
  partial.push(() => {
    interaction.dispose();
    interactionCards.delete(scene);
  });
  const unregisterInteraction = scene.controls.registerBack({
    back: interaction.back,
    isOpen: () => interaction.isOpen() && !scene.settingsOpen,
  });
  partial.push(unregisterInteraction);
  // A tap on the box dismisses the whole conversation, skipping its remaining lines.
  scene.conversationBox = createConversationBox(() => {
    if (scene.emergencyReturn.active) {
      return;
    }
    scene.model.dismissConversation();
    renderConversation(scene);
  });
  partial.push(() => scene.conversationBox.dispose());
  scene.station = createStationView(scene.controls.overlay, {
    acceptJob: (id) => {
      let accepted = false;
      apply(() => {
        accepted = scene.model.acceptJob(id) !== "busy";
      });
      return accepted;
    },
    advanceGreeting: () => scene.model.advanceGreeting(),
    balance: () => ({
      amount: scene.model.state.economy.stardust,
      text: amount(scene.model.state.economy.stardust),
    }),
    busyLine: () => scene.model.jobBusyLine,
    buy: (key) =>
      apply(() => {
        if (projectId(key)) {
          scene.model.donate(projectId(key)!);
        } else {
          scene.model.buy(item(key));
        }
      }),
    dropJob: () => apply(() => scene.model.dropJob()),
    exchange: {
      exchangeImmediately: (order) => confirmStationExchange(scene, order),
      preview: (order) => scene.model.previewExchange(order),
    },
    greeting: () => scene.model.stationGreeting,
    jobs: () =>
      scene.model.jobBoard().map((job) => ({
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
      nextLine: label("nextLine"),
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
    reducedMotion: () => scene.controls.reducedMotion(),
    request: (key) => {
      const project = projectId(key);
      if (project) {
        const view = scene.model.projects?.find(({ id }) => id === project);
        const donation = scene.model.donationRequest(project);
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
      const request = scene.model.requestPurchase(item(key));
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
          (scene.model.projects ?? []).map((project) => ({
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
              : scene.model.state.economy.stardust > 0
                ? "forSale"
                : "unaffordable",
          }))
        : scene.model.shopRows(tab).map((row) => {
            const view = stationRow(
              ECONOMY,
              labels,
              scene.model.state.economy.stardust,
              row,
              (weapon) => fill(label("requiresWeapon"), { weapon: weaponName(labels, weapon) }),
            );
            const path =
              row.item.kind === "paint" ? materialShipSwatch(scene, row.item.scheme) : undefined;
            return path ? { ...view, glyph: { kind: "swatch" as const, path } } : view;
          }),
    select: (key) => {
      const chosen = item(key);
      if (chosen.kind === "paint") {
        apply(() => scene.model.selectPaint(chosen.scheme));
      }
    },
    services: () => scene.model.stationServices,
    undock: () => apply(() => scene.model.undock()),
  });
  partial.push(() => scene.station.dispose());
  // Back and Escape leave the shop for the station card, and the card undocks. Settings
  // opened over either closes first, as the innermost card.
  const { card, inner } = scene.station.layers;
  const stationLayers = [card, inner].map((layer) =>
    scene.controls.registerBack({
      back: layer.back,
      isOpen: () => layer.isOpen() && !scene.settingsOpen,
    }),
  );
  const unregisterStation = () => stationLayers.forEach((unregister) => unregister());
  partial.push(unregisterStation);
  // Art's quantum jump, played over every layer.
  const artManifest = scene.cache.json.get("art-manifest") as
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
  const jumpData = readQuantumJump(scene.cache.json.get("quantum-jump"));
  const [field, glow, star, tunnel] = [
    sheet("quantum-jump-field"),
    sheet("quantum-jump-glow"),
    sheet("quantum-jump-star"),
    jumpData && sheet(jumpData.warp.tunnel),
  ];
  scene.quantum =
    jumpData && field && glow && star && tunnel
      ? createJumpOverlay(scene.controls.overlay, { field, glow, jump: jumpData, star, tunnel })
      : null;
  partial.push(() => scene.quantum?.dispose());
  // The home half: storybook pages, galaxy selection and Restart's confirm.
  scene.storybook = createStorybook(scene.controls.overlay, {
    labels: { next: label("next"), previous: label("previous"), skip: label("skip") },
    onChoose: (index) => apply(() => scene.model.storyChoose(index)),
    onNext: () => apply(() => scene.model.storyNext()),
    onPrevious: () => apply(() => scene.model.storyPrevious()),
    onSkip: () => apply(() => scene.model.storySkip()),
    reducedMotion: () => scene.controls.reducedMotion(),
  });
  partial.push(() => scene.storybook.dispose());
  scene.galaxies = createGalaxyMap(scene.controls.overlay, {
    labels: {
      back: label("questBack"),
      development: label("galaxyInDevelopment"),
      earthDescription: label("galaxyEarthDescription"),
      earthKicker: label("galaxyEarthKicker"),
      earthTitle: label("galaxyEarthTitle"),
      home: label("homeButton"),
      jump: label("jump"),
      jumpEarth: label("galaxyJumpEarth"),
      jumpTo: label("galaxyJumpTo"),
      locked: label("galaxyLocked"),
      lockedAction: label("galaxyLockedAction"),
      number: label("galaxyNumber"),
      stay: label("stayHere"),
      stayEarth: label("galaxyStayEarth"),
      stayIn: label("galaxyStayIn"),
    },
    // In flight, the local map it opened from; at boarding, the Welcome back page.
    onClose: closeGalaxyMap,
    // In flight Earth ends the flight with the jump home; at boarding it is the room at once.
    onEarth: () => {
      if (scene.model.galaxyMapShownInFlight) {
        if (scene.quantum && !scene.jumping) {
          scene.galaxies.jump();
        }
        leaveFlight(() => scene.model.leaveCockpit());
      } else {
        apply(() => scene.model.leaveCockpit());
      }
    },
    onFlightEnd: () => apply(() => scene.model.finishRouteFlight()),
    onJump: () => {
      const selected = scene.model.galaxyMapSelection;
      if (scene.model.galaxyMapStays) {
        // Stay here returns to the local map that opened this galaxy map.
        closeGalaxyMap();
      } else if (selected !== null && scene.model.isUnlocked(selected)) {
        // The map is the jump's source: its panel and destination action go at once.
        if (scene.quantum && !scene.jumping) {
          scene.galaxies.jump();
        }
        leaveFlight(() => scene.model.jump());
      } else {
        apply(() => scene.model.jump());
      }
    },
    onStep: (delta) => apply(() => scene.model.stepGalaxy(delta)),
    onView: (position) => apply(() => scene.model.viewGalaxy(position)),
    reducedMotion: () => scene.controls.reducedMotion(),
  });
  partial.push(() => scene.galaxies.dispose());
  // The route map's art: the sky, ground and figures, the marker hues and Ada's frames.
  const routeAssets = manifest?.assets ?? [];
  const markers = readRouteMarkers(scene.cache.json.get("galaxy-fields"));
  const travelMaterial = () => {
    const state = scene.model.state;
    const flight = state.mode === "space" ? state.flight : null;
    return staticShipJets(
      scene.shipJets,
      lightGalaxy(scene.lightGalaxies, flight?.galaxy) ? LIGHT_FIELD.jets.shipLevels : undefined,
      flight?.levels.engine ?? state.economy.levels.engine,
    );
  };
  const routeArt = readRouteArt(routeAssets, markers, () =>
    materialShipFrames(scene, routeAssets, paintInUse(scene)),
  );
  if (routeArt) {
    scene.galaxies.setArt({ ...routeArt, jets: travelMaterial });
  }
  void loadStoryArt(manifest).then(
    (home) => {
      if (disposedPartial || !scene.entryCurrent()) {
        return;
      }
      const resolved = readRouteArt(
        routeAssets,
        markers,
        () => materialShipFrames(scene, routeAssets, paintInUse(scene)),
        home,
      );
      if (resolved) {
        scene.galaxies.setArt({ ...resolved, jets: travelMaterial });
      }
    },
    () => undefined,
  );
  // The warp ship: the paint's poses, and its idle frames for the sprite steps.
  scene.warpPaint = () => {
    const scheme = scene.model.state.economy.paint;
    const poses = materialWarpPoses(scene, scheme);
    return {
      jets: travelMaterial,
      ...(poses ? { poses } : {}),
      scheme,
      sprites: materialShipFrames(scene, routeAssets, paintInUse(scene)),
    };
  };
  scene.routeGalaxies = () =>
    ROUTE.map((galaxy) => {
      const card = galaxyCard(galaxy);
      return {
        flavor: card.flavor,
        hue: markerHue(markers, galaxy),
        name: card.name,
        placeholder: !BUILT.has(galaxy),
        preview: routePreviews(routeAssets, card),
        unlocked: scene.model.isUnlocked(galaxy),
      };
    });
  scene.restartCard = createRestartCard(scene.controls.overlay, {
    labels: {
      cancel: label("confirmCancel"),
      close: label("close"),
      restart: label("restart"),
      title: label("restartTitle"),
    },
    onRestart: () => apply(() => scene.model.restart()),
  });
  partial.push(() => scene.restartCard.dispose());
  scene.resetSaveCard = createRestartCard(scene.controls.overlay, {
    kind: "reset-save",
    labels: {
      cancel: CHEAT_COPY.cancel,
      close: CHEAT_COPY.close,
      restart: CHEAT_COPY.reset,
      title: CHEAT_COPY.resetSaveTitle,
    },
    onRestart: () => resetSave(scene),
  });
  partial.push(() => scene.resetSaveCard.dispose());
  const homeLayers = [
    // Back on a storybook page acts as Previous, and does nothing on a scene's first page. On
    // Ada's room page, back and Escape open the Paused card instead.
    scene.controls.registerBack({
      back: () => apply(() => scene.model.storyPrevious()),
      isOpen: () => scene.model.screen === "story" && !scene.model.roomPage && !scene.settingsOpen,
    }),
    // Back and Escape on the galaxy map: one step back. In flight it opens
    // over the Paused card's local map, so it is the innermost card while that card is open.
    scene.controls.registerBack({
      back: closeGalaxyMap,
      isOpen: () =>
        scene.galaxies.isOpen() &&
        !scene.controls.navigationCovered() &&
        (scene.model.galaxyMapShownInFlight || !scene.settingsOpen),
    }),
    scene.controls.registerBack({
      back: () => scene.restartCard.close(),
      isOpen: () => scene.restartCard.isOpen() && !scene.settingsOpen,
    }),
    scene.controls.registerBack({
      back: () => scene.resetSaveCard.close(),
      isOpen: () => scene.resetSaveCard.isOpen(),
    }),
  ];
  partial.push(() => homeLayers.forEach((unregister) => unregister()));
  const hide = (): void => {
    scene.controls.reset();
    flushScene(scene);
  };
  const blockReturnInput = (event: Event): void => {
    if (scene.emergencyReturn.active) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const unregisterReturn = scene.controls.registerBack({
    back: () => undefined,
    isOpen: () => scene.emergencyReturn.active,
  });
  for (const type of ["keydown", "pointerdown", "click"]) {
    window.addEventListener(type, blockReturnInput, true);
  }
  window.addEventListener("pointerdown", scene.feedbackSound.unlock);
  window.addEventListener("keydown", scene.feedbackSound.unlock);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", hide);
  let disposedUi = false;
  const disposeUi = () => {
    if (disposedUi) {
      return;
    }
    disposedUi = true;
    scene.events.off(Scenes.Events.SHUTDOWN, disposeUi);
    scene.events.off(Scenes.Events.DESTROY, disposeUi);
    flushScene(scene);
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pointerdown", scene.feedbackSound.unlock);
    window.removeEventListener("keydown", scene.feedbackSound.unlock);
    scene.feedbackSound.dispose();
    unregisterReturn();
    for (const type of ["keydown", "pointerdown", "click"]) {
      window.removeEventListener(type, blockReturnInput, true);
    }
    scene.emergencyReturn.cancel();
    scene.controls.overlay.inert = false;
    disposePartial();
  };
  scene.disposeEntryResources = disposeUi;
  scene.events.once(Scenes.Events.SHUTDOWN, disposeUi);
  scene.events.once(Scenes.Events.DESTROY, disposeUi);
  stopPartial?.();
  scene.registerEntryCleanup?.(disposeUi);
  observeFeedback(scene);
  scene.shell.setSavingAvailable(!scene.savingUnavailable);
  if (newer) {
    requireNewerVersion((state) => scene.shell.setRequiredUpdate(state));
  }
  refreshScene(scene);
  loadAsteroidArt(scene);
}

/** A station trade updates its status without fabricating flight pickup feedback. */
export function confirmStationExchange(
  scene: UiContext,
  order: ImmediateExchangeOrder,
): ImmediateExchangeResult {
  if (scene.emergencyReturn.active) {
    return { kind: "refused", reason: "unavailable" };
  }
  const result = scene.model.exchangeImmediately(order);
  if (result.kind === "exchanged") {
    scene.controls.reset();
    scene.feedback.baseline(scene.model.state);
    const flight = scene.model.state.flight;
    if (flight) {
      scene.held = {
        flight,
        snapshot: gainSnapshot(scene.model.state.economy.paints, scene.model.ship),
      };
    }
    flushScene(scene);
    refreshScene(scene);
  }
  return result;
}

const coveredScenePaint = new WeakMap<
  object,
  {
    conversation: ReturnType<typeof createCoveredPaint<GameModel["conversation"]>>;
    markers: ReturnType<typeof createCoveredPaint<ReturnType<GameModel["targetMarkers"]>[number]>>;
  }
>();

/** The conversation box, in the desktop wording without a coarse pointer. */
export function renderConversation(scene: UiContext): void {
  const emergency = scene.emergencyReturn.line;
  const { dialogue, docked, notice } = scene.model.state;
  const covered = !emergency && (scene.settingsOpen || Boolean(dialogue) || Boolean(docked));
  const sceneCovered = !emergency && (Boolean(dialogue) || Boolean(docked));
  let paint = coveredScenePaint.get(scene);
  if (!paint) {
    paint = { conversation: createCoveredPaint(), markers: createCoveredPaint() };
    coveredScenePaint.set(scene, paint);
  }
  const line =
    emergency ??
    paint.conversation(
      scene.model.state.flight ?? scene.model.state,
      scene.settingsOpen,
      !sceneCovered && !emergency,
      () => [scene.model.conversation],
    )[0] ??
    null;
  scene.conversationBox.render(line, !coarsePointer(window), scene.reducedMotion);
  // UI covers retain the scene box beneath their scrim; actual interaction replaces it.
  const occupant = boxOccupant({
    line: line !== null && !sceneCovered,
    notice: notice !== "" && !sceneCovered,
    saveStatus: scene.savingUnavailable,
  });
  // Written only on a change: an attribute write restyles the whole play area.
  if (occupant !== scene.boxOccupant) {
    scene.boxOccupant = occupant;
    const host = document.getElementById(VIEW_HOST_ID);
    if (occupant) {
      host?.setAttribute(BOX_OCCUPANT, occupant);
    } else {
      host?.removeAttribute(BOX_OCCUPANT);
    }
  }
  const { insets, view } = scene.controls.layout();
  const area = safeGameArea(insets, view);
  const flight = scene.model.state.flight;
  const scan = scanViews.get(scene);
  if (scan) {
    if (scan.state !== scene.model.state) {
      scan.view.reset();
      scan.state = scene.model.state;
    }
    scan.view.enqueue(scene.model.drainScanOutcomes());
    const elapsed = Math.max(0, Math.min(50, scene.time.now - scan.time));
    scan.time = scene.time.now;
    scan.view.render(
      {
        area: scanFeedbackArea(insets, view),
        blocked: () => scanFeedbackFootprints(document, document.getElementById(VIEW_HOST_ID)),
        covered:
          covered ||
          Boolean(emergency) ||
          scene.controls.navigationCovered() ||
          scene.jumping ||
          scene.startShown ||
          !scene.enabled ||
          document.hidden ||
          scene.model.state.mode !== "space" ||
          !flight,
        dialogue: () => scanFeedbackDialogue(document, document.getElementById(VIEW_HOST_ID)),
        hudRow: () => scanFeedbackHudRow(document, document.getElementById(VIEW_HOST_ID)),
        reducedMotion: scene.reducedMotion,
        resolveAnchor: (outcome) => {
          if (flight?.galaxy !== outcome.galaxy) {
            return undefined;
          }
          const target = landmarkById(outcome.galaxy, outcome.targetId);
          return target ? scene.project(target) : undefined;
        },
        time: scene.time.now,
      },
      elapsed,
    );
  }
  const penny = pennyLayers.get(scene);
  if (!penny) {
    return;
  }
  const markers = paint.markers(flight, scene.settingsOpen, !sceneCovered && !emergency, () =>
    scene.model.targetMarkers(area, scene.litCaches),
  );
  penny.place(
    flight?.player ?? { x: 0, y: 0 },
    area,
    {
      // The HUD footprints, a DOM measurement, matter only for markers to place.
      blocked:
        markers.length > 0 ? markerFootprints(document, document.getElementById(VIEW_HOST_ID)) : [],
      color: `#${scene.palette.pointOfInterest.toString(16).padStart(6, "0")}`,
      ...(scene.edgeInk === undefined
        ? {}
        : { edge: `#${scene.edgeInk.toString(16).padStart(6, "0")}` }),
      light: scene.light,
      threat: `#${scene.palette.threat.toString(16).padStart(6, "0")}`,
    },
    markers,
  );
}

export function observeFeedback(scene: UiContext): void {
  const kinds = scene.feedback.observe(TELEPORT_DISTANCE, scene.model.state);
  scene.feedbackSound.play(kinds);
  if (!kinds.includes("damage")) {
    return;
  }
  // Every shield hit restarts the hit flash; the shake and the flash skip under reduced motion.
  scene.hitAt = scene.time.now;
  if (scene.screenShake) {
    const camera = scene.cameras.main;
    camera.shake(HIT_SHAKE.duration, shakeIntensity(camera.zoom, HIT_SHAKE_SHARE));
  }
}

/** The Ship card's facts with the paint named. */
export function shipView(scene: UiContext): ShipView {
  const ship = scene.model.ship;
  const paint = ECONOMY.paints[ship.paint]?.label;
  return {
    ...ship,
    ...(scene.model.aboardQuestId ? { aboardQuestId: scene.model.aboardQuestId } : {}),
    paint: (paint && CONTENT.labels[paint]) ?? "",
  };
}

// Queues item notices for what Ada gained since last frame; a new flight starts from what she
// holds, and leaving flight clears them.
export function noticeGains(scene: UiContext): void {
  const pickups = scene.model.drainPickupFeedback();
  const { flight, mode } = scene.model.state;
  if (mode !== "space" || !flight) {
    if (scene.held) {
      scene.held = undefined;
      scene.controls.setGains(null);
    }
    return;
  }
  const snapshot = gainSnapshot(scene.model.state.economy.paints, scene.model.ship);
  const gains: ItemGain[] = [];
  if (scene.held?.flight === flight) {
    gains.push(...itemGains(Boolean(scene.model.state.docked), scene.held.snapshot, snapshot));
  } else if (scene.held) {
    scene.controls.setGains(null);
  }
  gains.push(...pickups);
  if (gains.length > 0) {
    scene.controls.setGains(gains);
  }
  scene.held = { flight, snapshot };
}

/** Baselines a new or loaded flight before the pill observes its cumulative paid ore. */
export function renderStatus(scene: UiContext): void {
  const state = scene.model.state;
  const flight = state.mode === "space" ? state.flight : null;
  if (!shieldOreFlights.has(scene) || shieldOreFlights.get(scene) !== flight) {
    scene.controls.resetShieldOreSpent(flight?.shieldOreSpent ?? 0);
    shieldOreFlights.set(scene, flight);
  }
  const aboard = scene.model.aboard;
  scene.controls.setStatus({
    aboard: aboard && { kind: aboard.kind, label: aboardLabel(CONTENT.labels, aboard) },
    capacity: scene.model.shieldMax,
    level: state.flight?.levels.shield ?? state.economy.levels.shield,
    lightField: lightGalaxy(
      scene.lightGalaxies,
      state.mode === "space" ? state.flight?.galaxy : undefined,
    ),
    ore: scene.model.ship.ore,
    oreLabel: CONTENT.labels.ore ?? "",
    rechargeDelay: CONTENT.tuning.shieldRechargeDelay,
    recharging: scene.model.shieldRecharging,
    shield: state.flight?.shield ?? 0,
    shieldOreSpent: flight?.shieldOreSpent ?? 0,
    sinceDamage: state.flight?.sinceDamage ?? 0,
    stardust: state.economy.stardust,
    stardustLabel: fill(CONTENT.labels.stardustAmount ?? "", {
      amount: stardustCount(state.economy.stardust),
    }),
  });
}

/**
 * The interface for this frame. Under a storybook page that covers the game area (`covered`), the
 * flight HUD and the Pause card's local map, which the page hides, are left as they are; the page
 * itself, the shell and navigation still update.
 */
export function refreshScene(scene: UiContext, covered = false): void {
  const state = scene.model.state;
  // The warp ship loads the paint in use, again on a paint change.
  if (scene.quantum && scene.warpPaint && state.economy.paint !== scene.warpScheme) {
    scene.warpScheme = state.economy.paint;
    scene.quantum.setPaint(scene.warpPaint());
  }
  const enabled = state.mode === "space" && !state.dialogue && !state.docked;
  if (enabled !== scene.enabled) {
    scene.enabled = enabled;
    scene.controls.setEnabled(enabled);
    scene.controls.reset();
  }
  if (!covered) {
    const action = enabled ? scene.model.contextAction : undefined;
    const questIcon = enabled && !action ? questContextIcon(scene.model.contextQuestDetails) : null;
    scene.controls.setContext(
      action
        ? { action, label: scene.model.contextLabel ?? "" }
        : questIcon
          ? { action: "use", label: CONTENT.labels.quests ?? "", questIcon }
          : undefined,
    );
    scene.controls.setWeapons(scene.model.weapons());
    noticeGains(scene);
    renderStatus(scene);
  }
  scene.station.setOpen(state.mode === "space" && Boolean(state.docked));
  // Each arrival at the start screen shows the offer there, which checks for a new version.
  const screen = scene.model.screen;
  const start = screen === "start";
  if (start !== scene.startShown) {
    scene.startShown = start;
    startScreenShown(start);
  }
  // Play keeps the screen on; the start screen and the Paused card let it sleep.
  const playing = !start && !scene.settingsOpen;
  if (playing !== scene.screenOn) {
    scene.screenOn = playing;
    keepScreenOn(playing);
  }
  armBack(scene);
  scene.controls.setSettingsButton(false);
  scene.controls.setAchievementsButton(false);
  scene.controls.setExitButton(start && exitShown());
  const pauseModel: GameModel & { readonly pauseMapAvailable?: boolean } = scene.model;
  const entry = navigationEntry({
    background: document.hidden,
    dialogue: Boolean(state.dialogue),
    docked: Boolean(state.docked),
    flight: state.flight,
    jumping: scene.jumping,
    mandatoryStory: Boolean(scene.model.storyView),
    mapOpen: scene.model.galaxyMapOpen,
    mode: state.mode,
  });
  scene.controls.setPause({
    canMap: pauseModel.pauseMapAvailable === true,
    carrying: scene.model.carrying,
    field: mapField(scene),
    ...(state.mode === "space" && state.flight ? { galaxy: state.flight.galaxy } : {}),
    inDanger: scene.model.inDanger,
    job: scene.model.jobObjective,
    map: covered ? null : scene.model.map,
    menuContext: start ? "start" : "nonplay",
    navigation: entry,
    place: entry === "pause" ? "flight" : null,
    questEntries: scene.model.quests,
    ship: state.mode === "space" && state.flight ? shipView(scene) : null,
    towing: scene.model.towing,
  });
  scene.controls.setAchievements(scene.model.achievements);
  const continuation: GameModel & { readonly canContinue?: boolean } = scene.model;
  scene.shell.render(state, screen, continuation.canContinue);
  const interactionPanel = screen === "space" && state.dialogue?.text ? state.dialogue : null;
  const interactionGalaxy = state.flight?.galaxy ?? state.selectedGalaxy;
  interactionCards
    .get(scene)
    ?.show(
      { galaxy: interactionGalaxy, progress: state.progress[interactionGalaxy] },
      interactionPanel,
    );
  if (interactionPanel) {
    const legacy = document.querySelector<HTMLElement>(".story-panel");
    if (legacy) {
      legacy.hidden = true;
    }
  }
  const flightGalaxy =
    (state.mode === "space" ? state.flight?.galaxy : undefined) ??
    aboardGalaxy(state, scene.model.storyView?.page);
  scene.palette = (flightGalaxy && scene.galaxyPalettes.get(flightGalaxy)) || scene.basePalette;
  const background = scene.palette.background;
  if (background !== scene.spaceBackground) {
    scene.spaceBackground = background;
    scene.cameras.main.setBackgroundColor(background);
  }
  const story = scene.model.storyView;
  const selected = scene.model.galaxyMapSelection;
  scene.storybook.show(
    story && {
      ...storyPageView(story.page, story.choices, story.canGoBack, story.canSkip),
      run: story.run,
      ...(aboardGalaxy(state, story.page) !== null && titleArts.get(scene)
        ? { aboard: { art: titleArts.get(scene)!, paint: state.economy.paint } }
        : {}),
    },
    null,
  );
  const panel = scene.model.selectedPosition;
  const ship = scene.model.shipPosition;
  scene.galaxies.show(
    selected !== null && panel !== null && ship !== null
      ? {
          atEarth: !scene.model.galaxyMapShownInFlight,
          flight: scene.model.routeFlight,
          galaxies: scene.routeGalaxies(),
          panel,
          ship,
          stay: scene.model.galaxyMapStays,
        }
      : null,
  );
  if (screen !== "start") {
    scene.restartCard.close();
  }
}

/** The flight's galaxy for the map: its name, its field's background and its fog. */
export function mapField(scene: UiContext): MapField | null {
  const galaxy = scene.model.state.mode === "space" ? scene.model.state.flight?.galaxy : undefined;
  if (!galaxy) {
    return null;
  }
  const palette = scene.galaxyPalettes.get(galaxy) ?? scene.basePalette;
  return {
    background: `#${palette.background.toString(16).padStart(6, "0")}`,
    fog: fogColor(palette.environment, palette.environmentDetail),
    name: galaxyCard(galaxy).name,
  };
}

// Back stays on the game except on the start screen with nothing open, where it is the browser's.
export function armBack(scene: UiContext): void {
  setBackArmed(!backReleased(scene.startShown, scene.settingsOpen));
}

/** The one save write: suspended for a cheat session, so every save path stops at once. */
export async function flushScene(scene: UiContext): Promise<void> {
  if (scene.cheatSession.active || !requiredReady() || !scene.entryCurrent()) {
    return;
  }
  const admitted = scene.entryCurrent;
  const generation = requiredLoading.state.attempt;
  const document = scene.model.saveDocument();
  const unlocked = [...document.unlocked];
  const result = await saves.save(document);
  if (result.status === "saved") {
    recordGalaxyUnlocks(unlocked);
  }
  if (
    !admitted() ||
    !requiredReady() ||
    generation !== requiredLoading.state.attempt ||
    !scene.sys.isActive()
  ) {
    return;
  }
  const available = result.status === "saved";
  scene.shell.setSavingAvailable(available);
  scene.savingUnavailable = !available;
}

/** Plays `model` in place of the current one, as a launch would: nothing in flight is kept. */
function replaceModel(model: GameModel, scene: UiContext): void {
  scene.model = model;
  scene.held = undefined;
  scene.controls.setGains(null);
  scene.controls.reset();
  refreshScene(scene);
}

/**
 * Show tips again (gameplay/cheats.md "Other actions") is not a cheat: in a cheat session it also
 * clears the seen first-flight lessons in the stored pre-cheat save, written past flushScene's
 * suspended seam, and in the session's own pre-cheat copy. Outside a session flushScene saves it.
 */
export function showTipsAgain(scene: UiContext): void {
  scene.model.showTipsAgain();
  const session = scene.cheatSession;
  if (!session.active || session.ending) {
    return;
  }
  const written = (session.written ?? Promise.resolve())
    .then(async () => {
      const loaded = await saves.load();
      if (loaded.status === "loaded") {
        await saves.save(withoutSeenLessons(loaded.save));
      }
    })
    .catch(() => undefined);
  const before =
    session.before === null
      ? null
      : JSON.stringify(withoutSeenLessons(JSON.parse(session.before) as GameSave));
  scene.cheatSession = { ...session, before, written };
}

/**
 * Ends the cheat session back on the start screen: the pre-cheat save loads in place of the
 * session's play, so Continue resumes it. Saving and actions wait until it has loaded, and the
 * load waits for any Show tips again write to that save.
 */
export async function endCheatSession(scene: UiContext): Promise<void> {
  const { before, written } = scene.cheatSession;
  scene.cheatSession = { ...scene.cheatSession, ending: true };
  await written;
  restoreBeforeCheats(before, await saves.load(), scene);
}

/** The pre-cheat save, or the copy taken at the first cheat when the store could not read it. */
function restoreBeforeCheats(
  before: string | null,
  loaded: Awaited<ReturnType<typeof saves.load>>,
  scene: UiContext,
): void {
  const save =
    loaded.status === "unavailable" || loaded.status === "newer"
      ? before && (JSON.parse(before) as unknown)
      : loaded.save;
  scene.cheatSession = NO_CHEAT_SESSION;
  replaceModel(new GameModel(CONTENT, save ?? undefined), scene);
}

/**
 * Reset save (gameplay/cheats.md "Other actions"): ends any cheat session, clears the whole save,
 * achievements included, and returns to the start screen as on a first launch. Device settings
 * are stored apart from the save.
 */
export function resetSave(scene: UiContext): void {
  if (scene.cheatSession.ending) {
    return;
  }
  scene.cheatSession = NO_CHEAT_SESSION;
  scene.controls.closeSettings();
  scene.controls.closePause();
  replaceModel(new GameModel(CONTENT), scene);
  void flushScene(scene);
}

/**
 * Galaxies a cheat unlocks need their downloads in the session, which saves nothing to record
 * them through; recordGalaxyUnlocks otherwise follows saved unlocks only.
 */
function scheduleCheatGalaxies(scene: UiContext): void {
  recordGalaxyUnlocks(scene.model.state.unlocked);
}
