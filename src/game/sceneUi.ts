// The scene's DOM interface: building the controls, cards and screens, and refreshing them.
// Functions over the scene's UiContext.
import type { NetworkPlayNotice } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { Scale, type Scene, Scenes } from "phaser";

import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import {
  AMMO_PACK_FRAMES,
  EDGE_MARKER_DEPTH,
  FALLBACK_SPACE_PALETTE,
  galaxyPalettes,
  hasShipHeadings,
  HIT_FLASH_DEPTH,
  HOLODISK_FRAMES,
  readBeaconArt,
  readCacheArt,
  readEnemyWeaponsArt,
  readGalaxyFields,
  readLoopArt,
  readOutpostArt,
  readProjectArt,
  readSpacePalette,
  readStardustArt,
  readStationArt,
  readWeaponSolids,
} from "../art/index.ts";
import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { CONTENT } from "../data/content.ts";
import { lineDuration } from "../data/conversations.ts";
import { ECONOMY } from "../data/economy.ts";
import { INDUSTRIAL_BODY_KEYS } from "../data/enemyIdentity.ts";
import { BUILT, ROUTE } from "../data/galaxies.ts";
import { HIT_SHAKE } from "../data/layout.ts";
import STATION_JOB_BRIEFS from "../data/station-job-briefs.json" with { type: "json" };
import { galaxyCard } from "../data/storybook.ts";
import { coarsePointer } from "../input/coarsePointer.ts";
import { createControls } from "../input/controls.ts";
import { requiredLoading, requiredReady } from "../loading/required.ts";
import { openRewoundCampaign } from "../model/campaignRewind.ts";
import { CHEAT_IDS, type CheatId } from "../model/cheats.ts";
import { linearDialogueContinuation } from "../model/conversations.ts";
import type { ImmediateExchangeOrder, ImmediateExchangeResult } from "../model/exchange.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot, type ItemGain, itemGains } from "../model/itemGains.ts";
import { fill, itemName, type ShopItem, type ShopRow, shopRow, weaponName } from "../model/shop.ts";
import type { FlightState } from "../model/types.ts";
import {
  exitGame,
  exitShown,
  installApp,
  installState,
  keepScreenOn,
  networkPlayNotice,
  offersInstall,
  onInstallStateChange,
  requestUpdateCheck,
  requireNewerVersion,
  saveBeforeUpdate,
  setBackArmed,
  stepsKind,
  updateOffer,
} from "../pwa/index.ts";
import { type CampaignSave, SAVE_RESTORE, saves } from "../saving/index.ts";
import { backReleased } from "../ui/backStack.ts";
import { createBossHud } from "../ui/bossHud.ts";
import { createConversationBox, createInteractionCard } from "../ui/conversation.ts";
import { pageStorage, screenShakes } from "../ui/deviceSettings.ts";
import { createBannerLayer } from "../ui/disabledBanner.ts";
import { createFpsCounter } from "../ui/fpsCounter.ts";
import { createGalaxyMap } from "../ui/galaxyMap.ts";
import { itemDetailName } from "../ui/itemDetailContent.ts";
import { createJumpOverlay, type SheetArt } from "../ui/jumpOverlay.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { fogColor } from "../ui/layout/mapScreen.ts";
import { safeGameArea } from "../ui/layout/playView.ts";
import { mapDistance, type MapField, mapScreenLabels } from "../ui/mapScreen.ts";
import { markerFootprints } from "../ui/markerFootprints.ts";
import { createCoveredPaint } from "../ui/modalScenePaint.ts";
import { navigationEntry } from "../ui/navigationEntry.ts";
import { BOX_OCCUPANT, boxOccupant } from "../ui/notice.ts";
import { galaxiesAvailable } from "../ui/pause.ts";
import { createPennyMarkerLayer, markerName } from "../ui/pennyMarkers.ts";
import { questContextIcon } from "../ui/questsScreen.ts";
import { createRestartCard } from "../ui/restartCard.ts";
import { createScanFeedbackView } from "../ui/scanFeedbackView.ts";
import { aboardLabel, type ShipView } from "../ui/shipCard.ts";
import { createStationView } from "../ui/station.ts";
import { stardustCount } from "../ui/statusPill.ts";
import { loadStoryArt } from "../ui/storyArt.ts";
import { createStorybook, storyPageView } from "../ui/storybook.ts";
import { readTitleScreen, type TitleScreenArt } from "../ui/titleScreen.ts";
import { type CoreManifest, galaxyManifestKey, readGalaxyManifest } from "./artManifest.ts";
import { readDestruction } from "./destructionArt.ts";
import { enemyPartFrame, GALAXY_FAMILIES } from "./enemyArt.ts";
import { type CameraShake, HIT_SHAKE_SHARE, shakeCounter, TELEPORT_DISTANCE } from "./feedback.ts";
import { LIGHT_FIELD, lightGalaxy, readLightGalaxies } from "./lightField.ts";
import { fitPlayCamera, sceneFit, shakeIntensity } from "./playCamera.ts";
import { readQuantumJump } from "./quantumJump.ts";
import { markerHue, readRouteArt, readRouteMarkers, routePreviews } from "./routeArt.ts";
import type { GameScene } from "./scene.ts";
import {
  loadAsteroidArt,
  materialClassicShipFrame,
  materialShipFrames,
  materialShipHeading,
  materialWarpPoses,
  paintInUse,
  paintSwatch,
  publishCoreShards,
  readEnemyArt,
} from "./sceneAssets.ts";
import { coverShip, endJump, jumpScene } from "./sceneJump.ts";
import { type Asset, projectId, TITLE_SCREEN_KEY } from "./sceneShared.ts";
import { StoryShell } from "./shell.ts";
import { engineJets } from "./shipJets.ts";
import { shopItemDetail, stationRow } from "./shopView.ts";
import { staticShipJets } from "./staticShipJets.ts";
import { aboardGalaxy } from "./storyPresentation.ts";
import { RASTER_SCALE_EVENT } from "./svgRasters.ts";
import { readUpgradePickup } from "./upgradePickup.ts";

