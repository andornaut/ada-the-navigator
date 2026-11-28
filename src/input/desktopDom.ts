import {
  acceptsDesktopKeyDown,
  DESKTOP_FLIGHT_BINDINGS,
  type DesktopControlState,
  flightBindings,
} from "./desktop.ts";
import type { Vector } from "./state.ts";

interface DesktopBindingOptions {
  readonly accepts: () => boolean;
  readonly acceptsPointer?: (event: MouseEvent) => boolean;
  readonly onModeChange?: (desktop: boolean) => void;
  readonly onUse?: () => void;
  readonly point: (event: MouseEvent) => Vector;
  readonly surface: HTMLElement;
}

interface DesktopBinding {
  readonly active: () => boolean;
  readonly dispose: () => void;
  readonly touchActive: () => boolean;
}

/** Mouse gestures start on the game surface; page controls and native touch keep their inputs. */
export function bindDesktopInput(
  options: DesktopBindingOptions,
  state: DesktopControlState,
): DesktopBinding {
  const { surface } = options;
  const host = surface.ownerDocument.defaultView;
  if (!host) {
    throw new Error("Desktop controls require a mounted surface");
  }
  const document = surface.ownerDocument;
  let desktop = false;
  let pointerType = "mouse";
  let touched = false;
  const mode = (active: boolean) => {
    if (active) {
      touched = false;
    }
    if (desktop !== active) {
      desktop = active;
      state.reset();
      options.onModeChange?.(active);
    }
  };
  const onSurface = (event: Event) => event.target === surface;
  const onControl = (target: EventTarget | null) =>
    target instanceof Element &&
    Boolean(
      target.closest(
        "button,a,input,textarea,select,[role=button],[contenteditable]:not([contenteditable=false])",
      ),
    );
  const pointerDown = (event: PointerEvent) => {
    pointerType = event.pointerType;
    if (event.pointerType !== "mouse" && onSurface(event) && options.accepts()) {
      mode(false);
      touched = true;
    }
  };
  const down = (event: MouseEvent) => {
    // Phaser prevents the canvas mousedown default before it reaches the window.
    const binding = flightBindings.mouseButtons.get(event.button);
    if (
      pointerType !== "mouse" ||
      !onSurface(event) ||
      !options.accepts() ||
      binding === undefined ||
      options.acceptsPointer?.(event) === false
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    if (
      state.down(event.button, 0, options.point(event)) &&
      binding === DESKTOP_FLIGHT_BINDINGS.use
    ) {
      options.onUse?.();
    }
  };
  const move = (event: MouseEvent) => {
    if (desktop && options.accepts()) {
      state.move(0, options.point(event));
    }
  };
  const up = (event: MouseEvent) => state.up(event.button, 0);
  const keyDown = (event: KeyboardEvent) => {
    const binding = flightBindings.keys.get(event.code);
    if (
      !acceptsDesktopKeyDown(event) ||
      !options.accepts() ||
      binding === undefined ||
      onControl(event.target)
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    const fresh = state.keyDown(event.code, event.repeat);
    if (fresh && binding === DESKTOP_FLIGHT_BINDINGS.use) {
      options.onUse?.();
    }
  };
  const keyUp = (event: KeyboardEvent) => state.keyUp(event.code);
  const contextMenu = (event: MouseEvent) => {
    if (onSurface(event) && options.accepts()) {
      event.preventDefault();
    }
  };
  const reset = () => state.reset();
  const visibility = () => {
    if (document.hidden) {
      reset();
    }
  };
  host.addEventListener("pointerdown", pointerDown);
  host.addEventListener("pointercancel", reset);
  host.addEventListener("mousedown", down);
  host.addEventListener("mousemove", move);
  host.addEventListener("mouseup", up);
  host.addEventListener("keydown", keyDown);
  host.addEventListener("keyup", keyUp);
  host.addEventListener("contextmenu", contextMenu);
  host.addEventListener("blur", reset);
  host.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", visibility);
  return {
    active: () => desktop,
    dispose() {
      reset();
      host.removeEventListener("pointerdown", pointerDown);
      host.removeEventListener("pointercancel", reset);
      host.removeEventListener("mousedown", down);
      host.removeEventListener("mousemove", move);
      host.removeEventListener("mouseup", up);
      host.removeEventListener("keydown", keyDown);
      host.removeEventListener("keyup", keyUp);
      host.removeEventListener("contextmenu", contextMenu);
      host.removeEventListener("blur", reset);
      host.removeEventListener("pagehide", reset);
      document.removeEventListener("visibilitychange", visibility);
    },
    touchActive: () => touched && !desktop,
  };
}
