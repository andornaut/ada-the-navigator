import { pageToGame } from "@andornaut/game-kit/runtime/view/pagePoint";
import {
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
} from "@andornaut/game-kit/runtime/web/input/dom/pagePresses";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import type { GameObjects, Scene } from "phaser";

import { BUILD_LABEL } from "../buildLabel.ts";
import { CONTENT } from "../data/content.ts";
import { RESOURCE_DESCRIPTIONS } from "../data/resourceDescriptions.ts";
import type { Weapon } from "../data/types.ts";
import { uiIconUrl } from "../data/uiIconUrl.ts";
import { weaponDetailLines } from "../data/weaponDetails.ts";
import { canvasSize, fitCanvasCamera, sceneFit } from "../game/playCamera.ts";
import { RASTER_SCALE_EVENT } from "../game/svgRasters.ts";
import {
  createSpeedLine,
  createTouchChrome,
  createUseDisc,
  rasterTouchChrome,
  showSpeedLine,
  showTouchChrome,
  useDiscFrame,
} from "../game/touchChrome.ts";
import type { RequiredReady } from "../loading/required.ts";
import type { ItemGain } from "../model/itemGains.ts";
import type { ContextQuestDetails } from "../model/questObjectLinks.ts";
import { weaponName } from "../model/shop.ts";
import type { UseAction } from "../model/types.ts";
import { PHONE_BACK_PRESSED } from "../pwa/events.ts";
import type { UpdateOffer } from "../pwa/updateOffer.ts";
import {
  type AchievementEntry,
  type AchievementsLabels,
  createAchievementsCard,
} from "../ui/achievementsCard.ts";
import { assertAdaActionBindings, bindAdaAction } from "../ui/actionBinding.ts";
import { type BackLayer, createBackStack, pressBack } from "../ui/backStack.ts";
import type { CheatAction } from "../ui/cheatActions.ts";
import { type CheatLabels, createCheats } from "../ui/cheats.ts";
import { consumeContextQuestUse, createContextQuestIcon } from "../ui/contextQuestUse.ts";
import type { DeviceStorage } from "../ui/deviceSettings.ts";
import { bindAdaActionRoot } from "../ui/holdActionsAdapter.ts";
import { createItemNotices, type NoticePlaces, type PaintSwatch } from "../ui/itemNotice.ts";
import { SCROLL } from "../ui/layout/contentCard.ts";
import { units, VIEW_HOST_ID } from "../ui/layout/css.ts";
import {
  HUD_BUTTON,
  HUD_ROW,
  hudButtonTarget,
  hudRect,
  shieldIconCentre,
  STATUS_PILL,
  statusCargoInset,
  statusPillWidth,
} from "../ui/layout/playView.ts";
import { stickTargets, useDiscLayout, usePressed } from "../ui/layout/touchControls.ts";
import { createViewScaleBridge, type PlayLayout, readViewUnit } from "../ui/layout/viewScale.ts";
import { createMenuCard } from "../ui/menuCard.ts";
import { activateNavigation, createNavigationButton } from "../ui/navigationButton.ts";
import { mountNavigationPose } from "../ui/pauseButton.ts";
import {
  createPauseCards,
  type PauseLabels,
  type PauseOptions,
  type PauseState,
} from "../ui/pauseCard.ts";
import { inCurrentView, rootPressGuard } from "../ui/pressScope.ts";
import { refusalPose, refusalStart } from "../ui/refusal.ts";
import { createResourceCard } from "../ui/resourceCard.ts";
import {
  createSettings,
  EXIT_SHOWN_ATTRIBUTE,
  type FeedbackSettings,
  type SettingsLabels,
  type SettingsOptions,
} from "../ui/settings.ts";
import { shieldDetails } from "../ui/shieldDetails.ts";
import { createStatusPill, pillCount, type StatusView } from "../ui/statusPill.ts";
import { STICK_DEPTHS, stickViews } from "../ui/sticks.ts";
import { USE_PRESS_MS } from "../ui/touchChrome.ts";
import { createUpdateDialog, type UpdateLabels } from "../ui/updateDialog.ts";
import { createWeaponDetailCard } from "../ui/weaponDetailCard.ts";
import { createWeaponSelector, type WeaponChoice, type WeaponLabels } from "../ui/weapons.ts";
import { FRAME_TURN } from "../view/frameTurn.ts";
import { coarsePointer, touchControlsActive, useDiscShown } from "./coarsePointer.ts";
import { bindDesktopInput, DesktopControlState, type DesktopFrame } from "./desktop.ts";
import { type ControlSample, ControlState } from "./state.ts";

