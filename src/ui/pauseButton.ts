import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { SCROLL } from "../data/layout.ts";
import {
  ADA_ACTION_HOLD_MS,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actionBinding.ts";
import { readViewUnit } from "./layout/viewScale.ts";
import { type PauseFrame, pauseFrames, pausePose } from "./pause.ts";

const disposers = new WeakMap<HTMLButtonElement, () => void>();

export function disposePauseButton(button: HTMLButtonElement): void {
  disposers.get(button)?.();
}

const UI_ROOT = "/art/ui/";

/** Presents the shared navigation poses without owning an activation. */
export function mountNavigationPose(button: HTMLButtonElement) {
  let disposed = false;
  let frames: Readonly<Record<"held" | "press" | "rest", readonly PauseFrame[]>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const showFrame = (frame: PauseFrame | undefined) => {
    button.dataset.pose = pausePose(frame?.index ?? 0);
  };
  const rest = () => {
    clearTimeout(timer);
    showFrame(frames?.rest[0]);
  };
  const press = () => {
    clearTimeout(timer);
    const steps = frames?.press ?? [];
    const play = (index: number) => {
      const frame = steps[index];
      if (!frame) {
        showFrame(frames?.held[0]);
        return;
      }
      showFrame(frame);
      timer = setTimeout(() => play(index + 1), frame.duration);
    };
    play(0);
  };
  void fetch(`${UI_ROOT}manifest.json`)
    .then((response) => response.json() as Promise<{ sprites?: { json: string; key: string }[] }>)
    .then((manifest) => {
      const entry = manifest.sprites?.find((sprite) => sprite.key === "ui-pause");
      return entry
        ? fetch(`${UI_ROOT}${entry.json}`).then((response) => response.json())
        : undefined;
    })
    .then((sheet: unknown) => {
      if (sheet && !disposed) {
        frames = pauseFrames(sheet as Parameters<typeof pauseFrames>[0]);
        rest();
      }
    })
    .catch(() => undefined);
  return {
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
    press,
    rest,
  };
}

// Chibi's touch pause button (ui-pause): rest, then its press frames once on a press, then held
// until release, each frame drawn as its pose's vector art. Activating it pauses. Its tags and
// timing come from the UI manifest's sheet; until they load it shows the rest pose.
export function createPauseButton(
  root: HTMLElement,
  label: string,
  onPause: () => void,
): HTMLButtonElement {
  const kit = createButton(root.ownerDocument, {
    appearance: { className: "ada-pause", face: {}, layout: "caller" },
    content: { kind: "icon", name: label },
    getAction: (button) => {
      const owned = resolveAdaHoldAction(root, button);
      return owned?.available() ? owned : null;
    },
    getState: (button) => ({
      availability: button.hidden
        ? { kind: "omitted" }
        : button.disabled
          ? { kind: "disabled" }
          : { kind: "available" },
    }),
    rule: { holdMs: ADA_ACTION_HOLD_MS, slopPx: SCROLL.dragThreshold },
  });
  const button = kit.element;
  // The HUD paints the pose and focus on the button's pseudo-element.
  kit.face.hidden = true;
  button.dataset.action = "pause";
  button.title = label;
  button.hidden = true;
  let disposed = false;
  const pose = mountNavigationPose(button);
  const action = bindAdaAction(
    {
      click: {
        availability: () =>
          button.disabled || button.closest("[hidden], [inert]")
            ? { kind: "omitted" }
            : { kind: "available" },
        run: () => {
          pose.rest();
          onPause();
        },
      },
      current: () => !disposed && button.isConnected,
      nativeClickOwner: "factory",
      slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
    },
    button,
  );
  const dispose = () => {
    disposed = true;
    action.dispose();
    kit.dispose();
    pose.dispose();
    button.removeEventListener("pointerdown", pose.press);
    for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
      button.removeEventListener(type, pose.rest);
    }
    disposers.delete(button);
  };
  try {
    assertAdaActionMetadata(button);
    root.append(button);
    assertAdaActionBindings(button);
  } catch (error) {
    dispose();
    button.remove();
    throw error;
  }
  button.addEventListener("pointerdown", pose.press);
  for (const type of ["pointerup", "pointercancel", "pointerleave"] as const) {
    button.addEventListener(type, pose.rest);
  }
  disposers.set(button, dispose);
  return button;
}
