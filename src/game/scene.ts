import Phaser from "phaser";

import { CHEAT_COPY } from "../data/cheat-copy.ts";
import { ECONOMY } from "../data/economy.ts";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { SCREEN } from "../data/screen.ts";
import { GALAXIES, SELECTOR_BACKDROP } from "../data/storybook.ts";
import { BEAM, weaponAt } from "../data/weapon-catalog.ts";
import { createControls } from "../input/controls.ts";
import { grantAllWeapons } from "../model/cheats.ts";
import { carriesStardust } from "../model/drops.ts";
import { enemySpeedFraction } from "../model/enemy-ai.ts";
import {
  activeBeamFlashes,
  activeBlastFlashes,
  BLAST_FLASH_SECONDS,
  shipSpeedFraction,
  stationDock,
} from "../model/flight.ts";
import { GameModel } from "../model/game.ts";
import { projectileOpacity } from "../model/player-projectiles.ts";
import { hullOffset } from "../model/ship-physics.ts";
import { fill, itemAbout, itemName, type ShopItem } from "../model/shop.ts";
import { stationIndicatorTarget } from "../model/stations.ts";
import type { FlightInput, SpaceObject, Vec } from "../model/types.ts";
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
import { screenShakes } from "../ui/device-settings.ts";
import { createGalaxySelect } from "../ui/galaxy-select.ts";
import { createRestartCard } from "../ui/restart-card.ts";
import { createStardustCounter } from "../ui/stardust-counter.ts";
import { createStationView } from "../ui/station.ts";
import { createStorybook } from "../ui/storybook.ts";
import { asteroidArt, type AsteroidOutline, cellTint, tinted } from "./asteroid-art.ts";
import {
  type DestructionData,
  flashAt,
  readDestruction,
  readShards,
  reducedAt,
  type ShardData,
  shardPolygons,
} from "./destruction-art.ts";
import {
  type EnemyArt,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
  enemyJetsPath,
  enemyJetTriangles,
  selectEnemyFrame,
} from "./enemy-art.ts";
import { FeedbackSound, ModelFeedback } from "./feedback.ts";
import { readSave, writeSave } from "./persistence.ts";
import { sceneryDetail } from "./scenery.ts";
import { StoryShell } from "./shell.ts";
import {
  paintFrames,
  selectPaintedShipAsset,
  type ShipAsset,
  shipDirectionCount,
} from "./ship-art.ts";
import { jetTriangles, readShipJets, type ShipJets } from "./ship-jets.ts";
import { stationRow } from "./shop-view.ts";
import {
  FALLBACK_SPACE_PALETTE,
  galaxyBackground,
  readSpacePalette,
  spaceColorCss,
  spaceObjectColor,
} from "./space-palette.ts";
import {
  readStardustArt,
  type StardustArt,
  stardustDrawn,
  stardustFrame,
  stardustPhase,
} from "./stardust-art.ts";
import {
  nameLabelled,
  readStationArt,
  type StationArt,
  type StationFrame,
  stationFrame,
} from "./station-art.ts";
import { preloadTouchChrome } from "./touch-chrome.ts";