export interface ControlsOptions {
  /** The clock press, notice and feedback timing read, in milliseconds. */
  readonly now: () => number;
  /** Where the device settings are read and written; undefined where site data is blocked. */
  readonly storage: DeviceStorage | undefined;
  readonly requiredReady?: RequiredReady;
  readonly subscribeRequired?: (invalidate: () => void) => () => void;
  readonly contextQuestDetails?: () => ContextQuestDetails | null;
  readonly aboardResource?: () => {
    readonly questId?: string;
    readonly title: string;
    readonly text: string;
    readonly kind: "carrying" | "towing";
  } | null;
  readonly achievements: AchievementsLabels;
  readonly cheats: {
    readonly labels: CheatLabels;
    readonly onOpenChange?: (open: boolean) => void;
    readonly rows: readonly CheatAction[];
  };
  // The start screen's Exit where the game offers to leave (exitShown), or undefined where it
  // does not, which makes no Exit at all.
  readonly exit?: { readonly label: string; readonly onExit: () => void } | undefined;
  readonly fpsCounter: SettingsOptions["fpsCounter"];
  readonly install?: SettingsOptions["install"];
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onPauseChange?: (paused: boolean) => void;
  readonly pause: {
    readonly buttonLabel: string;
    readonly menuLabel?: string;
    readonly labels: Omit<PauseLabels, "achievements" | "cheats">;
    readonly paint?: PauseOptions["paint"];
    readonly shipFrame?: (heading: number) => string | undefined;
    readonly onBackToTitle: () => void;
    /** Return to Earth, which the Map offers. */
    readonly onGalaxies: () => void;
    readonly onTravel: (destination: string) => void;
  };
  // The scene's SVG raster scale when the controls are made; the scene emits
  // RASTER_SCALE_EVENT with each new one, and the touch chrome paints again at it.
  readonly rasterScale: number;
  // The in-session update offer, on any screen; its card pauses play while it shows.
  readonly update?: {
    readonly labels: UpdateLabels;
    readonly offer: UpdateOffer;
    // Focuses the current screen's default control as the offer closes.
    readonly restoreFocus: () => void;
  };
  // Returns whether the switch was refused.
  readonly onWeaponSelect: (weapon: Weapon) => boolean;
  // Player copy for the item notices (src/ui/itemNotice.ts).
  readonly noticeLabels: Readonly<Record<string, string>>;
  // Each paint scheme's shop swatch, the paint notice's icon.
  readonly paintSwatch?: PaintSwatch;
  readonly shieldLabel: string;
  readonly weaponLabels: WeaponLabels;
}

/** What Use does here and the action's name, the Use disc's accessible name. */
export interface UseContext {
  readonly action: UseAction;
  readonly questIcon?: string;
  readonly label: string;
}

export interface Controls {
  closeSettings(): void;
  // Closes the Paused card and the local map, resuming the flight.
  closePause(): void;
  // Focuses the local map's Galaxies, as the galaxy map over it closes.
  focusGalaxies(): void;
  // Opens the Achievements card, as the start screen's Achievements does.
  openAchievements(): void;
  // Adds a card that back and Escape close while it is open, innermost so far.
  registerBack(layer: BackLayer): () => void;
  dispose(): void;
  openSettings(): void;
  /** The DOM layer that holds the controls and modal cards. */
  readonly overlay: HTMLElement;
  // The play layout in effect: the logical view and its safe insets.
  layout(): PlayLayout;
  // Whether Reduced motion is on, for the refusal cue.
  reducedMotion(): boolean;
  reset(): void;
  sample(frame?: DesktopFrame): ControlSample;
  // The Achievements card's entries.
  setAchievements(entries: readonly AchievementEntry[]): void;
  // What Use does here and its name, or undefined with nothing in reach.
  setContext(context: UseContext | undefined): void;
  // Plays the refusal cue on the Use disc; a repeat while it plays does not restart it.
  refuseUse(): void;
  setEnabled(enabled: boolean): void;
  // Shows the HUD settings button (the start screen); in play Settings opens from the Paused card.
  setSettingsButton(shown: boolean): void;
  // Shows the start screen's Achievements button.
  setAchievementsButton(shown: boolean): void;
  // Shows the start screen's Exit where the game offers to leave.
  setExitButton(shown: boolean): void;
  setPause(state: PauseState): void;
  navigationCovered(): boolean;
  // The status pill's shield and Stardust count.
  resetShieldOreSpent(total?: number): void;
  setStatus(view: StatusView): void;
  // Queues item notices for gains; null clears them, as on leaving flight.
  setGains(gains: readonly ItemGain[] | null): void;
  setWeapons(weapons: readonly WeaponChoice[]): void;
}

const CONTROL_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "KeyA",
  "KeyD",
  "KeyS",
  "KeyW",
  "Space",
]);

