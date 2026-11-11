import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import {
  clientPoint,
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
} from "@andornaut/game-kit/web/input/dom/pagePresses";
import type { GameObjects, Scene } from "phaser";

import type { Weapon } from "../data/types.ts";
import {
  createSpeedLine,
  createTouchChrome,
  showSpeedLine,
  showTouchChrome,
} from "../game/touch-chrome.ts";
import { PHONE_EVENTS } from "../pwa/events.ts";
import type { StartCover, UpdateOffer } from "../pwa/updateOffer.ts";
import { type BackLayer, createBackStack, pressBack } from "../ui/back-stack.ts";
import type { CheatAction } from "../ui/cheat-actions.ts";
import { type CheatLabels, createCheats } from "../ui/cheats.ts";
import { units, VIEW_HOST_ID, VIEW_PROPERTIES } from "../ui/layout/css.ts";
import { noticeReserve } from "../ui/layout/playView.ts";
import { stickTargets } from "../ui/layout/touchControls.ts";
import { createViewScaleBridge } from "../ui/layout/viewScale.ts";
import { escapeTarget, pauseButtonShown } from "../ui/pause.ts";
import { createPauseButton } from "../ui/pause-button.ts";
import { createPauseCards, type PauseLabels, type PauseState } from "../ui/pause-card.ts";
import {
  createSettings,
  type FeedbackSettings,
  type SettingsLabels,
  type SettingsOptions,
} from "../ui/settings.ts";
import { createStatusPill, type StatusView } from "../ui/status-pill.ts";
import { STICK_DEPTHS, stickViews } from "../ui/sticks.ts";
import { createUpdateDialog, type UpdateLabels } from "../ui/update-dialog.ts";
import { createWeaponSelector, type WeaponChoice, type WeaponLabels } from "../ui/weapons.ts";
import { FRAME_TURN } from "../view/frame-turn.ts";
import { coarsePointer, touchControlsActive } from "./coarse-pointer.ts";
import { type ControlSample, ControlState } from "./state.ts";

export interface ControlsOptions {
  readonly cheats: {
    readonly actions: readonly CheatAction[];
    readonly canExecute: () => boolean;
    readonly labels: CheatLabels;
    readonly onSave: () => void;
    readonly run: () => object | null;
  };
  readonly install?: SettingsOptions["install"];
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onPauseChange?: (paused: boolean) => void;
  readonly pause: {
    readonly buttonLabel: string;
    readonly labels: PauseLabels;
    readonly onReturnHome: () => void;
    readonly onTravel: (destination: string) => void;
  };
  // Settings or the cheats card opening or closing over the start screen.
  readonly onStartCover?: (what: StartCover, covering: boolean) => void;
  readonly update?: { readonly labels: UpdateLabels; readonly offer: UpdateOffer };
  readonly onWeaponSelect: (weapon: Weapon) => void;
  readonly shieldLabel: string;
  readonly weaponLabels: WeaponLabels;
}

