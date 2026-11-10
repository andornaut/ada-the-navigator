import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import {
  clientPoint,
  listenPagePresses,
  onPageControl,
  type PagePointerEvent,
} from "@andornaut/game-kit/web/input/dom/pagePresses";
import type { Scene } from "phaser";

import { createSettings, type FeedbackSettings, type SettingsLabels } from "../ui/settings.ts";
import { drawSticks } from "../ui/sticks.ts";
import { FRAME_TURN } from "../view/frame-turn.ts";
import { type ControlSample, ControlState } from "./state.ts";

export interface ControlsOptions {
  readonly labels: SettingsLabels;
  readonly onFeedbackChange?: (settings: FeedbackSettings) => void;
  readonly onPauseChange?: (paused: boolean) => void;
}

export interface Controls {
  closeSettings(): void;
  dispose(): void;
  openSettings(): void;
  reset(): void;
  sample(): ControlSample;
  setContext(label: string | undefined): void;
  setEnabled(enabled: boolean): void;
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
    onOpenChange(open) {
      if (open) {
        state.openModal();
      } else {
        state.closeModal();
      }
      options.onPauseChange?.(open);
    },
    onVisibilityChange(value) {
      visibility = value;
    },
  });
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(10000);
  const camera = scene.cameras.add(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
  scene.cameras.main.ignore(graphics);
  const fitControls = (): void => {
    camera.setViewport(0, 0, scene.scale.gameSize.width, scene.scale.gameSize.height);
    camera.ignore(scene.children.list.filter((object) => object !== graphics));
  };
  scene.events.on("prerender", fitControls);
  fitControls();
  const point = (event: PagePointerEvent) =>
    pageToGame(
      FRAME_TURN.turn(),
      canvas.getBoundingClientRect(),
      scene.scale.gameSize,
      clientPoint(event),
    );
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
        if (settings.isOpen()) {
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
    for (const target of settings.joystickTargets) {
      target.hidden = !enabled || settings.isOpen();
    }
    drawSticks(
      graphics,
      {
        height: scene.scale.height,
        showIdle: true,
        visibility,
        visible: enabled && !settings.isOpen(),
        width: scene.scale.width,
      },
      state,
    );
  };
  scene.events.on("preupdate", draw);
  scene.events.on("pause", reset);
  scene.events.on("sleep", reset);
  const controls: Controls = {
    closeSettings: () => settings.close(),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      stopPointers();
      state.setEnabled(false);
      settings.dispose();
      scene.events.off("prerender", fitControls);
      scene.cameras.remove(camera);
      graphics.destroy();
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
    openSettings: () => settings.open(),
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
      settings.useButton.hidden = !value || contextLabel === undefined;
    },
  };
  scene.events.once("shutdown", controls.dispose);
  draw();
  return controls;
}