export function createControls(scene: Scene, options: ControlsOptions): Controls {
  const { now } = options;
  const canvas = scene.game.canvas;
  const parent = canvas.parentElement;
  if (!parent) {
    throw new Error("Controls require a mounted game canvas");
  }
  const host = parent.closest<HTMLElement>(`#${VIEW_HOST_ID}`);
  const previousPosition = parent.style.position;
  const ownsPosition = getComputedStyle(parent).position === "static";
  if (ownsPosition) {
    parent.style.position = "relative";
  }
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  const state = new ControlState();
  const requiredReady = () => options.requiredReady?.() ?? true;
  const desktop = new DesktopControlState(() => requiredReady() && state.accepts());
  let enabled = true;
  // Whether the current gameplay view permits the Paused card (PauseState.place).
  let pausable = false;
  let disposed = false;
  let context: UseContext | undefined;
  // The shared dispatcher supplies the Use press timestamp for its visual frames.
  let usePress: { readonly since: number } | undefined;
  // When the Use disc's refusal cue started, if one has played.
  let useRefused: number | undefined;
  let useShown = false;
  let visibility = { aim: true, move: true };
  let reducedMotion = false;
  let returnToMenu: (() => void) | undefined;
  let returnToPause: "achievements" | "cheats" | "settings" | undefined;
  let returningToParent = false;
  function restoreParent(parent: () => void): void {
    returningToParent = true;
    queueMicrotask(() => {
      if (disposed) {
        returningToParent = false;
        return;
      }
      parent();
      returningToParent = false;
      syncModal();
    });
  }
  let menuContext: "start" | "nonplay" = "nonplay";
  const settings = createSettings(parent, {
    build: BUILD_LABEL,
    fpsCounter: options.fpsCounter,
    install: options.install,
    labels: options.labels,
    onFeedbackChange(value) {
      reducedMotion = value.reducedMotion;
      options.onFeedbackChange?.(value);
    },
    onOpenChange(open) {
      if (!open && returnToMenu) {
        const reopen = returnToMenu;
        returnToMenu = undefined;
        restoreParent(reopen);
      } else if (!open && returnToPause === "settings") {
        returnToPause = undefined;
        pause.restorePaused("settings");
      }
      syncModal();
    },
    onVisibilityChange(value) {
      visibility = value;
    },
    storage: options.storage,
  });
  let exitPose: ReturnType<typeof mountNavigationPose> | undefined;
  let pressedStoryButton: HTMLElement | undefined;
  const actionRoot = bindAdaActionRoot(
    {
      allowNonPrimaryTouch: true,
      guard: rootPressGuard(settings.root),
      pointerRelease: {
        onPressChange: (element) => {
          usePress = element === settings.useButton ? { since: now() } : undefined;
          weapons.setPressed(element);
          pressedStoryButton?.removeAttribute("data-story-pressed");
          pressedStoryButton =
            element?.classList.contains("ada-story-button") ||
            element?.classList.contains("ada-story-skip")
              ? element
              : undefined;
          pressedStoryButton?.setAttribute("data-story-pressed", "");
          if (exitPose) {
            const present = element === exitButton ? exitPose.press : exitPose.rest;
            present();
          }
        },
        pointerTarget: document,
        resolvePointer: (event) => resolveUsePointer(event),
      },
      requiredReady,
      subscribeRequired: options.subscribeRequired ?? (() => () => {}),
    },
    settings.root,
  );
  const cheats = createCheats(settings.root, {
    ...options.cheats,
    onOpenChange(open) {
      options.cheats.onOpenChange?.(open);
      if (!open && returnToMenu) {
        const reopen = returnToMenu;
        returnToMenu = undefined;
        restoreParent(reopen);
      } else if (!open && returnToPause === "cheats") {
        returnToPause = undefined;
        pause.restorePaused("cheats");
      }
      syncModal();
    },
    reducedMotion: () => reducedMotion,
  });
  const pause = createPauseCards(settings.root, {
    labels: {
      ...options.pause.labels,
      achievements: options.achievements.title,
      cheats: options.cheats.labels.title,
    },
    onAchievements: () => {
      returnToPause = "achievements";
      achievements.open({
        intent: "back",
        label: options.pause.labels.mapScreen.questBack ?? options.pause.labels.close,
      });
    },
    onBackToTitle: () => options.pause.onBackToTitle(),
    onCheats: () => {
      returnToPause = "cheats";
      cheats.open();
    },
    onGalaxies: () => options.pause.onGalaxies(),
    onOpenChange: () => syncModal(),
    onSettings: () => {
      returnToPause = "settings";
      settings.open();
    },
    onTravel: (destination) => options.pause.onTravel(destination),
    ...(options.pause.paint ? { paint: options.pause.paint } : {}),
    reducedMotion: () => reducedMotion,
    shipFrame: (heading) => options.pause.shipFrame?.(heading),
  });
  // The start screen's Achievements disc remains in the HUD.
  const achievements = createAchievementsCard(settings.root, {
    labels: options.achievements,
    onOpenChange: (open) => {
      achievementsButton.setAttribute("aria-expanded", String(open));
      if (!open && returnToMenu) {
        const reopen = returnToMenu;
        returnToMenu = undefined;
        restoreParent(reopen);
      } else if (!open && returnToPause === "achievements") {
        returnToPause = undefined;
        pause.restorePaused("achievements");
      }
      syncModal();
    },
  });
  const achievementsButton = document.createElement("button");
  achievementsButton.type = "button";
  achievementsButton.className = "ada-achievements-open";
  achievementsButton.dataset.action = "achievements";
  achievementsButton.setAttribute("aria-label", options.achievements.title);
  achievementsButton.title = options.achievements.title;
  achievementsButton.setAttribute("aria-haspopup", "dialog");
  achievementsButton.setAttribute("aria-expanded", "false");
  achievementsButton.hidden = true;
  const achievementsDisc = document.createElement("span");
  achievementsDisc.className = "ada-disc";
  achievementsDisc.setAttribute("aria-hidden", "true");
  achievementsButton.append(achievementsDisc);
  const achievementsAction = bindAdaAction(
    {
      click: {
        availability: () =>
          achievementsButton.disabled || achievementsButton.closest("[hidden], [inert]")
            ? { kind: "omitted" }
            : { kind: "available" },
        run: () => achievements.open(),
      },
      current: () =>
        !disposed &&
        achievementsButton.isConnected &&
        inCurrentView(settings.root, achievementsButton),
      slopPx: () => SCROLL.dragThreshold * readViewUnit(achievementsButton),
    },
    achievementsButton,
  );
  settings.openButton.before(achievementsButton);
  settings.openButton.hidden = true;
  settings.root.classList.add("ada-no-settings-button");
  // The start screen's Exit disc at the top right, where it shows; it follows the Menu in Tab order.
  const exitButton = options.exit ? document.createElement("button") : undefined;
  let exitAction: ReturnType<typeof bindAdaAction> | undefined;
  if (exitButton && options.exit) {
    const { label } = options.exit;
    exitButton.type = "button";
    exitButton.className = "ada-exit-open";
    exitButton.dataset.action = "exit";
    exitButton.setAttribute("aria-label", label);
    exitButton.title = label;
    exitButton.hidden = true;
    exitPose = mountNavigationPose(exitButton);
    exitAction = bindAdaAction(
      {
        click: {
          availability: () =>
            exitButton.disabled || exitButton.closest("[hidden], [inert]")
              ? { kind: "omitted" }
              : { kind: "available" },
          run: () => {
            exitPose?.rest();
            options.exit?.onExit();
          },
        },
        current: () =>
          !disposed && exitButton.isConnected && inCurrentView(settings.root, exitButton),
        slopPx: () => SCROLL.dragThreshold * readViewUnit(exitButton),
      },
      exitButton,
    );
  }
  const menu = createMenuCard(settings.root, {
    closeLabel: options.pause.labels.close,
    labels: {
      achievements: options.achievements.title,
      backToTitle: options.pause.labels.backToTitle,
      cheats: options.cheats.labels.title,
      settings: options.pause.labels.settings,
    },
    onAction: (action, reopen) => {
      if (action === "backToTitle") {
        returnToMenu = undefined;
        options.pause.onBackToTitle();
        return;
      }
      returnToMenu = reopen;
      if (action === "cheats") {
        cheats.open();
      } else if (action === "settings") {
        settings.open();
      } else {
        achievements.open({
          intent: "back",
          label: options.pause.labels.mapScreen.questBack ?? options.pause.labels.close,
        });
      }
    },
    onOpenChange: () => syncModal(),
    title: options.pause.menuLabel ?? "Menu",
  });
  const openNavigation = () =>
    activateNavigation(
      {
        mapOpen: pause.mapOpen(),
        menu: menu.open,
        pausable,
        pause: () => pause.open(),
      },
      pauseButton,
    );
  const navigation = createNavigationButton(
    settings.root,
    {
      menu: options.pause.menuLabel ?? "Menu",
      pause: options.pause.buttonLabel,
    },
    openNavigation,
  );
  const pauseButton = navigation.button;
  if (exitButton) {
    pauseButton.after(exitButton);
  }
  const navigationCovered = (): boolean =>
    returningToParent ||
    Boolean(returnToMenu || returnToPause) ||
    menu.isOpen() ||
    settings.isOpen() ||
    cheats.isOpen() ||
    achievements.isOpen() ||
    resource.isOpen() ||
    weaponDetail.isOpen() ||
    (update?.isOpen() ?? false);
  const modalOpen = (): boolean => navigationCovered() || pause.isOpen();
  const syncNavigationEntry = () => {
    navigation.setMode(pausable && !pause.mapOpen() ? "pause" : "menu");
    pauseButton.hidden = false;
    pauseButton.inert = modalOpen() || !inCurrentView(settings.root, pauseButton);
    if (exitButton) {
      exitButton.inert = modalOpen();
    }
  };
  function syncModal(): void {
    const open = modalOpen();
    syncNavigationEntry();
    const active = document.activeElement;
    const foreground =
      active instanceof HTMLElement ? active.closest<HTMLElement>(".ada-modal") : null;
    if (
      foreground &&
      !foreground.hidden &&
      foreground.parentElement === settings.root &&
      foreground !== settings.root.lastElementChild
    ) {
      settings.root.append(foreground);
      focusTarget(active as HTMLElement);
    }
    desktop.reset();
    settings.root.classList.toggle("ada-modal-open", open);
    if (open) {
      state.openModal();
    } else {
      state.closeModal();
    }
    weapons.setEnabled(enabled && !open);
    status.setShown(enabled && !pause.mapOpen());
    options.onPauseChange?.(open);
  }
  const weapons = createWeaponSelector(settings.root, {
    labels: options.weaponLabels,
    onHold: (choice, origin) => {
      if (!state.accepts()) {
        return;
      }
      weaponDetail.open(
        weaponName(CONTENT.labels, choice.id),
        weaponDetailLines(choice.id, choice.level),
        origin,
        {
          ammo: choice.ammo,
          ammoLabel: CONTENT.labels.ammo ?? "",
          id: choice.id,
          level: choice.level,
        },
      );
    },
    onSelect: (weapon) => state.accepts() && options.onWeaponSelect(weapon),
    reducedMotion: () => reducedMotion,
  });
  const weaponDetail = createWeaponDetailCard(settings.root, {
    closeLabel: options.pause.labels.close,
    onOpenChange: () => syncModal(),
  });
  const resource = createResourceCard(settings.root, {
    closeLabel: options.pause.labels.close,
    onOpenChange: () => syncModal(),
  });
  const status = createStatusPill(settings.root, {
    onResource: (kind, origin) => {
      if (!state.accepts()) {
        return;
      }
      const iconSource =
        kind === "aboard"
          ? origin
          : origin
              .closest(".ada-status")
              ?.querySelector<HTMLElement>(
                kind === "ore" ? ".ada-status-ore" : ".ada-status-stardust",
              );
      const icon = iconSource?.cloneNode(true) as HTMLElement | undefined;
      if (icon) {
        for (const attribute of [
          "tabindex",
          "role",
          "aria-label",
          "aria-haspopup",
          "data-action",
        ]) {
          icon.removeAttribute(attribute);
        }
        icon.classList.remove("ada-resource-target");
        icon.setAttribute("aria-hidden", "true");
        icon.hidden = false;
      }
      if (kind === "aboard") {
        const details = options.aboardResource?.();
        if (!details) {
          return;
        }
        if (details.questId) {
          pause.openQuest(details.questId, "flight");
          return;
        }
        if (icon) {
          icon.dataset.kind = details.kind;
        }
        resource.open(details.title, details.text, origin, {
          ...(icon ? { icon } : {}),
        });
      } else {
        resource.open(CONTENT.labels[kind] ?? "", RESOURCE_DESCRIPTIONS[kind], origin, {
          ...(icon ? { icon } : {}),
          ...(statusView ? { count: statusView[kind] } : {}),
        });
      }
    },
    onShield: (origin) => {
      if (!state.accepts() || !statusView) {
        return;
      }
      const details = shieldDetails(options.shieldLabel, statusView);
      const icon = document.createElement("span");
      icon.className = "ada-detail-unlimited-icon";
      icon.style.setProperty("--glyph", `url('${uiIconUrl("shield")}')`);
      icon.setAttribute("aria-hidden", "true");
      resource.open(details.title, details.text, origin, {
        icon,
        quantity: details.quantity,
      });
    },
    reducedMotion: () => reducedMotion,
    shieldLabel: options.shieldLabel,
  });
  // The chip draws under the HUD controls: it goes first among them.
  const notices = createItemNotices(settings.root, {
    labels: options.noticeLabels,
    ...(options.paintSwatch ? { paintSwatch: options.paintSwatch } : {}),
    onArrive: (target) => {
      if (reducedMotion) {
        return;
      }
      if (target.kind === "cargo") {
        status.bumpCargo();
      } else if (target.kind === "weapon") {
        weapons.bump(target.weapon);
      } else if (target.kind === "shield") {
        status.bumpShield();
      }
    },
    reducedMotion: () => reducedMotion,
  });
  let weaponIds: readonly Weapon[] = [];
  let statusView: StatusView | undefined;
  const update = options.update
    ? createUpdateDialog(
        settings.root,
        host ?? settings.root,
        options.update.labels,
        options.update.offer,
        options.update.restoreFocus,
        () => syncModal(),
      )
    : undefined;
  const stick = (kind: "aim" | "move") => ({
    knob: createTouchChrome(scene, options.rasterScale, "knob")?.setDepth(STICK_DEPTHS.knob),
    line: createSpeedLine(scene, options.rasterScale).setDepth(STICK_DEPTHS.line),
    ring: createTouchChrome(scene, options.rasterScale, kind)?.setDepth(STICK_DEPTHS.ring),
  });
  const sticks = { aim: stick("aim"), move: stick("move") };
  const questUseIcon = createContextQuestIcon(settings.useButton);
  const useDisc = createUseDisc(scene, options.rasterScale).setDepth(STICK_DEPTHS.ring);
  const stickParts = [
    ...[sticks.move, sticks.aim]
      .flatMap(({ knob, line, ring }) => [ring, line, knob])
      .filter((part) => part !== undefined),
    useDisc,
  ];
  for (const part of stickParts) {
    part.setScrollFactor(0).setVisible(false);
  }
  scene.cameras.main.ignore(stickParts);
  const stickSet = new Set<GameObjects.GameObject>(stickParts);
  // The sticks draw over the whole canvas, in logical px.
  const camera = scene.cameras.add();
  fitCanvasCamera(scene, camera);
  // The play area's view scale (src/ui/layout/viewScale.ts): the DOM UI's logical px, the safe
  // insets and the nine-slice edges, from the canvas's display size.
  const view = createViewScaleBridge(host ?? parent, scene.scale.displaySize);
  let layout = view.update();
  // Keep each joystick's pointer target over its drawn rest ring, in logical canvas px.
  let placedTargets = "";
  let useLayout = useDiscLayout(canvasSize(sceneFit(scene)), layout.insets);
  const placeTargets = (): void => {
    const size = canvasSize(sceneFit(scene));
    const placement = JSON.stringify([size.width, size.height, layout.insets]);
    if (placement === placedTargets) {
      return;
    }
    placedTargets = placement;
    const targets = stickTargets(size, layout.insets);
    settings.joystickTargets.forEach((target, index) => {
      const rect = targets[index === 0 ? "move" : "aim"];
      target.style.left = units(rect.x);
      target.style.top = units(rect.y);
    });
    useLayout = useDiscLayout(size, layout.insets);
    useDisc.setPosition(useLayout.frame.x, useLayout.frame.y);
    settings.useButton.style.left = units(useLayout.frame.x);
    settings.useButton.style.top = units(useLayout.frame.y);
  };
  const fitControls = (): void => {
    camera.ignore(scene.children.list.filter((object) => !stickSet.has(object)));
    layout = view.update();
    placeTargets();
  };
  scene.events.on("prerender", fitControls);
  fitControls();
  const raster = (scale: number): void => rasterTouchChrome(scene, scale);
  scene.events.on(RASTER_SCALE_EVENT, raster);
  const point = (event: Pick<PagePointerEvent, "clientX" | "clientY">) => {
    fitControls();
    return pageToGame(
      FRAME_TURN.turn(),
      canvas.getBoundingClientRect(),
      canvasSize(sceneFit(scene)),
      { x: event.clientX, y: event.clientY },
    );
  };
  const joystickTarget = (target: EventTarget | null) => {
    const found = target instanceof Element ? target.closest("[data-control]") : null;
    return found && settings.root.contains(found) ? found : null;
  };
  const resolveUsePointer = (
    event: Pick<PointerEvent, "clientX" | "clientY" | "target">,
  ): HTMLElement | null | undefined => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target === null) {
      return null;
    }
    const capturedUse = event.target instanceof Node && settings.useButton.contains(event.target);
    const native = settings.useButton.contains(target);
    const surface = target === canvas || target === parent || joystickTarget(target) !== null;
    if (!native && (!surface || onPageControl(target))) {
      return capturedUse ? null : undefined;
    }
    if (useShown && state.accepts() && usePressed(useLayout, point(event))) {
      return settings.useButton;
    }
    return native || capturedUse ? null : undefined;
  };
  const desktopBinding = bindDesktopInput(
    {
      accepts: () => state.accepts(),
      acceptsPointer: (event) => resolveUsePointer(event) !== settings.useButton,
      onModeChange: () => state.reset(),
      onUse: () => state.requestUse(),
      point,
      surface: canvas,
    },
    desktop,
  );
  const useAction = bindAdaAction(
    {
      beforeClick: (event) => event.detail === 0 || resolveUsePointer(event) === settings.useButton,
      click: {
        availability: () =>
          state.accepts() &&
          context !== undefined &&
          useShown &&
          !settings.useButton.closest("[hidden], [inert]")
            ? { kind: "available" }
            : { kind: "omitted" },
        run: () => state.requestUse(),
      },
      current: () => !disposed && settings.useButton.isConnected,
      slopPx: () => SCROLL.dragThreshold * readViewUnit(settings.useButton),
    },
    settings.useButton,
  );
  for (const button of [achievementsButton, exitButton, settings.openButton, settings.useButton]) {
    if (button) {
      assertAdaActionBindings(button);
    }
  }
  // Where the item notice's chip and destinations sit now, in HUD rect px.
  const noticePlaces = (): NoticePlaces => {
    const view = canvasSize(sceneFit(scene));
    const hud = hudRect(layout.insets, view);
    const left = pauseButton.hidden ? STATUS_PILL.xAlone : STATUS_PILL.x;
    const ore = statusView?.ore ?? 0;
    const aboard = statusView?.aboard?.kind ?? null;
    // The pill's width as it draws now, from the counts it shows.
    const width = statusPillWidth(
      { ore: pillCount(ore), stardust: pillCount(statusView?.stardust ?? 0) },
      aboard,
    );
    const count = weaponIds.length;
    const target = (index: number) => hud.width + hudButtonTarget(count - 1 - index).x;
    return {
      cargo: aboard ? left + width - statusCargoInset(aboard) : null,
      leftmostTarget: count > 0 ? target(0) : null,
      pill: { left, width },
      right: hud.width,
      row: HUD_ROW.centre,
      shield: shieldIconCentre(layout.insets, view, statusView?.level ?? 1),
      weapons: new Map(
        weaponIds.map((id, index) => [id, target(index) + HUD_BUTTON.target / 2] as const),
      ),
    };
  };
  const release = (pointerId: number) => state.release(pointerId);
  const stopPointers = listenPagePresses(
    (event) =>
      state.accepts() &&
      resolveUsePointer(event) !== settings.useButton &&
      (event.pointerType === "touch" || joystickTarget(event.target) !== null) &&
      !onPageControl(event.target) &&
      (event.target === canvas || event.target === parent || joystickTarget(event.target) !== null),
    {
      cancel: ({ pointerId }) => release(pointerId),
      down: ({ pointerId }, event) => {
        const at = point(event);
        state.down(at.x < canvasSize(sceneFit(scene)).width / 2 ? "move" : "aim", pointerId, at);
      },
      move: ({ pointerId }, event) => {
        state.move(pointerId, point(event));
      },
      up: ({ pointerId }) => release(pointerId),
    },
    window,
  );
  // Back and Escape close the innermost open card, innermost registered last; other cards join
  // through registerBack.
  const backStack = createBackStack();
  const leaveBack = [
    backStack.register({ back: resource.close, isOpen: resource.isOpen }),
    backStack.register({ back: weaponDetail.close, isOpen: weaponDetail.isOpen }),
    backStack.register({
      back: () => pause.close(),
      isOpen: () => pause.isOpen() && !pause.mapOpen() && !pause.shipOpen(),
    }),
    backStack.register({ back: () => pause.closeMap(), isOpen: () => pause.mapOpen() }),
    backStack.register({ back: () => pause.closeShip(), isOpen: () => pause.shipOpen() }),
    backStack.register({ back: menu.close, isOpen: menu.isOpen }),
    backStack.register({ back: () => cheats.close(), isOpen: () => cheats.isOpen() }),
    backStack.register({ back: () => achievements.close(), isOpen: () => achievements.isOpen() }),
    backStack.register({
      back: () => settings.close(),
      isOpen: () => settings.isOpen() && !settings.stepsOpen(),
    }),
    backStack.register({ back: () => settings.closeSteps(), isOpen: () => settings.stepsOpen() }),
  ];
  if (update) {
    leaveBack.push(backStack.register({ back: update.defer, isOpen: update.isOpen }));
  }
  // Back with nothing open opens the Paused card where it opens.
  const onBack = () => {
    if (!requiredReady()) {
      return;
    }
    pressBack(backStack, true, openNavigation);
  };
  const reset = () => {
    actionRoot.invalidate();
    state.reset();
    desktop.reset();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (!requiredReady()) {
      return;
    }
    // Q exits from the bare start screen, wherever Exit shows.
    if (
      event.code === "KeyQ" &&
      !event.repeat &&
      menuContext === "start" &&
      !backStack.anyOpen() &&
      !(
        event.target instanceof Element &&
        (event.target.closest("input,textarea,select") ||
          (event.target instanceof HTMLElement && event.target.isContentEditable))
      ) &&
      exitAction?.activate()
    ) {
      event.preventDefault();
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) {
        if (!backStack.back()) {
          openNavigation();
        }
      }
      return;
    }
    if (!state.accepts() || !CONTROL_KEYS.has(event.code)) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest(
        "input,textarea,select,button,a,[contenteditable]:not([contenteditable=false])",
      )
    ) {
      return;
    }
    event.preventDefault();
    if (!desktopBinding.active() && coarsePointer(window)) {
      state.keyDown(event.code, event.repeat);
    }
  };
  const keyUp = (event: KeyboardEvent) => state.keyUp(event.code);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      reset();
    }
  };
  window.addEventListener(PHONE_BACK_PRESSED, onBack);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", reset);
  window.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", onVisibility);
  const draw = () => {
    cheats.refresh();
    const flightShown = enabled && !pause.mapOpen();
    const touch =
      !desktopBinding.active() &&
      (touchControlsActive(window, flightShown, false) ||
        (flightShown && desktopBinding.touchActive()));
    syncNavigationEntry();
    // Modal covers affect input eligibility, not the underlying scene paint.
    status.setShown(enabled && !pause.mapOpen());
    notices.update(now(), flightShown, noticePlaces());
    weapons.setShown(flightShown);
    weapons.updateFeedback(now(), flightShown);
    for (const target of settings.joystickTargets) {
      target.hidden = !touch;
      target.inert = modalOpen();
    }
    useShown = useDiscShown(
      window,
      flightShown,
      context !== undefined,
      desktopBinding.touchActive(),
    );
    if (!useShown) {
      usePress = undefined;
    }
    settings.useButton.hidden = !useShown;
    settings.useButton.inert = modalOpen();
    useDisc.setVisible(useShown);
    if (context) {
      const useFocused =
        useShown && !settings.useButton.inert && settings.useButton.matches(":focus-visible");
      const pose = usePress
        ? now() - usePress.since < USE_PRESS_MS
          ? "press"
          : "held"
        : useFocused
          ? settings.useButton.matches(":active")
            ? "focus-held"
            : "focus"
          : "rest";
      const refusal =
        useRefused === undefined ? null : refusalPose(reducedMotion, now() - useRefused);
      useDisc.setFrame(
        useDiscFrame(
          context.questIcon ? "quest" : context.action,
          refusal?.tinted ? "refused" : pose,
        ),
      );
      useDisc.setPosition(useLayout.frame.x + (refusal?.shake ?? 0), useLayout.frame.y);
    }
    const size = canvasSize(sceneFit(scene));
    const views = stickViews(
      {
        height: size.height,
        insets: layout.insets,
        visibility,
        visible: touch,
        width: size.width,
      },
      state,
    );
    for (const side of ["move", "aim"] as const) {
      const view = views[side];
      const { knob, line, ring } = sticks[side];
      showSpeedLine(line, view?.line);
      if (ring) {
        ring.setVisible(view !== undefined);
        if (view) {
          showTouchChrome(ring, view.ringPose);
          ring.setPosition(view.ring.x, view.ring.y);
        }
      }
      if (knob) {
        knob.setVisible(view !== undefined);
        if (view) {
          showTouchChrome(knob, view.knobPose);
          knob.setPosition(view.knob.x, view.knob.y);
        }
      }
    }
  };
  scene.events.on("preupdate", draw);
  scene.events.on("pause", reset);
  scene.events.on("sleep", reset);
  const controls: Controls = {
    closePause: () => pause.close(),
    closeSettings: () => {
      if (cheats.isOpen()) {
        returnToMenu = undefined;
        returnToPause = undefined;
        menu.close();
        cheats.close();
      }
      settings.close();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      actionRoot.dispose();
      useAction.dispose();
      navigation.dispose();
      stopPointers();
      desktopBinding.dispose();
      state.setEnabled(false);
      returnToMenu = undefined;
      returnToPause = undefined;
      returningToParent = false;
      menu.dispose();
      resource.dispose();
      weaponDetail.dispose();
      status.dispose();
      notices.dispose();
      weapons.dispose();
      cheats.dispose();
      update?.dispose();
      achievementsAction.dispose();
      exitAction?.dispose();
      exitPose?.dispose();
      achievements.dispose();
      pause.dispose();
      settings.dispose();
      scene.events.off("prerender", fitControls);
      scene.events.off(RASTER_SCALE_EVENT, raster);
      view.dispose();
      scene.cameras.remove(camera);
      for (const part of stickParts) {
        part.destroy();
      }
      window.removeEventListener(PHONE_BACK_PRESSED, onBack);
      for (const leave of leaveBack) {
        leave();
      }
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pagehide", reset);
      document.removeEventListener("visibilitychange", onVisibility);
      scene.events.off("preupdate", draw);
      scene.events.off("pause", reset);
      scene.events.off("sleep", reset);
      scene.events.off("shutdown", controls.dispose);
      canvas.style.touchAction = previousTouchAction;
      if (ownsPosition && parent.style.position === "relative") {
        parent.style.position = previousPosition;
      }
    },
    focusGalaxies: () => pause.focusGalaxies(),
    layout: () => layout,
    navigationCovered,
    openAchievements: () => achievements.open(),
    openSettings: () => {
      cheats.close();
      settings.open();
    },
    overlay: settings.root,
    reducedMotion: () => reducedMotion,
    refuseUse() {
      useRefused = refusalStart(now(), useRefused);
    },
    registerBack: (layer) => backStack.register(layer),
    reset,
    resetShieldOreSpent(total) {
      status.resetShieldOreSpent(total);
    },
    sample(frame) {
      if (!requiredReady()) {
        reset();
        return state.sample();
      }
      const touch = state.sample();
      const sample =
        frame &&
        !desktopBinding.touchActive() &&
        (desktopBinding.active() || !coarsePointer(window))
          ? { ...desktop.sample(frame), use: touch.use }
          : touch;
      return consumeContextQuestUse(
        () => options.contextQuestDetails?.() ?? null,
        (context) => pause.openContextQuests(context),
        sample,
      );
    },
    setAchievements: (entries) => achievements.setEntries(entries),
    setAchievementsButton() {
      achievementsButton.hidden = true;
    },
    setContext(next) {
      state.setUseAvailable(next !== undefined);
      if (
        next?.action === context?.action &&
        next?.label === context?.label &&
        next?.questIcon === context?.questIcon
      ) {
        return;
      }
      context = next;
      questUseIcon.set(next?.questIcon ?? null);
      if (next) {
        settings.useButton.dataset.use = next.action;
        settings.useButton.setAttribute("aria-label", next.label);
      } else {
        delete settings.useButton.dataset.use;
        settings.useButton.removeAttribute("aria-label");
      }
    },
    setEnabled(value) {
      const nextEnabled = value && requiredReady();
      if (enabled !== nextEnabled) {
        actionRoot.invalidate();
        desktop.reset();
      }
      enabled = nextEnabled;
      state.setEnabled(nextEnabled);
      weapons.setEnabled(nextEnabled && !modalOpen());
    },
    setExitButton(shown) {
      if (exitButton) {
        if (!shown && !exitButton.hidden) {
          exitPose?.rest();
        }
        exitButton.hidden = !shown;
        settings.root.toggleAttribute(EXIT_SHOWN_ATTRIBUTE, shown);
      }
    },
    setGains(gains) {
      if (gains === null) {
        notices.clear();
        weapons.clearFeedback();
      } else {
        for (const gain of gains) {
          if (gain.kind === "ammo") {
            weapons.showAmmoGain(gain.weapon, gain.added);
          }
        }
        notices.push(gains);
      }
    },
    setPause(view) {
      pausable = view.navigation === undefined ? view.place !== null : view.navigation === "pause";
      menuContext = view.menuContext ?? "nonplay";
      menu.setContext(menuContext);
      pause.setState(view);
      syncNavigationEntry();
    },
    setSettingsButton() {
      settings.openButton.hidden = true;
      settings.root.classList.toggle("ada-no-settings-button", true);
    },
    setStatus(view) {
      statusView = view;
      status.setStatus(view, now());
      weapons.setLightField(view.lightField);
    },
    setWeapons(choices) {
      weaponIds = choices.map((choice) => choice.id);
      weapons.setWeapons(choices);
    },
  };
  scene.events.once("shutdown", controls.dispose);
  draw();
  return controls;
}