export interface Controls {
  closeSettings(): void;
  // Adds a card that back and Escape close while it is open, innermost so far.
  registerBack(layer: BackLayer): () => void;
  dispose(): void;
  openSettings(): void;
  /** The DOM layer that holds the controls and modal cards. */
  readonly overlay: HTMLElement;
  // Whether Reduced motion is on, for the refusal cue.
  reducedMotion(): boolean;
  reset(): void;
  sample(): ControlSample;
  setContext(label: string | undefined): void;
  setEnabled(enabled: boolean): void;
  // Shows the HUD settings button (the start screen); in play Settings opens from the Paused card.
  setSettingsButton(shown: boolean): void;
  setTravel(state: PauseState): void;
  // The status pill's shield and Stardust count.
  setStatus(view: StatusView): void;
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
  let enabled = true;
  let disposed = false;
  let contextLabel: string | undefined;
  let visibility = { aim: true, move: true };
  let reducedMotion = false;
  const settings = createSettings(parent, {
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
    restoreFocus: () => settings.openButton.focus(),
  });
  const pause = createPauseCards(settings.root, {
    labels: options.pause.labels,
    onOpenChange: () => syncModal(),
    onReturnHome: () => options.pause.onReturnHome(),
    onSettings: () => {
      returnToPause = true;
      settings.open();
    },
    onTravel: (destination) => options.pause.onTravel(destination),
    reducedMotion: () => reducedMotion,
  });
  const pauseButton = createPauseButton(settings.root, options.pause.buttonLabel, () =>
    pause.open(),
  );
  let settingsButton = true;
  const modalOpen = (): boolean =>
    settings.isOpen() || cheats.isOpen() || pause.isOpen() || (update?.isOpen() ?? false);
  function syncModal(): void {
    const open = modalOpen();
    settings.root.classList.toggle("ada-modal-open", open);
    if (open) {
      state.openModal();
    } else {
      state.closeModal();
    }
    weapons.setEnabled(enabled && !open);
    options.onPauseChange?.(open);
  }
  const weapons = createWeaponSelector(settings.root, {
    labels: options.weaponLabels,
    onSelect(weapon) {
      if (state.accepts()) {
        options.onWeaponSelect(weapon);
      }
    },
    reducedMotion: () => reducedMotion,
  });
  const status = createStatusPill(settings.root, {
    reducedMotion: () => reducedMotion,
    shieldLabel: options.shieldLabel,
  });
  let pillWidth = 0;
  let weaponCount = 0;
  // A notice keeps clear of the status pill and the weapon row's press areas.
  const reserveNotice = () => {
    host.style.setProperty(
      VIEW_PROPERTIES.noticeReserve,
      units(noticeReserve(weaponCount, pillWidth)),
    );
  };
  const update = options.update
    ? createUpdateDialog(settings.root, options.update.labels, options.update.offer, () =>
        syncModal(),
      )
    : undefined;
  const stick = (kind: "aim" | "move") => ({
    knob: createTouchChrome(scene, "knob")?.setDepth(STICK_DEPTHS.knob),
    line: createSpeedLine(scene).setDepth(STICK_DEPTHS.line),
    ring: createTouchChrome(scene, kind)?.setDepth(STICK_DEPTHS.ring),
  });
  const sticks = { aim: stick("aim"), move: stick("move") };
  const stickParts = [sticks.move, sticks.aim]
    .flatMap(({ knob, line, ring }) => [ring, line, knob])
    .filter((part) => part !== undefined);
  for (const part of stickParts) {
    part.setScrollFactor(0).setVisible(false);
  }
  scene.cameras.main.ignore(stickParts);
  const stickSet = new Set<GameObjects.GameObject>(stickParts);
  const camera = scene.cameras.add(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
  // The play area's view scale (src/ui/layout/viewScale.ts): the DOM UI's logical px, the safe
  // insets and the nine-slice edges, from the canvas's display size.
  const host = parent.closest<HTMLElement>(`#${VIEW_HOST_ID}`) ?? parent;
  const view = createViewScaleBridge(host, scene.scale.displaySize);
  let layout = view.update();
  // Keep each joystick's pointer target over its drawn rest ring, in logical canvas px.
  let placedTargets = "";
  const placeTargets = (): void => {
    const { gameSize } = scene.scale;
    const placement = JSON.stringify([gameSize.width, gameSize.height, layout.insets]);
    if (placement === placedTargets) {
      return;
    }
    placedTargets = placement;
    const targets = stickTargets(gameSize, layout.insets);
    settings.joystickTargets.forEach((target, index) => {
      const rect = targets[index === 0 ? "move" : "aim"];
      target.style.left = units(rect.x);
      target.style.top = units(rect.y);
    });
  };
  const fitControls = (): void => {
    camera.setViewport(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
    camera.ignore(scene.children.list.filter((object) => !stickSet.has(object)));
    layout = view.update();
    placeTargets();
  };
  scene.events.on("prerender", fitControls);
  fitControls();
  const point = (event: PagePointerEvent) => {
    fitControls();
    return pageToGame(
      FRAME_TURN.turn(),
      canvas.getBoundingClientRect(),
      scene.scale.gameSize,
      clientPoint(event),
    );
  };
  const joystickTarget = (target: EventTarget | null) => {
    const found = target instanceof Element ? target.closest("[data-control]") : null;
    return found && settings.root.contains(found) ? found : null;
  };
  const stopPointers = listenPagePresses(
    (event) =>
      state.accepts() &&
      coarsePointer(window) &&
      (event.pointerType === "touch" || joystickTarget(event.target) !== null) &&
      !onPageControl(event.target) &&
      (event.target === canvas || event.target === parent || joystickTarget(event.target) !== null),
    {
      cancel: ({ pointerId }) => state.release(pointerId),
      down: ({ pointerId }, event) => {
        const at = point(event);
        state.down(at.x < scene.scale.width / 2 ? "move" : "aim", pointerId, at);
      },
      move: ({ pointerId }, event) => state.move(pointerId, point(event)),
      up: ({ pointerId }) => state.release(pointerId),
    },
    window,
  );
  // Back and Escape close the innermost open card, innermost registered last; other cards join
  // through registerBack.
  const backStack = createBackStack();
  const leaveBack = [
    backStack.register({
      back: () => pause.close(),
      isOpen: () => pause.isOpen() && !pause.travelOpen(),
    }),
    backStack.register({ back: () => pause.closeTravel(), isOpen: () => pause.travelOpen() }),
    backStack.register({ back: () => cheats.close(), isOpen: () => cheats.isOpen() }),
    backStack.register({
      back: () => settings.close(),
      isOpen: () => settings.isOpen() && !settings.stepsOpen(),
    }),
    backStack.register({ back: () => settings.closeSteps(), isOpen: () => settings.stepsOpen() }),
  ];
  if (update) {
    leaveBack.push(backStack.register({ back: update.defer, isOpen: update.isOpen }));
  }
  // Back during flight with nothing open opens the Paused card.
  const onBack = () => {
    pressBack(backStack, enabled, () => pause.open());
  };
  const reset = () => state.reset();
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) {
        if (!backStack.back()) {
          const target = escapeTarget(enabled, settingsButton);
          if (target === "pause") {
            pause.open();
          } else if (target === "settings") {
            settings.open();
          }
        }
      }
      return;
    }
    if (!state.accepts() || !CONTROL_KEYS.has(event.code)) {
      return;
    }
    if (
      event.target instanceof Element &&
      (event.target.closest("input,textarea,select") ||
        (event.code === "Space" && event.target.closest("button,a")))
    ) {
      return;
    }
    event.preventDefault();
    state.keyDown(event.code, event.repeat);
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
    const touch = touchControlsActive(window, enabled, modalOpen());
    pauseButton.hidden = !pauseButtonShown(coarsePointer(window), enabled, modalOpen());
    // The pill shows in flight and hides with the pause button under a card; on desktop, where the
    // pause button is hidden, it keeps its place.
    status.setShown(enabled && !modalOpen());
    for (const target of settings.joystickTargets) {
      target.hidden = !touch;
    }
    const views = stickViews(
      {
        height: scene.scale.height,
        insets: layout.insets,
        visibility,
        visible: touch,
        width: scene.scale.width,
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
      state.setEnabled(false);
      status.dispose();
      weapons.dispose();
      cheats.dispose();
      update?.dispose();
      pause.dispose();
      settings.dispose();
      scene.events.off("prerender", fitControls);
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
    openSettings: () => {
      cheats.close();
      settings.open();
    },
    overlay: settings.root,
    reducedMotion: () => reducedMotion,
    registerBack: (layer) => backStack.register(layer),
    reset,
    sample: () => state.sample(),
    setContext(label) {
      contextLabel = label;
      state.setUseAvailable(label !== undefined);
      settings.useButton.hidden = !enabled || label === undefined;
      settings.useButton.textContent = label ?? "";
    },
    setEnabled(value) {
      enabled = value;
      state.setEnabled(value);
      weapons.setEnabled(value && !modalOpen());

      settings.useButton.hidden = !value || contextLabel === undefined;
    },
    setSettingsButton(shown) {
      settingsButton = shown;
      settings.openButton.hidden = !shown;
      settings.root.classList.toggle("ada-no-settings-button", !shown);
    },
    setStatus(view) {
      status.setStatus(view, performance.now());
      const width = status.width();
      if (width !== pillWidth) {
        pillWidth = width;
        reserveNotice();
      }
    },
    setTravel: (travel) => pause.setState(travel),
    setWeapons(choices) {
      if (choices.length !== weaponCount) {
        weaponCount = choices.length;
        reserveNotice();
      }
      weapons.setWeapons(choices);
    },
  };
  scene.events.once("shutdown", controls.dispose);
  draw();
  return controls;
}
