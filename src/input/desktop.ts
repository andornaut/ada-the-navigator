import type { Vector } from "./state.ts";

export const DESKTOP_SHIFT_THROTTLE = 0.2;

/** Desktop directions are measured in logical screen coordinates, before world projection. */
export interface DesktopFrame {
  readonly ship: Vector;
}

export interface DesktopSample {
  readonly aim: Vector;
  readonly fire: boolean;
  readonly move: Vector;
  readonly turn: -1 | 0 | 1;
}

export const DESKTOP_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Enter",
  "KeyA",
  "KeyD",
  "KeyE",
  "KeyF",
  "KeyH",
  "KeyL",
  "KeyS",
  "KeyW",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);
const USE_KEYS = new Set(["Enter", "KeyE", "KeyF"]);

const zero = (): Vector => ({ x: 0, y: 0 });
const unit = (vector: Vector): Vector => {
  const length = Math.hypot(vector.x, vector.y);
  return length ? { x: vector.x / length, y: vector.y / length } : zero();
};

/** The existing modal gate controls admission; callers reset on focus, mode and modal changes. */
export class DesktopControlState {
  private readonly accepts: () => boolean;
  private readonly keys = new Set<string>();
  private readonly buttons = new Set<number>();
  private pointer: { readonly id: number; readonly position: Vector } | undefined;
  private pendingAim: Vector | undefined;
  private pendingNoseFire = false;

  constructor(accepts: () => boolean) {
    this.accepts = accepts;
  }

  keyDown(code: string, repeat = false): boolean {
    if (!this.accepts() || !DESKTOP_KEYS.has(code) || this.keys.has(code) || repeat) {
      return false;
    }
    this.keys.add(code);
    if (code === "Space") {
      this.pendingNoseFire = true;
    }
    return true;
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  down(button: number, pointerId: number, point: Vector): boolean {
    if (
      !this.accepts() ||
      (button !== 0 && button !== 2) ||
      this.buttons.has(button) ||
      (this.pointer && this.pointer.id !== pointerId)
    ) {
      return false;
    }
    const position = { ...point };
    this.pointer = { id: pointerId, position };
    this.buttons.add(button);
    if (button === 0) {
      this.pendingAim = position;
    }
    return true;
  }

  move(pointerId: number, point: Vector): void {
    if (this.accepts() && this.pointer?.id === pointerId) {
      this.pointer = { id: pointerId, position: { ...point } };
    }
  }

  up(button: number, pointerId: number): void {
    if (this.pointer?.id !== pointerId) {
      return;
    }
    this.buttons.delete(button);
    if (!this.buttons.size) {
      this.pointer = undefined;
    }
  }

  reset(): void {
    this.keys.clear();
    this.buttons.clear();
    this.pointer = undefined;
    this.pendingAim = undefined;
    this.pendingNoseFire = false;
  }

  sample(frame: DesktopFrame): DesktopSample {
    if (!this.accepts()) {
      return { aim: zero(), fire: false, move: zero(), turn: 0 };
    }
    // A press released before sampling retains its target for one update. Held fire follows
    // the latest pointer and uses the same equipped-weapon cadence as a short press.
    const pointer = this.buttons.has(0) ? this.pointer?.position : this.pendingAim;
    const fire = pointer !== undefined || this.keys.has("Space") || this.pendingNoseFire;
    this.pendingAim = undefined;
    this.pendingNoseFire = false;
    const offset = pointer ? { x: pointer.x - frame.ship.x, y: pointer.y - frame.ship.y } : zero();
    const slow = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = slow ? DESKTOP_SHIFT_THROTTLE : 1;
    const west = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const east = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const north = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const south = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    const move = unit({ x: Number(east) - Number(west), y: Number(south) - Number(north) });
    const left = this.keys.has("KeyH");
    const right = this.keys.has("KeyL");
    const turn = left === right ? 0 : right ? 1 : -1;
    return {
      aim: unit(offset),
      fire,
      move: { x: move.x * speed, y: move.y * speed },
      turn,
    };
  }
}

export interface DesktopBindingOptions {
  readonly accepts: () => boolean;
  readonly acceptsPointer?: (event: MouseEvent) => boolean;
  readonly onModeChange?: (desktop: boolean) => void;
  readonly onUse?: () => void;
  readonly point: (event: MouseEvent) => Vector;
  readonly surface: HTMLElement;
}

export interface DesktopBinding {
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
    if (
      pointerType !== "mouse" ||
      !onSurface(event) ||
      !options.accepts() ||
      (event.button !== 0 && event.button !== 2) ||
      options.acceptsPointer?.(event) === false
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    if (state.down(event.button, 0, options.point(event)) && event.button === 2) {
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
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      !options.accepts() ||
      !DESKTOP_KEYS.has(event.code) ||
      onControl(event.target)
    ) {
      return;
    }
    event.preventDefault();
    mode(true);
    const fresh = state.keyDown(event.code, event.repeat);
    if (fresh && USE_KEYS.has(event.code)) {
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