// Art's destruction data; a wreck's flash sprite shares its id plus this suffix.
const DESTRUCTION_PATH = "/art/enemies/destruction.json";
const FLASH_SUFFIX = ":flash";

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
  private stationArt: StationArt<Asset> | undefined;
  private stardustArt: StardustArt<Asset> | undefined;
  private destruction: DestructionData | undefined;
  private shards = new Map<string, ShardData>();
  private reducedMotion = false;
  // Painted ship frames load only for the scheme in use.
  private paintAssets: Asset[] = [];
  private paintLoads = new Set<string>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private settingsOpen = false;
  private startShown = false;
  private enabled: boolean | undefined;
  private durable = "";
  private savedAt = 0;
  private feedback = new ModelFeedback();
  private feedbackSound = new FeedbackSound();
  private screenShake = true;
  private palette = FALLBACK_SPACE_PALETTE;
  // The space background in use: the flight's galaxy hue, else the palette's.
  private spaceBackground = FALLBACK_SPACE_PALETTE.background;
  private station!: ReturnType<typeof createStationView>;
  private storybook!: ReturnType<typeof createStorybook>;
  private galaxies!: ReturnType<typeof createGalaxySelect>;
  private restartCard!: ReturnType<typeof createRestartCard>;
  private stardust!: ReturnType<typeof createStardustCounter>;

  constructor() {
    super("prototype");
  }

  preload(): void {
    this.load.once("filecomplete-json-art-manifest", () => {
      const manifest = this.cache.json.get("art-manifest") as {
        assets: Asset[];
        spacePalette?: string;
      };
      if (manifest.spacePalette) {
        this.load.json("space-palette", manifest.spacePalette);
      }
      for (const [archetype, frames] of enemyFrameSets(manifest.assets)) {
        this.load.json(`enemy-jets-${archetype}`, enemyJetsPath(archetype, frames[0]!));
      }
      for (const asset of manifest.assets) {
        // Painted ship frames load on demand, only for the scheme in use.
        if (asset.paint !== undefined) {
          continue;
        }
        if (asset.path.endsWith(".svg")) {
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
    preloadTouchChrome(this);
  }

  create(): void {
    this.palette = readSpacePalette(this.cache.json.get("space-palette")) ?? FALLBACK_SPACE_PALETTE;
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
    this.jets = this.add.graphics().setDepth(9);
    this.ship = this.add.image(0, 0, "ship").setDepth(10);
    const manifest = this.cache.json.get("art-manifest") as { assets: Asset[] } | undefined;
    this.shipAssets = (manifest?.assets ?? []).filter((asset) => this.textures.exists(asset.id));
    // Jets render behind the ship sprite. Missing, invalid or heading-mismatched metadata keeps
    // the authored thrust frames.
    const jets = readShipJets(this.cache.json.get("ship-jets"));
    this.shipJets =
      jets?.headings.length === shipDirectionCount(this.shipAssets) ? jets : undefined;
    // Archetypes without a complete loaded frame set keep their vector placeholders.
    this.enemyArt = enemyArt(
      (archetype) => this.cache.json.get(`enemy-jets-${archetype}`),
      enemyFrameSets(this.shipAssets),
    );
    // Art without its loaded textures or data keeps the placeholders.
    this.stationArt = readStationArt(this.shipAssets);
    this.stardustArt = readStardustArt(this.shipAssets);
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
    this.shell = new StoryShell({
      choose: (id) => apply(() => this.model.choose(id)),
      continueGame: () => apply(() => this.model.continueGame()),
      reducedMotion: () => this.controls.reducedMotion(),
      restart: () => this.restartCard.open(),
      start: () => apply(() => this.model.start()),
    });
    this.controls = createControls(this, {
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
        if (!this.settingsOpen && state.mode === "space" && !state.dialogue && !state.docked) {
          apply(() => this.model.selectWeapon(weapon));
        }
      },
      // Navigation lives in the Paused card; both refuse while Ada is in danger.
      pause: {
        buttonLabel: PROTOTYPE.labels.pause ?? "",
        labels: {
          close: PROTOTYPE.labels.close ?? "",
          destinations: PROTOTYPE.labels.destinations ?? "",
          resume: PROTOTYPE.labels.resume ?? "",
          returnHome: PROTOTYPE.labels.returnHome ?? "",
          settings: PROTOTYPE.labels.settings ?? "",
          title: PROTOTYPE.labels.pauseTitle ?? "",
          travel: PROTOTYPE.labels.travel ?? "",
          travelEmpty: PROTOTYPE.labels.travelEmpty ?? "",
          travelUnavailable: PROTOTYPE.labels.travelUnavailable ?? "",
        },
        onReturnHome: () => {
          if (!this.model.inDanger) {
            apply(() => this.model.returnHome());
          }
        },
        onTravel: (id) => {
          if (!this.model.inDanger) {
            apply(() => this.model.teleport(id));
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
    this.stardust = createStardustCounter(this.controls.overlay);
    this.station = createStationView(this.controls.overlay, {
      balance: () => ({
        amount: this.model.state.economy.stardust,
        text: amount(this.model.state.economy.stardust),
      }),
      buy: (key) => apply(() => this.model.buy(item(key))),
      labels: {
        close: label("close"),
        confirmBuy: label("confirmBuy"),
        confirmCancel: label("confirmCancel"),
        inUse: label("inUse"),
        owned: label("owned"),
        shipPaint: label("shipPaint"),
        shop: label("shop"),
        shopShip: label("shopShip"),
        shopWeapons: label("shopWeapons"),
        station: label("station"),
        stationWelcome: label("stationWelcome"),
        undock: label("undock"),
      },
      reducedMotion: () => this.controls.reducedMotion(),
      request: (key) => {
        const request = this.model.requestPurchase(item(key));
        return request.kind === "refused"
          ? request
          : {
              about: itemAbout(labels, item(key)),
              kind: "confirm",
              left: fill(label("confirmLeft"), { amount: amount(request.left) }),
              price: request.price,
              title: fill(label("confirmTitle"), { name: itemName(ECONOMY, labels, item(key)) }),
            };
      },
      rows: (tab) =>
        this.model
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
    const { card, shop } = this.station.layers;
    const stationLayers = [card, shop].map((layer) =>
      this.controls.registerBack({
        back: layer.back,
        isOpen: () => layer.isOpen() && !this.settingsOpen,
      }),
    );
    const unregisterStation = () => stationLayers.forEach((unregister) => unregister());
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
      onJump: () => apply(() => this.model.jump()),
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
      // Back on a storybook page acts as Previous, and does nothing on a scene's first page.
      this.controls.registerBack({
        back: () => apply(() => this.model.storyPrevious()),
        isOpen: () => this.model.screen === "story" && !this.settingsOpen,
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
      this.galaxies.dispose();
      this.restartCard.dispose();
      this.station.dispose();
      this.stardust.dispose();
      this.controls.dispose();
      this.shell.dispose();
      this.labels.clear();
    });
    this.observeFeedback();
    this.refresh();
  }

  override update(time: number, milliseconds: number): void {
    if (!this.controls) {
      return;
    }
    const state = this.model.state;
    this.feedback.advance(Math.min(milliseconds / 1000, 0.05));
    if (
      !this.settingsOpen &&
      !document.hidden &&
      state.mode === "space" &&
      !state.dialogue &&
      !state.docked
    ) {
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
    }
    this.refresh();
    this.draw();
    const durable = JSON.stringify([
      state.mode,
      state.selectedSector,
      state.progress,
      state.unlocked,
      state.dialogue,
      state.docked,
      state.economy,
    ]);
    if (durable !== this.durable || time - this.savedAt >= 1000) {
      this.flush();
      this.durable = durable;
      this.savedAt = time;
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
    this.controls.setShield(this.model.shieldMax, state.flight?.shield ?? 0);
    this.station.setOpen(state.mode === "space" && Boolean(state.docked));
    this.stardust.set(
      state.mode === "space"
        ? fill(PROTOTYPE.labels.stardustAmount ?? "", { amount: state.economy.stardust })
        : null,
    );
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
    this.controls.setTravel({
      destinations: this.model.destinations(),
      inDanger: this.model.inDanger,
    });
    this.shell.render(state, screen);
    const background = galaxyBackground(
      this.palette,
      state.mode === "space" ? (state.flight?.sector ?? null) : null,
    );
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
        next: !story.page.choices,
      },
      selected === null ? null : SELECTOR_BACKDROP,
    );
    const galaxy = selected === null ? undefined : GALAXIES[selected - 1];
    this.galaxies.show(
      galaxy && selected !== null
        ? {
            ...galaxy,
            first: selected === 1,
            last: selected === GALAXIES.length,
            number: selected,
            unlocked: this.model.isUnlocked(selected),
          }
        : null,
    );
    if (screen !== "start") {
      this.restartCard.close();
    }
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
      const frames = paintFrames(this.paintAssets, paint);
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
    return paint;
  }

  // Back stays on the game except on the start screen with nothing open, where it is the browser's.
  private armBack(): void {
    setBackArmed(!backReleased(this.startShown, this.settingsOpen));
  }

  private flush(): void {
    this.shell.setSavingAvailable(writeSave(this.model.save()));
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
    for (const sprite of this.enemySprites.values()) {
      sprite.setVisible(false);
    }
    this.ship.setVisible(Boolean(flight) && this.model.state.mode === "space");
    for (const label of this.labels.values()) {
      label.setVisible(false);
    }
    if (!flight || this.model.state.mode !== "space") {
      return;
    }
    // Stationary world markers provide motion cues without a navigation map.
    const cell = 160;
    const span = Math.ceil(Math.max(SCREEN.width, SCREEN.height) / cell) + 2;
    const gx = Math.floor(flight.player.x / cell);
    const gy = Math.floor(flight.player.y / cell);
    for (let x = gx - span; x <= gx + span; x++) {
      for (let y = gy - span; y <= gy + span; y++) {
        const point = this.project({
          x: x * cell + ((y * 37) % 83),
          y: y * cell + ((x * 53) % 79),
        });
        // Background markers stay muted but carry a light per-cell tint.
        this.ink.fillStyle(tinted(0.3, cellTint(x, y), this.palette.environmentDetail), 0.6);
        this.ink.fillCircle(point.x, point.y, 1);
      }
    }
    for (const object of flight.objects) {
      this.drawObject(object);
    }
    // Placeholder blast flash until Art supplies one: the blast's ground-plane ellipse, half-width
    // R x 1.414 and half-height R x 0.707, fading out.
    for (const flash of activeBlastFlashes(flight)) {
      const point = this.project(flash);
      this.overlay.lineStyle(2, this.palette.weapon, 1 - flash.age / BLAST_FLASH_SECONDS);
      this.overlay.strokeEllipse(
        point.x,
        point.y,
        flash.radius * Math.SQRT2 * 2,
        flash.radius * Math.SQRT1_2 * 2,
      );
    }
    // Placeholder beam flash until Art supplies one: a line that fades over the flash.
    for (const flash of activeBeamFlashes(flight)) {
      const from = this.project(flash.from);
      const to = this.project(flash.to);
      this.overlay.lineStyle(2, this.palette.weapon, 1 - flash.age / BEAM.flashSeconds);
      this.overlay.lineBetween(from.x, from.y, to.x, to.y);
    }
    for (const shot of flight.shots) {
      const color = shot.enemy ? this.palette.obstacle : this.palette.weapon;
      const point = this.project(shot);
      const tail = this.project({
        x: shot.x - shot.velocity.x * 0.035,
        y: shot.y - shot.velocity.y * 0.035,
      });
      const alpha = shot.fade ? projectileOpacity(shot.fade, shot.life) : 1;
      if (shot.projectile === "dot") {
        this.overlay.fillStyle(color, alpha);
        this.overlay.fillCircle(point.x, point.y, 1.5);
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
        this.overlay.lineStyle(1.5, color, alpha);
        this.overlay.lineBetween(tail.x, tail.y, point.x, point.y);
      }
    }
    this.drawDiscovery();
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
    if (this.shipJets && ship?.directionIndex !== undefined) {
      this.jets.setPosition(this.ship.x, this.ship.y);
      const display = {
        displayHeight: ship.displayHeight ?? 42,
        displayWidth: ship.displayWidth ?? 42,
        pivot: ship.pivot,
      };
      for (const { alpha, color, points } of jetTriangles(
        this.shipJets,
        display,
        ship.directionIndex,
        speed,
      )) {
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
    for (const [id, sprite] of this.enemySprites) {
      if (!activeIds.has(id.endsWith(FLASH_SUFFIX) ? id.slice(0, -FLASH_SUFFIX.length) : id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }
    for (const [id, label] of this.labels) {
      if (!activeIds.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
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
    const art = this.enemyArt.get(enemy.archetype);
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

  /** Authored frames already include perspective; jets are not clipped to the frame. */
  private drawEnemySprite(
    art: EnemyArt<Asset>,
    point: Vec,
    id: string,
    enemy: NonNullable<SpaceObject["enemy"]>,
  ): void {
    const frame = selectEnemyFrame(art, enemy.facing);
    let sprite = this.enemySprites.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, frame.id).setDepth(2);
      this.enemySprites.set(id, sprite);
    }
    sprite
      .setTexture(frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y)
      .setRotation(0)
      .setVisible(true);
    const speed = enemySpeedFraction(
      enemyCatalog[enemy.archetype],
      PROTOTYPE.tuning.maxSpeed,
      enemyEncounterTuning.speedCapRatio,
      enemy,
    );
    for (const { alpha, color, points } of enemyJetTriangles(art, frame, speed)) {
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

  private drawDiscovery(): void {
    const flight = this.model.state.flight;
    if (!flight) {
      return;
    }
    const cx = SCREEN.width / 2;
    const cy = SCREEN.height / 2;
    const candidates = flight.objects
      .filter(
        (object) =>
          object.role === "discovery" && (object.kind === "pickup" || object.kind === "resource"),
      )
      .map((object) => this.project(object))
      .filter(
        (point) => point.x < 0 || point.y < 0 || point.x > SCREEN.width || point.y > SCREEN.height,
      )
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    // An undiscovered station within its world indicator range takes precedence.
    const site = stationIndicatorTarget(
      ECONOMY,
      flight.sector,
      this.model.state.progress[flight.sector].stations,
      flight.player,
    );
    const station = site ? this.project(site) : null;
    const offscreen =
      station &&
      (station.x < 0 || station.y < 0 || station.x > SCREEN.width || station.y > SCREEN.height);
    const target = offscreen ? station : candidates[0];
    // Provisional nearby range scales with the viewport, without revealing distant targets.
    if (
      !target ||
      (!offscreen &&
        Math.hypot(target.x - cx, target.y - cy) > Math.max(SCREEN.width, SCREEN.height) * 1.5)
    ) {
      return;
    }
    const dx = target.x - cx;
    const dy = target.y - cy;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const scale = Math.min((cx - 44) / Math.abs(dx), (cy - 100) / Math.abs(dy));
    const x = cx + dx * Math.max(0, scale);
    const y = cy + dy * Math.max(0, scale);
    this.overlay.lineStyle(2, this.palette.pointOfInterest, 0.8);
    this.overlay.strokeTriangle(
      x + ux * 8,
      y + uy * 8,
      x - ux * 5 - uy * 5,
      y - uy * 5 + ux * 5,
      x - ux * 5 + uy * 5,
      y - uy * 5 - ux * 5,
    );
    this.overlay.strokeCircle(x - ux * 13, y - uy * 13, 3);
  }

  private drawFeedback(): void {
    for (const pulse of this.feedback.pulses) {
      const at = this.project(pulse);
      const radius = 12 + pulse.age * (pulse.kind === "teleport" ? 140 : 55);
      this.overlay.lineStyle(
        pulse.kind === "damage" ? 3 : 1.5,
        pulse.kind === "damage"
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
  }

  private drawDestinationLabel(object: SpaceObject, point: Vec, radius: number): void {
    const destination = nameLabelled(object.kind)
      ? this.model.destinations().find((entry) => entry.id === object.id)
      : undefined;
    if (!destination) {
      return;
    }
    let label = this.labels.get(object.id);
    if (!label) {
      label = this.add
        .text(0, 0, destination.label, {
          backgroundColor: spaceColorCss(this.spaceBackground),
          color: spaceColorCss(this.palette.pointOfInterest),
          fontFamily: '"Liberation Sans", sans-serif',
          fontSize: "14px",
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
      this.labels.set(object.id, label);
    }
    label.setPosition(point.x, point.y + radius + 8).setVisible(true);
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
    const art = this.stationArt;
    if (!art) {
      this.drawStationPlaceholder(object, point, radius);
      return;
    }
    const frame = stationFrame(art, this.reducedMotion, this.time.now);
    this.objectSprite(object.id, frame.id)
      .setDisplaySize(frame.displayWidth!, frame.displayHeight!)
      .setOrigin(frame.pivot.x, frame.pivot.y)
      .setPosition(point.x, point.y);
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
   * Art's Stardust gem with its glint loop from a per-pickup phase. A released pickup settles
   * out from its wreck; reduced motion shows the rest frame where it lands.
   */
  private drawStardust(object: SpaceObject, point: Vec, radius: number): void {
    const art = this.stardustArt;
    const flight = this.model.state.flight;
    if (!art || !flight) {
      this.ink.fillStyle(this.palette.active);
      this.ink.fillCircle(point.x, point.y, radius / 2);
      return;
    }
    const at = stardustDrawn(
      this.destruction?.pickups.settleMs ?? 110,
      this.reducedMotion,
      object.release && this.project(object.release.from),
      object.release ? (flight.time - object.release.at) * 1000 : 0,
      point,
    );
    const frame = stardustFrame(
      art,
      this.reducedMotion,
      stardustPhase(object.id, art.loopMs),
      this.time.now,
    );
    this.objectSprite(object.id, art.asset.id, frame)
      .setDisplaySize(art.asset.displayWidth!, art.asset.displayHeight!)
      .setOrigin(art.asset.pivot.x, art.asset.pivot.y)
      .setPosition(at.x, at.y);
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
    const shards = this.shards.get(wreck.archetype);
    const timing = data?.archetypes[wreck.archetype];
    const art = this.enemyArt.get(wreck.archetype);
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
        this.objectSprite(object.id, frame.id)
          .setDisplaySize(
            (frame.displayWidth ?? 42) * state.scale,
            (frame.displayHeight ?? 42) * state.scale,
          )
          .setOrigin(frame.pivot.x, frame.pivot.y)
          .setPosition(point.x, point.y)
          .setAlpha(state.alpha)
          .setTint(state.tint);
      }
      return;
    }
    const pivot = { x: frame.pivot.x * width, y: frame.pivot.y * height };
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
      const points: Phaser.Math.Vector2[] = [];
      for (let index = 0; index + 1 < polygon.points.length; index += 2) {
        points.push(
          new Phaser.Math.Vector2(
            point.x + (polygon.points[index]! - pivot.x) * scale,
            point.y + (polygon.points[index + 1]! - pivot.y) * scale,
          ),
        );
      }
      this.overlay.fillStyle(polygon.color, polygon.alpha);
      this.overlay.fillPoints(points, true);
    }
    const flash = flashAt(data, timing, time);
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
    const point = this.project(object);
    const definition = object.enemy ? enemyCatalog[object.enemy.archetype] : undefined;
    const radius = definition
      ? Math.max(object.radius, definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2)
      : object.radius;
    if (
      point.x < -radius - 60 ||
      point.y < -radius - 60 ||
      point.x > SCREEN.width + radius + 60 ||
      point.y > SCREEN.height + radius + 60
    ) {
      return;
    }
    const color = spaceObjectColor(this.palette, object);
    this.ink.lineStyle(1.5, color);
    this.ink.fillStyle(this.palette.environment);
    switch (object.kind) {
      case "destination": {
        this.ink.fillEllipse(point.x, point.y, radius * 2, radius);
        this.ink.strokeEllipse(point.x, point.y, radius * 2, radius);
        this.ink.strokeEllipse(point.x, point.y - 7, radius, radius * 0.6);
        this.drawDestinationLabel(object, point, radius);
        break;
      }
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
        if (carriesStardust(object)) {
          this.drawStardust(object, point, radius);
          break;
        }
        this.ink.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
        if (object.role === "cargo") {
          this.ink.fillStyle(color);
          this.ink.fillCircle(point.x, point.y, radius / 3);
        } else if (object.weapon && weaponAt(object.weapon, 1).projectileKind === "missile") {
          this.ink.lineBetween(point.x, point.y - radius * 0.65, point.x, point.y + radius * 0.65);
          this.ink.lineBetween(
            point.x,
            point.y + radius * 0.2,
            point.x - radius * 0.4,
            point.y + radius * 0.6,
          );
          this.ink.lineBetween(
            point.x,
            point.y + radius * 0.2,
            point.x + radius * 0.4,
            point.y + radius * 0.6,
          );
        } else if (object.weapon) {
          for (const degrees of weaponAt(object.weapon, 1).anglesDegrees) {
            const angle = (degrees * Math.PI) / 180;
            const x = point.x + Math.cos(angle) * radius * 0.7;
            const y = point.y + Math.sin(angle) * radius * 0.7;
            if (object.weapon === "scattershot") {
              this.ink.fillStyle(color);
              this.ink.fillCircle(x, y, 1);
            } else {
              this.ink.lineBetween(point.x - radius * 0.5, point.y, x, y);
            }
          }
        }
        break;
      case "resource":
        this.ink.fillStyle(color);
        this.ink.fillCircle(point.x, point.y, radius);
        break;
      case "rock":
      case "debris": {
        const art = object.asteroid ? asteroidArt(object.asteroid) : undefined;
        if (art) {
          this.drawAsteroid(point, art.entry.tint, art.outline);
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

  /** Placeholder asteroid: its collision parts filled as one mass, outlined on the union. */
  private drawAsteroid(point: Vec, tint: string, outline: AsteroidOutline): void {
    this.ink.fillStyle(tinted(0.14, tint, this.palette.environment));
    for (const part of outline.parts) {
      this.ink.fillPoints(
        part.map((at) => new Phaser.Math.Vector2(point.x + at.x, point.y + at.y)),
        true,
      );
    }
    this.ink.lineStyle(1.5, tinted(0.3, tint, this.palette.environmentDetail));
    for (const [start, end] of outline.edges) {
      this.ink.lineBetween(point.x + start.x, point.y + start.y, point.x + end.x, point.y + end.y);
    }
  }
}
