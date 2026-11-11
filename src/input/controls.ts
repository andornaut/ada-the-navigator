import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import {
  clientPoint,
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
} from "@andornaut/game-kit/web/input/dom/pagePresses";
import type { GameObjects, Scene } from "phaser";

import type { Weapon } from "../data/types.ts";
import { createTouchChrome, showTouchChrome } from "../game/touch-chrome.ts";
import type { CheatAction } from "../ui/cheat-actions.ts";
import { type CheatLabels, createCheats } from "../ui/cheats.ts";
import { createSettings, type FeedbackSettings, type SettingsLabels } from "../ui/settings.ts";
import { createShieldMeter } from "../ui/shield.ts";
import { stickRestCentres, stickViews } from "../ui/sticks.ts";
import { TOUCH_CHROME_FRAME } from "../ui/touch-chrome.ts";
import { createWeaponSelector, type WeaponChoice, type WeaponLabels } from "../ui/weapons.ts";
import { FRAME_TURN } from "../view/frame-turn.ts";
import { movementCssScale } from "./geometry.ts";
import { type ControlSample, ControlState } from "./state.ts";

export interface ControlsOptions {
  readonly cheats: {
    readonly actions: readonly CheatAction[];
    readonly canExecute: () => boolean;
    readonly labels: CheatLabels;
    readonly onSave: () => void;
    readonly run: () => object | null;
  };
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onPauseChange?: (paused: boolean) => void;
  readonly onWeaponSelect: (weapon: Weapon) => void;
  readonly shieldLabel: string;
  readonly weaponLabels: WeaponLabels;
}

export interface Controls {
  closeSettings(): void;
  dispose(): void;
  openSettings(): void;
  reset(): void;
  sample(): ControlSample;
  setContext(label: string | undefined): void;
  setEnabled(enabled: boolean): void;
  setShield(maximum: number, shield: number): void;
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
  const settings = createSettings(parent, {
    labels: options.labels,
    onFeedbackChange(value) {
      options.onFeedbackChange?.(value);
    },
    onOpenChange() {
      syncModal();
    },
    onVisibilityChange(value) {
      visibility = value;
    },
  });
  const cheats = createCheats(settings.root, settings.card, {
    ...options.cheats,
    beforeOpen: () => settings.close(),
    onOpenChange: () => syncModal(),
    restoreFocus: () => settings.openButton.focus(),
  });
  const modalOpen = (): boolean => settings.isOpen() || cheats.isOpen();
  function syncModal(): void {
    const open = modalOpen();
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
  });
  const shield = createShieldMeter(options.shieldLabel, settings.root);
  const sticks = {
    aim: { knob: createTouchChrome(scene, "knob"), ring: createTouchChrome(scene, "aim") },
    move: { knob: createTouchChrome(scene, "knob"), ring: createTouchChrome(scene, "move") },
  };
  const stickParts = [sticks.move.ring, sticks.move.knob, sticks.aim.ring, sticks.aim.knob].filter(
    (part) => part !== undefined,
  );
  for (const part of stickParts) {
    part.setScrollFactor(0).setDepth(10000).setVisible(false);
  }
  scene.cameras.main.ignore(stickParts);
  const stickSet = new Set<GameObjects.GameObject>(stickParts);
  const camera = scene.cameras.add(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
  // Keep each joystick's pointer target over its drawn rest ring, in the canvas's CSS pixels.
  let placedTargets = "";
  const placeTargets = (): void => {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const placement = [
      width,
      height,
      canvas.offsetLeft,
      canvas.offsetTop,
      scene.scale.gameSize.width,
      scene.scale.gameSize.height,
    ].join();
    if (width <= 0 || height <= 0 || placement === placedTargets) {
      return;
    }
    placedTargets = placement;
    const scale = {
      x: width / scene.scale.gameSize.width,
      y: height / scene.scale.gameSize.height,
    };
    const rest = stickRestCentres(scene.scale.gameSize);
    settings.joystickTargets.forEach((target, index) => {
      const centre = rest[index === 0 ? "move" : "aim"];
      const size = { x: TOUCH_CHROME_FRAME * scale.x, y: TOUCH_CHROME_FRAME * scale.y };
      target.style.left = `${canvas.offsetLeft + (centre.x + 0.5) * scale.x - size.x / 2}px`;
      target.style.top = `${canvas.offsetTop + (centre.y + 0.5) * scale.y - size.y / 2}px`;
      target.style.width = `${size.x}px`;
      target.style.height = `${size.y}px`;
    });
  };
  const fitControls = (): void => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      state.setMoveScale(movementCssScale(FRAME_TURN.turn(), scene.scale.gameSize, bounds));
    }
    camera.setViewport(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
    camera.ignore(scene.children.list.filter((object) => !stickSet.has(object)));
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
  const reset = () => state.reset();
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) {
        if (cheats.isOpen()) {
          cheats.close();
        } else if (settings.isOpen()) {
          settings.close();
        } else {
          settings.open();
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
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", reset);
  window.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", onVisibility);
  const draw = () => {
    cheats.refresh();
    for (const target of settings.joystickTargets) {
      target.hidden = !enabled || modalOpen();
    }
    const views = stickViews(
      {
        height: scene.scale.height,
        visibility,
        visible: enabled && !modalOpen(),
        width: scene.scale.width,
      },
      state,
    );
    for (const side of ["move", "aim"] as const) {
      const view = views[side];
      const { knob, ring } = sticks[side];
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
      shield.dispose();
      weapons.dispose();
      cheats.dispose();
      settings.dispose();
      scene.events.off("prerender", fitControls);
      scene.cameras.remove(camera);
      for (const part of stickParts) {
        part.destroy();
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
      shield.setEnabled(value);
      settings.useButton.hidden = !value || contextLabel === undefined;
    },
    setShield: (maximum, value) => shield.setShield(maximum, value),
    setWeapons: (choices) => weapons.setWeapons(choices),
  };
  scene.events.once("shutdown", controls.dispose);
  draw();
  return controls;
}
