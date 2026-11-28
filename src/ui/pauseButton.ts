import { createButton } from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { SCROLL } from "../data/layout.ts";
import {
  ADA_ACTION_HOLD_MS,
  assertAdaActionBindings,
  assertAdaActionMetadata,
  bindAdaAction,
  resolveAdaHoldAction,
} from "./actions/index.ts";
import { readViewUnit } from "./layoutDom/index.ts";
import { type PauseFrame, pauseFrames, pausePose } from "./pause.ts";

const UI_ROOT = "/art/ui/";

/** Presents the shared navigation poses without owning an activation. */
function mountNavigationPose(button: HTMLButtonElement) {
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

/** Mounts one HUD disc with the press and held poses from the UI manifest. */
export function createHudNavigationButton(
  root: HTMLElement,
  options: {
    readonly action: "pause" | "exit";
    readonly current?: (button: HTMLButtonElement) => boolean;
  },
  label: string,
  activate: () => void,
) {
  const kit = createButton(root.ownerDocument, {
    appearance: {
      className: options.action === "exit" ? "ada-exit-open" : "ada-pause",
      face: {},
      layout: "caller",
    },
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
  button.dataset.action = options.action;
  button.title = label;
  button.hidden = true;
  let disposed = false;
  let pose: ReturnType<typeof mountNavigationPose> | undefined;
  const action = bindAdaAction(
    {
      click: {
        availability: () =>
          button.disabled || button.closest("[hidden], [inert]")
            ? { kind: "omitted" }
            : { kind: "available" },
        run: () => {
          pose?.rest();
          activate();
        },
      },
      current: () => !disposed && button.isConnected && (options.current?.(button) ?? true),
      nativeClickOwner: "factory",
      slopPx: () => SCROLL.dragThreshold * readViewUnit(button),
    },
    button,
  );
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    action.dispose();
    kit.dispose();
    pose?.dispose();
  };
  try {
    assertAdaActionMetadata(button);
    root.append(button);
    assertAdaActionBindings(button);
    pose = mountNavigationPose(button);
  } catch (error) {
    dispose();
    button.remove();
    throw error;
  }
  return {
    activate: action.activate,
    button,
    dispose,
    setMode(mode: "pause" | "menu", label: string) {
      if (disposed || !button.isConnected || !root.contains(button)) {
        return;
      }
      button.dataset.navigation = mode;
      button.dataset.action = mode;
      button.setAttribute("aria-label", label);
      button.title = label;
    },
    setPressed(pressed: boolean) {
      if (disposed) {
        return;
      }
      if (pressed) {
        pose?.press();
      } else {
        pose?.rest();
      }
    },
  };
}
