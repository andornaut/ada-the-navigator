// The scene's DOM interface: building the controls, cards and screens, and refreshing them.
// Functions over the scene's UiContext.
import { Scale, type Scene, Scenes } from "phaser";

import PROJECTS_FILE from "../../public/art/projects.json" with { type: "json" };
import { CHEAT_COPY } from "../data/cheatCopy.ts";
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { BUILT, ROUTE } from "../data/galaxies.ts";
import { galaxyCard } from "../data/storybook.ts";
import { coarsePointer } from "../input/coarsePointer.ts";
import { createControls } from "../input/controls.ts";
import { grantAllWeapons } from "../model/cheats.ts";
import { GameModel } from "../model/game.ts";
import { gainSnapshot, itemGains } from "../model/itemGains.ts";
import { SHIP_HEADINGS } from "../model/nose.ts";
import { newerSave } from "../model/save.ts";
import { fill, itemAbout, itemName, type ShopItem } from "../model/shop.ts";
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
import { backReleased } from "../ui/backStack.ts";
import { createConversationBox } from "../ui/conversation.ts";
import { screenShakes } from "../ui/deviceSettings.ts";
import { createBannerLayer } from "../ui/disabledBanner.ts";
import { createGalaxyMap } from "../ui/galaxyMap.ts";
import { createJumpOverlay, type SheetArt } from "../ui/jumpOverlay.ts";
import { VIEW_HOST_ID } from "../ui/layout/css.ts";
import { fogColor } from "../ui/layout/mapScreen.ts";
import { type MapField, mapScreenLabels } from "../ui/mapScreen.ts";
import { BOX_OCCUPANT, boxOccupant } from "../ui/notice.ts";
import { galaxiesAvailable } from "../ui/pause.ts";
import { createRestartCard } from "../ui/restartCard.ts";
import { aboardLabel, type ShipView } from "../ui/shipCard.ts";
import { createStationView } from "../ui/station.ts";
import { stardustCount } from "../ui/statusPill.ts";
import { createStorybook, storyPageView } from "../ui/storybook.ts";
import { readTitleScreen } from "../ui/titleScreen.ts";
import { type CoreManifest, galaxyManifestKey, readGalaxyManifest } from "./artManifest.ts";
import { readDestruction, readShards } from "./destructionArt.ts";
import { EDGE_MARKER_DEPTH } from "./drawOrder.ts";
import { enemyPartFrame, GALAXY_FAMILIES } from "./enemyArt.ts";
import { readEnemyWeaponsArt } from "./enemyWeaponsArt.ts";
import { TELEPORT_DISTANCE } from "./feedback.ts";
import { lightGalaxy, readLightGalaxies } from "./lightField.ts";
import { readSave, stopSaving, writeSave } from "./persistence.ts";
import { fitPlayCamera, sceneFit, shakeIntensity } from "./playCamera.ts";
import { readProjectArt } from "./projectArt.ts";
import { readQuantumJump } from "./quantumJump.ts";
import {
  markerHue,
  readRouteArt,
  readRouteMarkers,
  routePreviews,
  routeShipFrames,
} from "./routeArt.ts";
import type { GameScene } from "./scene.ts";
import {
  loadAsteroidArt,
  loadShipFrames,
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
import { readOutpostArt, readStationArt } from "./stationArt.ts";
import { RASTER_SCALE_EVENT } from "./svgRasters.ts";
import { readUpgradePickup } from "./upgradePickup.ts";
import { BEACON_FRAMES, CACHE_FRAMES, HOLODISK_FRAMES, readLoopArt } from "./worldArt.ts";

/** The scene state and methods this module's functions use. */
export type UiContext = Scene &
  Pick<
    GameScene,
    | "add"
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
    | "controls"
    | "conversationBox"
    | "coreAssetIds"
    | "craftArt"
    | "debrisArt"
    | "destruction"
    | "edgeMarkerInk"
    | "enabled"
    | "enemyArt"
    | "enemyJets"
    | "enemyWeaponsArt"
    | "events"
    | "familyArts"
    | "familyParts"
    | "familyShards"
    | "feedback"
    | "feedbackSound"
    | "galaxies"
    | "galaxyBackdrops"
    | "galaxyLoads"
    | "galaxyManifestPaths"
    | "galaxyManifests"
    | "galaxyPalettes"
    | "galaxyStations"
    | "game"
    | "held"
    | "holodiskArt"
    | "hubArt"
    | "indicatorInk"
    | "ink"
    | "jetKeyline"
    | "jets"
    | "jobArt"
    | "jumping"
    | "lightGalaxies"
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
    | "projectArt"
    | "quantum"
    | "rasters"
    | "reducedMotion"
    | "resourceFiles"
    | "resourceRocks"
    | "restartCard"
    | "rockQueued"
    | "rockRequests"
    | "routeGalaxies"
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
  const saved = readSave();
  const newer = newerSave(saved);
  if (newer) {
    stopSaving();
  }
  scene.model = new GameModel(CONTENT, newer ? null : saved);
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
  fitPlayCamera(scene);
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
  scene.events.once(Scenes.Events.SHUTDOWN, () => scene.scale.off(Scale.Events.RESIZE, followZoom));
  const host = document.getElementById(VIEW_HOST_ID);
  if (host) {
    const layer = createBannerLayer(document, host, CONTENT.labels.disabledBanner ?? "");
    scene.bannerLayer = layer;
    scene.events.once(Scenes.Events.SHUTDOWN, () => layer.destroy());
  }
  scene.ink = scene.add.graphics();
  // Enemy jets draw behind enemy sprites; shots and feedback draw above both.
  scene.enemyJets = scene.add.graphics().setDepth(1);
  scene.overlay = scene.add.graphics().setDepth(3);
  scene.indicatorInk = scene.add.graphics().setDepth(3 - 1e-6);
  scene.edgeMarkerInk = scene.add.graphics().setDepth(EDGE_MARKER_DEPTH);
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
  for (const archetype of Object.keys(scene.destruction?.archetypes ?? {})) {
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
    action();
    observeFeedback(scene);
    scene.controls.reset();
    flushScene(scene);
    refreshScene(scene);
  };
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
  // The galaxy map's close X, back and Escape, one step back: in flight the local map again, focus
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
  // The start screen's art: its field, wordmark, each paint's ship frame and the speed jets at
  // Engine level 1.
  scene.shell.setTitleArt(
    readTitleScreen(
      manifest?.assets ?? [],
      scene.shipJets && engineJets(scene.shipJets, 1),
      scene.cache.json.get(TITLE_SCREEN_KEY),
    ),
  );
  scene.controls = createControls(scene, {
    achievements: {
      close: CONTENT.labels.close ?? "",
      next: CONTENT.labels.next ?? "",
      page: CONTENT.labels.achievementsPage ?? "",
      previous: CONTENT.labels.previous ?? "",
      progress: CONTENT.labels.achievementProgress ?? "",
      title: CONTENT.labels.achievements ?? "",
    },
    cheats: {
      actions: [
        {
          description: CHEAT_COPY.grantDescription,
          execute: ({ commit }) => {
            commit(() => {
              grantAllWeapons(scene.model.state);
            });
          },
          id: "grant-all-weapons",
          label: CHEAT_COPY.grantAllWeapons,
          scope: "save",
        },
      ],
      canExecute: () => scene.model.state.mode === "space" && !scene.model.state.dialogue,
      labels: CHEAT_COPY,
      onSave: () => apply(() => {}),
      run: () => (scene.model.state.mode === "space" ? scene.model.state.flight : null),
    },
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
          cargo: CONTENT.labels.cargo ?? "",
          equipment: CONTENT.labels.equipment ?? "",
        },
        shipRows: CONTENT.labels,
        title: CONTENT.labels.pauseTitle ?? "",
      },
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
    shieldLabel: CONTENT.labels.shield ?? "",
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
  const labels = CONTENT.labels;
  const label = (key: string): string => labels[key] ?? "";
  const amount = (value: number): string => fill(label("stardustAmount"), { amount: value });
  const item = (key: string): ShopItem => JSON.parse(key) as ShopItem;
  // The conversation box never pauses play; a tap moves it on.
  scene.conversationBox = createConversationBox(() => {
    scene.model.advanceConversation();
    renderConversation(scene);
  });
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
    projectsShown: () => scene.model.projects !== null,
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
        : scene.model
            .shopRows(tab)
            .map((row) => stationRow(ECONOMY, labels, scene.model.state.economy.stardust, row)),
    select: (key) => {
      const chosen = item(key);
      if (chosen.kind === "paint") {
        apply(() => scene.model.selectPaint(chosen.scheme));
      }
    },
    undock: () => apply(() => scene.model.undock()),
  });
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
  // The home half: storybook pages, galaxy selection and Restart's confirm.
  scene.storybook = createStorybook(scene.controls.overlay, {
    labels: { next: label("next"), previous: label("previous"), skip: label("skip") },
    onChoose: (index) => apply(() => scene.model.storyChoose(index)),
    onNext: () => apply(() => scene.model.storyNext()),
    onPrevious: () => apply(() => scene.model.storyPrevious()),
    onSkip: () => apply(() => scene.model.storySkip()),
    reducedMotion: () => scene.controls.reducedMotion(),
  });
  scene.galaxies = createGalaxyMap(scene.controls.overlay, {
    labels: {
      close: label("close"),
      development: label("galaxyInDevelopment"),
      home: label("homeButton"),
      jump: label("jump"),
      locked: label("galaxyLocked"),
      number: label("galaxyNumber"),
      stay: label("stayHere"),
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
        // Stay here: both maps close and the same flight resumes, with no jump.
        apply(() => scene.model.jump());
        scene.controls.closePause();
      } else if (selected !== null && scene.model.isUnlocked(selected)) {
        // The map is the jump's source: its panel, actions and close X go at once.
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
  // The route map's art: the sky, ground and figures, the marker hues and Ada's frames.
  const routeAssets = manifest?.assets ?? [];
  const markers = readRouteMarkers(scene.cache.json.get("galaxy-fields"));
  const routeArt = readRouteArt(routeAssets, markers, (thrust) =>
    routeShipFrames(routeAssets, paintInUse(scene), thrust),
  );
  if (routeArt) {
    scene.galaxies.setArt(routeArt);
  }
  // The warp ship: the paint's poses, and its idle frames for the sprite steps.
  scene.warpPaint = () => ({
    scheme: scene.model.state.economy.paint,
    sprites: routeShipFrames(routeAssets, paintInUse(scene), false),
  });
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
  const homeLayers = [
    // Back on a storybook page acts as Previous, and does nothing on a scene's first page. On
    // Ada's room page, back and Escape open the Paused card instead.
    scene.controls.registerBack({
      back: () => apply(() => scene.model.storyPrevious()),
      isOpen: () => scene.model.screen === "story" && !scene.model.roomPage && !scene.settingsOpen,
    }),
    // Back and Escape on the galaxy map: one step back, as its close X. In flight it opens
    // over the Paused card's local map, so it is the innermost card while that card is open.
    scene.controls.registerBack({
      back: closeGalaxyMap,
      isOpen: () =>
        scene.galaxies.isOpen() && (scene.model.galaxyMapShownInFlight || !scene.settingsOpen),
    }),
    scene.controls.registerBack({
      back: () => scene.restartCard.close(),
      isOpen: () => scene.restartCard.isOpen() && !scene.settingsOpen,
    }),
  ];
  const hide = (): void => {
    scene.controls.reset();
    flushScene(scene);
  };
  window.addEventListener("pointerdown", scene.feedbackSound.unlock);
  window.addEventListener("keydown", scene.feedbackSound.unlock);
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", hide);
  scene.events.once(Scenes.Events.SHUTDOWN, () => {
    flushScene(scene);
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pointerdown", scene.feedbackSound.unlock);
    window.removeEventListener("keydown", scene.feedbackSound.unlock);
    scene.feedbackSound.dispose();
    unregisterStation();
    homeLayers.forEach((unregister) => unregister());
    scene.storybook.dispose();
    scene.quantum?.dispose();
    scene.galaxies.dispose();
    scene.restartCard.dispose();
    scene.station.dispose();
    scene.conversationBox.dispose();
    scene.controls.dispose();
    scene.shell.dispose();
  });
  observeFeedback(scene);
  if (newer) {
    requireNewerVersion((state) => scene.shell.setRequiredUpdate(state));
  }
  refreshScene(scene);
  loadAsteroidArt(scene);
}

/** The conversation box, in the desktop wording without a coarse pointer. */
export function renderConversation(scene: UiContext): void {
  scene.conversationBox.render(
    scene.model.conversation,
    !coarsePointer(window),
    scene.reducedMotion,
  );
  // One box at a time: a line, else the game notice, else the save status (notice.ts). A card
  // over the play view covers the line or notice under it, which frees the slot for the save
  // status, drawn above cards.
  const { dialogue, docked, notice } = scene.model.state;
  const covered = scene.settingsOpen || Boolean(dialogue) || Boolean(docked);
  const occupant = boxOccupant({
    line: scene.model.conversation !== null && !covered,
    notice: notice !== "" && !covered,
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
}

export function observeFeedback(scene: UiContext): void {
  const kinds = scene.feedback.observe(TELEPORT_DISTANCE, scene.model.state);
  scene.feedbackSound.play(kinds);
  if (scene.screenShake && kinds.includes("damage")) {
    const camera = scene.cameras.main;
    camera.shake(100, shakeIntensity(camera.zoom, 0.002));
  }
}

/** The Ship card's facts with the paint named. */
export function shipView(scene: UiContext): ShipView {
  const ship = scene.model.ship;
  const paint = ECONOMY.paints[ship.paint]?.label;
  return { ...ship, paint: (paint && CONTENT.labels[paint]) ?? "" };
}

// Queues item notices for what Ada gained since last frame; a new flight starts from what she
// holds, and leaving flight clears them.
export function noticeGains(scene: UiContext): void {
  const { flight, mode } = scene.model.state;
  if (mode !== "space" || !flight) {
    if (scene.held) {
      scene.held = undefined;
      scene.controls.setGains(null);
    }
    return;
  }
  const snapshot = gainSnapshot(scene.model.state.economy.paints, scene.model.ship);
  if (scene.held?.flight === flight) {
    const gains = itemGains(Boolean(scene.model.state.docked), scene.held.snapshot, snapshot);
    if (gains.length > 0) {
      scene.controls.setGains(gains);
    }
  } else if (scene.held) {
    scene.controls.setGains(null);
  }
  scene.held = { flight, snapshot };
}

export function refreshScene(scene: UiContext): void {
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
  const action = enabled ? scene.model.contextAction : undefined;
  scene.controls.setContext(action && { action, label: scene.model.contextLabel ?? "" });
  scene.controls.setWeapons(scene.model.weapons());
  noticeGains(scene);
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
    recharging: scene.model.shieldRecharging,
    shield: state.flight?.shield ?? 0,
    stardust: state.economy.stardust,
    stardustLabel: fill(CONTENT.labels.stardustAmount ?? "", {
      amount: stardustCount(state.economy.stardust),
    }),
  });
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
  scene.controls.setSettingsButton(state.mode !== "space");
  scene.controls.setAchievementsButton(start);
  scene.controls.setExitButton(start);
  scene.controls.setPause({
    carrying: scene.model.carrying,
    field: mapField(scene),
    inDanger: scene.model.inDanger,
    job: scene.model.jobObjective,
    map: scene.model.map,
    place: enabled ? "flight" : scene.model.roomPage ? "room" : null,
    ship: enabled ? shipView(scene) : null,
    towing: scene.model.towing,
  });
  scene.controls.setAchievements(scene.model.achievements);
  scene.shell.render(state, screen);
  const flightGalaxy = state.mode === "space" ? state.flight?.galaxy : undefined;
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
    },
    null,
  );
  const panel = scene.model.selectedPosition;
  const ship = scene.model.shipPosition;
  scene.galaxies.show(
    selected !== null && panel !== null && ship !== null
      ? {
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

export function flushScene(scene: UiContext): void {
  const available = writeSave(scene.model.save());
  scene.shell.setSavingAvailable(available);
  scene.savingUnavailable = !available;
}