const scanViews = new WeakMap<
  object,
  {
    equipFlight?: FlightState;
    view: ReturnType<typeof createScanFeedbackView>;
    state: GameModel["state"];
    time: number | undefined;
  }
>();

const pennyLayers = new WeakMap<object, ReturnType<typeof createPennyMarkerLayer>>();
const interactionCards = new WeakMap<object, ReturnType<typeof createInteractionCard>>();
const titleArts = new WeakMap<object, TitleScreenArt | null>();

const openCampaignRewinds = new WeakMap<UiContext, () => boolean>();
const writingCampaignRewinds = new WeakSet<UiContext>();

const shieldOreFlights = new WeakMap<object, FlightState | null>();

/** The scene state and methods this module's functions use. */
export type UiContext = Partial<Pick<GameScene, "fieldLight">> &
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
    | "children"
    | "bossHud"
    | "controls"
    | "conversationBox"
    | "coreAssetIds"
    | "craftArt"
    | "debrisArt"
    | "destruction"
    | "edgeMarkerInk"
    | "emergencyReturn"
    | "enabled"
    | "entropy"
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
    | "jetHalo"
    | "jetKeyline"
    | "jets"
    | "jobArt"
    | "jumping"
    | "launchInk"
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
    | "useRefusals"
    | "warpCover"
    | "warpPaint"
    | "warpScheme"
    | "weaponSolids"
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
  // The session's clock, which the interface's timing reads through its options.
  const clock = () => performance.now();
  const newer = saved.status === "newer";
  scene.savingUnavailable = newer || saved.status === "unavailable";
  scene.model = new GameModel(CONTENT, scene.entropy, SAVE_RESTORE, newer ? undefined : saved.save);
  scene.basePalette =
    readSpacePalette(scene.cache.json.get("space-palette")) ?? FALLBACK_SPACE_PALETTE;
  scene.palette = scene.basePalette;
  // Art's field colours by stable galaxy id; a galaxy Art has none for flies in the base field.
  scene.galaxyPalettes = galaxyPalettes(
    scene.basePalette,
    readGalaxyFields(scene.cache.json.get("galaxy-fields")),
  );
  scene.lightGalaxies = readLightGalaxies(scene.cache.json.get("galaxy-fields"));
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
  // SVGs (as each is next drawn, rasterDrawn), and the touch chrome on RASTER_SCALE_EVENT,
  // rasterise again once a resize moves the camera's zoom far enough (svgRasters.ts).
  const followZoom = (): void => {
    if (scene.rasters.resize(sceneFit(scene).zoom)) {
      scene.events.emit(RASTER_SCALE_EVENT, scene.rasters.scale);
    }
  };
  followZoom();
  scene.scale.on(Scale.Events.RESIZE, followZoom);
  partial.push(() => scene.scale.off(Scale.Events.RESIZE, followZoom));
  const host = document.getElementById(VIEW_HOST_ID);
  if (host) {
    const mapLabels = mapScreenLabels(CONTENT.labels);
    const penny = createPennyMarkerLayer(document, host, {
      available: () =>
        scene.enabled === true &&
        !scene.startShown &&
        !scene.settingsOpen &&
        !scene.model.state.dialogue &&
        !scene.model.state.docked,
      open: (marker, origin) => {
        const details = scene.model.markerDetails(marker);
        if (details?.kind === "quest") {
          scene.controls.openMarkerDetails(details.details, origin);
        } else if (details?.kind === "point") {
          const { point } = details;
          const kind = markerName(point);
          scene.controls.openMarkerDetails(
            {
              description: [
                point.label && point.label !== kind ? kind : "",
                mapDistance(mapLabels, point.distance),
              ]
                .filter(Boolean)
                .join(" · "),
              title: point.label ?? kind,
            },
            origin,
          );
        }
      },
    });
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
  scene.launchInk = scene.add.graphics();
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
  scene.jetHalo = scene.add.graphics();
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
  scene.cacheArt = readCacheArt(scene.shipAssets);
  scene.upgradePickupArt = readUpgradePickup(manifest?.assets ?? []);
  scene.weaponSolids = readWeaponSolids(manifest?.assets ?? []);
  scene.holodiskArt = readLoopArt(scene.shipAssets, "holodisk", HOLODISK_FRAMES);
  scene.ammoPackArt = readLoopArt(scene.shipAssets, "ammo-pack", AMMO_PACK_FRAMES);
  scene.coreAssetIds = (manifest?.assets ?? []).map(({ id }) => id);
  scene.manifest = {
    assets: bootAssets,
    ...(manifest?.tow ? { tow: manifest.tow } : {}),
    ...(manifest?.jobs ? { jobs: manifest.jobs } : {}),
    ...(manifest?.backdropLayers ? { backdropLayers: manifest.backdropLayers } : {}),
  };
  scene.beaconArt = readBeaconArt(scene.shipAssets);
  scene.destruction = readDestruction(scene.cache.json.get("destruction"));
  for (const archetype of [
    ...Object.keys(scene.destruction?.archetypes ?? {}),
    ...INDUSTRIAL_BODY_KEYS,
  ]) {
    publishCoreShards(scene, archetype);
  }
  scene.paintAssets = (manifest?.assets ?? []).filter((asset) => asset.paint !== undefined);
  const ship = scene.shipAssets.find((asset) => asset.id === "ship");
  scene.ship.setDisplaySize(ship?.displayWidth ?? 42, ship?.displayHeight ?? 42);
  scene.ship.setOrigin(ship?.pivot.x ?? 0.5, ship?.pivot.y ?? 0.5);
  const apply = (action: () => void, { preserveInput = false } = {}): void => {
    if (!scene.entryCurrent() || !requiredReady()) {
      return;
    }
    if (newer || scene.emergencyReturn.active) {
      return;
    }
    const before = scene.model.screen;
    action();
    observeFeedback(scene);
    if (!preserveInput) {
      scene.controls.reset();
    }
    flushScene(scene);
    refreshScene(scene);
    if ((before === "start") !== (scene.model.screen === "start")) {
      requestUpdateCheck();
    }
  };
  // A cheat acts on the real save like any other action: apply saves it.
  const cheat = (id: CheatId) => ({
    available: () => scene.model.cheatAvailable(id),
    id,
    label: CHEAT_COPY[id],
    ...(id === "addOre" || id === "addStardust"
      ? {}
      : { refusalReason: () => "Action unavailable." }),
    run: () => apply(() => scene.model.cheat(id)),
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
    continueGame: () => apply(() => scene.model.continueGame()),
    // A tap on a notice dismisses it without touching flight input.
    dismissNotice: () => {
      scene.model.dismissNotice();
      refreshScene(scene);
    },
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
            path: materialShipFrames(scene, asset.paint ?? null)[heading] ?? "",
          };
    }),
    scene.shipJets && engineJets(scene.shipJets, 1),
    scene.cache.json.get(TITLE_SCREEN_KEY),
  );
  if (!titleArt || !scene.shipJets || !hasShipHeadings(scene.shipAssets)) {
    throw new Error("Required first-screen art or speed jets are invalid");
  }
  titleArts.set(scene, titleArt);
  scene.shell.setTitleArt(titleArt);
  // Update now saves the game before it switches builds.
  saveBeforeUpdate(() => flushScene(scene));
  let rewindSource: CampaignSave | null = null;
  let rewindRequest = 0;
  const canRewind = () => !newer && campaignRewindAllowed(scene);
  const authorizeCampaignRewind = (open: boolean) => {
    const request = ++rewindRequest;
    rewindSource = null;
    if (open && canRewind()) {
      void saves.readCampaign().then((source) => {
        if (request === rewindRequest && canRewind()) {
          rewindSource = source;
        }
      });
    }
  };
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
      onOpenChange: authorizeCampaignRewind,
      rows: [
        ...CHEAT_IDS.map(cheat),
        {
          available: () => rewindSource !== null && canRewind(),
          id: "selectiveReset",
          label: CHEAT_COPY.selectiveReset,
          run: () => {
            if (!rewindSource || !canRewind()) {
              return;
            }
            const request = ++rewindRequest;
            void saves.readCampaign().then((source) => {
              if (request === rewindRequest && canRewind()) {
                rewindSource = source;
                if (source) {
                  rewindCard.open();
                }
              }
            });
          },
        },
      ],
    },
    contextQuestDetails: () => scene.model.contextQuestDetails,
    exit: exitShown() ? { label: CONTENT.labels.exit ?? "", onExit: exitGame } : undefined,
    fpsCounter: scene.fpsCounter,
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
      motionNote: CONTENT.labels.motionNote ?? "",
      moveControls: CONTENT.labels.moveControls ?? "",
      reducedMotion: CONTENT.labels.reducedMotion ?? "",
      settings: CONTENT.labels.settings ?? "",
      sound: CONTENT.labels.sound ?? "",
      soundNote: CONTENT.labels.soundNote ?? "",
    },
    noticeLabels: CONTENT.labels,
    now: clock,
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
      if (paused) {
        pauseNetworkPlayClock(scene);
      }
      armBack(scene);
      flushScene(scene);
    },
    onWeaponSelect: (weapon) => {
      const state = scene.model.state;
      let refused = false;
      if (!scene.settingsOpen && state.mode === "space" && !state.dialogue && !state.docked) {
        apply(
          () => {
            const flight = state.flight;
            const previous = flight?.weapon;
            refused = !scene.model.selectWeapon(weapon);
            if (!refused && flight && previous !== undefined) {
              observeWeaponEquip(scene, flight, previous);
            }
          },
          { preserveInput: true },
        );
      }
      return refused;
    },
    paintSwatch: (scheme) => paintSwatch(scene, scheme),
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
        if (scene.model.canTeleport(id)) {
          jumpThen(() => scene.model.teleport(id));
        }
      },
      paint: {
        applyLabel: CONTENT.labels.shipPaintApply ?? "",
        current: () => scene.model.state.economy.paint,
        inUseLabel: CONTENT.labels.inUse ?? "",
        schemes: () =>
          ECONOMY.paintOrder
            .filter(
              (id) => id === ECONOMY.defaultPaint || scene.model.state.economy.paints.includes(id),
            )
            .map((id) => {
              const swatch = paintSwatch(scene, id);
              return {
                id,
                name: itemName(ECONOMY, CONTENT.labels, { kind: "paint", scheme: id }),
                ...(swatch ? { swatch } : {}),
              };
            }),
        select: (id) => apply(() => scene.model.selectPaint(id), { preserveInput: true }),
        title: CONTENT.labels.shipPaintPicker ?? "",
      },
      questTracking: {
        canTrack: (id) => scene.model.canTrackQuest(id),
        current: () => scene.model.trackedQuestId,
        track: (id) => {
          if (!scene.model.trackQuest(id)) {
            return false;
          }
          flushScene(scene);
          return true;
        },
      },
      shipFrame: (heading) => materialClassicShipFrame(scene, heading),
    },
    rasterScale: scene.rasters.scale,
    requiredReady,
    shieldLabel: CONTENT.labels.shield ?? "",
    storage: pageStorage(),
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
  const bossHud = createBossHud(scene.controls.overlay);
  scene.bossHud = bossHud;
  partial.push(() => bossHud.dispose());
  const scanView = createScanFeedbackView(
    document.getElementById(VIEW_HOST_ID) ?? scene.controls.overlay,
    scene.controls.overlay,
  );
  scanViews.set(scene, { state: scene.model.state, time: scene.time.now, view: scanView });
  partial.push(() => {
    scanView.dispose();
    scanViews.delete(scene);
  });
  const labels = CONTENT.labels;
  const label = (key: string): string => labels[key] ?? "";
  const stationOfferRow = (row: ShopRow) =>
    stationRow(
      ECONOMY,
      labels,
      scene.model.state.economy.stardust,
      row,
      (weapon) => fill(label("requiresWeapon"), { weapon: weaponName(labels, weapon) }),
      (scheme) => paintSwatch(scene, scheme),
    );
  const shopGroup = ({
    category,
    rows,
  }: NonNullable<ReturnType<GameModel["shopGroups"]>>[number]) => ({
    category,
    label: label({ ammo: "ammo", equipment: "equipment", weapons: "shopWeapons" }[category]),
    offers: rows.map(stationOfferRow),
  });
  const item = (key: string): ShopItem => JSON.parse(key) as ShopItem;
  // The conversation box never pauses play; a tap dismisses it.
  const finishConversation = (): void =>
    apply(() => {
      for (let count = 0; count < 20; count++) {
        const panel = scene.model.state.dialogue;
        const next = panel && linearDialogueContinuation(panel.choices);
        if (!next) {
          break;
        }
        scene.model.choose(next);
        if (scene.model.state.dialogue === panel) {
          break;
        }
      }
    });
  const interaction = createInteractionCard(scene.controls.overlay, {
    choose: (id) => apply(() => scene.model.choose(id)),
    close: () => apply(() => scene.model.closeInteraction()),
    reducedMotion: () => scene.controls.reducedMotion(),
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
        accepted = scene.model.acceptJob(id) === "accepted";
      });
      return accepted;
    },
    balance: () => ({
      ore: scene.model.state.flight?.cargo ?? 0,
      stardust: scene.model.state.economy.stardust,
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
      preview: (order) => scene.model.previewImmediateExchange(order),
    },
    greeting: () => scene.model.dockWelcome(),
    jobs: () => {
      const galaxy = scene.model.state.flight?.galaxy;
      return scene.model.jobBoard().map((job) => ({
        ...job,
        ...(galaxy && job.kind === "job" && job.type !== "activity"
          ? { brief: STATION_JOB_BRIEFS[galaxy][job.type] }
          : {}),
        rewardText: fill(label("jobReward"), { amount: job.reward }),
      }));
    },
    labels: {
      activityDrop: label("activityDrop"),
      close: label("close"),
      communityProjects: label("communityProjects"),
      confirmBuy: label("confirmBuy"),
      confirmCancel: label("confirmCancel"),
      continue: label("continue"),
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
      jobsProjects: label("jobsProjects"),
      owned: label("owned"),
      projectFunded: label("projectFunded"),
      questReward: label("questReward"),
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
              action: label("jobAccept"),
              kind: "confirm",
              price: donation.amount,
              title: fill(label("donateTitle"), { name: view.name }),
            };
      }
      const chosen = item(key);
      const request = scene.model.requestPurchase(chosen);
      if (request.kind === "refused") {
        return request;
      }
      const detail = shopItemDetail(
        ECONOMY,
        labels,
        shopRow(ECONOMY, scene.model.state.economy, chosen),
      );
      return {
        action: label("confirmBuy"),
        item: detail,
        kind: "confirm",
        price: request.price,
        title: fill(label("confirmTitle"), { name: itemDetailName(detail) }),
      };
    },
    rows: () =>
      // Show an effect before funding and the remaining price and progress afterward.
      (scene.model.projects ?? []).map((project) => ({
        glyph: { key: project.icon, kind: "stateVector" },
        group: "items",
        key: `project:${project.id}`,
        level:
          project.paid > 0
            ? fill(label("projectProgress"), { paid: project.paid, price: project.cost })
            : label(`projectEffect${project.copy}`),
        name: project.name,
        price: project.funded ? null : project.remaining,
        project: true,
        projectDetails: label(`projectAbout${project.copy}`),
        state: project.funded
          ? "owned"
          : scene.model.state.economy.stardust > 0
            ? "forSale"
            : "unaffordable",
      })),
    select: (key) => {
      const chosen = item(key);
      if (chosen.kind === "paint") {
        apply(() => scene.model.selectPaint(chosen.scheme));
      }
    },
    services: () => scene.model.stationServices,
    shopGroups: () => {
      const groups = scene.model.shopGroups();
      return groups ? [shopGroup(groups[0]), shopGroup(groups[1])] : undefined;
    },
    stationTitle: () => scene.model.dockedStationName,
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
      ? createJumpOverlay(clock, scene.controls.overlay, {
          field,
          glow,
          jump: jumpData,
          star,
          tunnel,
        })
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
      close: label("close"),
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
    now: clock,
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
    materialShipFrames(scene, paintInUse(scene)),
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
        () => materialShipFrames(scene, paintInUse(scene)),
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
      sprites: materialShipFrames(scene, paintInUse(scene)),
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
        preview: routePreviews(card),
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
  const rewindCard = createRestartCard(scene.controls.overlay, {
    commit: async (current) => {
      const source = rewindSource;
      if (!source || !canRewind()) {
        return null;
      }
      return commitCampaignRewind(scene, source, () => !newer && current());
    },
    kind: "rewind-quests",
    labels: {
      body: CHEAT_COPY.selectiveResetBody,
      cancel: CHEAT_COPY.cancel,
      close: CHEAT_COPY.close,
      restart: CHEAT_COPY.reset,
      title: CHEAT_COPY.selectiveResetTitle,
    },
  });
  openCampaignRewinds.set(scene, rewindCard.isOpen);
  partial.push(() => {
    openCampaignRewinds.delete(scene);
    rewindCard.dispose();
  });
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
      back: rewindCard.close,
      isOpen: rewindCard.isOpen,
    }),
  ];
  partial.push(() => homeLayers.forEach((unregister) => unregister()));
  const hide = (): void => {
    const scan = scanViews.get(scene);
    if (scan) {
      scan.time = undefined;
      scan.view.renderEquip(true, scene.time.now);
    }
    pauseNetworkPlayClock(scene);
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
  networkPlayNotice((notice) => {
    networkPlays.set(scene, { reason: notice.reason });
  });
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

// The network-play notice per scene once the launch reports it: the time it still has to show,
// set at the first flight, and the frame time it last showed at.
const networkPlays = new WeakMap<
  object,
  { reason: NetworkPlayNotice["reason"]; remaining?: number; shownAt?: number | undefined }
>();

function pauseNetworkPlayClock(scene: object): void {
  const notice = networkPlays.get(scene);
  if (notice) {
    notice.shownAt = undefined;
  }
}

/**
 * Whether the network-play notice wants the save status slot. Once per launch from the first
 * flight, the notice uses the line's full reading time, running only between visible samples.
 */
export function showNetworkPlay(
  scene: Pick<UiContext, "model" | "shell" | "time">,
  visible: boolean,
): boolean {
  const notice = networkPlays.get(scene);
  if (!notice) {
    return false;
  }
  const { flight, mode } = scene.model.state;
  const now = scene.time.now;
  const inFlight = mode === "space" && Boolean(flight);
  if (notice.remaining === undefined && inFlight) {
    const label = notice.reason === "quota" ? "networkPlayQuota" : "networkPlayUnsupported";
    notice.remaining = lineDuration(CONTENT.labels[label] ?? "") * 1000;
  }
  const reading = visible && inFlight;
  if (reading && notice.shownAt !== undefined && notice.remaining !== undefined) {
    notice.remaining -= Math.max(0, now - notice.shownAt);
  }
  const wanted = notice.remaining !== undefined && notice.remaining > 0;
  notice.shownAt = wanted && reading ? now : undefined;
  scene.shell.setNetworkPlay(wanted ? notice.reason : undefined);
  return wanted;
}

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
  const showsLine = line !== null && !sceneCovered;
  const showsNotice = notice !== "" && !sceneCovered;
  const networkPlay = showNetworkPlay(
    scene,
    !showsLine &&
      !showsNotice &&
      !covered &&
      !scene.jumping &&
      !document.hidden &&
      scene.model.screen === "space",
  );
  const occupant = boxOccupant({
    line: showsLine,
    notice: showsNotice,
    saveStatus: scene.savingUnavailable || networkPlay,
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
  const state = scene.model.state;
  const flight = state.flight;
  const scan = scanViews.get(scene);
  if (scan) {
    if (scan.state !== state) {
      scan.view.reset();
      scan.state = state;
      delete scan.equipFlight;
    }
    if (
      scan.equipFlight &&
      (scan.equipFlight !== flight || state.mode !== "space" || scene.startShown)
    ) {
      scan.view.clearEquip();
      delete scan.equipFlight;
    }
    scan.view.enqueue(scene.model.drainScanOutcomes());
    const scanCovered =
      covered ||
      Boolean(emergency) ||
      scene.controls.navigationCovered() ||
      scene.jumping ||
      scene.startShown ||
      !scene.enabled ||
      document.hidden ||
      scene.model.state.mode !== "space" ||
      !flight;
    const now = scene.time.now;
    const elapsed = scanCovered || scan.time === undefined ? 0 : Math.max(0, now - scan.time);
    scan.time = scanCovered ? undefined : now;
    scan.view.render({ covered: scanCovered, time: now }, elapsed);
    scan.view.renderEquip(scanCovered, now, line?.key);
  }
  const penny = pennyLayers.get(scene);
  if (!penny) {
    return;
  }
  const markers = paint.markers(flight, scene.settingsOpen, !sceneCovered && !emergency, () =>
    scene.model.targetMarkers(area, scene.litCaches),
  );
  // Measure HUD ink only for markers to place. A tracked marker above a nearby target also
  // clears Ada's ship, which may be directly under the target.
  const blocked =
    markers.length > 0 ? markerFootprints(document, document.getElementById(VIEW_HOST_ID)) : [];
  if (markers.some((marker) => marker.onScreen) && scene.ship.visible) {
    blocked.push(scene.ship.getBounds());
  }
  penny.place(
    flight?.player ?? { x: 0, y: 0 },
    area,
    {
      blocked,
      color: `#${scene.palette.pointOfInterest.toString(16).padStart(6, "0")}`,
      light: scene.light,
      reducedMotion: scene.reducedMotion,
      threat: `#${scene.palette.threat.toString(16).padStart(6, "0")}`,
    },
    markers,
  );
}

export function observeWeaponEquip(
  scene: UiContext,
  flight: FlightState,
  previous: FlightState["weapon"],
): void {
  const state = scene.model.state;
  const scan = scanViews.get(scene);
  if (
    scan?.state === state &&
    !scene.startShown &&
    state.mode === "space" &&
    state.flight === flight &&
    flight.weapon !== previous
  ) {
    scan.equipFlight = flight;
    scan.view.equip(flight.weapon, weaponName(CONTENT.labels, flight.weapon));
  }
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
  const flight = scene.model.state.flight;
  const paint = ECONOMY.paints[ship.paint]?.label;
  return {
    ...ship,
    ...(flight
      ? {
          shieldHealth: {
            capacity: scene.model.shieldMax,
            rechargeDelay: CONTENT.tuning.shieldRechargeDelay,
            shield: flight.shield,
          },
        }
      : {}),
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
  scene.bossHud?.show(scene.model.bossHud());
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
    // Each Use press the model refused since the last frame plays the Use disc's refusal cue.
    const refusals = scene.model.useRefusals;
    if (refusals > scene.useRefusals) {
      scene.controls.refuseUse();
    }
    scene.useRefusals = refusals;
    scene.controls.setWeapons(scene.model.weapons());
    noticeGains(scene);
    renderStatus(scene);
  }
  scene.station.setOpen(state.mode === "space" && Boolean(state.docked));
  const screen = scene.model.screen;
  const start = screen === "start";
  scene.startShown = start;
  // Play keeps the screen on; the start screen and the Paused card let it sleep.
  const playing = !start && !scene.settingsOpen;
  if (playing !== scene.screenOn) {
    scene.screenOn = playing;
    keepScreenOn(playing);
  }
  armBack(scene);
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
    flightLog: scene.model.flightLog,
    ...(state.mode === "space" && state.flight ? { galaxy: state.flight.galaxy } : {}),
    inDanger: scene.model.inDanger,
    job: scene.model.jobObjective,
    map: covered ? null : scene.model.map,
    menuContext: start ? "start" : "nonplay",
    navigation: entry,
    place: entry === "pause" ? "flight" : null,
    questEntries: scene.model.quests,
    ship: state.mode === "space" && state.flight ? shipView(scene) : null,
    stardust: state.economy.stardust,
    towing: scene.model.towing,
  });
  scene.controls.setAchievements(scene.model.achievements);
  const continuation: GameModel & { readonly canContinue?: boolean } = scene.model;
  scene.shell.render(state, screen, continuation.canContinue, continuation.noticeOpacity);
  const interactionPanel = screen === "space" && state.dialogue?.text ? state.dialogue : null;
  const interactionGalaxy = state.flight?.galaxy ?? state.selectedGalaxy;
  interactionCards.get(scene)?.show(
    {
      ...(state.docked ? { docked: state.docked } : {}),
      galaxy: interactionGalaxy,
      progress: state.progress[interactionGalaxy],
    },
    interactionPanel,
  );
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

/** The one save write, so every save path shares its admission. */
export async function flushScene(scene: UiContext): Promise<void> {
  if (
    writingCampaignRewinds.has(scene) ||
    openCampaignRewinds.get(scene)?.() ||
    !requiredReady() ||
    !scene.entryCurrent()
  ) {
    return;
  }
  const admitted = scene.entryCurrent;
  const generation = requiredLoading.state.attempt;
  const document = scene.model.saveDocument();
  const result = await saves.save(document);
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

function campaignRewindAllowed(scene: UiContext): boolean {
  const { screen, state } = scene.model;
  return (
    requiredReady() &&
    scene.entryCurrent() &&
    scene.sys.isActive() &&
    !scene.savingUnavailable &&
    !scene.emergencyReturn.active &&
    !scene.jumping &&
    !scene.model.galaxyMapOpen &&
    !state.dialogue &&
    !state.docked &&
    !state.flight?.storyScene &&
    (screen === "start" || screen === "space")
  );
}

/** Build offscreen and replace the model only after the authorized real save was committed. */
async function commitCampaignRewind(
  scene: UiContext,
  source: CampaignSave,
  current: () => boolean,
): Promise<((present: boolean) => void) | null> {
  const model = scene.model;
  const generation = requiredLoading.state.attempt;
  const authorized = () =>
    current() &&
    campaignRewindAllowed(scene) &&
    scene.model === model &&
    requiredLoading.state.attempt === generation;
  if (!authorized() || writingCampaignRewinds.has(scene)) {
    return null;
  }
  writingCampaignRewinds.add(scene);
  let committed = false;
  try {
    const next = openRewoundCampaign(CONTENT, scene.entropy, SAVE_RESTORE, source.save);
    const adoptGeneration = await saves.commitCampaign(source, next.saveDocument(), authorized);
    if (!adoptGeneration) {
      return null;
    }
    committed = true;
    return (present) => {
      try {
        if (present && scene.entryCurrent() && scene.sys.isActive()) {
          // Closing navigation calls onPauseChange, which can request a save of the old model.
          scene.controls.closeSettings();
          scene.controls.closePause();
          adoptGeneration();
          replaceModel(next, scene);
        }
      } finally {
        writingCampaignRewinds.delete(scene);
      }
    };
  } finally {
    if (!committed) {
      writingCampaignRewinds.delete(scene);
    }
  }
}
