import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import {
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
} from "@andornaut/game-kit/web/input/dom/pagePresses";
import { focusTarget } from "@andornaut/game-kit/web/ui/dom/focusModality";
import type { GameObjects, Scene } from "phaser";

import { BUILD_LABEL } from "../buildLabel.ts";
import { CONTENT } from "../data/content.ts";
import { RESOURCE_DESCRIPTIONS } from "../data/resourceDescriptions.ts";
import type { Weapon } from "../data/types.ts";
import { WEAPON_DETAIL_LABELS, weaponDetailLines } from "../data/weaponDetails.ts";
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
import type { ItemGain } from "../model/itemGains.ts";
import { weaponName } from "../model/shop.ts";
import type { UseAction } from "../model/types.ts";
import { PHONE_EVENTS } from "../pwa/events.ts";
import type { StartCover, UpdateOffer } from "../pwa/updateOffer.ts";
import {
  type AchievementEntry,
  type AchievementsLabels,
  createAchievementsCard,
} from "../ui/achievementsCard.ts";
import { type BackLayer, createBackStack, pressBack } from "../ui/backStack.ts";
import type { CheatAction } from "../ui/cheatActions.ts";
import { type CheatLabels, createCheats } from "../ui/cheats.ts";
import { createItemNotices, type NoticePlaces } from "../ui/itemNotice.ts";
import { units, VIEW_HOST_ID } from "../ui/layout/css.ts";
import {
  HUD_BUTTON,
  HUD_ROW,
  hudButtonTarget,
  hudRect,
  shieldIconCentre,
  STATUS_CARGO_INSET,
  STATUS_PILL,
  statusPillWidth,
} from "../ui/layout/playView.ts";
import { stickTargets, useDiscLayout, usePressed } from "../ui/layout/touchControls.ts";
import { createViewScaleBridge, type PlayLayout } from "../ui/layout/viewScale.ts";
import { pauseButtonShown } from "../ui/pause.ts";
import { createPauseButton } from "../ui/pauseButton.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "../ui/pauseCard.ts";
import { createResourceCard } from "../ui/resourceCard.ts";
import {
  createSettings,
  EXIT_SHOWN_ATTRIBUTE,
  type FeedbackSettings,
  type SettingsLabels,
  type SettingsOptions,
} from "../ui/settings.ts";
import { createStatusPill, pillCount, type StatusView } from "../ui/statusPill.ts";
import { STICK_DEPTHS, stickViews } from "../ui/sticks.ts";
import { USE_PRESS_MS } from "../ui/touchChrome.ts";
import { createUpdateDialog, type UpdateLabels } from "../ui/updateDialog.ts";
import { createWeaponDetailCard } from "../ui/weaponDetailCard.ts";
import { createWeaponSelector, type WeaponChoice, type WeaponLabels } from "../ui/weapons.ts";
import { FRAME_TURN } from "../view/frameTurn.ts";
import { coarsePointer, touchControlsActive } from "./coarsePointer.ts";
import { bindDesktopInput, DesktopControlState, type DesktopFrame } from "./desktop.ts";
import { type ControlSample, ControlState } from "./state.ts";

export interface ControlsOptions {
  readonly aboardResource?: () => {
    readonly questId?: string;
    readonly title: string;
    readonly text: string;
    readonly kind: "carrying" | "towing";
  } | null;
  readonly achievements: AchievementsLabels;
  readonly cheats: {
    readonly actions: readonly CheatAction[];
    readonly canExecute: () => boolean;
    readonly labels: CheatLabels;
    readonly onSave: () => void;
    readonly run: () => object | null;
  };
  // The start screen's Exit where the game offers to leave (exitShown), or undefined where it
  // does not, which makes no Exit at all.
  readonly exit?: { readonly label: string; readonly onExit: () => void } | undefined;
  readonly install?: SettingsOptions["install"];
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onPauseChange?: (paused: boolean) => void;
  readonly pause: {
    readonly buttonLabel: string;
    readonly labels: PauseLabels;
    readonly onBackToTitle: () => void;
    /** Return to Earth, which the Map offers. */
    readonly onGalaxies: () => void;
    readonly onTravel: (destination: string) => void;
  };
  // The scene's SVG raster scale when the controls are made; the scene emits
  // RASTER_SCALE_EVENT with each new one, and the touch chrome paints again at it.
  readonly rasterScale: number;
  // Settings or the cheats card opening or closing over the start screen.
  readonly onStartCover?: (what: StartCover, covering: boolean) => void;
  readonly update?: {
    readonly labels: UpdateLabels;
    readonly offer: UpdateOffer;
    // Focuses the start screen's default button as the offer closes.
    readonly restoreFocus: () => void;
  };
  // Returns whether the switch was refused.
  readonly onWeaponSelect: (weapon: Weapon) => boolean;
  // Player copy for the item notices (src/ui/itemNotice.ts).
  readonly noticeLabels: Readonly<Record<string, string>>;
  readonly shieldLabel: string;
  readonly weaponLabels: WeaponLabels;
}

/** What Use does here and the action's name, the Use disc's accessible name. */
export interface UseContext {
  readonly action: UseAction;
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
  setEnabled(enabled: boolean): void;
  // Shows the HUD settings button (the start screen); in play Settings opens from the Paused card.
  setSettingsButton(shown: boolean): void;
  // Shows the start screen's Achievements button.
  setAchievementsButton(shown: boolean): void;
  // Shows the start screen's Exit where the game offers to leave.
  setExitButton(shown: boolean): void;
  setPause(state: PauseState): void;
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
  const canvas = scene.game.canvas;
  const parent = canvas.parentElement;
  if (!parent) {
    throw new Error("Controls require a mounted game canvas");
  }
  const previousPosition = parent.style.position;
  const ownsPosition = getComputedStyle(parent).position === "static";
  if (ownsPosition) {
    parent.style.position = "relative";
  }
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  const state = new ControlState();
  const desktop = new DesktopControlState(() => state.accepts());
  let enabled = true;
  // Whether the current gameplay view permits the Paused card (PauseState.place).
  let pausable = false;
  let disposed = false;
  let context: UseContext | undefined;
  // The pointer pressing the Use disc and when it went down, for the press frame.
  let usePress: { readonly id: number; readonly since: number } | undefined;
  let useShown = false;
  let visibility = { aim: true, move: true };
  let reducedMotion = false;
  const settings = createSettings(parent, {
    build: BUILD_LABEL,
    install: options.install,
    labels: options.labels,
    onFeedbackChange(value) {
      reducedMotion = value.reducedMotion;
      options.onFeedbackChange?.(value);
    },
    onOpenChange(open) {
      options.onStartCover?.("settings", open);
      if (!open && returnToPause && !cheatsOpening) {
        returnToPause = false;
        pause.open();
      }
      syncModal();
    },
    onVisibilityChange(value) {
      visibility = value;
    },
  });
  // Settings opened from the Paused card, and the cheats card opened from that Settings, return
  // to the Paused card when they close.
  let returnToPause = false;
  let cheatsOpening = false;
  const cheats = createCheats(settings.root, settings.card, {
    ...options.cheats,
    beforeOpen: () => {
      cheatsOpening = true;
      settings.close();
      cheatsOpening = false;
    },
    onOpenChange: (open) => {
      options.onStartCover?.("cheats", open);
      if (!open && returnToPause) {
        returnToPause = false;
        pause.open();
      }
      syncModal();
    },
    restoreFocus: () => focusTarget(settings.openButton),
  });
  const pause = createPauseCards(settings.root, {
    labels: options.pause.labels,
    onBackToTitle: () => options.pause.onBackToTitle(),
    onGalaxies: () => options.pause.onGalaxies(),
    onOpenChange: () => syncModal(),
    onSettings: () => {
      returnToPause = true;
      settings.open();
    },
    onTravel: (destination) => options.pause.onTravel(destination),
    reducedMotion: () => reducedMotion,
  });
  // The start screen's Achievements disc remains in the HUD.
  const achievements = createAchievementsCard(settings.root, {
    labels: options.achievements,
    onOpenChange: (open) => {
      options.onStartCover?.("achievements", open);
      achievementsButton.setAttribute("aria-expanded", String(open));
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
  achievementsButton.addEventListener("click", () => achievements.open());
  // Settings opens from the Paused card. Its standalone HUD position holds Achievements.
  settings.openButton.replaceWith(achievementsButton);
  settings.root.classList.add("ada-no-settings-button");
  // The start screen's Exit follows Achievements, where the game offers to leave.
  const exitButton = options.exit ? document.createElement("button") : undefined;
  if (exitButton && options.exit) {
    const { label, onExit } = options.exit;
    exitButton.type = "button";
    exitButton.className = "ada-exit-open";
    exitButton.dataset.action = "exit";
    exitButton.setAttribute("aria-label", label);
    exitButton.title = label;
    exitButton.hidden = true;
    const exitDisc = document.createElement("span");
    exitDisc.className = "ada-disc";
    exitDisc.setAttribute("aria-hidden", "true");
    exitButton.append(exitDisc);
    exitButton.addEventListener("click", onExit);
    achievementsButton.after(exitButton);
  }
  const pauseButton = createPauseButton(settings.root, options.pause.buttonLabel, () =>
    pause.open(),
  );
  const modalOpen = (): boolean =>
    settings.isOpen() ||
    cheats.isOpen() ||
    pause.isOpen() ||
    achievements.isOpen() ||
    resource.isOpen() ||
    weaponDetail.isOpen() ||
    (update?.isOpen() ?? false);
  function syncModal(): void {
    const open = modalOpen();
    desktop.reset();
    settings.root.classList.toggle("ada-modal-open", open);
    if (open) {
      state.openModal();
    } else {
      state.closeModal();
    }
    weapons.setEnabled(enabled && !open);
    status.setShown(enabled && !open);
    options.onPauseChange?.(open);
  }
  const weapons = createWeaponSelector(settings.root, {
    labels: options.weaponLabels,
    onHold: (choice, origin) => {
      if (!state.accepts()) {
        return;
      }
      const ammo =
        choice.ammo === null
          ? WEAPON_DETAIL_LABELS.detailUnlimited
          : WEAPON_DETAIL_LABELS.detailAmmoLeft.replace(
              "{count}",
              new Intl.NumberFormat("en-US").format(choice.ammo),
            );
      weaponDetail.open(
        weaponName(CONTENT.labels, choice.id),
        [...weaponDetailLines(choice.id, choice.level), ammo],
        origin,
        { id: choice.id, level: choice.level },
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
          quests: {
            label: options.pause.labels.mapScreen.quests,
            onOpen: () => pause.openQuests(),
          },
        });
      } else {
        resource.open(
          CONTENT.labels[kind] ?? "",
          RESOURCE_DESCRIPTIONS[kind],
          origin,
          icon ? { icon } : {},
        );
      }
    },
    reducedMotion: () => reducedMotion,
    shieldLabel: options.shieldLabel,
  });
  // The chip draws under the HUD controls: it goes first among them.
  const notices = createItemNotices(settings.root, {
    labels: options.noticeLabels,
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
  const host = parent.closest<HTMLElement>(`#${VIEW_HOST_ID}`) ?? parent;
  const view = createViewScaleBridge(host, scene.scale.displaySize);
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
  const desktopBinding = bindDesktopInput(
    {
      accepts: () => state.accepts(),
      onModeChange: () => state.reset(),
      onUse: () => state.requestUse(),
      point,
      surface: canvas,
    },
    desktop,
  );
  const joystickTarget = (target: EventTarget | null) => {
    const found = target instanceof Element ? target.closest("[data-control]") : null;
    return found && settings.root.contains(found) ? found : null;
  };
  // Where the item notice's chip and destinations sit now, in HUD rect px.
  const noticePlaces = (): NoticePlaces => {
    const view = canvasSize(sceneFit(scene));
    const hud = hudRect(layout.insets, view);
    const left = pauseButton.hidden ? STATUS_PILL.xAlone : STATUS_PILL.x;
    const ore = statusView?.ore ?? 0;
    const aboard = Boolean(statusView?.aboard);
    // The pill's width as it draws now, from the counts it shows.
    const width = statusPillWidth(
      { ore: pillCount(ore), stardust: pillCount(statusView?.stardust ?? 0) },
      aboard,
    );
    const count = weaponIds.length;
    const target = (index: number) => hud.width + hudButtonTarget(count - 1 - index).x;
    return {
      cargo: aboard ? left + width - STATUS_CARGO_INSET : null,
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
  const release = (pointerId: number) => {
    if (usePress?.id === pointerId) {
      usePress = undefined;
    } else {
      state.release(pointerId);
    }
  };
  const stopPointers = listenPagePresses(
    (event) =>
      state.accepts() &&
      (event.pointerType === "touch" || joystickTarget(event.target) !== null) &&
      !onPageControl(event.target) &&
      (event.target === canvas || event.target === parent || joystickTarget(event.target) !== null),
    {
      cancel: ({ pointerId }) => release(pointerId),
      down: ({ pointerId }, event) => {
        const at = point(event);
        // Use's press circle takes a press first; the rest of the view starts a stick.
        if (useShown && !usePress && usePressed(useLayout, at)) {
          usePress = { id: pointerId, since: performance.now() };
          state.requestUse();
          return;
        }
        state.down(at.x < canvasSize(sceneFit(scene)).width / 2 ? "move" : "aim", pointerId, at);
      },
      move: ({ pointerId }, event) => {
        if (usePress?.id !== pointerId) {
          state.move(pointerId, point(event));
        }
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
    pressBack(backStack, pausable, () => pause.open());
  };
  const reset = () => {
    state.reset();
    desktop.reset();
  };
  const keyDown = (event: KeyboardEvent) => {
    // Q exits from the bare start screen, wherever Exit shows.
    if (
      event.code === "KeyQ" &&
      !event.repeat &&
      exitButton &&
      !exitButton.hidden &&
      !backStack.anyOpen() &&
      !(event.target instanceof Element && event.target.closest("input,textarea,select"))
    ) {
      event.preventDefault();
      options.exit?.onExit();
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) {
        if (!backStack.back() && pausable) {
          pause.open();
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
  const use = () => state.requestUse();
  settings.useButton.addEventListener("click", use);
  window.addEventListener(PHONE_EVENTS.backPressed, onBack);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", reset);
  window.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", onVisibility);
  const draw = () => {
    cheats.refresh();
    const touch =
      !desktopBinding.active() &&
      (touchControlsActive(window, enabled, modalOpen()) ||
        (enabled && !modalOpen() && desktopBinding.touchActive()));
    pauseButton.hidden = !pauseButtonShown(coarsePointer(window), pausable, modalOpen());
    // The pill remains beside Pause and hides under a card.
    status.setShown(enabled && !modalOpen());
    notices.update(performance.now(), enabled && !modalOpen(), noticePlaces());
    weapons.updateFeedback(performance.now(), enabled && !modalOpen());
    for (const target of settings.joystickTargets) {
      target.hidden = !touch;
    }
    // Use is a touch control, as in Chibi: shown on a touch screen while an action is in reach;
    // on desktop the Use key acts.
    useShown = touch && context !== undefined;
    if (!useShown) {
      usePress = undefined;
    }
    settings.useButton.hidden = !useShown;
    useDisc.setVisible(useShown);
    if (context) {
      const held = usePress
        ? performance.now() - usePress.since < USE_PRESS_MS
          ? "press"
          : "held"
        : "rest";
      useDisc.setFrame(useDiscFrame(context.action, held));
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
      cheats.close();
      settings.close();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      stopPointers();
      desktopBinding.dispose();
      state.setEnabled(false);
      resource.dispose();
      weaponDetail.dispose();
      status.dispose();
      notices.dispose();
      weapons.dispose();
      cheats.dispose();
      update?.dispose();
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
      window.removeEventListener(PHONE_EVENTS.backPressed, onBack);
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
    openAchievements: () => achievements.open(),
    openSettings: () => {
      cheats.close();
      settings.open();
    },
    overlay: settings.root,
    reducedMotion: () => reducedMotion,
    registerBack: (layer) => backStack.register(layer),
    reset,
    resetShieldOreSpent(total) {
      status.resetShieldOreSpent(total);
    },
    sample(frame) {
      const touch = state.sample();
      return frame &&
        !desktopBinding.touchActive() &&
        (desktopBinding.active() || !coarsePointer(window))
        ? { ...desktop.sample(frame), use: touch.use }
        : touch;
    },
    setAchievements: (entries) => achievements.setEntries(entries),
    setAchievementsButton(shown) {
      achievementsButton.hidden = !shown;
    },
    setContext(next) {
      state.setUseAvailable(next !== undefined);
      if (next?.action === context?.action && next?.label === context?.label) {
        return;
      }
      context = next;
      if (next) {
        settings.useButton.dataset.use = next.action;
        settings.useButton.setAttribute("aria-label", next.label);
      } else {
        delete settings.useButton.dataset.use;
        settings.useButton.removeAttribute("aria-label");
      }
    },
    setEnabled(value) {
      if (enabled !== value) {
        desktop.reset();
      }
      enabled = value;
      state.setEnabled(value);
      weapons.setEnabled(value && !modalOpen());
    },
    setExitButton(shown) {
      if (exitButton) {
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
      pausable = view.place !== null;
      pause.setState(view);
    },
    setSettingsButton() {
      settings.openButton.hidden = true;
      settings.root.classList.add("ada-no-settings-button");
    },
    setStatus(view) {
      statusView = view;
      status.setStatus(view, performance.now());
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
